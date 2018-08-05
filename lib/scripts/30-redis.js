'use strict';
const fs = require('fs');
const targz = require('targz');
const getDate = request('../tools').getDate;
const path = require('path');

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
    const fileName = path.join(options.backupDir , `redis_${getDate()}_backupiobroker.tar.gz`);

    options.context.fileNames = options.context.fileNames || [];
    options.context.fileNames.push(fileName);

    targz.compress({
        src: options.path,
        dest: fileName,
    }, (err, stdout, stderr) => {
        if (err) {
            log.error(stderr);
            callback(err, stderr)
        } else {
            callback(null, stdout);
        }
    });
}

module.exports = {
    command,
    ignoreErrors: true
};