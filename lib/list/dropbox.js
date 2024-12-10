"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getFile = getFile;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
// @ts-expect-error no types
const dropbox_v2_api_1 = __importDefault(require("dropbox-v2-api"));
const dropboxLib_1 = __importDefault(require("../dropboxLib"));
async function list(options) {
    const config = options.config;
    let accessToken;
    // Token refresh
    if (!options.restoreSource || options.restoreSource === 'dropbox') {
        if (config.dropboxTokenType === 'default') {
            accessToken = await dropboxLib_1.default.getToken(config.dropboxAccessJson, options.log).catch((err) => options.log.warn(`[Dropbox] Token: ${err}`));
        }
        else if (config.dropboxTokenType === 'custom') {
            accessToken = config.accessToken;
        }
        if (accessToken) {
            const dbx = dropbox_v2_api_1.default.authenticate({ token: accessToken });
            let dir = (config.dir || '/').replace(/\\/g, '/');
            if (config.ownDir === true) {
                dir = (config.dirMinimal || '/').replace(/\\/g, '/');
            }
            if (!dir || dir[0] !== '/') {
                dir = `/${dir || ''}`;
            }
            return new Promise((resolve, reject) => {
                try {
                    dbx({
                        resource: 'files/list_folder',
                        parameters: {
                            path: dir.replace(/^\/$/, ''),
                        },
                    }, (err, result) => {
                        if (err?.error_summary) {
                            options.log.error(`[Dropbox] ${JSON.stringify(err.error_summary)}`);
                        }
                        if (result?.entries) {
                            const _files = result.entries
                                .map(file => {
                                return {
                                    path: file.path_display,
                                    name: file.path_display.replace(/\\/g, '/').split('/').pop() || '',
                                    size: file.size,
                                };
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
                                options.log.error(`[FTP] Files error: ${e} please check the ftp config and try again!!`);
                            }
                            resolve(files);
                        }
                        else {
                            reject(new Error(`${err && err.error_summary ? JSON.stringify(err.error_summary) : 'Error on Dropbox list'}`));
                        }
                    });
                }
                catch (err) {
                    reject(new Error(err));
                }
            });
        }
        return Promise.reject(new Error('No access token found'));
    }
    return Promise.resolve(null);
}
async function getFile(commonConfig, fileName, toStoreName, log) {
    const config = commonConfig;
    // Token refresh
    let accessToken;
    if (config.dropboxTokenType === 'default') {
        accessToken = await dropboxLib_1.default.getToken(config.dropboxAccessJson, log).catch(err => log.warn(`[Dropbox] cannot get access token: ${err}`));
    }
    else if (config.dropboxTokenType === 'custom') {
        accessToken = config.accessToken;
    }
    if (accessToken) {
        // copy file to backupDir
        const dbx = dropbox_v2_api_1.default.authenticate({ token: accessToken });
        const onlyFileName = fileName.split('/').pop() || fileName;
        let dir = (config.dir || '/').replace(/\\/g, '/');
        if (config.ownDir === true) {
            dir = (config.dirMinimal || '/').replace(/\\/g, '/');
        }
        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }
        return new Promise((resolve, reject) => {
            try {
                log.debug(`Dropbox: Download of "${fileName}" started`);
                const writeStream = (0, node_fs_1.createWriteStream)(toStoreName);
                writeStream.on('error', err => {
                    log.error(`[Dropbox] error by writing: ${err}`);
                    reject(err);
                });
                dbx({
                    resource: 'files/download',
                    parameters: {
                        path: (0, node_path_1.join)(dir.replace(/^\/$/, ''), onlyFileName).replace(/\\/g, '/'),
                    },
                }, (err) => {
                    if (err) {
                        log.error(`[Dropbox] error by download: ${err}`);
                        reject(new Error(err));
                    }
                    else {
                        log.debug(`[Dropbox] Download of "${fileName}" done`);
                        resolve();
                    }
                }).pipe(writeStream);
            }
            catch (err) {
                log.error(`[Dropbox] error by download: ${err}`);
                reject(new Error(err));
            }
        });
    }
    throw new Error('Not configured');
}
//# sourceMappingURL=dropbox.js.map