"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mount = mount;
exports.umount = umount;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const tools_1 = require("./tools");
const node_child_process_1 = require("node:child_process");
const backupDir = (0, node_path_1.join)((0, tools_1.getIobDir)(), 'backups').replace(/\\/g, '/');
function mount(config, log) {
    let dir = config.dir || '/';
    if (config.ownDir === true) {
        dir = config.dirMinimal;
    }
    if ((0, node_fs_1.existsSync)(`${config.fileDir}/.mount`)) {
        (0, node_child_process_1.exec)(`mount | grep -o "${backupDir}"`, (error, stdout, stderr) => {
            if (stdout.includes(backupDir)) {
                (0, node_child_process_1.exec)(`${config.sudo ? 'sudo umount' : 'umount'} ${backupDir}`, (error, stdout, stderr) => {
                    if (error) {
                        log.debug('device is busy... wait 2 Minutes!!');
                        setTimeout(() => {
                            (0, node_child_process_1.exec)(`${config.sudo ? 'sudo umount' : 'umount'} -l ${backupDir}`, (error, stdout, stderr) => {
                                if (error) {
                                    log.error(stderr);
                                }
                                else {
                                    try {
                                        if ((0, node_fs_1.existsSync)(`${config.fileDir}/.mount`)) {
                                            (0, node_fs_1.unlinkSync)(`${config.fileDir}.mount`);
                                        }
                                    }
                                    catch (e) {
                                        log.debug(`file ".mount" cannot deleted: ${e}`);
                                    }
                                }
                            });
                        }, 120000);
                    }
                    else {
                        try {
                            if ((0, node_fs_1.existsSync)(`${config.fileDir}/.mount`)) {
                                (0, node_fs_1.unlinkSync)(`${config.fileDir}/.mount`);
                            }
                        }
                        catch (e) {
                            log.debug(`file ".mount" cannot deleted: ${e}`);
                        }
                    }
                });
            }
        });
    }
    if (config.mountType === 'CIFS') {
        if (!config.mount.startsWith('//')) {
            config.mount = `//${config.mount}`;
        }
        if (!dir.startsWith('/')) {
            dir = `/${dir}`;
        }
        if ((!config.pass.startsWith(`"`) || !config.pass.endsWith(`"`)) &&
            (!config.pass.startsWith(`'`) || !config.pass.endsWith(`'`))) {
            config.pass = `"${config.pass}"`;
        }
        return new Promise((resolve, reject) => {
            log.debug(`[CIFS] cifs-mount command: "${config.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${config.user ? `username=${config.user},password=****` : ''}${config.cifsDomain ? `,domain=${config.cifsDomain}` : ''}${config.clientInodes ? ',noserverino' : ''}${config.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777,${config.smb} ${config.mount}${dir} ${backupDir}"`);
            (0, node_child_process_1.exec)(`${config.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${config.user ? `username=${config.user},password=${config.pass}` : ''}${config.cifsDomain ? `,domain=${config.cifsDomain}` : ''}${config.clientInodes ? ',noserverino' : ''}${config.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777,${config.smb} ${config.mount}${dir} ${backupDir}`, (error, stdout) => {
                if (error) {
                    log.debug('[CIFS] first mount attempt with smb option failed. try next mount attempt without smb option ...');
                    log.debug(`[CIFS] cifs-mount command: "${config.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${config.user ? `username=${config.user},password=****` : ''}${config.cifsDomain ? `,domain=${config.cifsDomain}` : ''}${config.clientInodes ? ',noserverino' : ''}${config.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777 ${config.mount}${dir} ${backupDir}"`);
                    (0, node_child_process_1.exec)(`${config.sudo ? 'sudo mount' : 'mount'} -t cifs -o ${config.user ? `username=${config.user},password=${config.pass}` : ''}${config.cifsDomain ? `,domain=${config.cifsDomain}` : ''}${config.clientInodes ? ',noserverino' : ''}${config.cacheLoose ? ',cache=loose' : ''},rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777 ${config.mount}${dir} ${backupDir}`, (error, stdout) => {
                        if (error) {
                            let errLog = JSON.stringify(error);
                            try {
                                const formatPass = config.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                errLog = errLog.replace(new RegExp(formatPass, 'g'), '****');
                            }
                            catch {
                                // ignore
                            }
                            reject(new Error(errLog));
                        }
                        else {
                            log.debug(`[CIFS] mount successfully completed: ${stdout}`);
                            try {
                                (0, node_fs_1.writeFileSync)(`${config.fileDir}/.mount`, config.mountType);
                            }
                            catch (e) {
                                log.debug(`[CIFS] file ".mount" cannot created: ${e}`);
                            }
                            resolve();
                        }
                    });
                }
                else {
                    log.debug(`[CIFS] mount successfully completed: ${stdout}`);
                    try {
                        (0, node_fs_1.writeFileSync)(`${config.fileDir}/.mount`, config.mountType);
                    }
                    catch (e) {
                        log.debug(`[CIFS] file ".mount" cannot created: ${e}`);
                    }
                    resolve();
                }
            });
        });
    }
    if (config.mountType === 'NFS') {
        if (!dir.startsWith('/')) {
            dir = `/${dir}`;
        }
        log.debug(`[CIFS] nfs-mount command: "${config.sudo ? 'sudo mount' : 'mount'} ${config.mount}:${dir} ${backupDir}"`);
        return new Promise((resolve, reject) => {
            (0, node_child_process_1.exec)(`${config.sudo ? 'sudo mount' : 'mount'} ${config.mount}:${dir} ${backupDir}`, (error, stdout) => {
                if (error) {
                    reject(error);
                }
                else {
                    log.debug(`[CIFS] mount successfully completed: ${stdout}`);
                    try {
                        (0, node_fs_1.writeFileSync)(`${config.fileDir}/.mount`, config.mountType);
                    }
                    catch (e) {
                        log.debug(`[CIFS] file ".mount" cannot created: ${e}`);
                    }
                    resolve();
                }
            });
        });
    }
    if (config.mountType === 'Expert') {
        log.debug(`[CIFS] expert-mount command: "${config.expertMount}"`);
        return new Promise((resolve, reject) => {
            (0, node_child_process_1.exec)(config.expertMount, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                else {
                    log.debug(`[CIFS] expert-mount successfully completed: ${stdout}`);
                    try {
                        (0, node_fs_1.writeFileSync)(`${config.fileDir}/.mount`, config.mountType);
                    }
                    catch (e) {
                        log.debug(`[CIFS] file ".mount" cannot created: ${e}`);
                    }
                    resolve();
                }
            });
        });
    }
    return Promise.resolve();
}
function umount(config, log) {
    if (!config.mount) {
        throw new Error('NO mount path specified!');
    }
    if ((0, node_fs_1.existsSync)(`${config.fileDir}/.mount`)) {
        return new Promise((resolve, reject) => {
            (0, node_child_process_1.exec)(`mount | grep -o "${backupDir}"`, (error, stdout, stderr) => {
                if (stdout.includes(backupDir)) {
                    (0, node_child_process_1.exec)(`${config.sudo ? 'sudo umount' : 'umount'} ${backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            log.debug('[CIFS] device is busy... wait 2 Minutes!!');
                            setTimeout(() => {
                                (0, node_child_process_1.exec)(`${config.sudo ? 'sudo umount' : 'umount'} -l ${backupDir}`, (error, stdout, stderr) => {
                                    if (error) {
                                        log.error(`[CIFS] error: ${stderr}`);
                                        reject(error);
                                    }
                                    else {
                                        log.debug(`[CIFS] umount successfully completed: ${stdout}`);
                                        try {
                                            (0, node_fs_1.existsSync)(`${config.fileDir}/.mount`) &&
                                                (0, node_fs_1.unlinkSync)(`${config.fileDir}/.mount`);
                                        }
                                        catch (e) {
                                            log.debug(`[CIFS]file ".mount" cannot deleted: ${e}`);
                                        }
                                        resolve();
                                    }
                                });
                            }, 120000);
                        }
                        else {
                            log.debug(`[CIFS] umount successfully completed: ${stdout}`);
                            try {
                                if ((0, node_fs_1.existsSync)(`${config.fileDir}/.mount`)) {
                                    (0, node_fs_1.unlinkSync)(`${config.fileDir}/.mount`);
                                }
                            }
                            catch (e) {
                                log.debug(`[CIFS] file ".mount" cannot deleted: ${e}`);
                            }
                            resolve();
                        }
                    });
                }
                else {
                    log.debug('[CIFS] mount inactive, umount not started ...');
                    try {
                        if ((0, node_fs_1.existsSync)(`${config.fileDir}/.mount`)) {
                            (0, node_fs_1.unlinkSync)(`${config.fileDir}/.mount`);
                        }
                    }
                    catch (e) {
                        log.debug(`[CIFS] file ".mount" cannot deleted: ${e}`);
                    }
                    resolve();
                }
            });
        });
    }
    return Promise.resolve();
}
//# sourceMappingURL=cifsLib.js.map