'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

    const fileName = path.join(options.backupDir, `historyDB_${getDate()}_backupiobroker.tar.gz`);

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
    let data = [];

    if (fs.existsSync(options.path)) {
        const stat = fs.statSync(options.path);
        if (!stat.isDirectory()) {
            const parts = options.path.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
            data.push(name);
        } else {
            pth = options.path;
            try {
                data = fs.readdirSync(pth);
            } catch (err) {
                callback(err);
                callback = null;
            }
        }
    }

    const tar = require('tar');

    const f = fs.createWriteStream(fileName);

    f.on('finish', () => {
        clearInterval(timer);
        log.debug(`Backup created: ${fileName}`);
        options.context.done.push('historyDB');
        options.context.types.push('historyDB');
        if (callback) {
            callback(null);
            callback = null;
        }
    });
    f.on('error', err => {
        clearInterval(timer);
        options.context.errors.historyDB = err.toString();
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
}

module.exports = {
    command,
    ignoreErrors: true
};