'use strict';

const fs = require('fs');
const oneDriveAPI = require('onedrive-api');
const Onedrive = require('../oneDriveLib');

function copyFiles(od_accessToken, dir, fileNames, log, errors, callback) {
    if (!fileNames || !fileNames.length) {
        callback && callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        if (fs.existsSync(fileName)) {
            log.debug('Onedrive: Copy ' + onlyFileName + '...');

            const readStream = fs.createReadStream(fileName);

            readStream.on('error', err => {
                err && log.error('readStream Onedrive: ' + err);
            });

            oneDriveAPI.items
                .uploadSimple({
                    accessToken: od_accessToken,
                    parentPath: dir,
                    filename: onlyFileName,
                    readableStream: readStream,
                })
                .then((item) => {
                    log.debug(`${item && item.name ? item.name : fileName} with Id: ${item && item.id ? item.id : 'undefined'} saved on Onedrive`);
                    setImmediate(copyFiles, od_accessToken, dir, fileNames, log, errors, callback);
                })
                .catch((err) => {
                    if (err) {
                        errors.onedrive = JSON.stringify(err);
                        log.error('upload Onedrive: ' + JSON.stringify(err));
                    }
                    setImmediate(copyFiles, od_accessToken, dir, fileNames, log, errors, callback);
                });
        } else {
            log.error('Onedrive: File "' + fileName + '" not found');
            setImmediate(copyFiles, od_accessToken, dir, fileNames, log, errors, callback)
        }
    }
}

function deleteFiles(od_accessToken, fileIds, fileNames, log, errors, callback) {
    if ((!fileIds || !fileIds.length) && (!fileNames || !fileNames.length)) {
        callback && callback();
    } else {
        const fileId = fileIds.shift();
        const fileName = fileNames.shift();

        log.debug(`Onedrive: delete ${fileName} with Id: ${fileId}`);

        oneDriveAPI.items
            .delete({
                accessToken: od_accessToken,
                itemId: fileId,
            })
            .then(() => {
                setImmediate(deleteFiles, od_accessToken, fileIds, fileNames, log, errors, callback);
            })
            .catch((error) => {
                error && log.error('Onedrive: ' + JSON.stringify(error));
                setImmediate(deleteFiles, od_accessToken, fileIds, fileNames, log, errors, callback);
            });
    }
}

async function cleanFiles(itemId, pthNo, od_accessToken, options, dir, names, num, log, errors, callback) {
    if (!num) {
        return callback && callback();
    }
    const pth = dir.split('/');

    oneDriveAPI.items
        .listChildren({
            accessToken: od_accessToken,
            itemId: itemId,
        })
        .then((childrens) => {
            const childs = JSON.parse(JSON.stringify(childrens.value));
            if (pth.length > pthNo) {
                const result = childs.filter((d) => d.name === pth[pthNo]);
                itemId = result[0].id;
                pthNo++;
                setImmediate(cleanFiles, itemId, pthNo, od_accessToken, options, dir, names, num, log, errors, callback);
            } else if (pth.length = pthNo) {
                try {
                    if (childs) {
                        const fileIds = [];
                        const fileNames = [];

                        names.forEach(name => {
                            const subResult = childs.filter(a => a.name.startsWith(name));
                            let numDel = num;

                            if (name == 'influxDB' && options.influxDBMulti) numDel = num * options.influxDBEvents.length;
                            if (name == 'mysql' && options.mySqlMulti) numDel = num * options.mySqlEvents.length;
                            if (name == 'pgsql' && options.pgSqlMulti) numDel = num * options.pgSqlEvents.length;
                            if (name == 'homematic' && options.ccuMulti) numDel = num * options.ccuEvents.length;

                            if (subResult.length > numDel) {
                                // delete oldest files
                                subResult.sort((a, b) => {
                                    const at = new Date(a.lastModifiedDateTime).getTime();
                                    const bt = new Date(b.lastModifiedDateTime).getTime();
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
                        deleteFiles(od_accessToken, fileIds, fileNames, log, errors, callback);
                    } else {
                        callback && callback(err);
                    }
                } catch (e) {
                    callback && callback(e);
                }
            }
        })
        .catch((error) => {
            log.error('Onedrive clean error: ' + error);
            reject();
        });


}

async function command(options, log, callback) {
    let od_accessToken;

    // Token refresh
    const onedrive = new Onedrive();
    od_accessToken = await onedrive.getToken(options.onedriveAccessJson, log).catch(err => log.warn('Onedrive Token: ' + err));


    if (od_accessToken && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir) {
            dir = 'root';
        }
        if (dir.startsWith('/')) {
            dir = dir.substring(1);
        }

        copyFiles(od_accessToken, dir, fileNames, log, options.context.errors, err => {
            if (err) {
                options.context.errors.onedrive = err;
                log.error('Onedrive: ' + err);
            }
            if (options.deleteOldBackup === true) {
                cleanFiles('root', 0, od_accessToken, options, dir, options.context.types, options.deleteBackupAfter, log, options.context.errors, err => {
                    if (err) {
                        options.context.errors.onedrive = options.context.errors.onedrive || err;
                    } else {
                        !options.context.errors.onedrive && options.context.done.push('onedrive');
                    }
                    callback && callback(err);
                });
            } else {
                !options.context.errors.onedrive && options.context.done.push('onedrive');
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