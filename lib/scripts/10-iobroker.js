'use strict';
const child_process = require('node:child_process');
const getDate = require('../tools').getDate;
const getSize = require('../tools').getSize;
const path = require('node:path');
const fs = require('node:fs');

function command(options, log, callback) {

    try {
        log.debug(`Current working directory: ${process.cwd()}`);
    } catch (err) {
        log.error(`Error getting current working directory: ${err}`);
        options.context.errors.iobroker = err;
            if (callback) {
                callback(err, null, -1);
                callback = null;
            }
    }

    if (options.workDir != undefined) {
        const ioPath = options.workDir;
        log.debug(`ioPath: ${ioPath}`);

        try {
            const fileName = path.join(options.backupDir, `iobroker_${getDate()}${options.nameSuffix ? `_${options.nameSuffix}` : ''}_backupiobroker.tar.gz`);

            options.context.fileNames.push(fileName);

            const cmd = child_process.fork(ioPath, ['backup', fileName], { silent: true });
            cmd.stdout.on('data', data => log.debug(data.toString()));

            cmd.stderr.on('data', data => log.error(data.toString()));

            cmd.on('close', code => {
                options.context.done.push('iobroker');
                options.context.types.push('iobroker');

                if (fs.existsSync(fileName)) {
                    const stat = fs.statSync(fileName);

                    if (Math.round(stat.size / (1024 * 1024) * 10) / 10 > 500) {
                        log.warn(`Your backup ${fileName.split('/').pop()} has a file size of ${getSize(stat.size)}. This can lead to problems. Please check your file system for large files.`);
                    }
                } else {
                    options.context.errors.iobroker = 'ioBroker Backup not created';
                }
                if (callback) {
                    callback(null, null, code);
                    callback = null;
                }
            });

            cmd.on('error', error => {
                options.context.errors.iobroker = error;
                console.error(`error: ${error}`);
                if (callback) {
                    callback(error, null, -1);
                    callback = null;
                }
            });
        } catch (error) {
            options.context.errors.iobroker = error;
            if (callback) {
                callback(error, null, -1);
                callback = null;
            }
        }
    } else {
        options.context.errors.iobroker = 'Unable to read iobroker path';
        log.error('Unable to read iobroker path');
        if (callback) {
            callback(null, null, -1);
            callback = null;
        }
    }
}

module.exports = {
    command,
    ignoreErrors: false
};
