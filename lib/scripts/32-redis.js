'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');
const copyFile = require('../tools').copyFile;
const fse = require('fs-extra');

function command(options, log, callback) {

    log.debug('Start Redis Backup ...');

    const fileName = path.join(options.backupDir, `redis_${getDate()}_backupiobroker.tar.gz`);

    const tmpDir = path.join(options.backupDir, 'redistmp').replace(/\\/g, '/');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
        log.debug('Created redistmp directory');
    } else {
        log.debug(`Try deleting the old redis tmp directory: "${tmpDir}"`);
        fse.removeSync(tmpDir);
        if (!fs.existsSync(tmpDir)) {
            log.debug(`old redis tmp directory "${tmpDir}" successfully deleted`);
            fs.mkdirSync(tmpDir);
            log.debug('Created redistmp directory');
        }
    }

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
            data = fs.readdirSync(pth);
        }
    }

    data.forEach(function (file) {
        try {
            //copyFile(path.join(pth, file), path.join(tmpDir, file), err => {
            fse.copy(path.join(pth, file), path.join(tmpDir, file), err => {
                if (err) {
                    clearInterval(timer);
                    options.context.errors.redis = err.toString();
                    err && log.error(err);
                    if (callback) {
                        callback(err);
                        callback = null;
                    }
                } else {
                    const tar = require('tar');

                    const f = fs.createWriteStream(fileName);

                    f.on('finish', () => {
                        clearInterval(timer);
                        log.debug(`Backup created: ${fileName}`);
                        options.context.done.push('redis');
                        options.context.types.push('redis');
                        try {
                            log.debug(`Try deleting the redis tmp directory: "${tmpDir}"`);
                            fse.removeSync(tmpDir);
                            if (!fs.existsSync(tmpDir)) {
                                log.debug(`redis tmp directory "${tmpDir}" successfully deleted`);
                            }
                        } catch (err) {
                            log.debug(`redis tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                            callback(err);
                            callback = null;
                        }
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
                            callback(err);
                            callback = null;
                        }
                    });

                    try {
                        log.debug('The following files were found for the backup: ' + data);
                        tar.create({ gzip: true, cwd: tmpDir }, data).pipe(f);
                    } catch (err) {
                        clearInterval(timer);
                        callback(err);
                        callback = null;
                    }
                }
            });
        } catch (err) {
            clearInterval(timer);
            callback(err);
            callback = null;
        }
    });
}

module.exports = {
    command,
    ignoreErrors: true
};