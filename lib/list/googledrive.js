"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getFile = getFile;
const googleDriveLib_1 = __importDefault(require("../googleDriveLib"));
async function list(options) {
    const config = options.config;
    if (config.accessJson && (!options.restoreSource || options.restoreSource === 'googledrive')) {
        const gDrive = new googleDriveLib_1.default(config.accessJson, config.newToken);
        if (!gDrive) {
            throw new Error('No or invalid access key');
        }
        let dir = (config.dir || '/').replace(/\\/g, '/');
        if (config.ownDir === true) {
            dir = (config.dirMinimal || '/').replace(/\\/g, '/');
        }
        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }
        const id = await gDrive.getFileOrFolderId(dir);
        if (!id) {
            return {};
        }
        const list = await gDrive.listFilesInFolder(id);
        const _files = list
            ?.map(file => ({ path: file.name, name: file.name, size: file.size, id }))
            .filter(file => (options.creators.includes(file.name.split('_')[0]) ||
            options.creators.includes(file.name.split('.')[0])) &&
            file.name.endsWith('.gz')) || [];
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
    return Promise.resolve(null);
}
async function getFile(commonConfig, fileName, toStoreName, log) {
    const config = commonConfig;
    if (config.accessJson) {
        const gDrive = new googleDriveLib_1.default(config.accessJson, config.newToken);
        if (!gDrive) {
            throw new Error('No or invalid access key');
        }
        let dir = (config.dir || '/').replace(/\\/g, '/');
        if (config.ownDir === true) {
            dir = (config.dirMinimal || '/').replace(/\\/g, '/');
        }
        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }
        log.debug(`[GoogleDrive] Download of "${fileName}" started`);
        const folderId = await gDrive.getFileOrFolderId(dir);
        if (!folderId) {
            throw new Error('Folder not found');
        }
        const fileId = await gDrive.getFileOrFolderId(fileName, folderId);
        if (!fileId) {
            throw new Error('File not found');
        }
        return gDrive
            .readFile(fileId, toStoreName)
            .then(() => log.debug(`[GoogleDrive] Download of "${fileName}" done`));
    }
    throw new Error('Not configured');
}
//# sourceMappingURL=googledrive.js.map