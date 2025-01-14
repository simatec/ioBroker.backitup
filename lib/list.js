"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const tools_1 = require("./tools");
const storages = {};
async function listStorage(options) {
    if (!storages[options.storage]) {
        try {
            const strObject = await import(`./list/${options.storage}`);
            storages[options.storage] = strObject.default;
        }
        catch (e) {
            throw new Error(`Cannot load list module "${options.storage}": ${e}`);
        }
    }
    try {
        return await storages[options.storage].list(options);
    }
    catch (err) {
        throw new Error(`Cannot list files with "${options.storage}": ${err}`);
    }
}
async function list(restoreSource, config, log) {
    const files = {};
    const creators = ['iobroker', 'ccu'];
    // Collect all creators
    Object.keys(config.iobroker).forEach(type => {
        const subConfig = config.iobroker;
        if (typeof subConfig[type] === 'object') {
            const cfg = subConfig[type];
            if (cfg.type === 'creator') {
                if (!creators.includes(type)) {
                    creators.push(type);
                }
            }
        }
    });
    Object.keys(config.ccu).forEach(type => {
        const subConfig = config.ccu;
        if (typeof subConfig[type] === 'object') {
            const cfg = subConfig[type];
            if (cfg.type === 'creator') {
                if (!creators.includes(type)) {
                    creators.push(type);
                }
            }
        }
    });
    const backupDir = (0, node_path_1.join)((0, tools_1.getIobDir)(), 'backups').replace(/\\/g, '/');
    if ((0, node_fs_1.existsSync)(backupDir) && (!restoreSource || restoreSource === 'local')) {
        const fff = (0, node_fs_1.readdirSync)(backupDir)
            .sort()
            .map(file => (0, node_path_1.join)(backupDir, file).replace(/\\/g, '/'));
        const pathNameSize = fff
            .map(file => {
            const stat = (0, node_fs_1.statSync)(file);
            return { path: file, name: file.split('/').pop() || '', size: stat.size };
        })
            .filter(file => (file.name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/) ||
            creators.includes(file.name.split('_')[0]) ||
            creators.includes(file.name.split('.')[0])) &&
            file.name.split('.').pop() === 'gz');
        files.local = {};
        pathNameSize.forEach(file => {
            if (files.local) {
                if (file.name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
                    files.local.iobroker = files.local.iobroker || [];
                    files.local.iobroker.push(file);
                }
                else {
                    const type = file.name.split('_')[0];
                    files.local[type] = files.local[type] || [];
                    files.local[type].push(file);
                }
            }
        });
    }
    const done = [];
    const main = Object.keys(config);
    const promises = [];
    const mapping = [];
    for (let m = 0; m < main.length; m++) {
        const subConfig = config[main[m]];
        for (const attr in subConfig) {
            const storage = attr;
            if (typeof subConfig[storage] === 'object' && subConfig[storage].type === 'storage') {
                if (done.includes(storage)) {
                    continue;
                }
                done.push(storage);
                mapping.push(storage);
                promises[mapping.length - 1] = listStorage({
                    storage,
                    restoreSource,
                    config: subConfig[attr],
                    creators,
                    log,
                }).catch(error => {
                    log.error(error);
                    return null;
                });
                //     if (result) {
                //         if (type === 'cifs') {
                //             for (const type in result) {
                //                 if (result.hasOwnProperty(type)) {
                //                     result[type] = result[type].filter(
                //                         file => !files.local[type].find(f => f.path === file.path),
                //                     );
                //                 }
                //             }
                //         }
                //
                //         files[type] = result;
                //     }
                //     setTimeout(() => !--counter && callback && callback({ error: err, data: files }), 2000);
                // });
            }
        }
    }
    const results = await Promise.all(promises);
    results.forEach((res, i) => {
        if (res) {
            files[mapping[i]] = res;
        }
    });
    // Remove double files
    if (files.cifs && files.local) {
        for (const type in files.cifs) {
            const storage = type;
            if (files.cifs[storage]) {
                files.cifs[storage] = files.cifs[storage].filter(file => !files.local?.[storage]?.find(f => f.path === file.path));
                if (!files.cifs[storage]?.length) {
                    delete files.cifs[storage];
                }
            }
        }
    }
    return files;
}
exports.default = list;
//# sourceMappingURL=list.js.map