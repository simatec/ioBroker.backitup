const fs = require('fs');
const targz = require('targz');
const copyFile = require('../tools').copyFile;
const path = require('path');
const fse = require('fs-extra');

function restore(options, fileName, log, callback) {
    let errorSwitch = false;
    log.debug('Start Redis Restore ...');
    let stat;
    if (fs.existsSync(options.path)) {
        stat = fs.statSync(options.path);
    }
    const tmpDir = path.join(options.backupDir, 'redistmp').replace(/\\/g, '/');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
        log.debug('Created redistmp directory');
    } else {
        fse.removeSync(tmpDir);
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir);
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
        targz.decompress({
            src: fileName,
            dest: tmpDir,
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error('Redis Restore not completed');
                log.error(err);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    let files = [];
                    if (fs.existsSync(tmpDir)) {
                        files = fs.readdirSync(tmpDir);
                        log.debug('Restore Redis Backup');

                        files.forEach(function (file) {
                            try {
                                if (file == 'dump.rdb') {
                                    copyFile((tmpDir + "/" + file), path.join(pth + "/" + file), err => {
                                        if (err) {
                                            log.error(err);
                                        } else {
                                            if (fs.existsSync(path.join(pth + "/" + file))) {
                                                log.debug(`redis file ${file} successfully restored`);
                                            }
                                            log.debug(`Try deleting the redis tmp File  ${file}`);
                                            fse.removeSync(tmpDir + "/" + file);
                                            if (!fs.existsSync(tmpDir + "/" + file)) {
                                                log.debug(`redis tmp file ${file} successfully deleted`);
                                            }
                                        }
                                    });
                                } else {
                                    log.debug(`Try deleting the redis tmp File  ${file}`);
                                    fse.removeSync(tmpDir + "/" + file);
                                    if (!fs.existsSync(tmpDir + "/" + file)) {
                                        log.debug(`redis tmp file ${file} successfully deleted`);
                                    }
                                }
                            } catch (err) {
                                log.error('Redis Restore not completed: ' + err)
                                errorSwitch = true;
                            }
                            /*
                            copyFile((tmpDir + "/" + file), path.join(pth + "/" + file), err => {
                                if (err) {
                                    log.error(err);
                                } else {
                                    log.debug('Copy Redis File for Restore ...');
                                    log.debug('Delete tmp Files:' + tmpDir + "/" + file);
                                    try {
                                        fs.unlinkSync(tmpDir + "/" + file);
                                        setTimeout(function () {
                                            fs.rmdirSync(tmpDir);
                                        }, 1000);
                                    } catch (err) {
                                        log.debug('tmp folder not deleted ...');
                                    }

                                    if (callback) {
                                        log.debug('Redis Restore completed successfully');
                                        callback(null, 'redis restore done');
                                        callback = null;
                                    }
                                }
                            });
                            */
                        });
                        try {
                            setTimeout(function () {
                                log.debug('Try deleting the redis tmp directory');
                                fse.removeSync(tmpDir);
                                if (!fs.existsSync(tmpDir)) {
                                    log.debug(`redis tmp directory successfully deleted`);
                                }
                            }, 1000);
                        } catch (err) {
                            log.debug('redis tmp directory cannot deleted ...' + err);
                            errorSwitch = true
                        }

                    }
                    setTimeout(function () {
                        if (errorSwitch === false) {
                        log.debug('Redis Restore completed successfully');
                        callback(null, 'redis restore done');
                        callback = null;
                        } else {
                            callback(null, 'redis restore broken');
                            callback = null;
                        }
                    }, 3000);
                }
            }
        });
    } catch (e) {
        if (callback) {
            callback(e);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: true
};