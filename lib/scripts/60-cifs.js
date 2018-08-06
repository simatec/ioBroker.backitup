'use strict';

const copyFile = require('../tools').copyFile;
const path = require('path');
const fs = require('fs');

function copyFiles(dir, fileNames, log, callback) {
	if (!fileNames || !fileNames.length) {
		callback();
	} else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();
        try {
        	log.debug('Copy ' + onlyFileName + '...');
            copyFile(fileName, path.join(dir, onlyFileName), err => {
                err && log.error(err);
                setImmediate(copyFiles, dir, fileNames, log, callback);
			});
		} catch (e) {
        	log.error(e);
            setImmediate(copyFiles, dir, fileNames, log, callback);
		}
	}
}

function command(options, log, callback) {
	if (options.context && options.context.fileNames && options.context.fileNames.length) {
		const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
		if (fs.existsSync(options.dir)) {
            copyFiles(options.dir, fileNames, log, err => {
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