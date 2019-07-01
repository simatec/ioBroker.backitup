'use strict';

const fs = require('fs');

function copyFiles(gDrive, dir, fileNames, log, errors, callback) {
    if (!fileNames || !fileNames.length) {
        callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        if (fs.existsSync(fileName)) {
            log.debug('Copy ' + onlyFileName + '...');

            gDrive.createFolder(dir)
                .then(folderId => {
                    try {
                        return gDrive.writeFile(folderId, fs.readFileSync(fileName))
                    } catch (err) {
                        err && log.error(err);
                        setImmediate(copyFiles, gDrive, dir, fileNames, log, errors, callback);
                    }
                })
                .then(fileId => {
                    setImmediate(copyFiles, gDrive, dir, fileNames, log, errors, callback);
                })
                .catch(err => {
                    err && log.error(err);
                    setImmediate(copyFiles, gDrive, dir, fileNames, log, errors, callback);
                });
        } else {
            log.error('File "' + fileName + '" not found');
            setImmediate(copyFiles, gDrive, dir, fileNames, log, errors, callback)
        }
    }
}

function deleteFiles(gDrive, files, log, errors, callback) {
    if (!files || !files.length) {
        callback && callback();
    } else {
        log.debug('delete ' + files[0]);
        let file = files.shift().replace(/\\/g, '/');
        const parts = file.split('/');
        const fileName = parts.pop();
        const dir = parts.join('/');

        gDrive.getFileOrFolderId(dir)
            .then(folderId => {
                if (!folderId) {
                    setImmediate(deleteFiles, gDrive, files, log, errors, callback);
                } else {
                    return gDrive.getFileOrFolderId(fileName, folderId);
                }
            }).then(fileId => {
                return gDrive.deleteFile(fileId);
            }).then(() => {
                setImmediate(deleteFiles, gDrive, files, log, errors, callback);
            })
            .catch(err => {
                err && log.error(err);
                setImmediate(deleteFiles, gDrive, files, log, errors, callback);
            });
    }
}

function cleanFiles(gDrive, dir, names, num, log, errors, callback) {
    if (!num) {
        return callback && callback();
    }
    try {
        dbx({
            resource: 'files/list_folder',
            parameters: {
                path: dir.replace(/^\/$/, '')
            },
        }, (err, result) => {

            err && log.error(err);

            if (result && result.entries) {
                const files = [];
                names.forEach (name => {
                    const subResult = result.entries.filter(a => a.name.startsWith(name));

                    if (subResult.length > num) {
                        // delete oldest files
                        subResult.sort((a, b) => {
                            const at = new Date(a.client_modified).getTime();
                            const bt = new Date(b.client_modified).getTime();
                            if (at > bt) return -1;
                            if (at < bt) return 1;
                            return 0;
                        });


                        for (let i = num; i < subResult.length; i++) {
                            files.push(subResult[i].path_display);
                        }
                    }

                });
                deleteFiles(gDrive, files, log, errors, callback);
            }  else {
                callback && callback(err);
            }
        });
    } catch (e) {
        callback && callback(e);
    }
}

function command(options, log, callback) {
    if (options.accessJson && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
        const gDrive = google.authorize(options.accessJson);

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        copyFiles(gDrive, dir, fileNames, log, options.context.errors, err => {
            if (err) {
                options.context.errors.googledrive = err;
                log.error(err);
            }
            if (options.deleteOldBackup === true) {
                cleanFiles(gDrive, dir, options.context.types, options.deleteBackupAfter, log, options.context.errors, err => {
                    if (err) {
                        options.context.errors.googledrive = options.context.errors.googledrive || err;
                    } else {
                        !options.context.errors.googledrive && options.context.done.push('googledrive');
                    }
                    callback(err);
                });
            } else {
                !options.context.errors.googledrive && options.context.done.push('googledrive');
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