const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

let waitRestore;

function restore(options, fileName, log, adapter, callback) {
    log.debug('Start Node-Red Restore ...');

    const onlyFileName = fileName.split('/').pop();
    const instance = onlyFileName.split('.');
    const num = instance[1].split('_');
    const nrDir = num[0] === '0' ? 'node-red' : `node-red.${num[0]}`;

    const tmpDir = path.join(options.backupDir, `node-red.${num[0]}`).replace(/\\/g, '/');
    const noderedPth = path.join(options.path, nrDir).replace(/\\/g, '/');

    log.debug('Filename for Restore: ' + fileName);

    const desiredMode = '0o2775';

    try {
        fse.ensureDirSync(tmpDir, desiredMode);
        log.debug('node-red tmp directory created: ' + tmpDir)
    } catch (e) {
        log.debug('node-red tmp directory cannot created');
    }

    if (fs.existsSync(noderedPth)) {
        try {
            fse.emptyDirSync(noderedPth);
            if (fs.readdirSync(noderedPth) == 0) {
                log.debug('old Node-Red database was successfully deleted');
            }
        } catch (e) {
            log.debug('old Node-Red database cannot deleted');
        }
    }
    // Stop node-red
    let startAfterRestore = false;
    adapter.getForeignObject(`system.adapter.node-red.${num[0]}`, function (err, obj) {
        if (obj && obj != null && obj.common.enabled == true) {
            adapter.setForeignState(`system.adapter.node-red.${num[0]}.alive`, false);
            log.debug(`node-red.${num[0]} stopped`);
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
                    log.error('Node-Red Restore not completed');
                    log.error(err);
                    if (callback) {
                        callback(err, stderr);
                        clearTimeout(waitRestore);
                    }
                } else {
                    if (callback) {
                        try {
                            fse.copySync(tmpDir, noderedPth);
                            if (fs.existsSync(noderedPth)) {
                                log.debug('Node-Red Database is successfully restored');
                            }
                            log.debug('Try deleting the Node-Red tmp directory');
                            fse.removeSync(tmpDir);
                            if (!fs.existsSync(tmpDir)) {
                                log.debug('Node-Red tmp directory was successfully deleted');
                            }
                            const child_process = require('child_process');

                            if (fs.existsSync(noderedPth)) {
                                child_process.exec('npm install', { cwd: noderedPth }, function (error) {
                                    if (error) {
                                        log.debug(`To complete the restore, please run an "npm install" manually in the path "${noderedPth}".`);
                                        callback && callback(error);
                                        clearTimeout(waitRestore);
                                    } else {
                                        // Start node-red
                                        if (startAfterRestore) {
                                            adapter.getForeignObject(`system.adapter.node-red.${num[0]}`, function (err, obj) {
                                                if (obj && obj != null && obj.common.enabled == false) {
                                                    adapter.setForeignState(`system.adapter.node-red.${num[0]}.alive`, true);
                                                    log.debug(`node-red.${num[0]} started`);
                                                }
                                            });
                                            log.debug('Node-Red Restore completed successfully');
                                            callback && callback(null, 'node-red restore done');
                                            callback = null;
                                            clearTimeout(waitRestore);
                                        }
                                    }
                                });
                            }
                        } catch (err) {
                            callback && callback(err);
                            clearTimeout(waitRestore);
                        }
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