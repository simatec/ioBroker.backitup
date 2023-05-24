const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');

function replayInfuxDB(options, tmpDir, log, callback) {
    const { exec } = require('child_process');

    let dbName = options.dbName;

    if (options.influxDBMulti === true && fs.existsSync(tmpDir)) {
        const files = fs.readdirSync(tmpDir);

        try {
            files.forEach(function (file) {
                const currentFiletype = file.split('.').pop();

                if (currentFiletype == 'manifest') {
                    const manifest = fs.readFileSync(path.join(tmpDir, file).replace(/\\/g, '/'));
                    const json = JSON.parse(manifest);

                    options.dbversion = json.files ? '1.x' : json.buckets ? '2.x' : options.dbversion;
                    dbName = options.dbversion == '1.x' ? json.files[0].database : options.dbversion == '2.x' ? json.buckets.bucketName : options.dbName;
                }
            });
        } catch (err) {
            log.error(`manifest is broken: ${err}`)
        }

        try {
            for (let i = 0; i < options.influxDBEvents.length; i++) {
                if (options.influxDBEvents[i].dbName == dbName) {
                    options.port = options.influxDBEvents[i].port ? options.influxDBEvents[i].port : '';
                    options.host = options.influxDBEvents[i].host ? options.influxDBEvents[i].host : '';
                    options.dbName = options.influxDBEvents[i].dbName ? options.influxDBEvents[i].dbName : '';
                    options.nameSuffix = options.influxDBEvents[i].nameSuffix ? options.influxDBEvents[i].nameSuffix : '';
                    options.token = options.influxDBEvents[i].token ? options.influxDBEvents[i].token : '';
                    options.dbversion = options.influxDBEvents[i].dbversion ? options.influxDBEvents[i].dbversion : '';
                    options.protocol = options.influxDBEvents[i].protocol ? options.influxDBEvents[i].protocol : '';
                }
            }
        } catch (err) {
            log.error(`InfluxDB config not found: ${err}`)
        }
    }

    const cmdDelete = `influx -execute='DROP DATABASE ${dbName}'`;
    let cmd;

    if (options.dbversion == '1.x') {
        cmd = `${options.exe ? `"${options.exe}"` : 'influxd'} restore -portable -db ${dbName}${options.dbType == 'remote' ? ` -host ${options.host}:${options.port}` : ''} "${tmpDir}"`;
    } else if (options.dbversion == '2.x') {
        cmd = `${options.exe ? `"${options.exe}"` : 'influx'} restore --bucket ${dbName}${options.dbType == 'remote' ? ` --host ${options.protocol}://${options.host}:${options.port}` : ''} -t ${options.token} "${tmpDir}"`;
    }

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