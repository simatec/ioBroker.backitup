'use strict';
const fs = require('fs');
const path = require('path');

function list(options, types, log, callback) {
    if (options.accessToken && options.source === 'Dropbox') {
        const dropboxV2Api = require('dropbox-v2-api');
        const dbx = dropboxV2Api.authenticate({token: options.accessToken});

        let dir = (options.dir || '').replace(/\\/g, '/');

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
                err && log.error(err);
                if (result && result.entries) {

                    result = result.entries.map(file => {
                        return {path: file.path_display, name: file.path_display.replace(/\\/g, '/').split('/').pop(), size: file.size}
                    }).filter(file => types.indexOf(file.name.split('_')[0]) !== -1);

                    const files = {};
                    result.forEach(file => {
                        const type = file.name.split('_')[0];
                        files[type] = files[type] || [];
                        files[type].push(file);
                    });

                    callback(null, files, 'dropbox');
                } else {
                    callback && callback(err)
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
    if (options.accessToken) {
        // copy file to options.backupDir
        const dropboxV2Api = require('dropbox-v2-api');
        const dbx = dropboxV2Api.authenticate({token: options.accessToken});

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        try {
            log.debug('Download of "' + fileName + '" started');
            dbx({
                resource: 'files/download',
                parameters: {
                    path: path.join(dir.replace(/^\/$/, ''), fileName).replace(/\\/g, '/')
                },
            }, (err, result, response) => {
                err && log.error(err);
                !err && log.debug('Download of "' + fileName + '" done');
                callback && callback(err);
            })
            .pipe(fs.createWriteStream(toStoreName));

        } catch (e) {
            setImmediate(callback, e);
        }
    } else {
        setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};