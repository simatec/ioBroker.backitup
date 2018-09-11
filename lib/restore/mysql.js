const {exec} = require('child_process');
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
    const fileNameMysql = path.join(options.backupDir , `mysql_restore_backupiobroker.sql`);

    let timer = setInterval(() => {
        if (fs.existsSync(fileNameMysql))  {
            const stats = fs.statSync(fileNameMysql);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug(`Extract ${fileSize}MB so far...`);
        } else {
            log.debug(`Something is wrong with "${fileNameMysql}".`);
        }
    }, 10000);

    try {
        targz.decompress({
            src: fileName,
            dest: options.path,
            tar: {
                map: header => {
                    header.name = fileNameMysql; // rename "." to mysql_restore_backupiobroker.sql
                    return header;
                }
            }
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                replayMySql(options, fileNameMysql, log, err => {
                    // delete mysql file
                    if (fs.existsSync(fileNameMysql)) {
                        fs.unlinkSync(fileNameMysql);
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
