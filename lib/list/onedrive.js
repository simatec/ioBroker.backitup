'use strict';
const fs = require('node:fs');
const oneDriveAPI = require('onedrive-api');
const Onedrive = require('../oneDriveLib');

let od_accessToken;

async function list(restoreSource, options, types, log, callback) {
    const db_onedriveAccessJson = options.onedriveAccessJson !== undefined ? options.onedriveAccessJson : options.onedrive && options.onedrive.onedriveAccessJson !== undefined ? options.onedrive.onedriveAccessJson : '';
    const db_dir = options.dir !== undefined ? options.dir : options.onedrive && options.onedrive.dir !== undefined ? options.onedrive.dir : '/';
    const db_ownDir = options.ownDir !== undefined ? options.ownDir : options.onedrive && options.onedrive.ownDir !== undefined ? options.onedrive.ownDir : false;
    const db_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.onedrive && options.onedrive.dirMinimal !== undefined ? options.onedrive.dirMinimal : '/';


    // Token refresh
    if (!restoreSource || restoreSource === 'onedrive') {
        const onedrive = new Onedrive();
        od_accessToken = await onedrive.getToken(db_onedriveAccessJson, log).catch(err => log.warn(`Onedrive Token: ${err}`));
    }

    if (od_accessToken && (!restoreSource || restoreSource === 'onedrive')) {

        let dir = (db_dir || '').replace(/\\/g, '/');

        if (db_ownDir === true) {
            dir = (db_dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }

        if (!dir) {
            dir = 'root';
        }
        if (dir.startsWith('/')) {
            dir = dir.substring(1);
        }

        oneDriveAPI.items
            .getMetadata({
                accessToken: od_accessToken,
                itemId: `${dir !== 'root' ? `root:/${dir}` : dir}`,
            })
            .then((res) => {
                if (res && res.id) {
                    oneDriveAPI.items
                        .listChildren({
                            accessToken: od_accessToken,
                            itemId: res.id,
                        })
                        .then((childrens) => {
                            if (childrens) {
                                let childs = JSON.parse(JSON.stringify(childrens.value));
                                if (childs) {
                                    childs = childs.map(file => {
                                        return { path: file.name, name: file.name, size: file.size, id: file.id }
                                    }).filter(file => (types.indexOf(file.name.split('_')[0]) !== -1 || types.indexOf(file.name.split('.')[0]) !== -1) && file.name.split('.').pop() == 'gz');

                                    const files = {};
                                    childs.forEach(file => {
                                        const type = file.name.split('_')[0];
                                        files[type] = files[type] || [];
                                        files[type].push(file);
                                    });

                                    callback && callback(null, files, 'onedrive');
                                } else {
                                    callback && callback(`Onedrive: ${err && err.error_summary ? JSON.stringify(err.error_summary) : 'Error on Onedrive list'}`)
                                }
                            }
                        })
                        .catch((error) => {
                            log.error(`Onedrive list error: ${error}`);
                            setImmediate(callback, error);
                        });
                }
            })
            .catch((error) => {
                log.error(`Onedrive Metadata error: ${error}`);
                setImmediate(callback, error);
            });
    } else {
        setImmediate(callback);
    }
}

async function getFile(options, fileName, toStoreName, log, callback) {

    const db_onedriveAccessJson = options.onedriveAccessJson !== undefined ? options.onedriveAccessJson : options.onedrive && options.onedrive.onedriveAccessJson !== undefined ? options.onedrive.onedriveAccessJson : '';
    const db_dir = options.dir !== undefined ? options.dir : options.onedrive && options.onedrive.dir !== undefined ? options.onedrive.dir : '/';
    const db_ownDir = options.ownDir !== undefined ? options.ownDir : options.onedrive && options.onedrive.ownDir !== undefined ? options.onedrive.ownDir : false;
    const db_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.onedrive && options.onedrive.dirMinimal !== undefined ? options.onedrive.dirMinimal : '/';

    // Token refresh
    const onedrive = new Onedrive();
    od_accessToken = await onedrive.getToken(db_onedriveAccessJson, log).catch(err => log.warn(`Onedrive Token: ${err}`));

    if (od_accessToken) {
        // copy file to backupDir
        const onlyFileName = fileName.split('/').pop();

        let dir = (db_dir || '').replace(/\\/g, '/');

        if (db_ownDir === true) {
            dir = (db_dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }

        if (!dir) {
            dir = 'root';
        }

        if (dir.startsWith('/')) {
            dir = dir.substring(1);
        }

        oneDriveAPI.items
            .getMetadata({
                accessToken: od_accessToken,
                itemId: `${dir !== 'root' ? `root:/${dir}` : dir}`,
            })
            .then((res) => {
                if (res && res.id) {
                    oneDriveAPI.items
                        .listChildren({
                            accessToken: od_accessToken,
                            itemId: res.id,
                        })
                        .then((childrens) => {
                            if (childrens) {
                                const childs = JSON.parse(JSON.stringify(childrens.value));
                                if (childs) {
                                    const result = childs.filter((d) => d.name === onlyFileName);

                                    log.debug(`Onedrive: Download of "${fileName}" started`);

                                    const writeStream = fs.createWriteStream(toStoreName);
                                    writeStream.on('error', err => {
                                        err && log.error(`OneDrive: ${err}`);
                                        callback && callback(err);
                                        callback = null;
                                    }).on('close', result => {
                                        log.debug(`OneDrive: Download of "${fileName}" finish`);
                                        callback && callback(result);
                                    });

                                    const promise = oneDriveAPI.items.download({
                                        accessToken: od_accessToken,
                                        itemId: result[0].id,
                                    });

                                    promise.then((fileStream) => fileStream.pipe(writeStream));
                                /*
                                  oneDriveAPI.items.download({
                                      accessToken: od_accessToken,
                                      itemId: result[0].id,
                                  })
                                      .pipe(writeStream);
                                */
                                }
                            }
                        })
                        .catch((error) => {
                            log.error(`Onedrive list error: ${error}`);
                            callback && setImmediate(callback, error);
                            callback && callback(error);
                            callback = null;
                        });
                }
            })
            .catch((error) => {
                log.error(`Onedrive Metadata error: ${error}`);
                callback && setImmediate(callback, error);
                callback && callback(error);
                callback = null;
            });
    } else {
        callback && setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile,
};
