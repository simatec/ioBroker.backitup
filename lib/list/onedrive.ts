import { createWriteStream } from 'node:fs';

import oneDriveAPI from 'onedrive-api';
import OneDrive from '../oneDriveLib';
import type { BackItUpStorageEngineOptions, BackItUpStorageEngineResult } from './types';
import type { BackItUpConfigStorage, BackItUpConfigStorageOneDrive, BackItUpWhatToSave } from '../types';

export async function list(options: BackItUpStorageEngineOptions): Promise<BackItUpStorageEngineResult | null> {
    const config: BackItUpConfigStorageOneDrive = options.config as BackItUpConfigStorageOneDrive;

    // Token refresh
    if (!options.restoreSource || options.restoreSource === 'onedrive') {
        const accessToken = await OneDrive.getToken(config.onedriveAccessJson, options.log).catch(err =>
            options.log.warn(`[OneDrive] Token: ${err}`),
        );

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

            const result = await oneDriveAPI.items.getMetadata({
                accessToken,
                itemId: `${dir !== 'root' ? `root:/${dir}` : dir}`,
            });

            if (result?.id) {
                const id: string = result.id;
                const children = await oneDriveAPI.items.listChildren({
                    accessToken,
                    itemId: id,
                });

                if (children?.value) {
                    const _files: {
                        path: string;
                        name: string;
                        size: number;
                        id?: string;
                    }[] = children.value
                        .map(file => ({
                            path: file.name || '',
                            name: file.name || '',
                            size: file.size || 0,
                            id: file.id,
                        }))
                        .filter(
                            file =>
                                (options.creators.includes(file.name.split('_')[0] as BackItUpWhatToSave) ||
                                    options.creators.includes(file.name.split('.')[0] as BackItUpWhatToSave)) &&
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

export async function getFile(
    commonConfig: BackItUpConfigStorage,
    fileName: string,
    toStoreName: string,
    log: ioBroker.Log,
): Promise<void> {
    const config: BackItUpConfigStorageOneDrive = commonConfig as BackItUpConfigStorageOneDrive;

    if (config.onedriveAccessJson) {
        // Token refresh
        const accessToken = await OneDrive.getToken(config.onedriveAccessJson, log);

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

            const result = await oneDriveAPI.items.getMetadata({
                accessToken,
                itemId: `${dir !== 'root' ? `root:/${dir}` : dir}`,
            });

            if (result?.id) {
                const children = await oneDriveAPI.items.listChildren({
                    accessToken,
                    itemId: result.id,
                });
                if (children?.value) {
                    const result = children.value.filter(d => d.name === onlyFileName);
                    if (result[0].id) {
                        const itemId: string = result[0].id;

                        return new Promise(async (resolve, reject) => {
                            log.debug(`[OneDrive] Download of "${fileName}" started`);

                            const writeStream = createWriteStream(toStoreName);
                            writeStream
                                .on('error', err => {
                                    log.error(`[OneDrive] ${err}`);
                                    reject(err);
                                })
                                .on('close', (): void => {
                                    log.debug(`[OneDrive] Download of "${fileName}" finish`);
                                    resolve();
                                });

                            const fileStream = await oneDriveAPI.items.download({
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
