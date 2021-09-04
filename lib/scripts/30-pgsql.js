'use strict';

const getDate = require('../tools').getDate;

const path = require('path');
const fs = require('fs');

async function command(options, log, callback) {
    if (options.pgSqlMulti) {
        for (let i = 0; i < options.pgSqlEvents.length; i++) {
            options.port = options.pgSqlEvents[i].port ? options.pgSqlEvents[i].port : '';
            options.host = options.pgSqlEvents[i].host ? options.pgSqlEvents[i].host : '';
            options.user = options.pgSqlEvents[i].user ? options.pgSqlEvents[i].user : '';
            options.pass = options.pgSqlEvents[i].pass ? options.pgSqlEvents[i].pass : '';
            options.exe = options.pgSqlEvents[i].exe ? options.pgSqlEvents[i].exe : '';
            options.dbName = options.pgSqlEvents[i].dbName ? options.pgSqlEvents[i].dbName : '';
            options.nameSuffix = options.pgSqlEvents[i].nameSuffix ? options.pgSqlEvents[i].nameSuffix : '';

            log.debug(`PgSql-Backup for ${options.nameSuffix} is started ...`);
            await startBackup(options, log, callback);
            log.debug(`PgSql-Backup for ${options.nameSuffix} is finish`);
        }
        options.context.done.push('pgsql');
        options.context.types.push('pgsql');
        return callback && callback(null);
        //return callback && callback();
    } else if (!options.pgSqlMulti) {
        log.debug('PgSql-Backup started ...');
        await startBackup(options, log, callback);
        log.debug('PgSql-Backup for is finish');
        options.context.done.push('pgsql');
        options.context.types.push('pgsql');
        return callback && callback(null);
        //return callback && callback();
    }
}

async function startBackup(options, log, callback) {
    return new Promise(async (resolve) => {
        let nameSuffix;
        if (options.hostType == 'Slave' && !options.pgSqlMulti) {
            nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
        } else {
            nameSuffix = options.nameSuffix ? options.nameSuffix : '';
        }
        const fileName = path.join(options.backupDir, `pgsql_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
        const fileNamePgsql = path.join(options.backupDir, `pgsql_${getDate()}_backupiobroker.sql`);

        options.context.fileNames = options.context.fileNames || [];
        options.context.fileNames.push(fileName);

        const child_process = require('child_process');

        child_process.exec(`${options.exe ? options.exe : 'pg_dump'}  --dbname=postgresql://${options.user}:${options.pass}@${options.host}:${options.port}/${options.dbName} > ${fileNamePgsql}`, async (error, stdout, stderr) => {
            if (error) {
                let errLog = '' + error;
                errLog = errLog.replace(new RegExp(options.pass, 'g'), "****");
                options.context.errors.pgsql = errLog.toString();
                callback && callback(errLog, stderr);
                callback = null;
            } else {
                let timer = setInterval(async () => {
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
                }, async (err, stdout, stderr) => {

                    clearInterval(timer);

                    if (err) {
                        options.context.errors.pgsql = err.toString();
                        if (callback) {
                            callback(err, stderr);
                            callback = null;
                        }
                    } else {
                        //options.context.done.push('pgsql');
                        //options.context.types.push('pgsql');
                        if (fileNamePgsql) {
                            fs.unlink(fileNamePgsql, function (err) {
                                if (err) throw err;
                                log.debug('postgresql File deleted!');
                            });
                        }
                        //callback && callback(null, stdout);
                        //callback = null;
                        resolve();
                    }
                });
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};