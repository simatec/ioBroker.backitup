'use strict';

function list(options, log, callback) {
    if (options.enabled) {
        setImmediate(callback, 'Not implemented');
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, log, callback) {
    if (options.enabled) {
        // copy file to options.backupDir
        setImmediate(callback, 'Not implemented');
    } else {
        setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};