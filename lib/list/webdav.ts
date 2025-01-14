import { createWriteStream } from 'node:fs';
import { Agent } from 'node:https';
import type { BackItUpStorageEngineOptions, BackItUpStorageEngineResult } from './types';
import type { BackItUpConfigStorage, BackItUpConfigStorageWebDav, BackItUpWhatToSave } from '../types';

export interface FileStat {
    filename: string;
    basename: string;
    lastmod: string;
    size: number;
    type: 'file' | 'directory';
    etag: string | null;
    mime?: string;
}

export declare enum AuthType {
    Auto = 'auto',
    Digest = 'digest',
    None = 'none',
    Password = 'password',
    Token = 'token',
}
export interface Headers {
    [key: string]: string;
}
export interface WebDAVClientOptions {
    authType?: AuthType;
    remoteBasePath?: string;
    contactHref?: string;
    ha1?: string;
    headers?: Headers;
    httpAgent?: any;
    httpsAgent?: any;
    maxBodyLength?: number;
    maxContentLength?: number;
    password?: string;
    token?: OAuthToken;
    username?: string;
    withCredentials?: boolean;
}
export interface OAuthToken {
    access_token: string;
    token_type: string;
    refresh_token?: string;
}
export async function list(options: BackItUpStorageEngineOptions): Promise<BackItUpStorageEngineResult | null> {
    const config: BackItUpConfigStorageWebDav = options.config as BackItUpConfigStorageWebDav;
    if (
        config.username &&
        config.pass &&
        config.url &&
        (!options.restoreSource || options.restoreSource === 'webdav')
    ) {
        //const { createClient } = require("webdav");
        const { createClient } = await import('webdav');
        const agent = new Agent({
            rejectUnauthorized: config.signedCertificates === undefined ? true : config.signedCertificates,
        });
        const client = createClient(config.url, {
            username: config.username,
            password: config.pass,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            httpsAgent: agent,
        } as WebDAVClientOptions);

        let dir = (config.dir || '/').replace(/\\/g, '/');

        if (config.ownDir) {
            dir = (config.dirMinimal || '').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }

        return client.getDirectoryContents(dir).then(contents => {
            if (contents) {
                const webDavFiles: FileStat[] = contents as FileStat[];
                const _files: {
                    path: string;
                    name: string;
                    size: number;
                }[] = webDavFiles
                    .map(file => {
                        return {
                            path: file.filename,
                            name: file.filename.replace(/\\/g, '/').split('/').pop() || '',
                            size: file.size,
                        };
                    })
                    .filter(
                        file =>
                            (options.creators.includes(file.name.split('_')[0] as BackItUpWhatToSave) ||
                                options.creators.includes(file.name.split('.')[0] as BackItUpWhatToSave)) &&
                            file.name?.endsWith('.gz'),
                    );

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
                return files;
            }
            return {};
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
    const config: BackItUpConfigStorageWebDav = commonConfig as BackItUpConfigStorageWebDav;

    if (config.username && config.pass && config.url) {
        const { createClient } = await import('webdav');
        const agent = new Agent({
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
            const writeStream = createWriteStream(toStoreName);
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
