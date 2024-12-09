"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getFile = getFile;
const node_fs_1 = require("node:fs");
const node_https_1 = require("node:https");
async function list(options) {
    const config = options.config;
    if (config.username &&
        config.pass &&
        config.url &&
        (!options.restoreSource || options.restoreSource === 'webdav')) {
        //const { createClient } = require("webdav");
        const { createClient } = await import('webdav');
        const agent = new node_https_1.Agent({
            rejectUnauthorized: config.signedCertificates === undefined ? true : config.signedCertificates,
        });
        const client = createClient(config.url, {
            username: config.username,
            password: config.pass,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            httpsAgent: agent,
        });
        let dir = (config.dir || '/').replace(/\\/g, '/');
        if (config.ownDir) {
            dir = (config.dirMinimal || '').replace(/\\/g, '/');
        }
        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }
        return client.getDirectoryContents(dir).then(contents => {
            if (contents) {
                const webDavFiles = contents;
                const _files = webDavFiles
                    .map(file => {
                    return {
                        path: file.filename,
                        name: file.filename.replace(/\\/g, '/').split('/').pop() || '',
                        size: file.size,
                    };
                })
                    .filter(file => (options.creators.includes(file.name.split('_')[0]) ||
                    options.creators.includes(file.name.split('.')[0])) &&
                    file.name?.endsWith('.gz'));
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
            return {};
        });
    }
    return Promise.resolve(null);
}
async function getFile(commonConfig, fileName, toStoreName, log) {
    const config = commonConfig;
    if (config.username && config.pass && config.url) {
        const { createClient } = await import('webdav');
        const agent = new node_https_1.Agent({
            rejectUnauthorized: config.signedCertificates === undefined ? true : config.signedCertificates,
        });
        const client = createClient(config.url, {
            username: config.username,
            password: config.pass,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            httpsAgent: agent,
        });
        log.debug(`[WebDAV] Download of "${fileName}" started`);
        return new Promise((resolve, reject) => {
            const writeStream = (0, node_fs_1.createWriteStream)(toStoreName);
            writeStream
                .on('error', err => {
                log.error(`[WebDAV] ${err}`);
                reject(err);
            })
                .on('close', () => {
                log.debug(`[WebDAV] Download of "${fileName}" finish`);
                resolve();
            });
            client.createReadStream(fileName).pipe(writeStream);
        });
    }
    throw new Error('Not configured');
}
module.exports = {
    list,
    getFile,
};
//# sourceMappingURL=webdav.js.map