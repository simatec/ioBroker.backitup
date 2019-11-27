'use strict';
const GoogleDrive = require('../googleDriveLib');

function list(restoreSource, options, types, log, callback) {
    if (options.accessJson && (!restoreSource || restoreSource === 'googledrive')) {
        const gDrive = new GoogleDrive(options.accessJson);

        if (!gDrive) {
            return callback && callback('No or invalid access key');
        }

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (options.ownDir === true) {
            dir = (options.dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        gDrive.getFileOrFolderId(dir)
            .then(id => {
                if (!id) {
                    callback(null, [], 'googledrive');
                } else {
                    return gDrive.listFilesInFolder(id)
                        .then(list => {
                            const result = list.map(file => {
                                return {path: file.name, name: file.name, size: file.size, id};
                            }).filter(file => types.indexOf(file.name.split('_')[0]) !== -1 || types.indexOf(file.name.split('.')[0]) !== -1);

                            const files = {};
                            result.forEach(file => {
                                const type = file.name.split('_')[0];
                                files[type] = files[type] || [];
                                files[type].push(file);
                            });
                            callback(null, files, 'googledrive');
                        });
                }
            })
            .catch(err => {
                callback && callback(err);
            });
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {
    if (options.accessJson) {
        const gDrive = new GoogleDrive(options.accessJson);

        if (!gDrive) {
            return callback && callback('No or invalid access key');
        }

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (options.ownDir === true) {
            dir = (options.dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        log.debug('Download of "' + fileName + '" started');
        gDrive.getFileOrFolderId(dir)
            .then(folderId => {
                 if (!folderId) {
                     callback && callback('Folder not found');
                 } else {
                     return gDrive.getFileOrFolderId(fileName, folderId);
                 }
            })
            .then(fileId => {
                if (!fileId) {
                    callback && callback('File not found');
                } else {
                    return gDrive.readFile(fileId, toStoreName);
                }
            })
            .then(() => {
                log.debug('Download of "' + fileName + '" done');
                callback && callback();
            })
            .catch(err => {
                err && log.error(err);
                callback && callback(err);
            });
    } else {
        setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};
