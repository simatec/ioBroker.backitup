const fs = require('fs');
const targz = require('targz');
const path = require('path');
const utils = require('../utils');

function restore(options, fileName, log, callback) {

    const oldFile = (options.path + '/dump.rdb');

    if (fs.existsSync(oldFile))  {
        fs.unlinkSync(oldFile);
    }

    let timer = setInterval(() => {
        if (fs.existsSync(fileName))  {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Extract ' + fileSize + 'MB so far...');
        }
    }, 10000);

    targz.decompress({
        src: fileName,
        dest: options.path,
    }, (err, stdout, stderr) => {

        clearInterval(timer);

        if (err) {
            log.error(stderr);
            if (callback) {
                callback(err, stderr);
                callback = null;
            }
        } else {
            if (callback) {
                callback(null, stdout);
                callback = null;
            }
        }
    });
}

module.exports = {
    restore,
    isStop: true
};