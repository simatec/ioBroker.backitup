'use strict';
import { existsSync, statSync, readdirSync } from 'fs';
import { getDate } from '../tools';
import { join } from 'path';

function command(options, log, callback) {
    let nameSuffix;
    if (options.hostType == 'Slave') {
        nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
    } else {
        nameSuffix = options.nameSuffix ? options.nameSuffix : '';
    }

    const fileName = join(options.backupDir, `zigbee2mqtt_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
    const sourcePth = join(options.path).replace(/\\/g, '/');

    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (existsSync(fileName)) {
            const stats = statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    let name;
    let pth;
    let data = [];

    if (existsSync(sourcePth)) {
        const stat = statSync(sourcePth);
        if (!stat.isDirectory()) {
            const parts = sourcePth.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
            data.push(name);
        } else {
            pth = sourcePth;
            try {
                data = readdirSync(pth);
            } catch (err) {
                callback && callback(err);
            }
        }
    }
    log.debug('compress from Zigbee2MQTT started ...');

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

            if (callback) {
                callback(null, stdout);
                callback = null;
            }
        }
    });
}

export default {
    command,
    ignoreErrors: true
};