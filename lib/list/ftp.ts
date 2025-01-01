import { createWriteStream } from 'node:fs';
import type FtpClient from 'ftp';
import type { BackItUpStorageEngineOptions, BackItUpStorageEngineResult } from './types';
import type { BackItUpConfigStorage, BackItUpConfigStorageFtp, BackItUpWhatToSave } from '../types';

export async function list(options: BackItUpStorageEngineOptions): Promise<BackItUpStorageEngineResult | null> {
    const config: BackItUpConfigStorageFtp = options.config as BackItUpConfigStorageFtp;

    if (config.host && (!options.restoreSource || options.restoreSource === 'ftp')) {
        const Client = await import('ftp');

        let dir = (config.dir || '/').replace(/\\/g, '/');

        if (config.ownDir) {
            dir = (config.dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }

        return new Promise((resolve, reject): void => {
            const client: FtpClient = new Client.default();

            client.on('ready', () => {
                options.log.debug('[FTP] connected.');
                client.list(dir, (err: Error | null, result): void => {
                    if (err) {
                        options.log.error(`[FTP] ${err}`);
                    }
                    client.end();
                    if (result?.length) {
                        let _files: {
                            path: string;
                            name: string;
                            size: number;
                        }[] = [];
                        try {
                            _files = result
                                .map(file => {
                                    return {
                                        path: file.name,
                                        name: file.name.replace(/\\/g, '/').split('/').pop() || '',
                                        size: file.size,
                                    };
                                })
                                .filter(
                                    file =>
                                        (options.creators.includes(file.name.split('_')[0] as BackItUpWhatToSave) ||
                                            options.creators.includes(file.name.split('.')[0] as BackItUpWhatToSave)) &&
                                        file.name.endsWith('.gz'),
                                );
                        } catch (e) {
                            options.log.error(`[FTP] error on ftp list: ${e} please check the ftp config!!`);
                        }

                        const files: BackItUpStorageEngineResult = {};
                        try {
                            _files.forEach(file => {
                                const type: BackItUpWhatToSave = file.name.split('_')[0] as BackItUpWhatToSave;
                                files[type] = files[type] || [];
                                files[type].push(file);
                            });
                        } catch (e) {
                            options.log.error(`[FTP] Files error: ${e} please check the ftp config and try again!!`);
                        }

                        resolve(files);
                    } else {
                        resolve({});
                    }
                });
            });
            client.on('error', err => reject(err));

            const srcFTP: FtpClient.Options = {
                host: config.host,
                port: parseInt(config.port as string, 10) || 21,
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

export async function getFile(
    commonConfig: BackItUpConfigStorage,
    fileName: string,
    toStoreName: string,
    log: ioBroker.Log,
): Promise<void> {
    const config: BackItUpConfigStorageFtp = commonConfig as BackItUpConfigStorageFtp;

    if (config.host) {
        // copy file to backupDir
        const Client = await import('ftp');
        const client: FtpClient = new Client.default();

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
                        } catch (e) {
                            // ignore
                        }
                        log.error(`[FTP] ${err}`);
                        reject(err);
                    } else {
                        try {
                            stream.once('close', () => {
                                log.debug('[FTP] Download done');
                                client.end();
                                resolve();
                            });
                            const writeStream = createWriteStream(toStoreName);
                            writeStream.on('error', err => {
                                log.error(`[FTP] ${err}`);
                                reject(err);
                            });

                            stream.pipe(writeStream);
                        } catch (err) {
                            log.error(`[FTP] ${err}`);
                            reject(new Error(err));
                        }
                    }
                });
            });

            client.on('error', err => reject(err));

            const srcFTP: FtpClient.Options = {
                host: config.host,
                port: parseInt(config.port as string, 10) || 21,
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
