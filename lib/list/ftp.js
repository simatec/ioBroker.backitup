'use strict';
const fs = require('fs');

function list(restoreSource, options, types, log, callback) {

    const ftp_host = options.host !== undefined ? options.host : options.ftp.host !== undefined ? options.ftp.host : '';
    const ftp_user = options.user !== undefined ? options.user : options.ftp.user !== undefined ? options.ftp.user : '';
    const ftp_pass = options.pass !== undefined ? options.pass : options.ftp.pass !== undefined ? options.ftp.pass : '';
    const ftp_port = options.port !== undefined ? options.port : options.ftp.port !== undefined ? options.ftp.port : 21;
    const ftp_dir = options.dir !== undefined ? options.dir : options.ftp.dir !== undefined ? options.ftp.dir : '/';
    const ftp_ownDir = options.ownDir !== undefined ? options.ownDir : options.ftp.ownDir !== undefined ? options.ftp.ownDir : false;
    const ftp_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.ftp.dirMinimal !== undefined ? options.ftp.dirMinimal : '/';

    if (ftp_host && (!restoreSource || restoreSource === 'ftp')) {
        const Client = require('ftp');
        const client = new Client();

        let dir = (ftp_dir || '').replace(/\\/g, '/');

        if (ftp_ownDir === true) {
            dir = (ftp_dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }

        client.on('ready', () => {
            log.debug('FTP: connected.');
            client.list(dir, (err, result) => {
                if (err) {
                    log.error('FTP: ' + err);
                }
                client.end();
                if (result && result.length) {
                    try {
                        result = result.map(file => {
                            return { path: file.name, name: file.name.replace(/\\/g, '/').split('/').pop(), size: file.size }
                        }).filter(file => (types.indexOf(file.name.split('_')[0]) !== -1 || types.indexOf(file.name.split('.')[0]) !== -1) && file.name.split('.').pop() == 'gz');
                    } catch (e) {
                        log.error('FTP: error on ftp list: ' + e + ' please check the ftp config!!');
                    }

                    const files = {};
                    try {
                        result.forEach(file => {
                            const type = file.name.split('_')[0];
                            files[type] = files[type] || [];
                            files[type].push(file);
                        });
                    } catch (e) {
                        log.error('FTP: Files error: ' + e + ' please check the ftp config and try again!!');
                    }

                    callback && callback(null, files, 'ftp');
                } else {
                    callback && callback()
                }
            });
        });
        client.on('error', err => {
            if (callback) {
                callback(err);
                callback = null;
            }
        });

        const srcFTP = {
            host: ftp_host,
            port: ftp_port || 21,
            user: ftp_user,
            password: ftp_pass
        };

        client.connect(srcFTP);
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {

    const ftp_host = options.host !== undefined ? options.host : options.ftp.host !== undefined ? options.ftp.host : '';
    const ftp_user = options.user !== undefined ? options.user : options.ftp.user !== undefined ? options.ftp.user : '';
    const ftp_pass = options.pass !== undefined ? options.pass : options.ftp.pass !== undefined ? options.ftp.pass : '';
    const ftp_port = options.port !== undefined ? options.port : options.ftp.port !== undefined ? options.ftp.port : 21;
    const ftp_dir = options.dir !== undefined ? options.dir : options.ftp.dir !== undefined ? options.ftp.dir : '/';
    const ftp_ownDir = options.ownDir !== undefined ? options.ownDir : options.ftp.ownDir !== undefined ? options.ftp.ownDir : false;
    const ftp_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.ftp.dirMinimal !== undefined ? options.ftp.dirMinimal : '/';

    if (ftp_host) {
        // copy file to backupDir
        const Client = require('ftp');
        const client = new Client();

        let dir = (ftp_dir || '').replace(/\\/g, '/');

        if (ftp_ownDir === true) {
            dir = (ftp_dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        client.on('ready', () => {
            log.debug('FTP: connected.');
            log.debug('FTP: Get file: ' + dir + '/' + fileName);
            client.get(dir + '/' + fileName, (err, stream) => {
                if (err) {
                    try {
                        client.end();
                    } catch (e) {

                    }
                    log.error('FTP: ' + err);
                    if (callback) {
                        callback(err);
                        callback = null;
                    }
                } else {
                    try {
                        stream.once('close', () => {
                            log.debug('FTP: Download done');
                            client.end();
                            if (callback) {
                                callback();
                                callback = null;
                            }
                        });
                        const writeStream = fs.createWriteStream(toStoreName);
                        writeStream.on('error', err => {
                            log.error('FTP: ' + err);
                            if (callback) {
                                callback();
                                callback = null;
                            }
                        });

                        stream.pipe(writeStream);
                    } catch (err) {
                        log.error('FTP: ' + err);
                        if (callback) {
                            callback(err);
                            callback = null;
                        }
                    }
                }
            });
        });

        client.on('error', err => {
            if (callback) {
                callback(err);
                callback = null;
            }
        });

        const srcFTP = {
            host: ftp_host,
            port: ftp_port || 21,
            user: ftp_user,
            password: ftp_pass
        };

        client.connect(srcFTP);
    } else {
        setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};