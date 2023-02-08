'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');
const fse = require('fs-extra');
const copyFile = require('../tools').copyFile;

function command(options, log, callback) {
    let nameSuffix;
    if (options.hostType == 'Slave') {
        nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
    } else {
        nameSuffix = options.nameSuffix ? options.nameSuffix : '';
    }

    const fileName = path.join(options.backupDir, `zigbee2mqtt_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
    const sourcePth = path.join(options.path).replace(/\\/g, '/');
    const tmpDir = path.join(options.backupDir, 'zigbee2mqtt_tmp').replace(/\\/g, '/');

    options.context.fileNames.push(fileName);

    const desiredMode = '0o2775';

    if (!fs.existsSync(tmpDir)) {
        try {
            fse.ensureDirSync(tmpDir, desiredMode);
            log.debug('Created zigbee2mqtt_tmp directory');
        } catch (err) {
            log.debug(`zigbee2mqtt_tmp directory "${tmpDir}" cannot created`);
        }
    } else {
        log.debug(`Try deleting the old zigbee2mqtt_tmp directory: "${tmpDir}"`);
        try {
            fse.removeSync(tmpDir);
        } catch (err) {
            log.debug(`old zigbee2mqtt_tmp directory "${tmpDir}" cannot deleted`);
        }
        if (!fs.existsSync(tmpDir)) {
            log.debug(`old zigbee2mqtt_tmp directory "${tmpDir}" successfully deleted`);
            try {
                fse.ensureDirSync(tmpDir, desiredMode);
                log.debug('Created new zigbee2mqtt_tmp directory');
            } catch (err) {
                log.debug(`zigbee2mqtt_tmp directory "${tmpDir}" cannot created`);
            }
        }
    }

    let timer = setInterval(() => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    let name;
    let pth;
    let data = [];

    if (fs.existsSync(sourcePth)) {
        const stat = fs.statSync(sourcePth);
        if (!stat.isDirectory()) {
            const parts = sourcePth.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
            data.push(name);
        } else {
            pth = sourcePth;
            try {
                data = fs.readdirSync(pth);
            } catch (err) {
                callback && callback(err);
                //callback = null;
            }
        }
    }
    log.debug('compress from Zigbee2MQTT started ...');
    let num = 0;

    data.forEach(function (file) {
        log.debug('detected Zigbee2MQTT file: ' + file);

        copyFile(path.join(pth, file), path.join(tmpDir, file), err => {
            if (err) {
                clearInterval(timer);
                options.context.errors.zigbee2mqtt = err.toString();
                err && log.error(err);
                if (callback) {
                    callback(err);
                    //callback = null;
                }
            } else {
                num++;

                if (file.length == num) {
                    const compress = require('../targz').compress;

                    compress({
                        src: pth,
                        dest: fileName,
                    }, (err, stdout, stderr) => {

                        clearInterval(timer);

                        if (err) {
                            options.context.errors.zigbee2mqtt = err.toString();
                            stderr && log.error(stderr);
                            if (callback) {
                                callback(err, stderr);
                                callback = null;
                            }
                        } else {
                            log.debug(`Backup created: ${fileName}`);
                            options.context.done.push('zigbee2mqtt');
                            options.context.types.push('zigbee2mqtt');
                            try {
                                log.debug(`Try deleting the zigbee2mqtt tmp directory: "${tmpDir}"`);
                                fse.removeSync(tmpDir);
                                if (!fs.existsSync(tmpDir)) {
                                    log.debug(`zigbee2mqtt tmp directory "${tmpDir}" successfully deleted`);
                                }
                            } catch (err) {
                                log.debug(`zigbee2mqtt tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                                callback && callback(err);
                                //callback = null;
                            }
                            if (callback) {
                                callback(null, stdout);
                                callback = null;
                            }
                        }
                    });
                }
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};