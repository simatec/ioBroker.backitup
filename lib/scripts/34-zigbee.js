'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    let zigbeeInst = [];

    const compress = require('../targz').compress;

    for (let i = 0; i <= 5; i++) {

        let pth = path.join(options.path, `zigbee_${i}`);

        if (fs.existsSync(pth)) {
            const data = fs.readdirSync(pth);

            let nameSuffix;
            if (options.hostType == 'Slave') {
                nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
            } else {
                nameSuffix = options.nameSuffix ? options.nameSuffix : '';
            }

            const fileName = path.join(options.backupDir, `zigbee.${i}_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);

            options.context.fileNames.push(fileName);

            compress({
                src: pth,
                dest: fileName,
            }, (err, stdout, stderr) => {
                if (err) {
                    options.context.errors.zigbee = err.toString();
                    stderr && log.error(stderr);
                    if (callback) {
                        callback(err, stderr);
                        callback = null;
                    }
                } else {
                    options.context.types.push('zigbee.' + i);
                    options.context.done.push('zigbee.' + i);
                    if (callback && i === 5) {
                        //callback(null, stdout);
                        //callback = null;
                    }
                }
            });
            zigbeeInst.push('zigbee.' + i);
            if (i == 5) {
                log.debug(zigbeeInst.length ? 'found zigbee database: ' + zigbeeInst : 'no zigbee database found!!');
            }
        } else if (!fs.existsSync(pth) && i === 5) {
            log.debug(zigbeeInst.length ? 'found zigbee database: ' + zigbeeInst : 'no zigbee database found!!');
            callback && callback(null, 'done');
        }
    }
}

module.exports = {
    command,
    ignoreErrors: true
};