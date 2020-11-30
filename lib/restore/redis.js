const fs = require('fs');
const targz = require('targz');
const copyFile = require('../tools').copyFile;
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
    } else {
        log.debug(`Try deleting the old redis tmp directory: "${tmpDir}"`);
        fse.removeSync(tmpDir);
        if (!fs.existsSync(tmpDir)) {
            log.debug(`old redis tmp directory "${tmpDir}" successfully deleted`);
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

                        files.forEach(function (file) {
                            try {
                                if (file == 'dump.rdb') {
                                    copyFile((tmpDir + "/" + file), path.join(pth + "/" + file), err => {
                                        if (err) {
                                            log.error(err);
                                            callback(null, 'redis restore broken');
                                            callback = null;
                                        } else {
                                            if (fs.existsSync(path.join(pth + "/" + file))) {
                                                log.debug(`redis file ${file} successfully restored`);
                                            }
                                            try {
                                                log.debug(`Try deleting the redis tmp directory: "${tmpDir}"`);
                                                fse.removeSync(tmpDir);
                                                if (!fs.existsSync(tmpDir)) {
                                                    log.debug(`redis tmp directory "${tmpDir}" successfully deleted`);
                                                }
                                            } catch (err) {
                                                log.debug(`redis tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                                                callback(null, 'redis restore is incomplete');
                                                callback = null;
                                            }
                                            log.debug('Redis Restore completed successfully');
                                            callback(null, 'redis restore done');
                                            callback = null;
                                        }
                                    });
                                }
                            } catch (err) {
                                log.error(`Redis Restore not completed: ${err}`)
                                callback(null, 'redis restore is incomplete');
                                callback = null;
                            }
                        });
                    }

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