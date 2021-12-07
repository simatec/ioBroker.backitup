'use strict';
const fs = require('fs');
//const path = require('path');

function list(restoreSource, options, types, log, callback) {
    try {
        const wd_username = options.username !== undefined ? options.username : options.webdav.username !== undefined ? options.webdav.username : '';
        const wd_pass = options.pass !== undefined ? options.pass : options.webdav.pass !== undefined ? options.webdav.pass : '';
        const wd_url = options.url !== undefined ? options.url : options.webdav.url !== undefined ? options.webdav.url : '';
        const wd_dir = options.dir !== undefined ? options.dir : options.webdav.dir !== undefined ? options.webdav.dir : '/';
        const wd_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.webdav.dirMinimal !== undefined ? options.webdav.dirMinimal : '/';
        const wd_ownDir = options.ownDir !== undefined ? options.ownDir : options.webdav.ownDir !== undefined ? options.webdav.ownDir : false;
        const wd_signedCertificates = options.signedCertificates !== undefined ? options.signedCertificates : options.webdav.signedCertificates !== undefined ? options.webdav.signedCertificates : true;

        if (wd_username && wd_pass && wd_url && (!restoreSource || restoreSource === 'webdav')) {

            const { createClient } = require("webdav");
            const agent = require("https").Agent({ rejectUnauthorized: wd_signedCertificates });
            let client;
            try {
                client = createClient(
                    wd_url,
                    {
                        username: wd_username,
                        password: wd_pass,
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        httpsAgent: agent
                    }
                );
            } catch (err) {
                log.error(`cannot conntect to WebDAV: ${err}`);
                callback && callback();
            }

            let dir = (wd_dir || '').replace(/\\/g, '/');

            if (wd_ownDir === true) {
                dir = (wd_dirMinimal || '').replace(/\\/g, '/');
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
                            callback && callback(null, files, 'webdav');
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
    } catch (err) {
        log.error('WebDAV: ' + err);
        callback && callback();
    }
}

function getFile(options, fileName, toStoreName, log, callback) {

    const wd_username = options.username !== undefined ? options.username : options.webdav.username !== undefined ? options.webdav.username : '';
    const wd_pass = options.pass !== undefined ? options.pass : options.webdav.pass !== undefined ? options.webdav.pass : '';
    const wd_url = options.url !== undefined ? options.url : options.webdav.url !== undefined ? options.webdav.url : '';
    const wd_dir = options.dir !== undefined ? options.dir : options.webdav.dir !== undefined ? options.webdav.dir : '/';
    const wd_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.webdav.dirMinimal !== undefined ? options.webdav.dirMinimal : '/';
    const wd_ownDir = options.ownDir !== undefined ? options.ownDir : options.webdav.ownDir !== undefined ? options.webdav.ownDir : false;
    const wd_signedCertificates = options.signedCertificates !== undefined ? options.signedCertificates : options.webdav.signedCertificates !== undefined ? options.webdav.signedCertificates : true;

    if (wd_username && wd_pass && wd_url) {

        const { createClient } = require("webdav");
        const agent = require("https").Agent({ rejectUnauthorized: wd_signedCertificates });
        // copy file to backupDir
        let client;
        try {
            client = createClient(
                wd_url,
                {
                    username: wd_username,
                    password: wd_pass,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    httpsAgent: agent
                }
            );
        } catch (err) {
            log.error(`cannot conntect to WebDAV: ${err}`);
            callback && callback();
        }

        let dir = (wd_dir || '').replace(/\\/g, '/');

        if (wd_ownDir === true) {
            dir = (wd_dirMinimal || '').replace(/\\/g, '/');
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
                    callback && callback();
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