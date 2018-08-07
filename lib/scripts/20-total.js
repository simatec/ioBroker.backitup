'use strict';

const targz = require('targz');
const path = require('path');
const getDate = require('../tools').getDate;
const fs = require('fs');

function command(options, log, callback) {
    const fileName = path.join(options.backupDir , `total${options.nameSuffix ? '_' + options.nameSuffix : ''}_${getDate()}_backupiobroker.tar.gz`);

    options.context.fileNames.push(fileName);

    log.debug('TAR started...');

    let timer = setInterval(() => {
        if (fs.existsSync(fileName))  {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    targz.compress({
        src: options.dir,
        dest: fileName,
        tar: {
            ignore: name => path.dirname(name) === options.backupDir
        },
        gz: {
            level: 6,
            memLevel: 6
        }
    }, (err, stdout, stderr) => {

        clearInterval(timer);

        if (err) {
            options.context.errors.total = err;
            log.error(stderr);
            if (callback) {
                callback(err, stderr);
                callback = null;
            }
        } else {
            options.context.done.push('total');
            if (callback) {
                callback(null, stdout);
                callback = null;
            }
        }
    });
}

module.exports = {
    command,
    ignoreErrors: true
};