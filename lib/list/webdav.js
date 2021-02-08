'use strict';
const fs = require('fs');
//const path = require('path');

function list(restoreSource, options, types, log, callback) {
    if (options.username && options.pass && options.url && (!restoreSource || restoreSource === 'webdav')) {

        const { createClient } = require("webdav");

        let client;
        try {
            client = createClient(
                options.url,
                {
                    username: options.username,
                    password: options.pass,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );
        } catch (err) {
            log.error(`cannot conntect to WebDAV: ${err}`);
            callback && callback();
        }

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (options.ownDir === true) {
            dir = (options.dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        try {
            client
                .getDirectoryContents(dir)
                .then(contents => {
                    if (contents) {
                        contents = contents.map(file => {
                            return { path: file.filename, name: file.filename.replace(/\\/g, '/').split('/').pop(), size: file.size }
                        }).filter(file => (types.indexOf(file.name.split('_')[0]) !== -1 || types.indexOf(file.name.split('.')[0]) !== -1) && file.name.split('.').pop() == 'gz');

                        const files = {};
                        contents.forEach(file => {
                            const type = file.name.split('_')[0];
                            files[type] = files[type] || [];
                            files[type].push(file);
                        });
                        callback(null, files, 'webdav');
                    } else {
                        callback && callback(err)
                    }
                })
                .catch(err => {
                    log.error(`cannot conntect to WebDAV: ${err}`);
                    callback && callback();
                });
        } catch (e) {
            setImmediate(callback, e);
        }
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {
    if (options.webdav.username && options.webdav.pass && options.webdav.url) {

        const { createClient } = require("webdav");

        // copy file to options.backupDir
        let client;
        try {
            client = createClient(
                options.webdav.url,
                {
                    username: options.webdav.username,
                    password: options.webdav.pass,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );
        } catch (err) {
            log.error(`cannot conntect to WebDAV: ${err}`);
            callback && callback();
        }

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (options.ownDir === true) {
            dir = (options.dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        try {
            log.debug('WebDAV: Download of "' + fileName + '" started');

            const writeStream = fs.createWriteStream(toStoreName);
            writeStream
                .on('error', err => {
                    log.error('WebDAV: ' + err);
                    callback && callback(err);
                    callback = null;
                })
                .on('close', result => {
                    log.debug('WebDAV: Download of "' + fileName + '" finish');
                    callback();
                });
            client
                .createReadStream(fileName)
                .pipe(writeStream);
        } catch (e) {
            log.debug(e);
            callback && setImmediate(callback, e);
        }
    } else {
        callback && setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};