'use strict';

const getDate = require('../tools').getDate;

const path = require('path');
const fs = require('fs');

function command(options, log, callback) {
    let nameSuffix;
    if (options.hostType == 'Slave') {
        nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
    } else {
        nameSuffix = options.nameSuffix ? options.nameSuffix : '';
    }
    const fileName = path.join(options.backupDir, `pgsql_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
    const fileNamePgsql = path.join(options.backupDir, `pgsql_${getDate()}_backupiobroker.sql`);

    options.context.fileNames = options.context.fileNames || [];
    options.context.fileNames.push(fileName);

    const child_process = require('child_process');

    child_process.exec(`${options.exe ? options.exe : 'pg_dump'}  --dbname=postgresql://${options.user}:${options.pass}@${options.host}:${options.port}/${options.dbName} > ${fileNamePgsql}`, (error, stdout, stderr) => {
        if (error) {
            let errLog = '' + error;
            errLog = errLog.replace(new RegExp(options.pass, 'g'), "****");
            options.context.errors.pgsql = errLog.toString();
            callback && callback(errLog, stderr);
            callback = null;
        } else {
            let timer = setInterval(() => {
                if (fs.existsSync(fileName)) {
                    const stats = fs.statSync(fileName);
                    const fileSize = Math.floor(stats.size / (1024 * 1024));
                    log.debug('Packed ' + fileSize + 'MB so far...');
                }
            }, 10000);

            const compress = require('../targz').compress;

            compress({
                src: fileNamePgsql,
                dest: fileName,
            }, (err, stdout, stderr) => {

                clearInterval(timer);

                if (err) {
                    options.context.errors.pgsql = err.toString();
                    if (callback) {
                        callback(err, stderr);
                        callback = null;
                    }
                } else {
                    options.context.done.push('pgsql');
                    options.context.types.push('pgsql');
                    if (callback) {
                        if (fileNamePgsql) {
                            fs.unlink(fileNamePgsql, function (err) {
                                if (err) throw err;
                                log.debug('postgresql File deleted!');
                            });
                        }
                        callback && callback(null, stdout);
                        callback = null;
                    }
                }
            });
        }
    });
}

module.exports = {
    command,
    ignoreErrors: true
};