const fs = require('fs');
const copyFile = require('../tools').copyFile;
const path = require('path');
const fse = require('fs-extra');

let waitRestore;

function restore(options, fileName, log, callback) {
    log.debug('Start Redis Restore ...');
    let stat;
    if (fs.existsSync(options.path)) {
        stat = fs.statSync(options.path);
    }

    const desiredMode = '0o2775';

    const tmpDir = path.join(options.backupDir, 'redistmp').replace(/\\/g, '/');
    if (!fs.existsSync(tmpDir)) {
        fse.ensureDirSync(tmpDir, desiredMode);
        //fs.mkdirSync(tmpDir);
        log.debug('Created redistmp directory');
    } else {
        log.debug(`Try deleting the old redis tmp directory: "${tmpDir}"`);
        fse.removeSync(tmpDir);
        if (!fs.existsSync(tmpDir)) {
            log.debug(`old redis tmp directory "${tmpDir}" successfully deleted`);
            fse.ensureDirSync(tmpDir, desiredMode);
            //fs.mkdirSync(tmpDir);
            log.debug('Created redistmp directory');
        }
    }

    let timer = setInterval(() => {
        if (fs.existsSync(options.path)) {
            log.debug('Extracting Redis Backupfile...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 10000);

    let name;
    let pth;
    if (!fs.existsSync(options.path)) {
        const parts = options.path.replace(/\\/g, '/').split('/');
        name = parts.pop();
        if (name.indexOf('.')) {
            pth = parts.join('/');
        }
    } else {
        pth = options.path;
    }

    try {
        log.debug('decompress started ...');

        const decompress = require('../targz').decompress;

        waitRestore = setTimeout(() =>
            decompress({
                src: fileName,
                dest: tmpDir,
            }, (err, stdout, stderr) => {
                if (err) {
                    clearInterval(timer);
                    log.error('Redis Restore not completed');
                    log.error(err);
                    if (callback) {
                        callback(err, stderr);
                        callback = null;
                    }
                } else {
                    clearInterval(timer);
                    if (callback) {
                        let files = [];
                        if (fs.existsSync(tmpDir)) {
                            files = fs.readdirSync(tmpDir);
                            let num = 0;
                            files.forEach(function (file) {
                                try {
                                    copyFile(path.join(tmpDir, file), path.join(pth, file), err => {
                                        if (err) {
                                            log.error(err);
                                            callback && callback(null, 'redis restore broken');
                                            callback = null;
                                        } else {
                                            num++;
                                            if (fs.existsSync(path.join(pth + "/" + file))) {
                                                log.debug(`redis file ${file} successfully restored`);
                                            }
                                            if (files.length == num) {
                                                if (options.aof === true) {
                                                    log.debug('redis-cli bgrewriteaof started, please wait ...');
                                                    try {
                                                        const child_process = require('child_process');

                                                        child_process.exec(`redis-cli bgrewriteaof`, (error, stdout, stderr) => {
                                                            if (error) {
                                                                log.debug(`redis-cli bgrewriteaof error: "${error}"`);
                                                            }
                                                        });
                                                    } catch (e) {
                                                        log.debug(`redis-cli bgrewriteaof error: "${e}"`);
                                                    }
                                                }
                                                try {
                                                    log.debug(`Try deleting the redis tmp directory: "${tmpDir}"`);
                                                    fse.removeSync(tmpDir);
                                                    if (!fs.existsSync(tmpDir)) {
                                                        log.debug(`redis tmp directory "${tmpDir}" successfully deleted`);
                                                    }
                                                } catch (err) {
                                                    log.debug(`redis tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                                                    callback && callback(null, 'redis restore is incomplete');
                                                    callback = null;
                                                }
                                                clearTimeout(waitRestore);
                                                log.debug('Redis Restore completed successfully');
                                                callback && callback(null, 'redis restore done');
                                                callback = null;
                                            }
                                        }
                                    });
                                } catch (err) {
                                    log.error(`Redis Restore not completed: ${err}`)
                                    callback && callback(null, 'redis restore is incomplete');
                                    callback = null;
                                }
                            });
                        }
                    }
                }
            }), 2000);
    } catch (e) {
        if (callback) {
            clearInterval(timer);
            callback(e);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: true
};