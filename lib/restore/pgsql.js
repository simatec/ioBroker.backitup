const { exec } = require('child_process');
const fs = require('fs');
const targz = require('targz');
const path = require('path');

function replayPgSql(options, fileNamePgsql, log, callback) {
    // create DB before executing script  psql -c "create database Db name;" postgresql://iobroker:iobroker@localhost:5432/
    const cmdCreate = `psql -c "create database ${options.dbName};" postgresql://${options.user}:${options.pass}@${options.host}:${options.port}/`;
    try {
        exec(cmdCreate, (error, stdout, stderr) => {
            const cmd = `pg_restore --dbname=postgresql://${options.user}:${options.pass}@${options.host}:${options.port}/${options.dbName} < ${fileNamePgsql}`;
            try {
                const child = exec(cmd, (error, stdout, stderr) => {
                    if (error) log.error(stderr);
                    return callback(error);
                });
            } catch (e) {
                callback(e);
            }
        });
    } catch (e) {
        // ignore errors
    }
}

function restore(options, fileName, log, callback) {
    const fileNamePgsql = path.join(options.backupDir, `pgsql_restore_backupiobroker.sql`);
    log.debug('Start postgresql Restore ...');

    let timer = setInterval(() => {
        if (fs.existsSync(fileNamePgsql)) {
            const stats = fs.statSync(fileNamePgsql);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug(`Extract postgresql Backupfile ${fileSize}MB so far...`);
        } else {
            log.debug(`Something is wrong with "${fileNamePgsql}".`);
        }
    }, 10000);

    try {
        targz.decompress({
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
    isStop: true
};