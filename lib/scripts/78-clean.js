'use strict';

const copyFile = require('../tools').copyFile;
const path = require('path');
const fs = require('fs');

function deleteFiles(files, log, errors) {
    try {
        for (let f = 0; f < files.length; f++) {
            log.debug('delete ' + files[f]);
            fs.unlinkSync(files[f]);
        }
        return true;
    } catch (e) {
        errors.clean = errors.clean || e;
        log.error(e);
    }
}

function command(options, log, callback) {
	if (options.dir && options.context && options.context.fileNames && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        // delete files only if no errors
        const errors = Object.keys(options.context.errors);

        if (!errors.length) {
            if (deleteFiles(fileNames, log, options.context.errors)) {
                options.context.done.push('clean');
            }
        } else {
            log.error('Backup files not deleted from ' + options.backupDir + ' because some errors.');
        }
	}

	callback();
}

module.exports = {
    command,
    ignoreErrors: true
};