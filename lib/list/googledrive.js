'use strict';

function list(restoreSource, options, types, log, callback) {
    const gdAccessJson = options.accessJson !== undefined ? options.accessJson : options.googledrive && options.googledrive.accessJson !== undefined ? options.googledrive.accessJson : '';
    const gdDir = options.dir !== undefined ? options.dir : options.googledrive && options.googledrive.dir !== undefined ? options.googledrive.dir : '/';
    const gdOwnDir = options.ownDir !== undefined ? options.ownDir : options.googledrive && options.googledrive.ownDir !== undefined ? options.googledrive.ownDir : false;
    const gdDirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.googledrive && options.googledrive.dirMinimal !== undefined ? options.googledrive.dirMinimal : '/';
    const gdNewToken = options.newToken !== undefined ? options.newToken : options.googledrive && options.googledrive.newToken !== undefined ? options.googledrive.newToken : '';

    if (gdAccessJson && (!restoreSource || restoreSource === 'googledrive')) {
        let GoogleDrive = require('../googleDriveLib');
        let gDrive;
        try {
            gDrive = new GoogleDrive(gdAccessJson, gdNewToken);

            if (!gDrive) {
                return callback && callback('No or invalid access key');
            }
        } catch (e) {
            return callback && callback('No or invalid access key');
        }

        let dir = (gdDir || '').replace(/\\/g, '/');

        if (gdOwnDir === true) {
            dir = (gdDirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }
        gDrive.getFileOrFolderId(dir)
            .then(id => {
                if (!id) {
                    callback && callback(null, [], 'googledrive');
                } else {
                    return gDrive.listFilesInFolder(id)
                        .then(list => {
                            const result = list
                                .map(file => ({ path: file.name, name: file.name, size: file.size, id }))
                                .filter(file => (types.includes(file.name.split('_')[0]) || types.includes(file.name.split('.')[0])) && file.name.split('.').pop() === 'gz');

                            const files = {};
                            result.forEach(file => {
                                const type = file.name.split('_')[0];
                                files[type] = files[type] || [];
                                files[type].push(file);
                            });
                            callback && callback(null, files, 'googledrive');
                        });
                }
            })
            .catch(err => callback && callback(err));
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {
    const gdAccessJson = options.accessJson !== undefined ? options.accessJson : options.googledrive && options.googledrive.accessJson !== undefined ? options.googledrive.accessJson : '';
    const gdDir = options.dir !== undefined ? options.dir : options.googledrive && options.googledrive.dir !== undefined ? options.googledrive.dir : '/';
    const gdOwnDir = options.ownDir !== undefined ? options.ownDir : options.googledrive && options.googledrive.ownDir !== undefined ? options.googledrive.ownDir : false;
    const gdDirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.googledrive && options.googledrive.dirMinimal !== undefined ? options.googledrive.dirMinimal : '/';
    const gdNewToken = options.newToken !== undefined ? options.newToken : options.googledrive && options.googledrive.newToken !== undefined ? options.googledrive.newToken : '';

    if (gdAccessJson) {
        let GoogleDrive = require('../googleDriveLib');
        let gDrive = new GoogleDrive(gdAccessJson, gdNewToken);

        if (!gDrive) {
            return callback && callback('No or invalid access key');
        }

        let dir = (gdDir || '').replace(/\\/g, '/');

        if (gdOwnDir === true) {
            dir = (gdDirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }

        log.debug(`Download of "${fileName}" started`);
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
                log.debug(`Download of "${fileName}" done`);
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
    getFile,
};
