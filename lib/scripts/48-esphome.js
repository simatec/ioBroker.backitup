'use strict';
const fs = require('node:fs');
const path = require('node:path');
const getDate = require('../tools').getDate;

async function command(options, log, callback) {
    let esphomeInst = [];
    let dirs = [];

    // find all esphome dirs
    if (fs.existsSync(options.path)) {
        dirs = fs.readdirSync(options.path)
            .filter(name => {
                const fullPath = path.join(options.path, name);
                return fs.statSync(fullPath).isDirectory() && name.startsWith('esphome.');
            });
    }

    if (dirs.length) {
        log.debug(`found esphome data: ${dirs}`);
    } else {
        log.warn('no esphome data found!!');
        callback && callback(null, 'done');
        return;
    }

    for (const dirName of dirs) {
        const pth = path.join(options.path, dirName);

        const nameSuffix = options.hostType === 'Slave'
            ? (options.slaveSuffix || '')
            : (options.nameSuffix || '');

        const fileName = path.join(
            options.backupDir,
            `${dirName}_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`
        );

        // compress dir
        try {
            await compressAsync(pth, fileName);
            log.debug(`Backup created: ${fileName}`);

            options.context.fileNames.push(fileName);
            options.context.types.push(dirName);
            options.context.done.push(dirName);
            esphomeInst.push(dirName);
        } catch (err) {
            options.context.errors.esphome = err.toString();
            log.error(err);

            if (callback) {
                callback(err, err.toString());
                callback = null;
            }
        }
    }

    callback && callback(null, 'done');
}

// compression as Promise
function compressAsync(pth, fileName) {
    return new Promise((resolve, reject) => {
        const compress = require('../targz').compress;

        compress({
            src: pth,
            dest: fileName,
            tar: {
                ignore: name => path.basename(name) === '.esphome' || path.basename(name) === '.gitignore'
            },
        }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};
