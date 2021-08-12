const fs = require('fs');
const path = require('path');

function replayPgSql(options, fileNamePgsql, log, callback) {
    const { exec } = require('child_process');
    // create DB before executing script  psql -c "create database Db name;" postgresql://iobroker:iobroker@localhost:5432/
    const cmdCreate = `psql -c "create database ${options.dbName};" postgresql://${options.user}:${options.pass}@${options.host}:${options.port}/`;
    try {
        exec(cmdCreate, (error, stdout, stderr) => {
            const cmd = `pg_restore --dbname=postgresql://${options.user}:${options.pass}@${options.host}:${options.port}/${options.dbName} < ${fileNamePgsql}`;
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
    const fileNamePgsql = path.join(options.backupDir, `pgsql_restore_backupiobroker.sql`);
    log.debug('Start postgresql Restore ...');

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
        if (fs.existsSync(fileNamePgsql)) {
            const stats = fs.statSync(fileNamePgsql);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug(`Extract postgresql Backupfile ${fileSize}MB so far...`);
        } else {
            log.debug(`Something is wrong with "${fileNamePgsql}".`);
        }
    }, 10000);

    const decompress = require('../targz').decompress;

    try {
        decompress({
            src: fileName,
            dest: options.backupDir,
            tar: {
                map: header => {
                    header.name = `pgsql_restore_backupiobroker.sql`;
                    return header;
                }
            }
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('postgresql Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                replayPgSql(options, fileNamePgsql, log, err => {
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
                    if (fs.existsSync(fileNamePgsql)) {
                        fs.unlinkSync(fileNamePgsql);
                    }
                    if (callback) {
                        log.debug('postgresql Restore completed successfully');
                        callback(null, 'postgresql restore done');
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