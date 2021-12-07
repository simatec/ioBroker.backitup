'use strict';

const fs = require('fs');

function copyFiles(gDrive, dir, fileNames, log, errors, callback) {
    if (!fileNames || !fileNames.length) {
        callback && callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        if (fs.existsSync(fileName)) {
            log.debug('Google Drive: Copy ' + onlyFileName + '...');

            gDrive.createFolder(dir)
                .then(folderId => {
                    const readStream = fs.createReadStream(fileName);
                    readStream.on('error', err => {
                        err && log.error('Google Drive: ' + err);
                    });

                    try {
                        return gDrive.writeFile(folderId, onlyFileName, readStream);
                    } catch (err) {
                        err && log.error('Google Drive: ' + err);
                        setTimeout(copyFiles, 150, gDrive, dir, fileNames, log, errors, callback);
                    }
                })
                .then(() => setTimeout(copyFiles, 150, gDrive, dir, fileNames, log, errors, callback))
                .catch(err => {
                    err && log.error('Google Drive: ' + err);
                    setTimeout(copyFiles, 150, gDrive, dir, fileNames, log, errors, callback);
                });
        } else {
            log.error('Google Drive: File "' + fileName + '" not found');
            setTimeout(copyFiles, 150, gDrive, dir, fileNames, log, errors, callback)
        }
    }
}

function deleteFiles(gDrive, fileIds, fileNames, log, errors, callback) {
    if ((!fileIds || !fileIds.length) && (!fileNames || !fileNames.length)) {
        callback && callback();
    } else {
        const fileId = fileIds.shift();
        const fileName = fileNames.shift();
        log.debug('Google Drive: delete ' + fileName);

        gDrive.deleteFile(fileId)
            .then(() => setTimeout(deleteFiles, 150, gDrive, fileIds, fileNames, log, errors, callback))
            .catch(err => {
                err && log.error('Google Drive: ' + err);
                setTimeout(deleteFiles, 150, gDrive, fileIds, fileNames, log, errors, callback);
            });
    }
}

function cleanFiles(gDrive, options, dir, names, num, log, errors, callback) {
    if (!num) {
        return callback && callback();
    }
    gDrive.getFileOrFolderId(dir)
        .then(folderId => gDrive.listFilesInFolder(folderId))
        .then(result => {
            if (result && result.length) {
                const fileIds = [];
                const fileNames = [];
                names.forEach(name => {
                    const subResult = result.filter(a => a.name.startsWith(name));
                    let numDel = num;

                    if (name == 'influxDB' && options.influxDBMulti) numDel = num * options.influxDBEvents.length;
                    if (name == 'mysql' && options.mySqlMulti) numDel = num * options.mySqlEvents.length;
                    if (name == 'pgsql' && options.pgSqlMulti) numDel = num * options.pgSqlEvents.length;
                    if (name == 'homematic' && options.ccuMulti) numDel = num * options.ccuEvents.length;

                    // sort files
                    if (subResult.length > numDel) {
                        // delete oldest files
                        subResult.sort((a, b) => {
                            const at = new Date(a.modifiedTime).getTime();
                            const bt = new Date(b.modifiedTime).getTime();
                            if (at > bt) return -1;
                            if (at < bt) return 1;
                            return 0;
                        });

                        for (let i = numDel; i < subResult.length; i++) {
                            fileIds.push(subResult[i].id);
                            fileNames.push(subResult[i].name);
                        }
                    }
                });
                deleteFiles(gDrive, fileIds, fileNames, log, errors, callback);
            } else {
                callback && callback();
            }
        })
        .catch(err => {
            log.error('Google Drive: ' + err);
            callback && callback(err);
        });
}

function command(options, log, callback) {
    if (options.accessJson && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
        const GoogleDrive = require('../googleDriveLib');
        const gDrive = new GoogleDrive(options.accessJson);

        if (!gDrive) {
            return callback && callback('No or invalid access key');
        }

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        copyFiles(gDrive, dir, fileNames, log, options.context.errors, err => {
            if (err) {
                options.context.errors.googledrive = err;
                log.error('Google Drive: ' + err);
            }
            if (options.deleteOldBackup === true) {
                cleanFiles(gDrive, options, dir, options.context.types, options.deleteBackupAfter, log, options.context.errors, err => {
                    if (err) {
                        options.context.errors.googledrive = options.context.errors.googledrive || err;
                    } else {
                        !options.context.errors.googledrive && options.context.done.push('googledrive');
                    }
                    callback && callback(err);
                });
            } else {
                !options.context.errors.googledrive && options.context.done.push('googledrive');
                callback && callback(err);
            }
        });
    } else {
        callback && callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true
};