const fs = require('fs');
const targz = require('targz');
//const copyFile = require('../tools').copyFile;
const path = require('path');
const fse = require('fs-extra');

function restore(options, fileName, log, callback) {
    log.debug('Start Redis Restore ...');
    let stat;
    if (fs.existsSync(options.path)) {
        stat = fs.statSync(options.path);
    }
    const tmpDir = path.join(options.backupDir, 'redistmp').replace(/\\/g, '/');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
        log.debug('Created redistmp directory');
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
                        files.forEach(function (file) {
                            log.debug('Restore Redis Backup');
                            try {
                                fse.copySync(tmpDir + "/" + file), path.join(pth + "/" + file);
                                if (fs.existsSync(path.join(pth + "/" + file))) {
                                    log.debug(`redis file ${file} successfully restored`);
                                }
                                log.debug(`Try deleting the redis tmp File  ${file}`);
                                fse.removeSync(tmpDir + "/" + file);
                                if (!fs.existsSync(tmpDir + "/" + file)) {
                                    log.debug(`redis tmp file ${file} successfully deleted`);
                                }
                            } catch (err) {
                                callback('1' + err);
                                callback = null;
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
                        }

                    }
                    log.debug('Redis Restore completed successfully');
                    callback(null, 'redis restore done');
                    callback = null;
                }
            }
        });
    } catch (e) {
        if (callback) {
            callback('2' + err);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: true
};