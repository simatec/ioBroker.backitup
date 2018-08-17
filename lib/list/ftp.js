'use strict';

function list(options, log, callback) {
    if (options.enabled) {
        callback('Not implemented');
    } else {
        callback();
    }
}

function getFile(options, fileName, log, callback) {
    if (options.enabled) {
        // copy file to options.backupDir
        callback('Not implemented');
    } else {
        callback('Not configured');
    }
}

module.exports = {
    list,
    getFile
};