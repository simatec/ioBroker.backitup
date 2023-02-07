'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

    log.debug('Start SQLite3 Backup ...');

    const nameSuffix = options.hostType == 'Slave' && options.slaveSuffix ? options.slaveSuffix : options.hostType !== 'Slave' && options.nameSuffix ? options.nameSuffix : '';
    const fileName = path.join(options.backupDir, `sqlite_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
    const fileNameSQlite = path.join(options.backupDir, `sqlite_${getDate()}_backupiobroker.sql`);

    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    const compress = require('../targz').compress;

    const child_process = require('child_process');

    try {
        child_process.exec(`${options.exe ? options.exe : 'sqlite3'} ${options.filePth} .dump > ${fileNameSQlite}`, (error) => {
            if (error) {
                clearInterval(timer);
                options.context.errors.sqlite = error.toString();
                error && log.error(error);
                if (callback) {
                    callback(error);
                }
            } else {
                compress({
                    src: fileNameSQlite,
                    dest: fileName,
                    tar: {
						map: header => {
							header.name = fileNameSQlite.split('/').pop();
							return header;
						}
					}
                }, (err, stdout, stderr) => {
                    clearInterval(timer);
                    if (err) {
                        options.context.errors.sqlite = err.toString();
                        stderr && log.error(stderr);
                        if (callback) {
                            callback(err, stderr);
                        }
                    } else {
                        log.debug(`Backup created: ${fileName}`);
                        options.context.done.push('sqlite');
                        options.context.types.push('sqlite');

                        if (fileNameSQlite) {
							try {
								fs.unlinkSync(fileNameSQlite);
								log.debug('sqlite File deleted!');
							} catch (e) {
								log.debug('sqlite File cannot deleted: ' + e);
                                callback && callback(err);
							}
						}

                        if (callback) {
                            callback(null, stdout);
                            callback = null;
                        }
                    }
                });
            }
        });
    } catch (err) {
        clearInterval(timer);
        callback && callback(err);
        callback = null;
    }
}

module.exports = {
    command,
    ignoreErrors: true
};