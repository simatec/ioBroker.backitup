'use strict';
const child_process = require('child_process');

function command(options, log, callback) {
    if (options.mountType === 'CIFS' && options.mount && !options.mount.startsWith('//')) {
        options.mount = '//' + options.mount;
    }

    if (!options.mount) {
        return callback('NO mount path specified!');
    }
    if (options.mountType === 'CIFS') {
        child_process.exec(`mount -t cifs -o ${options.user ? 'user=' + options.user + ',password=' + options.pass : ''},rw,file_mode=0777,dir_mode=0777,vers=1.0 ${options.mount}/${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
            if (error) {
                child_process.exec(`mount -t cifs -o ${options.user ? 'user=' + options.user + ',password=' + options.pass : ''},rw,file_mode=0777,dir_mode=0777 ${options.mount}/${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
                    if (error) {
                        log.error(`[${options.name} ${stderr}`);
                        callback(error);
                    } else {
                        options.context.done.push('mount');
                        callback(null, stdout);
                    }
                });
            } else {
                options.context.done.push('mount');
                callback(null, stdout);
            }
        });
    }
    if (options.mountType === 'NFS') {
        child_process.exec(`mount ${options.mount}:/${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
            if (error) {
                log.error(`[${options.name} ${stderr}`);
                callback(error);
            } else {
                options.context.done.push('mount');
                callback(null, stdout);
            }
        });
    }
    if (options.mountType === 'Copy') {
		callback(null);
    }
}

module.exports = {
    command,
    ignoreErrors: true
};