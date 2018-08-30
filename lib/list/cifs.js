'use strict';

const copyFile = require('../tools').copyFile;
const tools = require('../tools');
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

function list(options, types, log, callback) {

    const backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');

    if (options.enabled && options.source === 'NAS / Copy') {
        if (options.mountType === 'CIFS') {
            child_process.exec(`mount -t cifs -o ${options.user ? 'user=' + options.user + ',password=' + options.pass : ''},rw,file_mode=0777,dir_mode=0777,vers=1.0 ${options.mount}/${options.dir} ${backupDir}`, (error, stdout, stderr) => {
                if (error) {
                    child_process.exec(`mount -t cifs -o ${options.user ? 'user=' + options.user + ',password=' + options.pass : ''},rw,file_mode=0777,dir_mode=0777 ${options.mount}/${options.dir} ${backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            callback(error);
                        } else {
                            callback(null, stdout);
                        }
                    });
                } else {
                    callback(null, stdout);
                }
            });
        }
        if (options.mountType === 'NFS') {
            child_process.exec(`mount ${options.mount}:/${options.dir} ${backupDir}`, (error, stdout, stderr) => {
                if (error) {
                    callback(error);
                } else {
                    callback(null, stdout);
                }
            });
            
        }

        let dir = backupDir.replace(/\\/g, '/');

        if (options.mountType === 'Copy') {
            dir = options.dir.replace(/\\/g, '/');

            if (dir[0] !== '/' && !dir.match(/\w:/)) {
                dir = '/' + (dir || '');
            }
        } else {
            if (dir[0] !== '/' && !dir.match(/\w:/)) {
                dir = '/' + (dir || '');
            }
        }
        if (fs.existsSync(dir)) {
            let result = fs.readdirSync(dir).sort().map(file => path.join(dir, file).replace(/\\/g, '/'));

            if (result && result.length) {

                result = result.map(file => {
                const stat = fs.statSync(file);
                return {path: file, name: file.split('/').pop(), size: stat.size};
                }).filter(file => types.indexOf(file.name.split('_')[0]) !== -1);

                const files = {};
                
                result.forEach(file => {
                    const type = file.name.split('_')[0];
                    files[type] = files[type] || [];
                    files[type].push(file);
            });
                callback(null, files, 'nas / copy');
            } else {
                callback && callback()
            }
        }
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {
    if (options.enabled) {
        // copy file to options.backupDir
        let dir = (options.dir || '').replace(/\\/g, '/');
        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        try {
            log.debug('Get file ' + fileName);
            copyFile(fileName, path.join(options.backupDir, toStoreName), err => {
                if (err) {
                    log.error(err);
                }
                setImmediate(options, fileName, toStoreName, log, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(options, fileName, toStoreName, log, callback);
        }
    } else {
        setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};