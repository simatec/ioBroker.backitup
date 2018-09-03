'use strict';

const copyFile = require('../tools').copyFile;
const tools = require('../tools');
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');
const backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');

function list(options, types, log, callback) {
    if (options.enabled && options.source === 'NAS / Copy') {
        if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
            mount(options, log, () => nasList(options, types, log, callback));
        } else {
            nasList(options, types, log, callback);
        }
    } else {
        setImmediate(callback);
    }   
}

function nasList(options, types, log, callback) {
    if (options.enabled && options.source === 'NAS / Copy') {
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

        const files = {};
        if (fs.existsSync(dir)) {
            let result = fs.readdirSync(dir).sort().map(file => path.join(dir, file).replace(/\\/g, '/'));

            if (result && result.length) {
                result = result.map(file => {
                    const stat = fs.statSync(file);
                    return {path: file, name: file.split('/').pop(), size: stat.size};
                }).filter(file => types.indexOf(file.name.split('_')[0]) !== -1);

                result.forEach(file => {
                    const type = file.name.split('_')[0];
                    files[type] = files[type] || [];
                    files[type].push(file);
                });
            }
        }
        if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
            umount(options, log, error => callback && callback(error, files, 'nas / copy'));
        } else {
            callback && callback(null, files, 'nas / copy');
        }
    } else {
        setImmediate(callback);
    }
}

function copyFileCifs(options, fileName, toStoreName, log, callback) {
    try {
        log.debug('Get file ' + fileName);
        if (options.mountType === 'Copy') {
            copyFile(fileName, toStoreName, err => {
                err && log.error(err);
                callback(null);
            });
        }
        if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
            // Todo CopyFile (the same 'local')
            //tools.copyFile(fileName, toSaveName, callback);
            //umount(options, log, error => callback(error));
            callback(null);
        }
        
    } catch (e) {
        log.error(e);

        if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
            umount(options, log, error => callback(error));
        } else {
            callback(e);
        }
    }
}

function getFile(options, fileName, toStoreName, log, callback) {
    if (options.enabled) {
        if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
            mount(options, log, () => copyFileCifs(options, fileName, toStoreName, log, callback));
        } else {
            copyFileCifs(options, fileName, toStoreName, log, callback);
        }
    } else {
        setImmediate(callback, 'Not configured');
    }
}

function mount(options, log, callback) {
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
    } else
    if (options.mountType === 'NFS') {
        child_process.exec(`mount ${options.mount}:/${options.dir} ${backupDir}`, (error, stdout, stderr) => {
            if (error) {
                callback(error);
            } else {
                callback(null, stdout);
            }
        });
    }
}

function umount(options, log, callback) {
    if (!options.mount) {
        return callback('NO mount path specified!');
    }
    child_process.exec(`umount ${backupDir}`, (error, stdout, stderr) => {
        if (error) {
            log.error(stderr);
            callback(error)
        } else {
            callback(null, stdout);
        }
    });
}

module.exports = {
    list,
    getFile
};