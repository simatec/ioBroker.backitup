'use strict';

const Client = require('ftp');
const path = require('path');
const fs = require('fs');

function uploadFiles(client, dir, fileNames, log, errors, callback) {
	if (!fileNames || !fileNames.length) {
		callback();
	} else {
		let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
		const onlyFileName = fileName.split('/').pop();

        log.debug('Send ' + onlyFileName);

        client.put(fileName, dir + '/' + onlyFileName, err => {
        	if (err) {
                errors.ftp = err;
        		log.error(err);
			}
            setImmediate(uploadFiles, client, dir, fileNames, log, errors, callback);
        });
	}
}

function deleteFiles(files, log, errors, callback) {
    if (!files || !files.length) {
        callback && callback();
    } else {
        log.debug('delete ' + files[0]);
        try {
            client.delete(dir, (err, files) => {
                err && log.error(err);
                setImmediate(deleteFiles, files, log, errors, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(deleteFiles, files, log, errors, callback);
        }
    }
}

function cleanFiles(dir, name, num, log, errors, callback) {
    
    try {
        client.list(dir, (err, result) => {
            err && log.error(err);
            if (result && result.entries && num) {
                result = result.entries.filter(a => a.name.startsWith(name));
                const files = [];
                
                if (result.length > num) {
                    // delete oldies files
                    result.sort((a, b) => {
                        const at = new Date(a.client_modified).getTime();
                        const bt = new Date(b.client_modified).getTime();
                        if (at > bt) return -1;
                        if (at < bt) return 1;
                        return 0;
                    });


                    for (let i = num; i < result.length; i++) {
                        files.push(result[i].path_display);
                    }
                }

                deleteFiles(files, log, errors, callback);
            } else {
                callback && callback()
            }
        });
    } catch (e) {
        callback && callback(e);
    }
}

function command(options, log, callback) {
	if (options.host && options.context && options.context.fileNames && options.context.fileNames.length) {
		const client = new Client();
		const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
        
        let dir = (options.dir || '').replace(/\\/g, '/');
        
        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        
		client.on('ready', () => {
		    log.debug('FTP connected.');
			uploadFiles(client, options.dir, fileNames, log, options.context.errors, err => {
				// todo: clean to many files on FTP
                cleanFiles(client, options.dir, options.name, options.deleteBackupAfter, log, options.context.errors, err => {
                    if (err) {
                        options.context.errors.ftp = options.context.errors.ftp || err;
                    } else {
                        options.context.done.push('ftp');
                    }
                    client.end();
                    if (callback) {
                        callback(err);
                        callback = null;
                    }
                });
			});
		});
		client.on('error', err => {
            options.context.errors.ftp = err;
			if (callback) {
				callback(err);
				callback = null;
			}
		});

		const srcFTP = {
			host     : options.host,
			port     : options.port || 21,
			user     : options.user,
			password : options.pass
		};

		client.connect(srcFTP);
	} else {
		callback();
	}
}

module.exports = {
    command,
    ignoreErrors: true
};