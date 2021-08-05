const fs = require('fs');

function restore(options, fileName, log, adapter, callback) {

    log.debug('Start History Restore ...');

    // stop history-Adapter before Restore
    let startAfterRestore = false;
    let enabledInstances = [];

    adapter.getObjectView('system', 'instance', { startkey: 'system.adapter.history.', endkey: 'system.adapter.history.\u9999' }, async (err, instances) => {
        let resultInstances = [];
        if (!err && instances && instances.rows) {
            instances.rows.forEach(row => {
                resultInstances.push({ id: row.id.replace('system.adapter.', ''), config: row.value.native.type })
            });
            for (let i = 0; i < resultInstances.length; i++) {
                let _id = resultInstances[i].id;
                // Stop history Instances
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
            log.debug('Could not retrieve history instances!');
        }
    });

    let timer = setInterval(() => {
        if (fs.existsSync(options.path)) {
            log.debug('Extracting History Backupfile...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 10000);

    const decompress = require('../targz').decompress;

    try {
        decompress({
            src: fileName,
            dest: options.path,
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('History Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    // Start history Instances
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
                    log.debug('History Restore completed successfully');
                    callback(null, 'historyDB restore done');
                    callback = null;
                }
            }
        });
    } catch (e) {
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