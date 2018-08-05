'use strict';
const child_process = require('child_process');

function command(options, log, callback) {
    child_process.exec(`mount -t cifs -o ${options.user ? 'user=' + options.user + ',password=' + options.pass : ''},rw,file_mode=0777,dir_mode=0777,vers=1.0 ${options.mount}/${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
        if (error) {
            log.error(`[${options.name} ${stderr}`);
            callback(error)
        } else {
            callback(null, stdout);
        }
    });
}

module.exports = {
    command,
    ignoreErrors: true
};