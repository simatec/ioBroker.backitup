'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    let zigbeeInst = [];

    for (let i = 0; i <= 5; i++) {

        let pth = path.join(options.path, `zigbee_${i}`);

        if (fs.existsSync(pth)) {
            const data = fs.readdirSync(pth);
            const fileName = path.join(options.backupDir, `zigbee.${i}_${getDate()}_backupiobroker.tar.gz`);

            options.context.fileNames.push(fileName);

            const tar = require('tar');

            const f = fs.createWriteStream(fileName);

            f.on('finish', () => {
                options.context.types.push('zigbee.' + i);
                options.context.done.push('zigbee.' + i);
                /*
                if (callback && i === 5) {
                    callback(null);
                    callback = null;
                }
                */
            });
            f.on('error', err => {
                options.context.errors.zigbee = err.toString();
                err && log.error(err);
                if (callback) {
                    callback(err);
                    callback = null;
                }
            });

            try {
                log.debug('The following files were found for the backup: ' + data);
                tar.create({ gzip: true, cwd: pth }, data).pipe(f);
            } catch (err) {
                clearInterval(timer);
                callback(err);
                callback = null;
            }
            zigbeeInst.push('zigbee.' + i);
            if (i == 5) {
                log.debug(zigbeeInst.length ? 'found zigbee database: ' + zigbeeInst : 'no zigbee database found!!');
            }
        } else if (!fs.existsSync(pth) && i === 5) {
            log.debug(zigbeeInst.length ? 'found zigbee database: ' + zigbeeInst : 'no zigbee database found!!');
            callback(null, 'done');
        }
    }
}

module.exports = {
    command,
    ignoreErrors: true
};