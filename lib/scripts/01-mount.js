'use strict';
const child_process = require('child_process');
const fs = require('fs');
const wol = require('node-wol');

function command(options, log, callback) {

    let waitTime = 10000;

    if (options.wakeOnLAN === 'true' || options.wakeOnLAN === true) {
        wol.wake(options.macAd, function (error) {
            if (error) {
                log.error(error);
                return callback('NO Wake on LAN specified!');
            } else {
                log.debug('Wake on LAN MAC-Address: ' + options.macAd);
            }
        });
        waitTime = options.wolTime * 1000;

        log.debug('Wake on LAN wait ' + options.wolTime + ' Seconds for NAS!');
    }
    if (options.mountType === 'CIFS' && options.mount && !options.mount.startsWith('//')) {
        options.mount = '//' + options.mount;
    }
    if (options.mountType === 'CIFS' && options.mount && !options.dir.startsWith('/') || options.mountType === 'NFS' && options.mount && !options.dir.startsWith('/')) {
        options.dir = '/' + options.dir;
    }
    if (!options.pass.startsWith("'")) {
        options.pass = "'" + options.pass + "'";
    }

    if (!options.mount) {
        return callback('NO mount path specified!');
    }
    if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
        if (fs.existsSync(options.fileDir + '/.mount')) {
            child_process.exec(`mount | grep -o "${options.backupDir}"`, (error, stdout, stderr) => {
                if (stdout.indexOf(options.backupDir) !== -1) {
                    log.debug('mount activ... umount is started before mount!!');
                    child_process.exec(`${options.sudo ? 'sudo umount' : 'umount'} ${options.backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            log.debug('device is busy... wait 2 Minutes!!');
                            setTimeout(function () {
                                child_process.exec(`${options.sudo ? 'sudo umount' : 'umount'} ${options.backupDir}`, (error, stdout, stderr) => {
                                    if (error) {
                                        options.context.errors.umount = error;
                                        log.error(stderr);
                                    } else {
                                        options.context.done.push('umount');
                                        log.debug('umount successfully completed');
                                        try {
                                            fs.existsSync(options.fileDir + '/.mount') && fs.unlinkSync(options.fileDir + '/.mount');
                                        } catch (e) {
                                            log.debug('file ".mount" cannot deleted: ' + e);
                                        }
                                    }
                                });
                            }, 120000);
                        } else {
                            options.context.done.push('umount');
                            log.debug('umount successfully completed');
                            try {
                                fs.existsSync(options.fileDir + '/.mount') && fs.unlinkSync(options.fileDir + '/.mount');
                            } catch (e) {
                                log.debug('file ".mount" cannot deleted: ' + e);
                            }
                        }
                    });
                }
            });
        }
    }
    if (options.mountType === 'CIFS') {
        setTimeout(function () {
            child_process.exec(`${options.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${options.user ? 'username=' + options.user + ',password=' + options.pass : ''}${options.cifsDomain ? ',domain=' + options.cifsDomain : ''},rw,file_mode=0777,dir_mode=0777,${options.smb} ${options.mount}${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
                if (error) {
                    //let errLog = '' + error;
                    //errLog = errLog.replace(new RegExp(options.pass, 'g'), "****")
                    //log.debug(`mount ${errLog}`);
                    log.debug('first mount attempt with smb option failed. try next mount attempt without smb option ...');
                    child_process.exec(`${options.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${options.user ? 'username=' + options.user + ',password=' + options.pass : ''}${options.cifsDomain ? ',domain=' + options.cifsDomain : ''},rw,file_mode=0777,dir_mode=0777 ${options.mount}${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            let errLog = '' + error;
                            errLog = errLog.replace(new RegExp(options.pass, 'g'), "****")
                            options.context.errors.mount = errLog;
                            log.error(`[${options.name} ${errLog}`);
                            callback(errLog);
                        } else {
                            log.debug('mount successfully completed');
                            options.context.done.push('mount');
                            try {
                                fs.writeFileSync(options.fileDir + '/.mount', options.mountType);
                            } catch (e) {
                                log.debug('file ".mount" cannot created: ' + e);
                            }
                            callback(null, stdout);
                        }
                    });
                } else {
                    log.debug('mount successfully completed');
                    options.context.done.push('mount');
                    fs.writeFileSync(options.fileDir + '/.mount', options.mountType);
                    callback(null, stdout);
                }
            });
        }, waitTime);
    }
    if (options.mountType === 'NFS') {
        setTimeout(function () {
            child_process.exec(`${options.sudo ? 'sudo mount' : 'mount'} ${options.mount}:${options.dir} ${options.backupDir}`, (error, stdout, stderr) => {
                if (error) {
                    options.context.errors.mount = error;
                    log.error(`[${options.name} ${stderr}`);
                    callback(error);
                } else {
                    log.debug('mount successfully completed');
                    options.context.done.push('mount');
                    try {
                        fs.writeFileSync(options.fileDir + '/.mount', options.mountType);
                    } catch (e) {
                        log.debug('file ".mount" cannot created: ' + e);
                    }
                    callback(null, stdout);
                }
            });
        }, waitTime);
    }
    if (options.mountType === 'Copy') {
        callback(null);
    }
}

module.exports = {
    command,
    ignoreErrors: true
};