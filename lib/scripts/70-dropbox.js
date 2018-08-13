'use strict';

const path = require('path');
const fs = require('fs');

function copyFiles(dbx, dir, fileNames, log, errors, callback) {
    if (!fileNames || !fileNames.length) {
        callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        try {
            log.debug('Copy ' + onlyFileName + '...');

            dbx({
                resource: 'files/upload',
                parameters: {
                    path: path.join(dir, onlyFileName).replace(/\\/g, '/')
                },
                readStream: fs.createReadStream(fileName)
            }, (err, result, response) => {
                err && log.error(err);
                setImmediate(copyFiles, dbx, dir, fileNames, log, errors, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(copyFiles, dbx, dir, fileNames, log, errors, callback)
        }
    }
}

function deleteFiles(dbx, files, log, errors, callback) {
    if (!files || !files.length) {
        callback && callback();
    } else {
        log.debug('delete ' + files[0]);
        try {
            dbx({
                resource: 'files/delete',
                parameters: {
                    path: files.shift()
                },
            }, (err, result) => {
                err && log.error(err);
                setImmediate(deleteFiles, dbx, files, log, errors, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(deleteFiles, dbx, files, log, errors, callback);
        }
    }
}

function cleanFiles(dbx, dir, names, num, log, errors, callback) {
    try {
        dbx({
            resource: 'files/list_folder',
            parameters: {
                path: dir.replace(/^\/$/, '')
            },
        }, (err, result) => {
            err && log.error(err);
            if (result && result.entries && num) {
                result = result.entries.filter(a => !!names.find(name => a.startsWith(name)));
                const files = [];

                if (result.length > num) {
                    // delete oldies files
                    result.sort((a, b) => {
                        const at = new Date(a.client_modified).getTime();
                        const bt = new Date(b.client_modified).getTime();
                        if (at > bt) return -1;
                        if (at < bt) return 1;
                        return 0;
                    });


                    for (let i = num; i < result.length; i++) {
                        files.push(result[i].path_display);
                    }
                }

                deleteFiles(dbx, files, log, errors, callback);
            } else {
                callback && callback()
            }
        });
    } catch (e) {
        callback && callback(e);
    }
}

function command(options, log, callback) {
    if (options.accessToken && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        const dropboxV2Api = require('dropbox-v2-api');
        const dbx = dropboxV2Api.authenticate({token: options.accessToken});

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        copyFiles(dbx, dir || '', fileNames, log, options.context.errors, err => {
            if (err) {
                options.context.errors.dropbox = err;
                log.error(err);
            }
            if (options.deleteOldBackup === true) {
                cleanFiles(dbx, dir, options.context.types, options.deleteBackupAfter, log, options.context.errors, err => {
                    if (err) {
                        options.context.errors.dropbox = options.context.errors.dropbox || err;
                    } else {
                        !options.context.errors.dropbox && options.context.done.push('dropbox');
                    }
                    callback(err);
                });
            } else {
                !options.context.errors.dropbox && options.context.done.push('dropbox');
                callback(err);
            }
        });
    } else {
        callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true
};