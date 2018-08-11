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

function deleteFiles(files, log, errors, callback) {
    if (!files || !files.length) {
        callback && callback();
    } else {
        log.debug('delete ' + files[0]);
        try {
            fs.unlinkSync(dir, (err, files) => {
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
        fs.readdirSync(dir, (err, result) => {
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
	if (options.dir && options.context && options.context.fileNames && options.context.fileNames.length) {
		const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        let dir = (options.dir || '').replace(/\\/g, '/');
        
        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        
		if (fs.existsSync(options.dir)) {
            copyFiles(options.dir, fileNames, log, options.context.errors, err => {
                // todo: clean to many files on Network
                cleanFiles(dir, options.name, options.deleteBackupAfter, log, options.context.errors, err => {
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