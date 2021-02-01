'use strict';
const fs = require('fs');
const targz = require('targz');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

    const fileName = path.join(options.backupDir , `javascripts_${getDate()}_backupiobroker.tar.gz`);

    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName))  {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 5000);

    let name;
    let pth;
    if (fs.existsSync(options.filePath)) {
        const stat = fs.statSync(options.filePath);
        if (!stat.isDirectory()) {
            const parts = options.filePath.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
        } else {
            pth = options.filePath;
        }
    }

    targz.compress({
        src: pth,
        dest: fileName,
        tar: {
            ignore: nm => name && name !== nm.replace(/\\/g, '/').split('/').pop()
        },
    }, (err, stdout, stderr) => {

        clearInterval(timer);

        if (err) {
            options.context.errors.javascripts = err.toString();
            stderr && log.error(stderr);
            if (callback) {
                callback(err, stderr);
                callback = null;
            }
        } else {
            options.context.done.push('javascripts');
            options.context.types.push('javascripts');
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