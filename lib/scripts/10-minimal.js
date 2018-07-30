'use strict';
const child_process = require('child_process');
const utils = require('../utils');

function code(options, log, callback) {
    let ioPath = utils.controllerDir + '/iobroker.js';

    child_process.fork(ioPath, ['backup', 'tempfile.tar.gz'], (error, stdout, stderr) => {
        if (error) {
            log.error(stderr);
            callback(error)
        } else {
            callback(null, stdout);
        }
    });
}

module.exports = code;