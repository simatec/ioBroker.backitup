
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const fs_async = require('fs').promises;

let waitRestore;
let timerDone;

async function restore(options, fileName, log, adapter, callback) {

    log.debug('Start Javascript Restore ...');

    // stop Javascript-Adapter before Restore
    let startAfterRestore = false;
    let enabledInstances = [];

    adapter.getObjectView('system', 'instance', { startkey: 'system.adapter.javascript.', endkey: 'system.adapter.javascript.\u9999' }, async (err, instances) => {
        let resultInstances = [];
        if (!err && instances && instances.rows) {
            instances.rows.forEach(row => {
                resultInstances.push({ id: row.id.replace('system.adapter.', ''), config: row.value.native.type })
            });
            for (let i = 0; i < resultInstances.length; i++) {
                let _id = resultInstances[i].id;
                // Stop Javascript Instances
                adapter.getForeignObject(`system.adapter.${_id}`, async function (err, obj) {
                    if (obj && obj != null && obj.common.enabled == true) {
                        adapter.setForeignState(`system.adapter.${_id}.alive`, false);
                        log.debug(`${_id} is stopped`);
                        enabledInstances.push(_id);
                        log.debug('enabled Instances: ' + enabledInstances)
                        startAfterRestore = true;
                    }
                });
            }
        }
        else {
            log.debug('Could not retrieve javascript instances!');
        }
    });
    const tmpDir = path.join(options.backupDir, 'tmpScripts').replace(/\\/g, '/');
    const desiredMode = '0o2775';
    if (!fs.existsSync(tmpDir)) {
        try {
            fse.ensureDirSync(tmpDir, desiredMode);
            log.debug(`Created javascript_tmp directory: "${tmpDir}"`);
        } catch (err) {
            log.debug(`Javascript tmp directory "${tmpDir}" cannot created ... ${err}`);
        }
    } else {
        try {
            log.debug(`Try deleting the old javascript_tmp directory: "${tmpDir}"`);
            fse.removeSync(tmpDir);
        } catch (err) {
            log.debug(`Javascript tmp directory "${tmpDir}" cannot deleted ... ${err}`);
        }
        if (!fs.existsSync(tmpDir)) {
            try {
                log.debug(`old javascript_tmp directory "${tmpDir}" successfully deleted`);
                fse.ensureDirSync(tmpDir, desiredMode);
                log.debug('Created javascript_tmp directory');
            } catch (err) {
                log.debug(`Javascript tmp directory "${tmpDir}" cannot created ... ${err}`);
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
                        log.error('Javascript Restore not completed');
                        callback(err, stderr);
                        callback = null;
                        clearTimeout(timerDone);
                        clearTimeout(waitRestore);
                    }
                } else {
                    await restoreJavascriptObjects(tmpDir, adapter, log);

                    try {
                        log.debug(`Try deleting the Javascript tmp directory: "${tmpDir}"`);
                        fse.removeSync(tmpDir);
                        if (!fs.existsSync(tmpDir)) {
                            log.debug(`Javascript tmp directory "${tmpDir}" successfully deleted`);
                        }
                    } catch (err) {
                        log.debug(`Javascript tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                    }

                    if (callback) {
                        // Start javascript Instances
                        if (startAfterRestore) {
                            enabledInstances.forEach(enabledInstance => {
                                adapter.getForeignObject(`system.adapter.${enabledInstance}`, async (err, obj) => {
                                    if (obj && obj != null && obj.common.enabled == false) {
                                        adapter.setForeignState(`system.adapter.${enabledInstance}.alive`, true);
                                        log.debug(`${enabledInstance} started`);
                                    }
                                });
                            });
                        }
                        timerDone = setTimeout(async () => {
                            log.debug('Javascript Restore completed successfully');
                            callback(null, 'javascript restore done');
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

async function restoreJavascriptObjects(tmpDir, adapter, log) {
    return new Promise(async (resolve) => {
        try {
            const object = await fs_async.readFile(path.join(tmpDir, 'script.json'));

            if (object) {
                const jsObjects = JSON.parse(object);

                for (const i in jsObjects) {
                    let _object;
                    try {
                        _object = await adapter.getObjectAsync(jsObjects[i]._id);
                    } catch (err) {
                        log.debug(err);
                    }
                    if (_object) {
                        try {
                            await adapter.setForeignObjectAsync(jsObjects[i]._id, jsObjects[i]);
                            log.debug('Restore Script: ' + jsObjects[i]._id.split('.').pop());
                        } catch (err) {
                            log.debug(`Error on set Object: ${err}`);
                        }
                    } else {
                        try {
                            await adapter.setForeignObjectNotExistsAsync(jsObjects[i]._id, jsObjects[i]);
                            log.debug('Restore Script: ' + jsObjects[i]._id.split('.').pop());
                        } catch (err) {
                            log.debug(`Error on create Object: ${err}`);

                        }
                    }
                }
            }
        } catch (err) {
            log.debug(`Error on Javascript-Restore: ${err}`);
        }
        resolve();
    });
}

module.exports = {
    restore,
    isStop: false
};