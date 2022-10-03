'use strict';
const child_process = require('child_process');
const utils = require('@iobroker/adapter-core');
const getDate = require('../tools').getDate;
const getSize = require('../tools').getSize;
const path = require('path');
const fs = require('fs');

function command(options, log, callback) {

    const ioPath = require.resolve('iobroker.js-controller/iobroker.js');

    try {
        const fileName = path.join(options.backupDir, `iobroker_${getDate()}${options.nameSuffix ? '_' + options.nameSuffix : ''}_backupiobroker.tar.gz`);

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
            }
            if (callback) {
                callback(null, null, code);
                callback = null;
            }
        });

        cmd.on('error', error => {
            options.context.errors.iobroker = error;
            console.error('error' + error);
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
}

module.exports = {
    command,
    ignoreErrors: false
};