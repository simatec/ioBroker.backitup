'use strict';
const child_process = require('child_process');
const utils = require('../utils');

function command(options, log, callback) {
    

    const d = new Date();
    
    const bkpName = options.name + '_' + options.nameSuffix + '_' + d.getFullYear() + '_' +
        ('0' + (d.getMonth() + 1)).slice(-2) + '_' +
        ('0' + d.getDate()).slice(-2) + '-' +
        ('0' + d.getHours()).slice(-2) + '_' +
        ('0' + d.getMinutes()).slice(-2) + '_' +
        ('0' + d.getSeconds()).slice(-2) + '_backupiobroker.tar.gz';
    
    let ioPath = utils.controllerDir + '/iobroker.js';

    try {
        const cmd = child_process.fork(ioPath, ['backup', bkpName], {silent: true});
        cmd.stdout.on('data', data => log.debug(data.toString()));

        cmd.stderr.on('data', data => log.error(data.toString()));

        cmd.on('close', code => {
            console.log('Closed');
            if (callback) {
                callback(null, null, code);
                callback = null;
            }
        });

        cmd.on('error', (error) => {
            console.error('error' + error);
            if (callback) {
                callback(error, null, -1);
                callback = null;
            }
        });
    } catch (error) {
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