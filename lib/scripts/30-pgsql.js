'use strict';

const getDate = require('../tools').getDate;

const path = require('node:path');
const fs = require('node:fs');

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
    } else if (!options.pgSqlMulti) {
        log.debug('PgSql-Backup started ...');
        await startBackup(options, log, callback);
        log.debug('PgSql-Backup for is finish');
        options.context.done.push('pgsql');
        options.context.types.push('pgsql');
        return callback && callback(null);
    }
}

async function startBackup(options, log, callback) {
    return new Promise(async (resolve) => {
        let nameSuffix;
        if (options.hostType === 'Slave' && !options.pgSqlMulti) {
            nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
        } else {
            nameSuffix = options.nameSuffix ? options.nameSuffix : '';
        }
        const fileName = path.join(options.backupDir, `pgsql_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`);
        const fileNamePgsql = path.join(options.backupDir, `pgsql_${getDate()}_backupiobroker.sql`);

        options.context.fileNames = options.context.fileNames || [];
        options.context.fileNames.push(fileName);

        if ((!options.pass.startsWith(`"`) || !options.pass.endsWith(`"`)) &&
            (!options.pass.startsWith(`'`) || options.pass.endsWith(`'`))
        ) {
            options.pass = `"${options.pass}"`;
        }

        const child_process = require('node:child_process');

        child_process.exec(`${options.exe ? options.exe : 'pg_dump'}  --dbname=postgresql://${options.user}:${options.pass}@${options.host}:${options.port}/${options.dbName} > ${fileNamePgsql}`, {maxBuffer: 10 * 1024 * 1024}, async (error, stdout, stderr) => {
            if (error) {
                let errLog = '' + error;
                try {
                    const formatPass = options.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    errLog = errLog.replace(new RegExp(formatPass, 'g'), "****");
                } catch (e) {
                    // ignore
                }
                options.context.errors.pgsql = errLog.toString();
                callback && callback(errLog, stderr);
                callback = null;
                resolve();
            } else {
                let timer = setInterval(async () => {
                    if (fs.existsSync(fileName)) {
                        const stats = fs.statSync(fileName);
                        const fileSize = Math.floor(stats.size / (1024 * 1024));
                        log.debug(`Packed ${fileSize}MB so far...`);
                    }
                }, 10000);

                const compress = require('../targz').compress;

                compress({
                    src: fileNamePgsql,
                    dest: fileName,
                    tar: {
                        map: header => {
                            header.name = fileNamePgsql.split('/').pop();
                            return header;
                        }
                    }
                }, async (err, stdout, stderr) => {
                    clearInterval(timer);

                    if (err) {
                        options.context.errors.pgsql = err.toString();
                        if (callback) {
                            callback(err, stderr);
                            callback = null;
                        }
                        resolve();
                    } else {
                        if (fileNamePgsql) {
                            fs.unlink(fileNamePgsql, (err) => {
                                if (err) {
                                    throw err;
                                }
                                log.debug('postgresql File deleted!');
                            });
                        }
                        resolve();
                    }
                });
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true,
};
