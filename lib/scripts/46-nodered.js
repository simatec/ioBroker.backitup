'use strict';
const fs = require('fs');
const fse = require('fs-extra');
const getDate = require('../tools').getDate;
const path = require('path');

async function command(options, log, callback) {
    let noderedInst = [];

    try {
        for (let i = 0; i <= 10; i++) {
            const nrDir = i === 0 ? 'node-red' : `node-red.${i}`;
            const pth = path.join(options.path, nrDir).replace(/\\/g, '/');

            if (fs.existsSync(pth)) {
                noderedInst.push(`node-red.${i}`);

                const nameSuffix = options.hostType == 'Slave' && options.slaveSuffix ? options.slaveSuffix : options.hostType !== 'Slave' && options.nameSuffix ? options.nameSuffix : '';
                const fileName = path.join(options.backupDir, `nodered.${i}_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
                const tmpDir = path.join(options.backupDir, `noderedtmp${i}`).replace(/\\/g, '/');

                const desiredMode = {
                    mode: 0o2775
                };

                if (!fs.existsSync(tmpDir)) {
                    log.debug('Created noderedtmp directory');
                    try {
                        await fse.ensureDir(tmpDir, desiredMode);
                    } catch (err) {
                        log.error(`Node-Red tmp directory "${tmpDir}" cannot created`);
                    }
                } else {
                    try {
                        await delTmp(options, tmpDir, log);
                    } catch (err) {
                        log.error(`The temporary directory "${tmpDir}" could not be deleted. Please check the directory permissions and delete the directory manually`)
                    }

                    if (!fs.existsSync(tmpDir)) {
                        log.debug('Created new noderedtmp directory');
                        try {
                            await fse.ensureDir(tmpDir, desiredMode);
                        } catch (err) {
                            log.error(`Node-Red tmp directory "${tmpDir}" cannot created`);
                        }
                    }
                }

                await tmpCopy(pth, tmpDir, log);
                await compressBackupFile(fileName, tmpDir, log, callback);

                try {
                    await delTmp(options, tmpDir, log);
                } catch (err) {
                    log.error(`The temporary directory "${tmpDir}" could not be deleted. Please check the directory permissions and delete the directory manually`)
                }

                options.context.fileNames.push(fileName);
                options.context.types.push(`nodered.${i}`);
                options.context.done.push(`nodered.${i}`);

                if (i == 10) {
                    log.debug(noderedInst.length ? `found node-red database: ${noderedInst}` : 'no Node-Red database found!!');
                }
            } else if (!fs.existsSync(pth) && i === 10) {
                log.debug(noderedInst.length ? `found node-red database: ${noderedInst}` : 'no node-red database found!!');
                callback && callback(null, 'done');
            }
        }
    } catch (err) {
        options.context.errors.nodered = JSON.stringify(err);
        log.error(`Error on node-red Backup: ${err}`);
        callback && callback(null, err);
    }
}

async function delTmp(options, tmpDir, log) {
    return new Promise(async (resolve, reject) => {
        log.debug(`Try deleting the old node-red tmp directory: "${tmpDir}"`);

        await fse.remove(tmpDir)
            .then(() => {
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`node-red tmp directory "${tmpDir}" successfully deleted`);
                }
                resolve();
            })
            .catch(err => {
                options.context.errors.nodered = JSON.stringify(err);
                log.error(`The temporary directory "${tmpDir}" could not be deleted. Please check the directory permissions and delete the directory manually`)
                reject(err);
            });
    });
}

async function tmpCopy(pth, tmpDir, log) {
    return new Promise(async (resolve, reject) => {
        await fse.copy(pth, tmpDir, {
            filter: path => {
                return !(path.indexOf('node_modules') > -1)
            }
        }).then(() => {
            log.debug('Node-Red tmp copy finish');
            resolve();
        }).catch(err => {
            reject(err);
        })
    });
}

async function compressBackupFile(fileName, tmpDir, log, callback) {
    return new Promise(async (resolve, reject) => {
        const compress = require('../targz').compress;

        compress({
            src: tmpDir,
            dest: fileName,
        }, async (err, stderr) => {
            if (err) {
                options.context.errors.nodered = err.toString();
                stderr && log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                    reject();
                }
            } else {
                log.debug(`Backup created: ${fileName}`);
                resolve();
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};