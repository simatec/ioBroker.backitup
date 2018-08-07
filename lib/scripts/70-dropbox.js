'use strict';

const path = require('path');
const fs = require('fs');

function copyFiles(dbx, dir, fileNames, log, callback) {
    if (!fileNames || !fileNames.length) {
        callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        try {
            log.debug('Copy ' + onlyFileName + '...');

            // This uploads basic.js to the root of your dropbox
            dbx.filesUpload({path: path.join(dir, onlyFileName), contents: fs.readFileSync(fileName)})
                .then(response => log.debug(response))
                .catch(err => log.error(err))
                .then(() => setImmediate(copyFiles, dbx, dir, fileNames, log, callback));

        } catch (e) {
            log.error(e);
            setImmediate(copyFiles, dbx, dir, fileNames, log, callback)
        }
    }
}

function cleanFiles(dbx, dir, num, log, callback) {
    dbx.filesListFolder({path: dir})
        .then(response => {
            // todo
            log.debug(response);
        })
        .catch(error => {
            log.error(error);
        })
        .then(() => callback && callback());
}

function command(options, log, callback) {
    if (options.accessToken && options.context && options.context.fileNames && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        const Dropbox = require('dropbox').Dropbox;
        const dbx = new Dropbox({accessToken: options.accessToken});

        copyFiles(dbx, options.dir || '', fileNames, log, err => {
            err && log.error(err);
            cleanFiles(dbx, options.dir, options.deleteBackupAfter, log, callback);
        });
    } else {
        callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true
};