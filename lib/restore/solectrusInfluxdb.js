const fs = require('node:fs');
const path = require('node:path');
const fse = require('fs-extra');
const fs_async = require('node:fs').promises;

let waitRestore;
let timerDone;

async function restore(options, fileName, log, adapter, callback) {
    log.debug('Start SOLECTRUS InfluxDB Restore ...');

    // stop solectrus-influxdb instances before Restore
    let startAfterRestore = false;
    let enabledInstances = [];

    adapter.getObjectView('system', 'instance', { startkey: 'system.adapter.solectrus-influxdb.', endkey: 'system.adapter.solectrus-influxdb.香' }, async (err, instances) => {
        let resultInstances = [];
        if (!err && instances && instances.rows) {
            instances.rows.forEach(row => {
                resultInstances.push({ id: row.id.replace('system.adapter.', ''), config: row.value.native.type })
            });
            for (let i = 0; i < resultInstances.length; i++) {
                let _id = resultInstances[i].id;
                // Stop solectrus-influxdb Instances
                adapter.getForeignObject(`system.adapter.${_id}`, async (err, obj) => {
                    if (obj?.common?.enabled) {
                        adapter.setForeignState(`system.adapter.${_id}.alive`, false);
                        log.debug(`${_id} is stopped`);
                        enabledInstances.push(_id);
                        log.debug(`enabled Instances: ${enabledInstances}`)
                        startAfterRestore = true;
                    }
                });
            }
        } else {
            log.debug('Could not retrieve solectrus-influxdb instances!');
        }
    });
    const tmpDir = path.join(options.backupDir, 'tmpSolectrusInfluxdb').replace(/\\/g, '/');
    const desiredMode = '0o2775';
    if (!fs.existsSync(tmpDir)) {
        try {
            fse.ensureDirSync(tmpDir, desiredMode);
            log.debug(`Created solectrusInfluxdb_tmp directory: "${tmpDir}"`);
        } catch (err) {
            log.debug(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot created ... ${err}`);
        }
    } else {
        try {
            log.debug(`Try deleting the old solectrusInfluxdb_tmp directory: "${tmpDir}"`);
            fse.removeSync(tmpDir);
        } catch (err) {
            log.debug(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot deleted ... ${err}`);
        }
        if (!fs.existsSync(tmpDir)) {
            try {
                log.debug(`old solectrusInfluxdb_tmp directory "${tmpDir}" successfully deleted`);
                fse.ensureDirSync(tmpDir, desiredMode);
                log.debug('Created solectrusInfluxdb_tmp directory');
            } catch (err) {
                log.debug(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot created ... ${err}`);
            }
        }
    }

    try {
        log.debug('decompress started ...');

        const decompress = require('../targz').decompress;

        waitRestore = setTimeout(() =>
            decompress({
                src: fileName,
                dest: tmpDir,
            }, async (err, stdout, stderr) => {
                if (err) {
                    log.error(err);
                    if (callback) {
                        log.error('SOLECTRUS InfluxDB Restore not completed');
                        callback(err, stderr);
                        callback = null;
                        clearTimeout(timerDone);
                        clearTimeout(waitRestore);
                    }
                } else {
                    await restoreSolectrusInfluxdbObjects(tmpDir, adapter, log);

                    try {
                        log.debug(`Try deleting the SOLECTRUS InfluxDB tmp directory: "${tmpDir}"`);
                        fse.removeSync(tmpDir);
                        if (!fs.existsSync(tmpDir)) {
                            log.debug(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" successfully deleted`);
                        }
                    } catch (err) {
                        log.debug(`SOLECTRUS InfluxDB tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                    }

                    if (callback) {
                        // Start solectrus-influxdb Instances
                        if (startAfterRestore) {
                            enabledInstances.forEach(enabledInstance => {
                                adapter.getForeignObject(`system.adapter.${enabledInstance}`, async (err, obj) => {
                                    if (obj && !obj.common?.enabled) {
                                        adapter.setForeignState(`system.adapter.${enabledInstance}.alive`, true);
                                        log.debug(`${enabledInstance} started`);
                                    }
                                });
                            });
                        }
                        timerDone = setTimeout(async () => {
                            log.debug('SOLECTRUS InfluxDB Restore completed successfully');
                            callback(null, 'solectrus-influxdb restore done');
                            callback(null);
                            callback = null;
                            clearTimeout(timerDone);
                            clearTimeout(waitRestore);
                        }, 2000);
                    }
                }
            }), 2000);
    } catch (e) {
        if (callback) {
            callback(e);
            callback = null;
            clearTimeout(timerDone);
            clearTimeout(waitRestore);
        }
    }

}

async function restoreSolectrusInfluxdbObjects(tmpDir, adapter, log) {
    return new Promise(async (resolve) => {
        try {
            const object = await fs_async.readFile(path.join(tmpDir, 'solectrusInfluxdb.json'));

            if (object) {
                const solectrusObjects = JSON.parse(object);

                for (const i in solectrusObjects) {
                    let _object;
                    try {
                        _object = await adapter.getForeignObjectAsync(solectrusObjects[i]._id);
                    } catch (err) {
                        log.debug(err);
                    }
                    if (_object) {
                        try {
                            // For the adapter instance object, only restore the configuration (native),
                            // keeping host/enabled/installedVersion etc. (common) as they are on this system
                            const isInstanceObject = solectrusObjects[i]._id.startsWith('system.adapter.');
                            const objectToSet = isInstanceObject
                                ? Object.assign({}, _object, { native: solectrusObjects[i].native })
                                : solectrusObjects[i];

                            await adapter.setForeignObjectAsync(solectrusObjects[i]._id, objectToSet);
                            const objectCheck = await adapter.getForeignObjectAsync(solectrusObjects[i]._id);

                            if (objectCheck) {
                                log.debug(`Restore SOLECTRUS InfluxDB Object: ${solectrusObjects[i]._id}`);
                            }
                        } catch (err) {
                            log.debug(`Error on set Object: ${err}`);
                        }
                    } else {
                        try {
                            await adapter.setForeignObjectNotExistsAsync(solectrusObjects[i]._id, solectrusObjects[i]);
                            const objectCheck = await adapter.getForeignObjectAsync(solectrusObjects[i]._id);

                            if (objectCheck) {
                                log.debug(`Added SOLECTRUS InfluxDB Object: ${solectrusObjects[i]._id}`);
                            }
                        } catch (err) {
                            log.debug(`Error on create Object: ${err}`);

                        }
                    }
                }
            }
        } catch (err) {
            log.debug(`Error on SOLECTRUS InfluxDB-Restore: ${err}`);
        }
        resolve();
    });
}

module.exports = {
    restore,
    isStop: false,
};
