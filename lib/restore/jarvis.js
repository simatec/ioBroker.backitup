const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const fs_async = require('fs').promises;

async function restore(options, fileName, log, adapter, callback) {
    log.debug('Start Jarvis Restore ...');

    let instance = fileName.split('.');
    let num = instance[1].split('_');

    const tmpDir = path.join(options.backupDir, `jarvis_${num[0]}`).replace(/\\/g, '/');
    const stateDir = path.join(tmpDir, 'states').replace(/\\/g, '/');

    log.debug('filename for restore: ' + fileName);

    // Stop jarvis
    let startAfterRestore = false;

    const obj = await adapter.getForeignObjectAsync(`system.adapter.jarvis.${num[0]}`);

    if (obj && obj.common && obj.common.enabled == true) {
        await adapter.setForeignStateAsync(`system.adapter.jarvis.${num[0]}.alive`, false);
        log.debug(`jarvis.${num[0]} stopped`);
        startAfterRestore = true;
    }

    try {
        await fse.ensureDir(tmpDir);
        log.debug('jarvis tmp directory created: ' + tmpDir)
    } catch (e) {
        log.debug('jarvis tmp directory cannot created');
    }

    const pthJarvis = path.join(options.path, 'jarvis');
    const pth = path.join(pthJarvis, num[0]);

    if (fs.existsSync(pth)) {
        try {
            await fse.remove(pth);
            if (!fs.existsSync(pth)) {
                log.debug('old jarvis database directory was successfully deleted');
            }
        } catch (e) {
            log.debug('old jarvis database directory cannot deleted');
        }
    }

    const decompress = require('../targz').decompress;

    try {
        decompress({
            src: fileName,
            dest: tmpDir,
        }, async (err, stdout, stderr) => {
            if (err) {
                log.error('jarvis restore not completed');
                log.error(err);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    try {
                        // Restore States
                        const object = await fs_async.readFile(path.join(stateDir, 'states.json'));

                        if (object) {
                            const jarvisObjects = JSON.parse(object);

                            for (const i in jarvisObjects) {
                                let _object;
                                try {
                                    _object = await adapter.getForeignObjectAsync(jarvisObjects[i].id);
                                } catch (err) {
                                    log.debug(err);
                                }
                                if (_object) {
                                    try {
                                        if (jarvisObjects[i].value !== null) {
                                            await adapter.setForeignStateAsync(jarvisObjects[i].id, jarvisObjects[i].value, true);
                                        }
                                    } catch (err) {
                                        log.debug(`Error on set Object: ${err}`);
                                    }
                                }
                            }
                        }

                        log.debug('Try deleting the states tmp directory');
                        await fse.remove(stateDir);
                        if (!fs.existsSync(stateDir)) {
                            log.debug('states tmp directory was successfully deleted');
                        }

                        // Restore Backup-Files
                        await fse.copy(tmpDir, pth);
                        if (fs.existsSync(pth)) {
                            log.debug('jarvis database is successfully restored');
                        }
                        // Start jarvis
                        if (startAfterRestore) {
                            const obj = await adapter.getForeignObjectAsync(`system.adapter.jarvis.${num[0]}`);

                            if (obj && obj.common && obj.common.enabled == false) {
                                await adapter.setForeignStateAsync(`system.adapter.jarvis.${num[0]}.alive`, true);
                                log.debug(`jarvis.${num[0]} started`);
                            }

                        }
                        log.debug('Try deleting the jarvis tmp directory');
                        await fse.remove(tmpDir);
                        if (!fs.existsSync(tmpDir)) {
                            log.debug('jarvis tmp directory was successfully deleted');
                        }
                    } catch (err) {
                        callback && callback(err);
                        callback = null;
                    }
                    log.debug('jarvis Restore completed successfully');
                    callback && callback(null, 'jarvis database restore done');
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
    isStop: false
};