'use strict';

function list(options, log, callback) {
    if (options.accessToken) {
        const dropboxV2Api = require('dropbox-v2-api');
        const dbx = dropboxV2Api.authenticate({token: options.accessToken});

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        dbx({
            resource: 'files/list_folder',
            parameters: {
                path: dir.replace(/^\/$/, '')
            },
        }, (err, result) => {
            err && log.error(err);
            if (result && result.entries) {
                result = result.entries.filter(a => a.name.startsWith(name));
                const files = [];

                result.sort((a, b) => {
                    const at = new Date(a.client_modified).getTime();
                    const bt = new Date(b.client_modified).getTime();
                    if (at > bt) return -1;
                    if (at < bt) return 1;
                    return 0;
                });

                for (let i = 0; i < result.length; i++) {
                    files.push(result[i].path_display);
                }

                callback(null, files, 'dropbox');
            } else {
                callback && callback(err)
            }
        });
    } else {
        callback();
    }
}

function getFile(options, fileName, log, callback) {
    if (options.accessToken && options.context.fileNames.length) {
        // copy file to options.backupDir
        callback('Not implemented');
    } else {
        callback('Not configured');
    }
}

module.exports = {
    list,
    getFile
};