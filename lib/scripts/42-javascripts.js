'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    let nameSuffix;
	if (options.hostType == 'Slave') {
		nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
	} else {
		nameSuffix = options.nameSuffix ? options.nameSuffix : '';
	}
    const fileName = path.join(options.backupDir, `javascripts_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);

    options.context.fileNames.push(fileName);

    let timer = setInterval(() => {
        if (fs.existsSync(fileName)) {
            const stats = fs.statSync(fileName);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Packed ' + fileSize + 'MB so far...');
        }
    }, 5000);

    let name;
    let pth;

    if (fs.existsSync(options.filePath)) {
        const stat = fs.statSync(options.filePath);
        if (!stat.isDirectory()) {
            const parts = options.filePath.replace(/\\/g, '/').split('/');
            name = parts.pop();
            pth = parts.join('/');
        } else {
            pth = options.filePath;
        }

        const compress = require('../targz').compress;

        compress({
            src: pth,
            dest: fileName,
            tar: {
                ignore: function (name) {
                    return path.extname(name) === '.gz' || path.extname(name) === '.sbk' // ignore .tar.gz and tar.sbk files when packing
                }
            }
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                options.context.errors.javascripts = err.toString();
                stderr && log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                log.debug(`Backup created: ${fileName}`);
                options.context.done.push('javascripts');
                options.context.types.push('javascripts');
                if (callback) {
                    callback(null, stdout);
                    callback = null;
                }
            }
        });
    } else {
        log.debug(`javascript directory "${options.filePath}" not found`);
        callback && callback(null);
        callback = null;
    }
}

module.exports = {
    command,
    ignoreErrors: true
};