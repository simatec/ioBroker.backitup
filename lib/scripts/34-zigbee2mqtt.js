'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');
const fse = require('fs-extra');

async function command(options, log, callback) {
    const nameSuffix = options.hostType == 'Slave' && options.slaveSuffix ? options.slaveSuffix : options.hostType !== 'Slave' && options.nameSuffix ? options.nameSuffix : '';
    const fileName = path.join(options.backupDir, `zigbee2mqtt_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
    const sourcePth = path.join(options.path).replace(/\\/g, '/');
    const tmpDir = path.join(options.backupDir, 'zigbee2mqtt_tmp').replace(/\\/g, '/');

    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    let pth;

    if (fs.existsSync(sourcePth)) {
        const stat = fs.statSync(sourcePth);
        if (!stat.isDirectory()) {
            const parts = sourcePth.replace(/\\/g, '/').split('/');
            pth = parts.join('/');
        } else {
            pth = sourcePth;
        }
    }

    const desiredMode = {
        mode: 0o2775
    };

    if (!fs.existsSync(tmpDir)) {
        try {
            await fse.ensureDir(tmpDir, desiredMode);
            log.debug('Created zigbee2mqtt directory');
        } catch (err) {
            log.debug(`zigbee2mqtt tmp directory "${tmpDir}" cannot created`);
        }
    } else {
        log.debug(`Try deleting the old zigbee2mqtt tmp directory: "${tmpDir}"`);
        try {
            await fse.remove(tmpDir);
        } catch (err) {
            log.debug(`old zigbee2mqtt tmp directory "${tmpDir}" cannot deleted`);
        }
        if (!fs.existsSync(tmpDir)) {
            log.debug(`old zigbee2mqtt tmp directory "${tmpDir}" successfully deleted`);
            try {
                await fse.ensureDir(tmpDir, desiredMode);
                log.debug('Created new zigbee2mqtt directory');
            } catch (err) {
                log.debug(`zigbee2mqtt tmp directory "${tmpDir}" cannot created`);
            }
        }
    }

    log.debug('compress from Zigbee2MQTT started ...');

    try {
        await tmpCopy(pth, tmpDir, log);
        await compressBackupFile(fileName, tmpDir, log, callback);
    } catch (err) {
        clearInterval(timer);
        options.context.errors.zigbee2mqtt = err.toString();
        log.error(err);
        await delTmp(tmpDir, log);

        if (callback) {
            callback(null);
            callback = null;
        }
    }

    clearInterval(timer);
    options.context.done.push('zigbee2mqtt');
    options.context.types.push('zigbee2mqtt');

    await delTmp(tmpDir, log);

    if (callback) {
        callback(null);
        callback = null;
    }
}

async function delTmp(tmpDir, log) {
    return new Promise(async (resolve, reject) => {
        log.debug(`Try deleting the old zigbee2mqtt tmp directory: "${tmpDir}"`);

        await fse.remove(tmpDir)
            .then(() => {
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`zigbee2mqtt tmp directory "${tmpDir}" successfully deleted`);
                }
                resolve();
            })
            .catch(err => {
                options.context.errors.zigbee2mqtt = JSON.stringify(err);
                log.debug(`zigbee2mqtt tmp directory "${tmpDir}" cannot deleted`);
                reject(err);
            });
    });
}

async function tmpCopy(pth, tmpDir, log) {
    return new Promise(async (resolve, reject) => {
        await fse.copy(pth, tmpDir, {
            filter: path => {
                return !(path.indexOf('log') > -1)
            }
        }).then(() => {
            log.debug('Zigbee2MQTT tmp copy finish');
            resolve();
        }).catch(err => {
            reject(err);
        });
    });
}

async function compressBackupFile(fileName, tmpDir, log, callback) {
    return new Promise(async (resolve, reject) => {
        const compress = require('../targz').compress;

        compress({
            src: tmpDir,
            dest: fileName,
        }, async (err, stderr) => {
            if (err) {
                options.context.errors.zigbee2mqtt = err.toString();
                stderr && log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                    reject();
                }
            } else {
                log.debug(`Backup created: ${fileName}`);
                resolve();
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};