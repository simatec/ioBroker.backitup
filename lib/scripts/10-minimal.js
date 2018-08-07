'use strict';
const child_process = require('child_process');
const utils = require('../utils');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    
    let ioPath = utils.controllerDir + '/iobroker.js';

    try {
        const fileName = path.join(options.backupDir , `minimal${options.nameSuffix ? '_' + options.nameSuffix : ''}_${getDate()}_backupiobroker.tar.gz`);

        options.context.fileNames.push(fileName);

        const cmd = child_process.fork(ioPath, ['backup', fileName], {silent: true});
        cmd.stdout.on('data', data => log.debug(data.toString()));

        cmd.stderr.on('data', data => log.error(data.toString()));

        cmd.on('close', code => {
            options.context.done.minimal = true;
            console.log('Closed');
            if (callback) {
                callback(null, null, code);
                callback = null;
            }
        });

        cmd.on('error', error => {
            options.context.error.minimal = error;
            console.error('error' + error);
            if (callback) {
                callback(error, null, -1);
                callback = null;
            }
        });
    } catch (error) {
        options.context.error.minimal = error;
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