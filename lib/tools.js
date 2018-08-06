const fs = require('fs');

function getDate(d) {
    d = d || new Date();

    return d.getFullYear() + '_' +
        ('0' + (d.getMonth() + 1)).slice(-2) + '_' +
        ('0' + d.getDate()).slice(-2) + '-' +
        ('0' + d.getHours()).slice(-2) + '_' +
        ('0' + d.getMinutes()).slice(-2) + '_' +
        ('0' + d.getSeconds()).slice(-2);
}

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

module.exports = {
    getDate,
    copyFile
};