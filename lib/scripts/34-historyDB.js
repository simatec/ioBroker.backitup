'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    let nameSuffix;
    if (options.hostType == 'Slave') {
        nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
    } else {
        nameSuffix = options.nameSuffix ? options.nameSuffix : '';
    }

    const fileName = path.join(options.backupDir, `historyDB_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);

    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    let name;
    let pth;

    if (fs.existsSync(options.path)) {
        const stat = fs.statSync(options.path);
        if (!stat.isDirectory()) {
            const parts = options.path.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
        } else {
            pth = options.path;
        }
    }
    log.debug('compress from historyDB started ...');

    const compress = require('../targz').compress;

    compress({
        src: pth,
        dest: fileName,
        tar: {
            ignore: nm => name && name !== nm.replace(/\\/g, '/').split('/').pop()
        },
    }, (err, stdout, stderr) => {

        clearInterval(timer);

        if (err) {
            options.context.errors.historyDB = err.toString();
            stderr && log.error(stderr);
            if (callback) {
                callback(err, stderr);
                callback = null;
            }
        } else {
            log.debug(`Backup created: ${fileName}`);
            options.context.done.push('historyDB');
            options.context.types.push('historyDB');
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