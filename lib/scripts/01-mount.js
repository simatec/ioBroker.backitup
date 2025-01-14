'use strict';
const fs = require('node:fs');

function command(options, log, callback) {
    let waitTime = 10000;
    let child_process;

    if (options.wakeOnLAN === 'true' || options.wakeOnLAN === true) {
        const wol = require('node-wol');

        wol.wake(
            options.macAd,
            {
                address: options.wolExtra === 'true' || options.wolExtra === true ? options.mount : '255.255.255.255',
                port: options.wolExtra === 'true' || options.wolExtra === true ? options.wolPort : 9,
            },
            error => {
                if (error) {
                    log.error(error);
                    return callback && callback('NO Wake on LAN specified!');
                } else {
                    log.debug(`Wake on LAN MAC-Address: ${options.macAd}`);
                }
            },
        );
        waitTime = options.wolTime * 1000;

        log.debug(`Wake on LAN wait ${options.wolTime} Seconds for NAS!`);
    }
    if (options.mountType === 'CIFS' && options.mount && !options.mount.startsWith('//')) {
        options.mount = `//${options.mount}`;
    }
    if (
        (options.mountType === 'CIFS' && options.mount && !options.dir.startsWith('/')) ||
        (options.mountType === 'NFS' && options.mount && !options.dir.startsWith('/'))
    ) {
        options.dir = `/${options.dir}`;
    }

    if (
        (!options.pass.startsWith(`"`) || !options.pass.endsWith(`"`)) &&
        (!options.pass.startsWith(`'`) || options.pass.endsWith(`'`))
    ) {
        options.pass = `"${options.pass}"`;
    }

    if (!options.mount) {
        return callback && callback('NO mount path specified!');
    }
    if (options.mountType === 'CIFS' || options.mountType === 'NFS' || options.mountType === 'Expert') {
        child_process = require('node:child_process');

        if (fs.existsSync(`${options.fileDir}/.mount`)) {
            child_process.exec(`mount | grep -o "${options.backupDir}"`, (error, stdout, stderr) => {
                if (stdout.includes(options.backupDir)) {
                    log.debug('mount activ... umount is started before mount!!');
                    child_process.exec(
                        `${options.sudo ? 'sudo umount' : 'umount'} ${options.backupDir}`,
                        (error, stdout, stderr) => {
                            if (error) {
                                log.debug('device is busy... wait 2 Minutes!!');
                                setTimeout(function () {
                                    child_process.exec(
                                        `${options.sudo ? 'sudo umount' : 'umount'} ${options.backupDir}`,
                                        (error, stdout, stderr) => {
                                            if (error) {
                                                options.context.errors.umount = error;
                                                log.error(stderr);
                                            } else {
                                                options.context.done.push('umount');
                                                log.debug('umount successfully completed');
                                                try {
                                                    fs.existsSync(`${options.fileDir}/.mount`) &&
                                                        fs.unlinkSync(`${options.fileDir}/.mount`);
                                                } catch (e) {
                                                    log.warn(`file ".mount" cannot deleted: ${e}`);
                                                }
                                            }
                                        },
                                    );
                                }, 120000);
                            } else {
                                options.context.done.push('umount');
                                log.debug('umount successfully completed');
                                try {
                                    fs.existsSync(`${options.fileDir}/.mount`) &&
                                        fs.unlinkSync(`${options.fileDir}/.mount`);
                                } catch (e) {
                                    log.warn(`file ".mount" cannot deleted: ${e}`);
                                }
                            }
                        },
                    );
                }
            });
        }
    }
    if (options.mountType === 'CIFS') {
        setTimeout(function () {
            log.debug(
                `cifs-mount command: "${options.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${options.user ? `username=${options.user},password=****` : ''}${options.cifsDomain ? `,domain=${options.cifsDomain}` : ''}${options.clientInodes ? ',noserverino' : ''}${options.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777,${options.smb} ${options.mount}${options.dir} ${options.backupDir}"`,
            );
            child_process.exec(
                `${options.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${options.user ? `username=${options.user},password=${options.pass}` : ''}${options.cifsDomain ? `,domain=${options.cifsDomain}` : ''}${options.clientInodes ? ',noserverino' : ''}${options.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777,${options.smb} ${options.mount}${options.dir} ${options.backupDir}`,
                (error, stdout, stderr) => {
                    if (error) {
                        log.debug(
                            'first mount attempt with smb option failed. try next mount attempt without smb option ...',
                        );
                        log.debug(
                            `cifs-mount command: "${options.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${options.user ? `username=${options.user},password=****` : ''}${options.cifsDomain ? `,domain=${options.cifsDomain}` : ''}${options.clientInodes ? ',noserverino' : ''}${options.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777 ${options.mount}${options.dir} ${options.backupDir}"`,
                        );
                        child_process.exec(
                            `${options.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${options.user ? `username=${options.user},password=${options.pass}` : ''}${options.cifsDomain ? `,domain=${options.cifsDomain}` : ''}${options.clientInodes ? ',noserverino' : ''}${options.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777 ${options.mount}${options.dir} ${options.backupDir}`,
                            (error, stdout, stderr) => {
                                if (error) {
                                    let errLog = `${error}`;
                                    try {
                                        const formatPass = options.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                        errLog = errLog.replace(new RegExp(formatPass, 'g'), '****');
                                    } catch (e) {
                                        // ignore
                                    }
                                    options.context.errors.mount = error;
                                    log.error(`[${options.name} ${errLog}`);
                                    callback && callback(null, errLog);
                                } else {
                                    log.debug('mount successfully completed');
                                    options.context.done.push('mount');
                                    try {
                                        fs.writeFileSync(`${options.fileDir}/.mount`, options.mountType);
                                    } catch (e) {
                                        log.warn(`file ".mount" cannot created: ${e}`);
                                    }
                                    callback && callback(null, stdout);
                                }
                            },
                        );
                    } else {
                        log.debug('mount successfully completed');
                        options.context.done.push('mount');
                        fs.writeFileSync(`${options.fileDir}/.mount`, options.mountType);
                        callback && callback(null, stdout);
                    }
                },
            );
        }, waitTime);
    }
    if (options.mountType === 'NFS') {
        setTimeout(function () {
            log.debug(
                `nfs-mount command: "${options.sudo ? 'sudo mount' : 'mount'} ${options.mount}:${options.dir} ${options.backupDir}"`,
            );
            child_process.exec(
                `${options.sudo ? 'sudo mount' : 'mount'} ${options.mount}:${options.dir} ${options.backupDir}`,
                (error, stdout, stderr) => {
                    if (error) {
                        options.context.errors.mount = error;
                        log.error(`[${options.name} ${stderr}`);
                        callback && callback(null, error);
                    } else {
                        log.debug('mount successfully completed');
                        options.context.done.push('mount');
                        try {
                            fs.writeFileSync(`${options.fileDir}/.mount`, options.mountType);
                        } catch (e) {
                            log.warn(`file ".mount" cannot created: ${e}`);
                        }
                        callback && callback(null, stdout);
                    }
                },
            );
        }, waitTime);
    }
    if (options.mountType === 'Expert') {
        setTimeout(function () {
            log.debug(`expert-mount command: "${options.expertMount}"`);
            child_process.exec(options.expertMount, (error, stdout, stderr) => {
                if (error) {
                    options.context.errors.mount = error;
                    log.error(`[${options.name} ${stderr}`);
                    callback && callback(null, error);
                } else {
                    log.debug('expert-mount successfully completed');
                    options.context.done.push('mount');
                    try {
                        fs.writeFileSync(`${options.fileDir}/.mount`, options.mountType);
                    } catch (e) {
                        log.warn(`file ".mount" cannot created: ${e}`);
                    }
                    callback && callback(null, stdout);
                }
            });
        }, waitTime);
    }
    if (options.mountType === 'Copy') {
        callback && callback(null);
    }
}

module.exports = {
    command,
    ignoreErrors: true,
};
