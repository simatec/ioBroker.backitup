'use strict';
const fs = require('fs');
const path = require('path');

function list(restoreSource, options, types, log, callback) {

    const db_accessToken = options.accessToken !== undefined ? options.accessToken : options.dropbox.accessToken !== undefined ? options.dropbox.accessToken : '';
    const db_dir = options.dir !== undefined ? options.dir : options.dropbox.dir !== undefined ? options.dropbox.dir : '/';
    const db_ownDir = options.ownDir !== undefined ? options.ownDir : options.dropbox.ownDir !== undefined ? options.dropbox.ownDir : false;
    const db_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.dropbox.dirMinimal !== undefined ? options.dropbox.dirMinimal : '/';

    if (db_accessToken && (!restoreSource || restoreSource === 'dropbox')) {
        const dropboxV2Api = require('dropbox-v2-api');
        const dbx = dropboxV2Api.authenticate({ token: db_accessToken });

        let dir = (db_dir || '').replace(/\\/g, '/');

        if (db_ownDir === true) {
            dir = (db_dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        try {
            dbx({
                resource: 'files/list_folder',
                parameters: {
                    path: dir.replace(/^\/$/, '')
                },
            }, (err, result) => {
                err && err.error_summary && log.error('Dropbox: ' + JSON.stringify(err.error_summary));
                if (result && result.entries) {

                    result = result.entries.map(file => {
                        return { path: file.path_display, name: file.path_display.replace(/\\/g, '/').split('/').pop(), size: file.size }
                    }).filter(file => (types.indexOf(file.name.split('_')[0]) !== -1 || types.indexOf(file.name.split('.')[0]) !== -1) && file.name.split('.').pop() == 'gz');

                    const files = {};
                    result.forEach(file => {
                        const type = file.name.split('_')[0];
                        files[type] = files[type] || [];
                        files[type].push(file);
                    });

                    callback && callback(null, files, 'dropbox');
                } else {
                    callback && callback(`Dropbox: ${err && err.error_summary ? JSON.stringify(err.error_summary) : 'Error on Dropbox list'}`)
                }
            });
        } catch (e) {
            setImmediate(callback, e);
        }
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {

    const db_accessToken = options.accessToken !== undefined ? options.accessToken : options.dropbox.accessToken !== undefined ? options.dropbox.accessToken : '';
    const db_dir = options.dir !== undefined ? options.dir : options.dropbox.dir !== undefined ? options.dropbox.dir : '/';
    const db_ownDir = options.ownDir !== undefined ? options.ownDir : options.dropbox.ownDir !== undefined ? options.dropbox.ownDir : false;
    const db_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.dropbox.dirMinimal !== undefined ? options.dropbox.dirMinimal : '/';

    if (db_accessToken) {
        // copy file to backupDir
        const dropboxV2Api = require('dropbox-v2-api');
        const dbx = dropboxV2Api.authenticate({ token: db_accessToken });

        const onlyFileName = fileName.split('/').pop();

        let dir = (db_dir || '').replace(/\\/g, '/');

        if (db_ownDir === true) {
            dir = (db_dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        try {
            log.debug('Dropbox: Download of "' + fileName + '" started');

            const writeStream = fs.createWriteStream(toStoreName);
            writeStream.on('error', err => {
                err && log.error('Dropbox: ' + err);
                callback && callback(err);
                callback = null;
            });

            dbx({
                resource: 'files/download',
                parameters: {
                    //path: path.join(dir.replace(/^\/$/, ''), fileName).replace(/\\/g, '/')
                    path: path.join(dir.replace(/^\/$/, ''), onlyFileName).replace(/\\/g, '/')
                },
            }, (err, result, response) => {
                err && log.error('Dropbox: ' + err);
                !err && log.debug('Dropbox: Download of "' + fileName + '" done');
                callback && callback(err);
                callback = null;
            })
                .pipe(writeStream);

        } catch (e) {
            callback && setImmediate(callback, e);
        }
    } else {
        callback && setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};