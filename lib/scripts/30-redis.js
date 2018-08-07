'use strict';
const fs = require('fs');
const targz = require('targz');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

	const fileName = path.join(options.backupDir , `redis_${getDate()}_backupiobroker.tar.gz`);

	options.context.fileNames = options.context.fileNames || [];
    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName))  {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 10000);

    targz.compress({
        src: options.path,
        dest: fileName,
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
    command,
    ignoreErrors: true
};