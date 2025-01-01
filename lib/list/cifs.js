"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getFile = getFile;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const tools_1 = require("../tools");
const fs_extra_1 = require("fs-extra");
const cifsLib_1 = require("../cifsLib");
const backupDir = (0, node_path_1.join)((0, tools_1.getIobDir)(), 'backups').replace(/\\/g, '/');
async function list(options) {
    const config = options.config;
    if (config.enabled && (!options.restoreSource || options.restoreSource === 'cifs')) {
        if (config.mountType === 'CIFS' || config.mountType === 'NFS' || config.mountType === 'Expert') {
            await (0, cifsLib_1.mount)(config, options.log);
        }
        let dir = backupDir.replace(/\\/g, '/');
        if (config.mountType === 'Copy') {
            dir = (config.dir || '/').replace(/\\/g, '/');
            if (config.ownDir === true) {
                dir = (config.dirMinimal || '/').replace(/\\/g, '/');
            }
            if (dir[0] !== '/' && !dir.match(/\w:/)) {
                dir = `/${dir || ''}`;
            }
        }
        else {
            if (dir[0] !== '/' && !dir.match(/\w:/)) {
                dir = `/${dir || ''}`;
            }
        }
        const files = {};
        if ((0, node_fs_1.existsSync)(dir)) {
            const result = (0, node_fs_1.readdirSync)(dir)
                .sort()
                .map(file => (0, node_path_1.join)(dir, file).replace(/\\/g, '/'));
            if (result?.length) {
                const _files = result
                    .map(file => {
                    const stat = (0, node_fs_1.statSync)(file);
                    return { path: file, name: file.split('/').pop() || '', size: stat.size };
                })
                    .filter(file => (options.creators.includes(file.name.split('_')[0]) ||
                    options.creators.includes(file.name.split('.')[0])) &&
                    file.name.endsWith('.gz'));
                const files = {};
                try {
                    _files.forEach(file => {
                        const type = file.name.split('_')[0];
                        files[type] = files[type] || [];
                        files[type].push(file);
                    });
                }
                catch (e) {
                    options.log.error(`[CIFS] Files error: ${e}`);
                }
                return files;
            }
            return {};
        }
        return files;
    }
    return Promise.resolve(null);
}
async function getFile(commonConfig, fileName, toStoreName, log) {
    const config = commonConfig;
    if (config.enabled) {
        if (config.mountType === 'CIFS' || config.mountType === 'NFS' || config.mountType === 'Expert') {
            // File already exists on the destination
            return;
        }
        return new Promise(async (resolve, reject) => {
            try {
                log.debug(`Get file ${fileName}`);
                log.debug(`Mount type: ${config.mountType != undefined ? config.mountType : 'Copy'}`);
                (0, fs_extra_1.copy)(fileName, toStoreName, (err) => {
                    if (err) {
                        log.error(err);
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (e) {
                log.error(`[CIFS] ${e}`);
                if (config.mountType === 'CIFS' || config.mountType === 'NFS' || config.mountType === 'Expert') {
                    await (0, cifsLib_1.umount)(config, log);
                }
                reject(new Error(e));
            }
        });
    }
    throw new Error('Not configured');
}
//# sourceMappingURL=cifs.js.map