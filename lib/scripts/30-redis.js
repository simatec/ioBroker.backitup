'use strict';
const fs = require('fs');

function copyFile(source, target, cb) {
    let cbCalled = false;

    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }

    const rd = fs.createReadStream(source);
    rd.on('error', err => done(err));
    const wr = fs.createWriteStream(target);
    wr.on('error', err => done(err));
    wr.on('close', ex => done());
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