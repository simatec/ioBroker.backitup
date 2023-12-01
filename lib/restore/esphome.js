const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

let waitRestore;

function restore(options, fileName, log, adapter, callback) {
    log.debug('Start ESPHome Restore ...');

    let instance = fileName.split('.');
    let num = instance[1].split('.');

    const tmpDir = path.join(options.backupDir, `esphome.${num[0]}`).replace(/\\/g, '/');
    const esphomePth = path.join(options.path, `esphome.${num[0]}`).replace(/\\/g, '/');

    log.debug('Filename for Restore: ' + fileName);

    const desiredMode = '0o2775';

    try {
        fse.ensureDirSync(tmpDir, desiredMode);
        log.debug('esphome tmp directory created: ' + tmpDir)
    } catch (e) {
        log.debug('esphome tmp directory cannot created');
    }

    if (fs.existsSync(esphomePth)) {
        try {
            fse.emptyDirSync(esphomePth);
            if (fs.readdirSync(esphomePth) == 0) {
                log.debug('old ESPHome data was successfully deleted');
            }
        } catch (e) {
            log.debug('old ESPHome data cannot deleted');
        }
    }
    // Stop esphome
    let startAfterRestore = false;
    adapter.getForeignObject(`system.adapter.esphome.${num[0]}`, function (err, obj) {
        if (obj && obj != null && obj.common.enabled == true) {
            adapter.setForeignState(`system.adapter.esphome.${num[0]}.alive`, false);
            log.debug(`esphome.${num[0]} stopped`);
            startAfterRestore = true;
        }
    });

    const decompress = require('../targz').decompress;

    try {
        waitRestore = setTimeout(() =>
            decompress({
                src: fileName,
                dest: tmpDir,
            }, (err, stdout, stderr) => {
                if (err) {
                    log.error('ESPHome Restore not completed');
                    log.error(err);
                    if (callback) {
                        callback(err, stderr);
                        clearTimeout(waitRestore);
                    }
                } else {
                    if (callback) {
                        try {
                            fse.copySync(tmpDir, esphomePth);
                            if (fs.existsSync(esphomePth)) {
                                log.debug('ESPHome data is successfully restored');
                            }
                            log.debug('Try deleting the esphome tmp directory');
                            fse.removeSync(tmpDir);
                            if (!fs.existsSync(tmpDir)) {
                                log.debug('esphome tmp directory was successfully deleted');
                            }
                            // Start esphome
                            if (startAfterRestore) {
                                adapter.getForeignObject(`system.adapter.esphome.${num[0]}`, function (err, obj) {
                                    if (obj && obj != null && obj.common.enabled == false) {
                                        adapter.setForeignState(`system.adapter.esphome.${num[0]}.alive`, true);
                                        log.debug(`esphome.${num[0]} started`);
                                    }
                                });
                            }
                        } catch (err) {
                            callback && callback(err);
                            clearTimeout(waitRestore);
                        }
                        log.debug('esphome Restore completed successfully');
                        callback && callback(null, 'ESPHome data restore done');
                        callback = null;
                        clearTimeout(waitRestore);
                    }
                }
            }), 3000);
    } catch (e) {
        if (callback) {
            callback && callback(e);
            callback = null;
            clearTimeout(waitRestore);
        }
    }
}

module.exports = {
    restore,
    isStop: false
};