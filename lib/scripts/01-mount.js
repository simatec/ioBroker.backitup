'use strict';
const child_process = require('child_process');
const fs = require('fs');

function command(options, log, callback) {
    if (options.mountType === 'CIFS' && options.mount && !options.mount.startsWith('//')) {
        options.mount = '//' + options.mount;
    }
    if (options.mountType === 'CIFS' && options.mount && !options.dir.startsWith('/') || options.mountType === 'NFS' && options.mount && !options.dir.startsWith('/')) {
        options.dir = '/' + options.dir;
    }

    if (!options.mount) {
        return callback('NO mount path specified!');
    }
    if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
		if (fs.existsSync(options.fileDir + '/.mount')) {
			child_process.exec(`umount ${options.backupDir}`, (error, stdout, stderr) => {
				if (error) {
					options.context.errors.umount = error;
					log.error(stderr);
					callback(error)
				} else {
					options.context.done.push('umount');
					fs.unlink(options.fileDir + '/.mount');
					callback(null, stdout);
				}
			});
		}
	}
    if (options.mountType === 'CIFS') {
        setTimeout(function() {
            child_process.exec(`mount -t cifs -o ${options.user ? 'user=' + options.user + ',password=' + options.pass : ''},rw,file_mode=0777,dir_mode=0777,vers=1.0 ${options.mount}${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
                if (error) {
                    child_process.exec(`mount -t cifs -o ${options.user ? 'user=' + options.user + ',password=' + options.pass : ''},rw,file_mode=0777,dir_mode=0777 ${options.mount}${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            log.error(`[${options.name} ${stderr}`);
                            callback(error);
                        } else {
                            options.context.done.push('mount');
                            fs.writeFileSync(options.fileDir + '/.mount', options.mountType);
                            callback(null, stdout);
                        }
                    });
                } else {
                    options.context.done.push('mount');
                    fs.writeFileSync(options.fileDir + '/.mount', options.mountType);
                    callback(null, stdout);
                }
            });
        }, 3000);
    }
    if (options.mountType === 'NFS') {
        setTimeout(function() {
            child_process.exec(`mount ${options.mount}:${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
                if (error) {
                    log.error(`[${options.name} ${stderr}`);
                    callback(error);
                } else {
                    options.context.done.push('mount');
                    fs.writeFileSync(options.fileDir + '/.mount', options.mountType);
                    callback(null, stdout);
                }
            });
        }, 3000);    
    }
    if (options.mountType === 'Copy') {
		callback(null);
    }
}

module.exports = {
    command,
    ignoreErrors: true
};