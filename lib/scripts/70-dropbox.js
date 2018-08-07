'use strict';

const path = require('path');
const fs = require('fs');

function copyFiles(dbx, dir, fileNames, log, callback) {
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
                setImmediate(copyFiles, dbx, dir, fileNames, log, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(copyFiles, dbx, dir, fileNames, log, callback)
        }
    }
}

function deleteFiles(dbx, files, log, callback) {
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
                setImmediate(deleteFiles, dbx, files, log, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(deleteFiles, dbx, files, log, callback);
        }
    }
}

function cleanFiles(dbx, dir, name, num, log, callback) {
    try {
        dbx({
            resource: 'files/list_folder',
            parameters: {
                path: dir.replace(/^\/$/, '')
            },
        }, (err, result) => {
            err && log.error(err);
            if (result && result.entries && num) {
                result = result.entries.filter(a => a.name.startsWith(name));
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

                deleteFiles(dbx, files, log, callback);
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

        copyFiles(dbx, dir || '', fileNames, log, err => {
            if (err) {
                options.context.error.dropbox = err;
                log.error(err);
            }
            cleanFiles(dbx, dir, options.name, options.deleteBackupAfter, log, err => {
                options.context.done.dropbox = true;
                if (err) {
                    options.context.error.dropbox = options.context.error.dropbox || err;
                } else {
                    options.context.done.dropbox = true;
                }
                callback(err);
            });
        });
    } else {
        callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true
};