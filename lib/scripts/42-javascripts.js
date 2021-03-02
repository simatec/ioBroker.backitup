'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

    const fileName = path.join(options.backupDir, `javascripts_${getDate()}_backupiobroker.tar.gz`);

    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 5000);

    let name;
    let pth;
    let data = [];

    if (fs.existsSync(options.filePath)) {
        const stat = fs.statSync(options.filePath);
        if (!stat.isDirectory()) {
            const parts = options.filePath.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
            data.push(name);
        } else {
            pth = options.filePath;
            data = fs.readdirSync(pth);
        }

        const tar = require('tar');

        const f = fs.createWriteStream(fileName);

        f.on('finish', () => {
            clearInterval(timer);
            log.debug(`Backup created: ${fileName}`);
            options.context.done.push('javascripts');
            options.context.types.push('javascripts');
            if (callback) {
                callback(null);
                callback = null;
            }
        });
        f.on('error', err => {
            clearInterval(timer);
            options.context.errors.javascripts = err.toString();
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
    } else {
        log.debug(`javascript directory "${options.filePath}" not found`);
        callback(null);
        callback = null;
    }
}

module.exports = {
    command,
    ignoreErrors: true
};