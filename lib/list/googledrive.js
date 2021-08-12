'use strict';

function list(restoreSource, options, types, log, callback) {

    const gd_accessJson = options.accessJson !== undefined ? options.accessJson : options.googledrive.accessJson !== undefined ? options.googledrive.accessJson : '';
    const gd_dir = options.dir !== undefined ? options.dir : options.googledrive.dir !== undefined ? options.googledrive.dir : '/';
    const gd_ownDir = options.ownDir !== undefined ? options.ownDir : options.googledrive.ownDir !== undefined ? options.googledrive.ownDir : false;
    const gd_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.googledrive.dirMinimal !== undefined ? options.googledrive.dirMinimal : '/';

    if (gd_accessJson && (!restoreSource || restoreSource === 'googledrive')) {
        let GoogleDrive = require('../googleDriveLib');
        let gDrive = new GoogleDrive(gd_accessJson);

        if (!gDrive) {
            return callback && callback('No or invalid access key');
        }

        let dir = (gd_dir || '').replace(/\\/g, '/');

        if (gd_ownDir === true) {
            dir = (gd_dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        gDrive.getFileOrFolderId(dir)
            .then(id => {
                if (!id) {
                    callback && callback(null, [], 'googledrive');
                } else {
                    return gDrive.listFilesInFolder(id)
                        .then(list => {
                            const result = list.map(file => {
                                return { path: file.name, name: file.name, size: file.size, id };
                            }).filter(file => (types.indexOf(file.name.split('_')[0]) !== -1 || types.indexOf(file.name.split('.')[0]) !== -1) && file.name.split('.').pop() == 'gz');

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
            .catch(err => {
                callback && callback(err);
            });
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {

    const gd_accessJson = options.accessJson !== undefined ? options.accessJson : options.googledrive.accessJson !== undefined ? options.googledrive.accessJson : '';
    const gd_dir = options.dir !== undefined ? options.dir : options.googledrive.dir !== undefined ? options.googledrive.dir : '/';
    const gd_ownDir = options.ownDir !== undefined ? options.ownDir : options.googledrive.ownDir !== undefined ? options.googledrive.ownDir : false;
    const gd_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.googledrive.dirMinimal !== undefined ? options.googledrive.dirMinimal : '/';

    if (gd_accessJson) {
        const GoogleDrive = require('../googleDriveLib');
        const gDrive = new GoogleDrive(gd_accessJson);

        if (!gDrive) {
            return callback && callback('No or invalid access key');
        }

        let dir = (gd_dir || '').replace(/\\/g, '/');

        if (gd_ownDir === true) {
            dir = (gd_dirMinimal || '').replace(/\\/g, '/');
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
