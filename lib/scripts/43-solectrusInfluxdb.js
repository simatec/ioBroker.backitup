'use strict';
const fs = require('node:fs');
const getDate = require('../tools').getDate;
const path = require('node:path');
const fse = require('fs-extra');
const fs_async = require('node:fs').promises;

let timerLog;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        timerLog = setTimeout(async () => resolve(), ms);
    });
}

async function command(options, log, callback) {
    let nameSuffix;
    if (options.hostType === 'Slave') {
        nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
    } else {
        nameSuffix = options.nameSuffix ? options.nameSuffix : '';
    }
    const fileName = path.join(options.backupDir, `solectrusInfluxdb_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`);

    options.context.fileNames.push(fileName);

    let timer = setInterval(async () => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug(`Packed ${fileSize}MB so far...`);
        }
    }, 5000);

    const tmpDir = path.join(options.backupDir, 'tmpSolectrusInfluxdb').replace(/\\/g, '/');
    const desiredMode = '0o2775';
    if (!fs.existsSync(tmpDir)) {
        try {
            fse.ensureDirSync(tmpDir, desiredMode);
            log.debug(`Created solectrusInfluxdb_tmp directory: "${tmpDir}"`);
        } catch (err) {
            log.warn(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot created ... ${err}`);
        }
    } else {
        try {
            log.debug(`Try deleting the old solectrusInfluxdb_tmp directory: "${tmpDir}"`);
            fse.removeSync(tmpDir);
        } catch (err) {
            log.warn(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot deleted ... ${err}`);
        }
        if (!fs.existsSync(tmpDir)) {
            try {
                log.debug(`old solectrusInfluxdb_tmp directory "${tmpDir}" successfully deleted`);
                fse.ensureDirSync(tmpDir, desiredMode);
                log.debug('Created solectrusInfluxdb_tmp directory');
            } catch (err) {
                log.warn(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot created ... ${err}`);
            }
        }
    }

    // data objects (folders/channels and created data points, including the formulas of calculated items)
    const dataObj = await options.adapter.getForeignObjectsAsync('solectrus-influxdb.*');

    // instance object(s) (adapter configuration/native settings)
    // Note: a wildcard fetch on "system.adapter.solectrus-influxdb.*" only returns the auto-generated
    // monitoring states (.alive, .cpu, .memHeapUsed, ...), not the instance object itself, so the
    // instances have to be looked up explicitly via the "instance" object view and fetched by exact id.
    const instanceObj = {};
    try {
        const instances = await options.adapter.getObjectViewAsync('system', 'instance', {
            startkey: 'system.adapter.solectrus-influxdb.',
            endkey: 'system.adapter.solectrus-influxdb.香',
        });
        if (instances && instances.rows) {
            for (const row of instances.rows) {
                const instanceObject = await options.adapter.getForeignObjectAsync(row.id);
                if (instanceObject) {
                    instanceObj[row.id] = instanceObject;
                }
            }
        }
    } catch (e) {
        log.warn(`Could not read SOLECTRUS InfluxDB instance object(s): ${e}`);
    }

    const obj = Object.assign({}, dataObj, instanceObj);

    log.debug(`found ${Object.keys(dataObj || {}).length} SOLECTRUS InfluxDB data object(s) and ${Object.keys(instanceObj).length} instance object(s)`);

    if (obj && Object.keys(obj).length) {
        try {
            await fs_async.writeFile(path.join(tmpDir, 'solectrusInfluxdb.json'), JSON.stringify(obj, null, 2));
        } catch (e) {
            log.error(`solectrusInfluxdb.json cannot be written: ${e}`);
        }

        for (const i in obj) {
            log.debug(`found SOLECTRUS InfluxDB object: ${obj[i]._id}`);
            await sleep(150);
        }
    } else {
        log.warn('No SOLECTRUS InfluxDB data found');
    }

    if (fs.existsSync(tmpDir) && obj && Object.keys(obj).length) {

        const compress = require('../targz').compress;

        compress({
            src: tmpDir,
            dest: fileName,
            tar: {
                ignore: name => path.extname(name) === '.gz' || path.extname(name) === '.sbk', // ignore .tar.gz and tar.sbk files when packing
            }
        }, async (err, stdout, stderr) => {
            clearInterval(timer);

            try {

                log.debug(`Try deleting the SOLECTRUS InfluxDB tmp directory: "${tmpDir}"`);
                fse.removeSync(tmpDir);
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" successfully deleted`);
                }
            } catch (err) {
                log.warn(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot deleted ... ${err}`);
            }
            if (err) {
                options.context.errors.solectrusInfluxdb = err.toString();
                stderr && log.error(stderr);
                clearTimeout(timerLog);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                log.debug(`Backup created: ${fileName}`);
                options.context.done.push('solectrusInfluxdb');
                options.context.types.push('solectrusInfluxdb');
                clearTimeout(timerLog);
                if (callback) {
                    callback(null, stdout);
                    callback = null;
                }
            }
        });
    } else {
        log.warn('SOLECTRUS InfluxDB Backup not created');
        clearInterval(timer);
        clearTimeout(timerLog);
        callback && callback(null);
        callback = null;
    }
}

module.exports = {
    command,
    ignoreErrors: true
};
