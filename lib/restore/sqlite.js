const fs = require('fs');
const path = require('path');

function replaySqlite(options, fileNameSQlite, log, callback) {
    const { exec } = require('child_process');

    if (options && options.filePth && fs.existsSync(options.filePth)) {
        try {
            fs.unlinkSync(options.filePth);
            log.debug('old sqlite db deleted!');
        } catch (e) {
            log.debug('sqlite db cannot deleted: ' + e);
            callback && callback(err);
        }
    }

    const cmdRestore = `${options.exe ? options.exe : 'sqlite3'} ${options.filePth} < ${fileNameSQlite}`;

    try {
        exec(cmdRestore, (error, stdout, stderr) => {
            if (error) log.error(stderr);
            return callback && callback(error);
        });
    } catch (e) {
        // ignore errors
    }
}

function restore(options, fileName, log, adapter, callback) {
    const fileNameSQlite = path.join(options.backupDir, `sqlite_restore_backupiobroker.sql`);
    log.debug('Start sqlite Restore ...');

    // stop sql-Adapter before Restore
    let startAfterRestore = false;
    let enabledInstances = [];

    adapter.getObjectView('system', 'instance', { startkey: 'system.adapter.sql.', endkey: 'system.adapter.sql.\u9999' }, async (err, instances) => {
        let resultInstances = [];
        if (!err && instances && instances.rows) {
            instances.rows.forEach(row => {
                resultInstances.push({ id: row.id.replace('system.adapter.', ''), config: row.value.native.type })
            });
            for (let i = 0; i < resultInstances.length; i++) {
                let _id = resultInstances[i].id;
                // Stop sql Instances
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
            log.debug('Could not retrieve sql instances!');
        }
    });

    let timer = setInterval(() => {
        if (fs.existsSync(fileNameSQlite)) {
            const stats = fs.statSync(fileNameSQlite);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug(`Extract sqlite Backupfile ${fileSize}MB so far...`);
        } else {
            log.debug(`Something is wrong with "${fileNameSQlite}".`);
        }
    }, 10000);

    const decompress = require('../targz').decompress;

    try {
        decompress({
            src: fileName,
            dest: options.backupDir,
            tar: {
                map: header => {
                    header.name = `sqlite_restore_backupiobroker.sql`;
                    return header;
                }
            }
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('sqlite Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                replaySqlite(options, fileNameSQlite, log, err => {
                    // Start sql Instances
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
                    // delete sqlite file
                    if (fs.existsSync(fileNameSQlite)) {
                        try {
                            fs.unlinkSync(fileNameSQlite);
                        } catch (e) {
                            log.debug(fileNameSQlite + ' cannot deleted ...');
                        }
                    }
                    if (callback) {
                        log.debug('sqlite Restore completed successfully');
                        callback(null, 'sqlite restore done');
                        callback = null;
                    }
                });
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