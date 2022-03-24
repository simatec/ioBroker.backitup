'use strict';
const fs = require('fs');
const path = require('path');
const dropboxV2Api = require('dropbox-v2-api');

let db_accessToken;

async function refreshToken(db_dropboxAccessJson, db_dropboxClient_id, log) {
    return new Promise(async (resolve) => {
        const axios = require('axios').default;

        axios('https://api.dropbox.com/1/oauth2/token', {
            method: 'post',
            params: {
                refresh_token: db_dropboxAccessJson,
                grant_type: 'refresh_token',
                client_id: db_dropboxClient_id
            }
        }).then((response) => {
            if (response && response.data && response.data.access_token) {
                log.debug('refresh Dropbox access_token successfully');
                resolve(response.data.access_token);
            } else {
                resolve();
            }
        }).catch((e) => {
            log.warn(`refresh Dropbox access_token error: ${e}`);
            resolve();
        });
    });
}
async function list(restoreSource, options, types, log, callback) {

    const db_dropboxAccessJson = options.dropboxAccessJson !== undefined ? options.dropboxAccessJson : options.dropbox.dropboxAccessJson !== undefined ? options.dropbox.dropboxAccessJson : '';
    const db_dropboxTokenType = options.dropboxTokenType !== undefined ? options.dropboxTokenType : options.dropbox.dropboxTokenType !== undefined ? options.dropbox.dropboxTokenType : '';
    const db_dropboxClient_id = options.dropboxClient_id !== undefined ? options.dropboxClient_id : options.dropbox.dropboxClient_id !== undefined ? options.dropbox.dropboxClient_id : '';
    const db_dir = options.dir !== undefined ? options.dir : options.dropbox.dir !== undefined ? options.dropbox.dir : '/';
    const db_ownDir = options.ownDir !== undefined ? options.ownDir : options.dropbox.ownDir !== undefined ? options.dropbox.ownDir : false;
    const db_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.dropbox.dirMinimal !== undefined ? options.dropbox.dirMinimal : '/';

    // Token refresh
    if (!restoreSource || restoreSource === 'dropbox') {
        if (db_dropboxTokenType == 'default') {
            db_accessToken = await refreshToken(db_dropboxAccessJson, db_dropboxClient_id, log);
        } else if (db_dropboxTokenType == 'custom') {
            db_accessToken = options.accessToken !== undefined ? options.accessToken : options.dropbox.accessToken !== undefined ? options.dropbox.accessToken : '';
        }
    }

    if (db_accessToken && (!restoreSource || restoreSource === 'dropbox')) {
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

    const db_dropboxAccessJson = options.dropboxAccessJson !== undefined ? options.dropboxAccessJson : options.dropbox.dropboxAccessJson !== undefined ? options.dropbox.dropboxAccessJson : '';
    const db_dropboxTokenType = options.dropboxTokenType !== undefined ? options.dropboxTokenType : options.dropbox.dropboxTokenType !== undefined ? options.dropbox.dropboxTokenType : '';
    const db_dropboxClient_id = options.dropboxClient_id !== undefined ? options.dropboxClient_id : options.dropbox.dropboxClient_id !== undefined ? options.dropbox.dropboxClient_id : '';
    const db_dir = options.dir !== undefined ? options.dir : options.dropbox.dir !== undefined ? options.dropbox.dir : '/';
    const db_ownDir = options.ownDir !== undefined ? options.ownDir : options.dropbox.ownDir !== undefined ? options.dropbox.ownDir : false;
    const db_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.dropbox.dirMinimal !== undefined ? options.dropbox.dirMinimal : '/';

    // Token refresh
    let db_accessToken;

    if (db_dropboxTokenType == 'default') {
        const axios = require('axios').default;

        axios('https://api.dropbox.com/1/oauth2/token', {
            method: 'post',
            params: {
                refresh_token: db_dropboxAccessJson,
                grant_type: 'refresh_token',
                client_id: db_dropboxClient_id
            }
        }).then((response) => {
            if (response && response.data && response.data.access_token) {
                db_accessToken = response.data.access_token;
                log.debug('refresh Dropbox access_token successfully');
            }
        }).catch((e) => {
            log.warn(`refresh Dropbox access_token error: ${e}`);
        });
    } else if (db_dropboxTokenType == 'custom') {
        db_accessToken = options.accessToken !== undefined ? options.accessToken : options.dropbox.accessToken !== undefined ? options.dropbox.accessToken : '';
    }

    if (db_accessToken) {
        // copy file to backupDir
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