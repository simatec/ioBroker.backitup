const fs = require('fs');
const targz = require('targz');
const path = require('path');
const fse = require('fs-extra');

function restore(options, fileName, log, callback) {
    log.debug('Start Jarvis Restore ...');

    let instance = fileName.split('.');
    let num = instance[1].split('_');

    const tmpDir = path.join(options.backupDir, `jarvis_${num[0]}`).replace(/\\/g, '/');

    log.debug('filename for restore: ' + fileName);

    try {
        fs.mkdirSync(tmpDir);
        log.debug('jarvis tmp directory created: ' + tmpDir)
    } catch (e) {
        log.debug('jarvis tmp directory cannot created');
    }

    const pthJarvis = path.join(options.path, 'jarvis');
    const pth = path.join(pthJarvis, num[0]);

    if (fs.existsSync(pth)) {
        try {
            fse.removeSync(pth);
            if (!fs.existsSync(pth)) {
                log.debug('old jarvis database directory was successfully deleted');
            }
        } catch (e) {
            log.debug('old jarvis database directory cannot deleted');
        }
    }

    try {
        targz.decompress({
            src: fileName,
            dest: tmpDir,
        }, (err, stdout, stderr) => {
            if (err) {
                log.error('jarvis restore not completed');
                log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    try {
                        fse.copySync(tmpDir, pth);
                        if (fs.existsSync(pth)) {
                            log.debug('jarvis database is successfully restored');
                        }
                        log.debug('Try deleting the jarvis tmp directory');
                        fse.removeSync(tmpDir);
                        if (!fs.existsSync(tmpDir)) {
                            log.debug('jarvis tmp directory was successfully deleted');
                        }
                    } catch (err) {
                        callback(err);
                        callback = null;
                    }
                    log.debug('jarvis Restore completed successfully');
                    callback(null, 'jarvis database restore done');
                    callback = null;
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