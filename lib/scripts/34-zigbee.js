'use strict';
const fs = require('fs');
const targz = require('targz');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

    for (let i = 0; i <= 5; i++) {

        let pth = options.path + '/zigbee_' + i;

        if (fs.existsSync(pth)) {
            const fileName = path.join(options.backupDir , `zigbee.${i}_${getDate()}_backupiobroker.tar.gz`);

            options.context.fileNames.push(fileName);

            let timer = setInterval(() => {
                if (fs.existsSync(fileName))  {
                    const stats = fs.statSync(fileName);
                    const fileSize = Math.floor(stats.size / (1024 * 1024));
                    log.debug('Packed ' + fileSize + 'MB so far...');
                }
            }, 10000);

            targz.compress({
                src: pth,
                dest: fileName,
            }, (err, stdout, stderr) => {

                clearInterval(timer);

                if (err) {
                    options.context.errors.zigbee = err.toString();
                    stderr && log.error(stderr);
                    if (callback) {
                        callback(err, stderr);
                        callback = null;
                    }
                } else {
                    options.context.done.push('zigbee.' + i);
                    options.context.types.push('zigbee.' + i);
                    if (callback) {
                        callback(null, stdout);
                        callback = null;
                    }
                }
            });
        }
    }
}

module.exports = {
    command,
    ignoreErrors: true
};