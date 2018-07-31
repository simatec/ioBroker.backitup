'use strict';
const fs = require('fs');

function copyFile(source, target, cb) {
    const rd = fs.createReadStream(source);
    rd.on('error', err => {
        if (cb) {
            cb(err);
            cb = null;
        }
    });

    const wr = fs.createWriteStream(target);
    wr.on('error', err => {
        if (cb) {
            cb(err);
            cb = null;
        }
    });
    
    wr.on('close', ex => {
        if (cb) {
            cb();
            cb = null;
        }
    });
    rd.pipe(wr);
}

function command(options, log, callback) {
    copyFile(options.path, options.backupDir + '/redis.rdp',  err => {
        // pack it
        callback(err);
    });
}

module.exports = {
    command,
    ignoreErrors: true
};