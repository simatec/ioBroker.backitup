'use strict';

const targz = require('targz');
const path = require('path');
const getDate = require('../tools').getDate;

function command(options, log, callback) {
    const fileName = path.join(options.backupDir , `total${options.nameSuffix ? '_' + options.nameSuffix : ''}_${getDate()}_backupiobroker.tar.gz`);

    options.context.fileNames = options.context.fileNames || [];
    options.context.fileNames.push(fileName);

    targz.compress({
        src: options.dir,
        dest: fileName,
        tar: {
            ignore: name => path.dirname(name) === options.backupDir
        },
        gz: {
            level: 6,
            memLevel: 6
        }
    }, (err, stdout, stderr) => {
        if (err) {
            log.error(stderr);
            callback(err)
        } else {
            callback(null, stdout);
        }
    });
}

module.exports = {
    command,
    ignoreErrors: true
};