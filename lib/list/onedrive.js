"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getFile = getFile;
const node_fs_1 = require("node:fs");
const onedrive_api_1 = __importDefault(require("onedrive-api"));
const oneDriveLib_1 = __importDefault(require("../oneDriveLib"));
async function list(options) {
    const config = options.config;
    // Token refresh
    if (!options.restoreSource || options.restoreSource === 'onedrive') {
        const accessToken = await oneDriveLib_1.default.getToken(config.onedriveAccessJson, options.log).catch(err => options.log.warn(`[OneDrive] Token: ${err}`));
        if (accessToken) {
            let dir = (config.dir || '/').replace(/\\/g, '/');
            if (config.ownDir === true) {
                dir = (config.dirMinimal || '/').replace(/\\/g, '/');
            }
            if (!dir || dir[0] !== '/') {
                dir = `/${dir || ''}`;
            }
            if (!dir) {
                dir = 'root';
            }
            if (dir.startsWith('/')) {
                dir = dir.substring(1);
            }
            const result = await onedrive_api_1.default.items.getMetadata({
                accessToken,
                itemId: `${dir !== 'root' ? `root:/${dir}` : dir}`,
            });
            if (result?.id) {
                const id = result.id;
                const children = await onedrive_api_1.default.items.listChildren({
                    accessToken,
                    itemId: id,
                });
                if (children?.value) {
                    const _files = children.value
                        .map(file => ({
                        path: file.name || '',
                        name: file.name || '',
                        size: file.size || 0,
                        id: file.id,
                    }))
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
                        options.log.error(`[FTP] Files error: ${e} please check the ftp config and try again!!`);
                    }
                    return files;
                }
                throw new Error('Empty answer');
            }
        }
    }
    return Promise.resolve(null);
}
async function getFile(commonConfig, fileName, toStoreName, log) {
    const config = commonConfig;
    if (config.onedriveAccessJson) {
        // Token refresh
        const accessToken = await oneDriveLib_1.default.getToken(config.onedriveAccessJson, log);
        if (accessToken) {
            // copy file to backupDir
            const onlyFileName = fileName.split('/').pop();
            let dir = (config.dir || '').replace(/\\/g, '/');
            if (config.ownDir === true) {
                dir = (config.dirMinimal || '').replace(/\\/g, '/');
            }
            if (!dir) {
                dir = 'root';
            }
            if (dir.startsWith('/')) {
                dir = dir.substring(1);
            }
            const result = await onedrive_api_1.default.items.getMetadata({
                accessToken,
                itemId: `${dir !== 'root' ? `root:/${dir}` : dir}`,
            });
            if (result?.id) {
                const children = await onedrive_api_1.default.items.listChildren({
                    accessToken,
                    itemId: result.id,
                });
                if (children?.value) {
                    const result = children.value.filter(d => d.name === onlyFileName);
                    if (result[0].id) {
                        const itemId = result[0].id;
                        return new Promise(async (resolve, reject) => {
                            log.debug(`[OneDrive] Download of "${fileName}" started`);
                            const writeStream = (0, node_fs_1.createWriteStream)(toStoreName);
                            writeStream
                                .on('error', err => {
                                log.error(`[OneDrive] ${err}`);
                                reject(err);
                            })
                                .on('close', () => {
                                log.debug(`[OneDrive] Download of "${fileName}" finish`);
                                resolve();
                            });
                            const fileStream = await onedrive_api_1.default.items.download({
                                accessToken,
                                itemId,
                            });
                            fileStream.pipe(writeStream);
                        });
                    }
                }
            }
        }
    }
    throw new Error('Not configured');
}
//# sourceMappingURL=onedrive.js.map