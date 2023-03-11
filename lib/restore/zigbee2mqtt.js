const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

async function restore(options, fileName, log, adapter, callback) {

    log.debug('Start Zigbee2MQTT Restore ...');

    let timer = setInterval(async () => {
        if (fs.existsSync(options.path)) {
            log.debug('Extracting Zigbee2MQTT Backupfile...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 10000);

    const decompress = require('../targz').decompress;

    const destPth = path.join(options.path).replace(/\\/g, '/');
    const tmpDir = path.join(options.backupDir, 'zigbee2mqtt_tmp').replace(/\\/g, '/');

    try {
        await fse.ensureDir(tmpDir);
        log.debug('Zigbee2MQTT tmp directory created: ' + tmpDir)
    } catch (e) {
        log.debug('Zigbee2MQTT tmp directory cannot created');
    }

    let name;
    let pth;

    if (fs.existsSync(destPth)) {
        const stat = fs.statSync(destPth);
        if (!stat.isDirectory()) {
            const parts = destPth.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
        } else {
            pth = destPth;
        }
    }

    try {
        decompress({
            src: fileName,
            dest: tmpDir,
        }, async (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('Zigbee2MQTT Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    // Restore Backup-Files
                    if (fs.existsSync(tmpDir)) {
                        const files = fs.readdirSync(pth);

                        files.forEach(async function (file) {
                            const stat = fs.statSync(path.join(pth, file));

                            if (!stat.isDirectory()) {
                                await fse.remove(file);
                            }
                        });

                        await fse.copy(tmpDir, pth, {
                            filter: path => {
                                return !(path.indexOf('log') > -1)
                            }
                        })
                            .then(async () => {
                                log.debug('Zigbe2MQTT copy finish');

                                log.debug('Try deleting the Zigbee2MQTT tmp directory');
                                await fse.remove(tmpDir);

                                if (!fs.existsSync(tmpDir)) {
                                    log.debug('Zigbee2MQTT tmp directory was successfully deleted');
                                }

                                log.debug('Zigbee2MQTT Restore completed successfully');
                                callback(null, 'Zigbee2MQTT restore done');
                                callback = null;
                            })
                            .catch(err => {
                                log.error(err);
                                callback && callback(null, 'Zigbee2MQTT restore broken');
                                callback = null;
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
    isStop: false
};