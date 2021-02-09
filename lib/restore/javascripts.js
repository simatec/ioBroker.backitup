const fs = require('fs');
const targz = require('targz');

function restore(options, fileName, log, adapter, callback) {

    log.debug('Start Javascript Restore ...');
    let timer = setInterval(() => {
        if (fs.existsSync(options.filePath))  {
            log.debug('Extracting Javascript Backupfile...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 5000);
    /*
    // stop Javascript-Adapter before Restore
    let startAfterRestore = false;
    let enabledInstances = [];
    
    adapter.getObjectView('system', 'instance', { startkey: 'system.adapter.javascript.', endkey: 'system.adapter.javascript.\u9999' },async (err, instances) => {
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
                        log.debug('enabledInstances: ' + enabledInstances)
                        startAfterRestore = true;
                    }
                });
            }
        }
        else {
            log.debug('Could not retrieve javascript instances!');
        }
    });
    */

    try {
        targz.decompress({
            src: fileName,
            dest: options.filePath,
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('Javascript Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    /*
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
                    */
                    log.debug('Javascript Restore completed successfully');
                    callback(null, 'javascript restore done');
                    callback(null, stdout);
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