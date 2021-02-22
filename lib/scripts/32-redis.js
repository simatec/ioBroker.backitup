'use strict';
const fs = require('fs');
//const targz = require('targz');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

    log.debug('Start Redis Backup ...');

    const fileName = path.join(options.backupDir, `redis_${getDate()}_backupiobroker.tar.gz`);

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

    // Test tar start
    const tar = require('tar');

    const f = fs.createWriteStream(fileName);

    f.on('finish', () => {
        clearInterval(timer);
        log.debug(`Backup created: ${fileName}`);
        options.context.done.push('redis');
        options.context.types.push('redis');
        if (callback) {
            callback(null);
            callback = null;
        }
    });
    f.on('error', err => {
        clearInterval(timer);
        options.context.errors.redis = err.toString();
        err && log.error(err);
        if (callback) {
            callback(err, stderr);
            callback = null;
        }
    });

    try {
        const data = fs.readdirSync(pth);
        log.debug('The following files were found for the backup: ' + data);
        tar.create({ gzip: true, cwd: pth }, data).pipe(f);
    } catch (err) {
        callback(err);
        callback = null;
    }
    // test tar end

    /*
    targz.compress({
        src: pth,
        dest: fileName,
        tar: {
            ignore: nm => name && name !== nm.replace(/\\/g, '/').split('/').pop()
        },
    }, (err, stdout, stderr) => {

        clearInterval(timer);

        if (err) {
            options.context.errors.redis = err.toString();
            stderr && log.error(stderr);
            if (callback) {
                callback(err, stderr);
                callback = null;
            }
        } else {
            options.context.done.push('redis');
            options.context.types.push('redis');
            if (callback) {
                callback(null, stdout);
                callback = null;
            }
        }
    });
    */
}

module.exports = {
    command,
    ignoreErrors: true
};