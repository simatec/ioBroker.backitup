const { exec } = require('child_process');
const child_process = require('child_process');
const fs = require('fs');
const targz = require('targz');
const path = require('path');

function replayMySql(options, fileNameMysql, log, callback) {
    // create DB before executing script
    const cmdCreate = `mysql -u ${options.user} -p${options.pass} -h ${options.host} -P ${options.port} --execute='CREATE DATABASE IF NOT EXISTS ${options.dbName};'`;

    try {
        exec(cmdCreate, (error, stdout, stderr) => {
            const cmd = `mysql -u ${options.user} -p${options.pass} -h ${options.host} -P ${options.port} ${options.dbName} < ${fileNameMysql}`;

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
    const fileNameMysql = path.join(options.backupDir, `mysql_restore_backupiobroker.sql`);
    log.debug('Start mysql Restore ...');

    let timer = setInterval(() => {
        if (fs.existsSync(fileNameMysql)) {
            const stats = fs.statSync(fileNameMysql);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug(`Extract mysql Backupfile ${fileSize}MB so far...`);
        } else {
            log.debug(`Something is wrong with "${fileNameMysql}".`);
        }
    }, 10000);

    try {
        targz.decompress({
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
                    // delete mysql file
                    if (fs.existsSync(fileNameMysql)) {
                        try {
                            fs.unlinkSync(fileNameMysql);
                        } catch (e) {
                            log.debug(fileNameMysql + ' cannot deleted ...');
                        }
                    }
                    if (callback) {
                        log.debug('History Restore completed successfully');
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
    isStop: true
};