'use strict';

const copyFile = require('../tools').copyFile;
const path = require('path');
const fs = require('fs');

function copyFiles(dir, fileNames, log, errors, callback) {
	if (!fileNames || !fileNames.length) {
		callback();
	} else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();
        try {
        	log.debug('Copy ' + onlyFileName + '...');
            copyFile(fileName, path.join(dir, onlyFileName), err => {
                if (err) {
                    errors.cifs = err;
                    log.error(err);
                }
                setImmediate(copyFiles, dir, fileNames, log, errors, callback);
			});
		} catch (e) {
        	log.error(e);
            errors.cifs = e;
            setImmediate(copyFiles, dir, fileNames, log, errors, callback);
		}
	}
}

function command(options, log, callback) {
	if (options.dir && options.context && options.context.fileNames && options.context.fileNames.length) {
		const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
		if (fs.existsSync(options.dir)) {
            copyFiles(options.dir, fileNames, log, options.context.errors, err => {
                // todo: clean to many files on Network

                if (err) {
                    options.context.errors.cifs = options.context.errors.cifs || err;
                } else {
                    options.context.done.push('cifs');
                }

                if (callback) {
                    callback(err);
                    callback = null;
                }
			});
		} else {
			callback(`Path "${options.dir}" not found`);
		}
	} else {
		callback();
	}
}

module.exports = {
    command,
    ignoreErrors: true
};