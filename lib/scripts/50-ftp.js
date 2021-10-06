'use strict';

const fs = require('fs');

function uploadFiles(client, dir, fileNames, log, errors, callback) {
    if (!fileNames || !fileNames.length) {
        callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        log.debug('Send ' + onlyFileName);
        if (fs.existsSync(fileName)) {
            client.put(fileName, dir + '/' + onlyFileName, err => {
                if (err) {
                    errors.ftp = err;
                    log.error(err);
                }
                setImmediate(uploadFiles, client, dir, fileNames, log, errors, callback);
            });
        } else {
            log.error('File "' + fileName + '" not found');
            setImmediate(uploadFiles, client, dir, fileNames, log, errors, callback);
        }
    }
}

function deleteFiles(client, files, log, errors, callback) {
    if (!files || !files.length) {
        callback && callback();
    } else {
        log.debug('delete ' + files[0]);
        const file = files.shift();
        try {
            client.delete(file, err => {
                err && log.error(err);
                setImmediate(deleteFiles, client, files, log, errors, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(deleteFiles, client, files, log, errors, callback);
        }
    }
}

function cleanFiles(client, options, dir, names, num, log, errors, callback) {
    if (!num) {
        return callback && callback();
    }
    try {
        if (dir[dir.length - 1] !== '/') {
            dir += '/';
        }
        client.list(dir, (err, result) => {
            if (err) {
                errors.ftp = errors.ftp || err;
            }
            if (names && result && result.length) {
                const files = [];
                names.forEach(name => {
                    const subResult = result.filter(a => a.name.startsWith(name));
                    let numDel = num;

                    if (name == 'influxDB' && options.influxDBMulti) numDel = num * options.influxDBEvents.length;
                    if (name == 'mysql' && options.mySqlMulti) numDel = num * options.mySqlEvents.length;
                    if (name == 'pgsql' && options.pgSqlMulti) numDel = num * options.pgSqlEvents.length;
                    if (name == 'homematic' && options.ccuMulti) numDel = num * options.ccuEvents.length;

                    if (subResult.length > numDel) {
                        // delete oldest files
                        subResult.sort((a, b) => {
                            const at = new Date(a.date).getTime();
                            const bt = new Date(b.date).getTime();
                            if (at > bt) return -1;
                            if (at < bt) return 1;
                            return 0;
                        });

                        for (let i = numDel; i < subResult.length; i++) {
                            files.push(dir + subResult[i].name);
                        }
                    }
                });
                deleteFiles(client, files, log, errors, callback);
            } else {
                callback && callback()
            }
        });
    } catch (e) {
        callback && callback(e);
    }
}

function command(options, log, callback) {
    if (options.host && options.context && options.context.fileNames && options.context.fileNames.length) {
        const Client = require('ftp');
        const client = new Client();
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        if (!options.dir.startsWith('/')) {
            options.dir = '/' + options.dir;
        }

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        client.on('ready', () => {
            log.debug('FTP connected.');
            uploadFiles(client, options.dir, fileNames, log, options.context.errors, err => {
                if (options.deleteOldBackup === true) {
                    cleanFiles(client, options, options.dir, options.context.types, options.deleteBackupAfter, log, options.context.errors, err => {
                        if (err) {
                            options.context.errors.ftp = options.context.errors.ftp || err;
                        } else {
                            options.context.done.push('ftp');
                        }
                        client.end();
                        if (callback) {
                            callback(err);
                            callback = null;
                        }
                    });
                } else {
                    !options.context.errors.ftp && options.context.done.push('ftp');
                    callback();
                }
            });
        });
        client.on('error', err => {
            options.context.errors.ftp = err;
            if (callback) {
                callback(err);
                callback = null;
            }
        });

        const srcFTP = {
            host: options.host,
            port: options.port || 21,
            user: options.user,
            password: options.pass
        };

        client.connect(srcFTP);
    } else {
        callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true
};