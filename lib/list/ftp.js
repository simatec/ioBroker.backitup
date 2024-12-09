"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getFile = getFile;
const node_fs_1 = require("node:fs");
async function list(options) {
    const config = options.config;
    const ftpDir = config.dir || '/';
    if (config.host && (!options.restoreSource || options.restoreSource === 'ftp')) {
        const Client = await import('ftp');
        let dir = ftpDir.replace(/\\/g, '/');
        if (config.ownDir) {
            dir = (config.dirMinimal || '').replace(/\\/g, '/');
        }
        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }
        return new Promise((resolve, reject) => {
            const client = new Client.default();
            client.on('ready', () => {
                options.log.debug('[FTP] connected.');
                client.list(dir, (err, result) => {
                    if (err) {
                        options.log.error(`[FTP] ${err}`);
                    }
                    client.end();
                    if (result?.length) {
                        let _files = [];
                        try {
                            _files = result
                                .map(file => {
                                return {
                                    path: file.name,
                                    name: file.name.replace(/\\/g, '/').split('/').pop() || '',
                                    size: file.size,
                                };
                            })
                                .filter(file => (options.creators.includes(file.name.split('_')[0]) ||
                                options.creators.includes(file.name.split('.')[0])) &&
                                file.name.endsWith('.gz'));
                        }
                        catch (e) {
                            options.log.error(`[FTP] error on ftp list: ${e} please check the ftp config!!`);
                        }
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
                        resolve({});
                    }
                });
            });
            client.on('error', err => reject(err));
            const srcFTP = {
                host: config.host,
                port: parseInt(config.port, 10) || 21,
                secure: config.secure || false,
                secureOptions: {
                    rejectUnauthorized: config.signedCertificates === undefined ? true : config.signedCertificates,
                },
                user: config.user,
                password: config.pass,
            };
            client.connect(srcFTP);
        });
    }
    return Promise.resolve(null);
}
async function getFile(commonConfig, fileName, toStoreName, log) {
    const config = commonConfig;
    if (config.host) {
        // copy file to backupDir
        const Client = await import('ftp');
        const client = new Client.default();
        return new Promise((resolve, reject) => {
            let dir = (config.dir || '').replace(/\\/g, '/');
            if (config.ownDir) {
                dir = (config.dirMinimal || '').replace(/\\/g, '/');
            }
            if (!dir || dir[0] !== '/') {
                dir = `/${dir || ''}`;
            }
            client.on('ready', () => {
                log.debug('[FTP] connected.');
                log.debug(`[FTP] Get file: ${dir}/${fileName}`);
                client.get(`${dir}/${fileName}`, (err, stream) => {
                    if (err) {
                        try {
                            client.end();
                        }
                        catch (e) {
                            // ignore
                        }
                        log.error(`[FTP] ${err}`);
                        reject(err);
                    }
                    else {
                        try {
                            stream.once('close', () => {
                                log.debug('[FTP] Download done');
                                client.end();
                                resolve();
                            });
                            const writeStream = (0, node_fs_1.createWriteStream)(toStoreName);
                            writeStream.on('error', err => {
                                log.error(`[FTP] ${err}`);
                                reject(err);
                            });
                            stream.pipe(writeStream);
                        }
                        catch (err) {
                            log.error(`[FTP] ${err}`);
                            reject(new Error(err));
                        }
                    }
                });
            });
            client.on('error', err => reject(err));
            const srcFTP = {
                host: config.host,
                port: parseInt(config.port, 10) || 21,
                secure: config.secure || false,
                secureOptions: {
                    rejectUnauthorized: config.signedCertificates === undefined ? true : config.signedCertificates,
                },
                user: config.user || '',
                password: config.pass || ''
            };
            client.connect(srcFTP);
        });
    }
    throw new Error('Not configured');
}
//# sourceMappingURL=ftp.js.map