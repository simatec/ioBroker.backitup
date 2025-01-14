import type { BackItUpStorageEngineOptions, BackItUpStorageEngineResult } from './types';
import type {
    BackItUpConfigStorage,
    BackItUpConfigStorageDropbox,
    BackItUpWhatToSave,
} from '../types';

import { createWriteStream } from 'node:fs';
import { join } from 'node:path';

// @ts-expect-error no types
import dropboxV2Api from 'dropbox-v2-api';
import Dropbox, { type DBX } from '../dropboxLib';

export async function list(options: BackItUpStorageEngineOptions): Promise<BackItUpStorageEngineResult | null> {
    const config: BackItUpConfigStorageDropbox = options.config as BackItUpConfigStorageDropbox;
    let accessToken;

    // Token refresh
    if (!options.restoreSource || options.restoreSource === 'dropbox') {
        if (config.dropboxTokenType === 'default') {
            accessToken = await Dropbox.getToken(config.dropboxAccessJson, options.log).catch((err: Error): void =>
                options.log.warn(`[Dropbox] Token: ${err}`),
            );
        } else if (config.dropboxTokenType === 'custom') {
            accessToken = config.accessToken;
        }

        if (accessToken) {
            const dbx: DBX = dropboxV2Api.authenticate({ token: accessToken });

            let dir = (config.dir || '/').replace(/\\/g, '/');

            if (config.ownDir === true) {
                dir = (config.dirMinimal || '/').replace(/\\/g, '/');
            }

            if (!dir || dir[0] !== '/') {
                dir = `/${dir || ''}`;
            }

            return new Promise((resolve, reject): void => {
                try {
                    dbx(
                        {
                            resource: 'files/list_folder',
                            parameters: {
                                path: dir.replace(/^\/$/, ''),
                            },
                        },
                        (err: any, result?: { entries: { path_display: string; size: number }[] }): void => {
                            if (err?.error_summary) {
                                options.log.error(`[Dropbox] ${JSON.stringify(err.error_summary)}`);
                            }
                            if (result?.entries) {
                                const _files: {
                                    path: string;
                                    name: string;
                                    size: number;
                                }[] = result.entries
                                    .map(file => {
                                        return {
                                            path: file.path_display,
                                            name: file.path_display.replace(/\\/g, '/').split('/').pop() || '',
                                            size: file.size,
                                        };
                                    })
                                    .filter(
                                        file =>
                                            (options.creators.includes(file.name.split('_')[0] as BackItUpWhatToSave) ||
                                                options.creators.includes(
                                                    file.name.split('.')[0] as BackItUpWhatToSave,
                                                )) &&
                                            file.name.endsWith('.gz'),
                                    );

                                const files: BackItUpStorageEngineResult = {};
                                try {
                                    _files.forEach(file => {
                                        const type: BackItUpWhatToSave = file.name.split('_')[0] as BackItUpWhatToSave;
                                        files[type] = files[type] || [];
                                        files[type].push(file);
                                    });
                                } catch (e) {
                                    options.log.error(
                                        `[FTP] Files error: ${e} please check the ftp config and try again!!`,
                                    );
                                }

                                resolve(files);
                            } else {
                                reject(
                                    new Error(
                                        `${err && err.error_summary ? JSON.stringify(err.error_summary) : 'Error on Dropbox list'}`,
                                    ),
                                );
                            }
                        },
                    );
                } catch (err) {
                    reject(new Error(err));
                }
            });
        }
        return Promise.reject(new Error('No access token found'));
    }
    return Promise.resolve(null);
}

export async function getFile(
    commonConfig: BackItUpConfigStorage,
    fileName: string,
    toStoreName: string,
    log: ioBroker.Log,
): Promise<void> {
    const config: BackItUpConfigStorageDropbox = commonConfig as BackItUpConfigStorageDropbox;

    // Token refresh
    let accessToken;

    if (config.dropboxTokenType === 'default') {
        accessToken = await Dropbox.getToken(config.dropboxAccessJson, log).catch(err =>
            log.warn(`[Dropbox] cannot get access token: ${err}`),
        );
    } else if (config.dropboxTokenType === 'custom') {
        accessToken = config.accessToken;
    }

    if (accessToken) {
        // copy file to backupDir
        const dbx = dropboxV2Api.authenticate({ token: accessToken });

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

                const writeStream = createWriteStream(toStoreName);
                writeStream.on('error', err => {
                    log.error(`[Dropbox] error by writing: ${err}`);
                    reject(err);
                });

                dbx(
                    {
                        resource: 'files/download',
                        parameters: {
                            path: join(dir.replace(/^\/$/, ''), onlyFileName).replace(/\\/g, '/'),
                        },
                    },
                    (err: any): void => {
                        if (err) {
                            log.error(`[Dropbox] error by download: ${err}`);
                            reject(new Error(err));
                        } else {
                            log.debug(`[Dropbox] Download of "${fileName}" done`);
                            resolve();
                        }
                    },
                ).pipe(writeStream);
            } catch (err) {
                log.error(`[Dropbox] error by download: ${err}`);
                reject(new Error(err));
            }
        });
    }

    throw new Error('Not configured');
}
