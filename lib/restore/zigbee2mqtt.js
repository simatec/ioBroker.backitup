const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const copyFile = require('../tools').copyFile;

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
                    //await fse.copy(tmpDir, pth);
                    let files = [];
                    if (fs.existsSync(tmpDir)) {
                        files = fs.readdirSync(tmpDir);
                        let num = 0;
                        files.forEach(function (file) {
                            copyFile(path.join(tmpDir, file), path.join(pth, file),async  err => {
                                if (err) {
                                    log.error(err);
                                    callback && callback(null, 'Zigbee2MQTT restore broken');
                                    callback = null;
                                } else {
                                    num++;
                                    if (fs.existsSync(path.join(pth + "/" + file))) {
                                        log.debug(`Zigbee2MQTT file ${file} successfully restored`);
                                    }

                                }
                                if (files.length == num) {

                                    log.debug('Try deleting the Zigbee2MQTT tmp directory');
                                    await fse.remove(tmpDir);

                                    if (!fs.existsSync(tmpDir)) {
                                        log.debug('Zigbee2MQTT tmp directory was successfully deleted');
                                    }

                                    log.debug('Zigbee2MQTT Restore completed successfully');
                                    callback(null, 'Zigbee2MQTT restore done');
                                    callback = null;
                                }
                            });
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