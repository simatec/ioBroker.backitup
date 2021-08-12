const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');

function replayInfuxDB(options, tmpDir, log, callback) {
    const { exec } = require('child_process');

    const cmdDelete = `influx -execute='DROP DATABASE ${options.dbName}'`;

    const cmd = `${options.exe ? `"${options.exe}"` : 'influxd'} restore -portable -db ${options.dbName}${options.dbType == 'remote' ? ` -host ${options.host}:${options.port}` : ''} "${tmpDir}"`;

    if (options.deleteDatabase && options.dbType == 'local') {
        try {
            exec(cmdDelete, (error, stdout, stderr) => {
                log.debug(stdout);

                const child = exec(cmd, (error, stdout, stderr) => {
                    if (error) log.error(stderr);
                    return callback && callback(error);
                });
            });
        } catch (e) {
            callback && callback(e);
        }
    } else {
        try {
            const child = exec(cmd, (error, stdout, stderr) => {
                if (error) log.error(stderr);
                return callback && callback(error);
            });
        } catch (e) {
            callback && callback(e);
        }
    }
}

function restore(options, fileName, log, adapter, callback) {
    const tmpDir = path.join(options.backupDir, 'influxDBtmp').replace(/\\/g, '/');

    // stop influxdb-Adapter before Restore
    let startAfterRestore = false;
    let enabledInstances = [];

    adapter.getObjectView('system', 'instance', { startkey: 'system.adapter.influxdb.', endkey: 'system.adapter.influxdb.\u9999' }, async (err, instances) => {
        let resultInstances = [];
        if (!err && instances && instances.rows) {
            instances.rows.forEach(row => {
                resultInstances.push({ id: row.id.replace('system.adapter.', ''), config: row.value.native.type })
            });
            for (let i = 0; i < resultInstances.length; i++) {
                let _id = resultInstances[i].id;
                // Stop influxdb Instances
                adapter.getForeignObject(`system.adapter.${_id}`, function (err, obj) {
                    if (obj && obj != null && obj.common.enabled == true) {
                        adapter.setForeignState(`system.adapter.${_id}.alive`, false);
                        log.debug(`${_id} is stopped`);
                        enabledInstances.push(_id);
                        startAfterRestore = true;
                    }
                });
            }
        }
        else {
            log.debug('Could not retrieve influxdb instances!');
        }
    });

    const desiredMode = '0o2775';

    if (!fs.existsSync(tmpDir)) {

        fse.ensureDirSync(tmpDir, desiredMode);
        //fs.mkdirSync(tmpDir);
        log.debug('Created tmp directory');
    } else {
        try {
            log.debug('Try deleting the old InfluxDB tmp directory');
            fse.removeSync(tmpDir);
            if (!fs.existsSync(tmpDir)) {
                log.debug('InfluxDB old tmp directory was successfully deleted');
            }
            fse.ensureDirSync(tmpDir, desiredMode);
            //fs.mkdirSync(tmpDir);
            log.debug('Created tmp directory');
        } catch (e) {
            log.debug('InfluxDB old tmp directory could not be deleted: ' + e);
        }
    }
    log.debug('Start infuxDB Restore ...');

    const decompress = require('../targz').decompress;

    try {
        decompress({
            src: fileName,
            dest: tmpDir,
        }, (err, stdout, stderr) => {
            if (err) {
                log.error(err);
                if (callback) {
                    log.error('infuxDB Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    replayInfuxDB(options, tmpDir, log, err => {
                        // Start infuxdb Instances
                        if (startAfterRestore) {
                            enabledInstances.forEach(enabledInstance => {
                                adapter.getForeignObject(`system.adapter.${enabledInstance}`, function (err, obj) {
                                    if (obj && obj != null && obj.common.enabled == false) {
                                        adapter.setForeignState(`system.adapter.${enabledInstance}.alive`, true);
                                        log.debug(`${enabledInstance} started`);
                                    }
                                });
                            });
                        }
                        // delete infuxDB tmpDir
                        if (fs.existsSync(tmpDir)) {
                            try {
                                log.debug('Try deleting the InfluxDB tmp directory');
                                fse.removeSync(tmpDir);
                                if (!fs.existsSync(tmpDir)) {
                                    log.debug('InfluxDB tmp directory was successfully deleted');
                                }
                            } catch (e) {
                                log.debug('InfluxDB tmp directory could not be deleted: ' + e);
                            }
                        }
                        log.debug('infuxDB Restore completed successfully');
                        callback && callback(null, 'influxDB restore done');
                        callback = null;
                    });
                }
            }
        });
    } catch (err) {
        if (callback) {
            callback(err);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: false
};