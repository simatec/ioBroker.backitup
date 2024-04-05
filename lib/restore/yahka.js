const fs = require('node:fs');
const path = require('node:path');
const fse = require('fs-extra');

let waitRestore;

function restore(options, fileName, log, adapter, callback) {
    log.debug('Start Yahka Restore ...');

    let instance = fileName.split('.');
    let num = instance[1].split('_');

    const tmpDir = path.join(options.backupDir, `yahka_${num[0]}.hapdata`).replace(/\\/g, '/');
    log.debug(`Filename for Restore: ${fileName}`);

    const desiredMode = '0o2775';

    try {
        fse.ensureDirSync(tmpDir, desiredMode);
        log.debug(`yahka tmp directory created: ${tmpDir}`)
    } catch (e) {
        log.debug('yahka tmp directory cannot created');
    }

    if (fs.existsSync(`${options.path}/yahka.${num[0]}.hapdata`)) {
        try {
            fse.removeSync(`${options.path}/yahka.${num[0]}.hapdata`);
            if (!fs.existsSync(`${options.path}/yahka.${num[0]}.hapdata`)) {
                log.debug('old Yahka database directory was successfully deleted');
            }
        } catch (e) {
            log.debug('old Yahka database directory cannot deleted');
        }
    }
    // Stop yahka
    let startAfterRestore = false;
    adapter.getForeignObject(`system.adapter.yahka.${num[0]}`, function (err, obj) {
        if (obj && obj != null && obj.common.enabled == true) {
            adapter.setForeignState(`system.adapter.yahka.${num[0]}.alive`, false);
            log.debug(`yahka.${num[0]} stopped`);
            startAfterRestore = true;
        }
    });

    const decompress = require('../targz').decompress;

    try {
        waitRestore = setTimeout(() =>
            decompress({
                src: fileName,
                dest: tmpDir,
            }, (err, stderr) => {
                if (err) {
                    log.error('Yahka Restore not completed');
                    log.error(err);
                    if (callback) {
                        callback(err, stderr);
                        clearTimeout(waitRestore);
                    }
                } else {
                    if (callback) {
                        const yahkaPth = path.join(options.path, `yahka.${num[0]}.hapdata`).replace(/\\/g, '/');

                        try {
                            if (fs.existsSync(yahkaPth)) {
                                fse.emptyDirSync(yahkaPth);
                                if (!fs.readdirSync(yahkaPth).length) {
                                    log.debug('Old Yahka Database is successfully deleted');
                                }
                            }
                        } catch (err) {
                            log.debug('old Yahka database cannot deleted');
                        }

                        try {
                            fse.copySync(tmpDir, yahkaPth);
                            if (fs.existsSync(yahkaPth)) {
                                log.debug('Yahka Database is successfully restored');
                            }
                            log.debug('Try deleting the Yahka tmp directory');
                            fse.removeSync(tmpDir);
                            if (!fs.existsSync(tmpDir)) {
                                log.debug('Yahka tmp directory was successfully deleted');
                            }
                            // Start yahka
                            if (startAfterRestore) {
                                adapter.getForeignObject(`system.adapter.yahka.${num[0]}`, function (err, obj) {
                                    if (obj && !obj.common.enabled) {
                                        adapter.setForeignState(`system.adapter.yahka.${num[0]}.alive`, true);
                                        log.debug(`yahka.${num[0]} started`);
                                    }
                                });
                            }
                        } catch (err) {
                            callback && callback(err);
                            clearTimeout(waitRestore);
                        }
                        log.debug('Yahka Restore completed successfully');
                        callback && callback(null, 'yahka database restore done');
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
