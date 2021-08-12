const fs = require('fs');
const path = require('path');

function replayMySql(options, fileNameMysql, log, callback) {
    const { exec } = require('child_process');
    // create DB before executing script
    const cmdCreate = `mysql -u ${options.user} -p${options.pass} -h ${options.host} -P ${options.port} --execute='CREATE DATABASE IF NOT EXISTS ${options.dbName};'`;

    try {
        exec(cmdCreate, (error, stdout, stderr) => {
            const cmd = `mysql -u ${options.user} -p${options.pass} -h ${options.host} -P ${options.port} ${options.dbName} < ${fileNameMysql}`;

            try {
                const child = exec(cmd, (error, stdout, stderr) => {
                    if (error) log.error(stderr);
                    return callback && callback(error);
                });
            } catch (e) {
                callback && callback(e);
            }
        });
    } catch (e) {
        // ignore errors
    }
}

function restore(options, fileName, log, adapter, callback) {
    const fileNameMysql = path.join(options.backupDir, `mysql_restore_backupiobroker.sql`);
    log.debug('Start mysql Restore ...');

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
        if (fs.existsSync(fileNameMysql)) {
            const stats = fs.statSync(fileNameMysql);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug(`Extract mysql Backupfile ${fileSize}MB so far...`);
        } else {
            log.debug(`Something is wrong with "${fileNameMysql}".`);
        }
    }, 10000);

    const decompress = require('../targz').decompress;

    try {
        decompress({
            src: fileName,
            dest: options.backupDir,
            tar: {
                map: header => {
                    header.name = `mysql_restore_backupiobroker.sql`;
                    return header;
                }
            }
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('mysql Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                replayMySql(options, fileNameMysql, log, err => {
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
                    // delete mysql file
                    if (fs.existsSync(fileNameMysql)) {
                        try {
                            fs.unlinkSync(fileNameMysql);
                        } catch (e) {
                            log.debug(fileNameMysql + ' cannot deleted ...');
                        }
                    }
                    if (callback) {
                        log.debug('mySql Restore completed successfully');
                        callback(null, 'mysql restore done');
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