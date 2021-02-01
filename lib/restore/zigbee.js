const fs = require('fs');
const targz = require('targz');
const path = require('path');
const fse = require('fs-extra');

function restore(options, fileName, log, adapter, callback) {
    log.debug('Start Zigbee Restore ...');

    let instance = fileName.split('.');
    let num = instance[1].split('_');

    const tmpDir = path.join(options.backupDir, `zigbee_${num[0]}`).replace(/\\/g, '/');
    log.debug('Filename for Restore: ' + fileName);
    try {
        fs.mkdirSync(tmpDir);
        log.debug('zigbee tmp directory created: ' + tmpDir)
    } catch (e) {
        log.debug('zigbee tmp directory cannot created');
    }

    if (fs.existsSync(options.path + '/zigbee_' + num[0])) {
        try {
            fse.removeSync(options.path + '/zigbee_' + num[0]);
            if (!fs.existsSync(options.path + '/zigbee_' + num[0])) {
                log.debug('old Zigbee database directory was successfully deleted');
            }
        } catch (e) {
            log.debug('old Zigbee database directory cannot deleted');
        }
    }
    // Stop zigbee
    let startAfterRestore = false;
    adapter.getForeignObject(`system.adapter.zigbee.${num[0]}`, function (err, obj) {
        if (obj && obj != null && obj.common.enabled == true) {
            adapter.setForeignState(`system.adapter.zigbee.${num[0]}.alive`, false);
            log.debug(`zigbee.${num[0]} stopped`);
            startAfterRestore = true;
        }
    });

    try {
        targz.decompress({
            src: fileName,
            dest: tmpDir,
        }, (err, stdout, stderr) => {
            if (err) {
                log.error('Zigbee Restore not completed');
                log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    try {
                        fse.copySync(tmpDir, `${options.path}/zigbee_${num[0]}`);
                        if (fs.existsSync(options.path + '/zigbee_' + num[0])) {
                            log.debug('Zigbee Database is successfully restored');
                        }
                        log.debug('Try deleting the Zigbee tmp directory');
                        fse.removeSync(tmpDir);
                        if (!fs.existsSync(tmpDir)) {
                            log.debug('Zigbee tmp directory was successfully deleted');
                        }
                        // Start zigbee
                        if (startAfterRestore) {
                            adapter.getForeignObject(`system.adapter.zigbee.${num[0]}`, function (err, obj) {
                                if (obj && obj != null && obj.common.enabled == false) {
                                    adapter.setForeignState(`system.adapter.zigbee.${num[0]}.alive`, true);
                                    log.debug(`zigbee.${num[0]} started`);
                                }
                            });
                        }
                    } catch (err) {
                        callback(err);
                        callback = null;
                    }
                    log.debug('Zigbee Restore completed successfully');
                    callback(null, 'zigbee database restore done');
                    callback = null;
                }
            }
        });
    } catch (e) {
        if (callback) {
            callback(e);
            callback(err);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: false
};