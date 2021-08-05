
const fs = require('fs');
const path = require('path');

let waitRestore;
let timerDone;

function restore(options, fileName, log, adapter, callback) {

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
                adapter.getForeignObject(`system.adapter.${_id}`, function (err, obj) {
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

    try {
        log.debug('decompress started ...');

        const decompress = require('../targz').decompress;

        waitRestore = setTimeout(() =>
            decompress({
                src: fileName,
                dest: options.filePath,
            }, (err, stdout, stderr) => {
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
                    try {
                        fs.readdir(options.filePath, (err, files) => {
                            if (files) {
                                files.forEach(file => {
                                    let newModifiedTime = new Date();
                                    let newAccessTime = new Date();
                                    try {
                                        fs.chmodSync(path.join(options.filePath, file), '0775');
                                        fs.utimesSync(path.join(options.filePath, file), newAccessTime, newModifiedTime);
                                    } catch (err) {
                                        log.debug(`File permission and timestamp for ${path.join(options.filePath, file)} cannot be set`);
                                    }
                                });
                            }
                        });
                    } catch (err) {
                        log.debug('Javascript mirror path cannot be read: ' + err);
                    }

                    if (callback) {
                        // Start javascript Instances
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
                        timerDone = setTimeout(function () {
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

module.exports = {
    restore,
    isStop: false
};