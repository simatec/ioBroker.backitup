'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');
const copyFile = require('../tools').copyFile;
const fse = require('fs-extra');

async function command(options, log, callback) {

    log.debug('Start Redis Backup ...');

    let nameSuffix;
    if (options.hostType == 'Slave') {
        nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
    } else {
        nameSuffix = options.nameSuffix ? options.nameSuffix : '';
    }

    const fileName = path.join(options.backupDir, `redis_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
    const tmpDir = path.join(options.backupDir, 'redistmp').replace(/\\/g, '/');

    const desiredMode = '0o2775';

    if (!fs.existsSync(tmpDir)) {
        try {
            fse.ensureDirSync(tmpDir, desiredMode);
            //fs.mkdirSync(tmpDir);
            log.debug('Created redistmp directory');
        } catch (err) {
            log.debug(`redis tmp directory "${tmpDir}" cannot created`);
        }
    } else {
        log.debug(`Try deleting the old redis tmp directory: "${tmpDir}"`);
        try {
            fse.removeSync(tmpDir);
        } catch (err) {
            log.debug(`old redis tmp directory "${tmpDir}" cannot deleted`);
        }
        if (!fs.existsSync(tmpDir)) {
            log.debug(`old redis tmp directory "${tmpDir}" successfully deleted`);
            try {
                fse.ensureDirSync(tmpDir, desiredMode);
                //fs.mkdirSync(tmpDir);
                log.debug('Created new redistmp directory');
            } catch (err) {
                log.debug(`redis tmp directory "${tmpDir}" cannot created`);
            }
        }
    }

    options.context.fileNames.push(fileName);

    let name;
    let pth;
    let data = [];

    if (fs.existsSync(options.path)) {
        const stat = fs.statSync(options.path);
        if (!stat.isDirectory()) {
            const parts = options.path.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
            data.push(name);
        } else {
            pth = options.path;
            try {
                data = fs.readdirSync(pth);
            } catch (err) {
                callback && callback(err);
                //callback = null;
            }
        }
    }
    // save aof
    if (options.aof) await bgSave(options, tmpDir, log, callback);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    const compress = require('../targz').compress;

    data.forEach(function (file) {
        const currentFiletype = file.split('.').pop();

        if (currentFiletype == 'rdb') {
            log.debug('detected redis file: ' + file + ' | file type: ' + currentFiletype);
            try {
                copyFile(path.join(pth, file), path.join(tmpDir, file), err => {
                    if (err) {
                        clearInterval(timer);
                        options.context.errors.redis = err.toString();
                        err && log.error(err);
                        if (callback) {
                            callback(err);
                            //callback = null;
                        }
                    } else {
                        compress({
                            src: tmpDir,
                            dest: fileName,
                            tar: {
                                ignore: nm => name && name !== nm.replace(/\\/g, '/').split('/').pop()
                            },
                        }, (err, stdout, stderr) => {
                            clearInterval(timer);
                            if (err) {
                                options.context.errors.redis = err.toString();
                                stderr && log.error(stderr);
                                if (callback) {
                                    callback(err, stderr);
                                    //callback = null;
                                }
                            } else {
                                log.debug(`Backup created: ${fileName}`);
                                options.context.done.push('redis');
                                options.context.types.push('redis');
                                try {
                                    log.debug(`Try deleting the redis tmp directory: "${tmpDir}"`);
                                    fse.removeSync(tmpDir);
                                    if (!fs.existsSync(tmpDir)) {
                                        log.debug(`redis tmp directory "${tmpDir}" successfully deleted`);
                                    }
                                } catch (err) {
                                    log.debug(`redis tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                                    callback && callback(err);
                                    //callback = null;
                                }
                                if (callback) {
                                    callback(null, stdout);
                                    callback = null;
                                }
                            }
                        });
                    }
                });
            } catch (err) {
                clearInterval(timer);
                callback && callback(err);
                callback = null;
            }
        }
    });
}

function bgSave(options, tmpDir, log, callback) {
    return new Promise((resolve, reject) => {
        log.debug('redis-cli save started, please wait ...');

        const child_process = require('child_process');

        child_process.exec(`redis-cli save`, (error, stdout, stderr) => {
            if (error) {
                options.context.errors.redis = error.toString();
                try {
                    log.debug(`Try deleting the redis tmp directory: "${tmpDir}"`);
                    fse.removeSync(tmpDir);
                    if (!fs.existsSync(tmpDir)) {
                        log.debug(`redis tmp directory "${tmpDir}" successfully deleted`);
                    }
                } catch (err) {
                    log.debug(`redis tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                    callback && callback(err);
                    callback = null;
                }
                callback && callback(error);
                callback = null;
            } else {
                log.debug('redis-cli save finish');
                resolve(stdout ? stdout : stderr);
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};