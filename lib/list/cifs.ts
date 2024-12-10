import type { BackItUpStorageEngineOptions, BackItUpStorageEngineResult } from './types';
import type { BackItUpConfigStorageCifs, BackItUpConfigStorage, BackItUpWhatToSave } from '../types';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getIobDir } from '../tools';
import { copy } from 'fs-extra';
import { mount, umount } from '../cifsLib';

const backupDir = join(getIobDir(), 'backups').replace(/\\/g, '/');

export async function list(options: BackItUpStorageEngineOptions): Promise<BackItUpStorageEngineResult | null> {
    const config: BackItUpConfigStorageCifs = options.config as BackItUpConfigStorageCifs;
    if (config.enabled && (!options.restoreSource || options.restoreSource === 'cifs')) {
        if (config.mountType === 'CIFS' || config.mountType === 'NFS' || config.mountType === 'Expert') {
            await mount(config, options.log);
        }

        let dir = backupDir.replace(/\\/g, '/');

        if (config.mountType === 'Copy') {
            dir = (config.dir || '/').replace(/\\/g, '/');
            if (config.ownDir === true) {
                dir = (config.dirMinimal || '/').replace(/\\/g, '/');
            }
            if (dir[0] !== '/' && !dir.match(/\w:/)) {
                dir = `/${dir || ''}`;
            }
        } else {
            if (dir[0] !== '/' && !dir.match(/\w:/)) {
                dir = `/${dir || ''}`;
            }
        }

        const files = {};
        if (existsSync(dir)) {
            const result = readdirSync(dir)
                .sort()
                .map(file => join(dir, file).replace(/\\/g, '/'));

            if (result?.length) {
                const _files: {
                    path: string;
                    name: string;
                    size: number;
                }[] = result
                    .map(file => {
                        const stat = statSync(file);
                        return { path: file, name: file.split('/').pop() || '', size: stat.size };
                    })
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
                    options.log.error(`[CIFS] Files error: ${e}`);
                }
                return files;
            }
            return {};
        }
        return files;
    }

    return Promise.resolve(null);
}

export async function getFile(
    commonConfig: BackItUpConfigStorage,
    fileName: string,
    toStoreName: string,
    log: ioBroker.Log,
): Promise<void> {
    const config: BackItUpConfigStorageCifs = commonConfig as BackItUpConfigStorageCifs;
    if (config.enabled) {
        if (config.mountType === 'CIFS' || config.mountType === 'NFS' || config.mountType === 'Expert') {
            // File already exists on the destination
            return;
        }

        return new Promise(async (resolve, reject): Promise<void> => {
            try {
                log.debug(`Get file ${fileName}`);
                log.debug(`Mount type: ${config.mountType != undefined ? config.mountType : 'Copy'}`);

                copy(fileName, toStoreName, (err): void => {
                    if (err) {
                        log.error(err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } catch (e) {
                log.error(`[CIFS] ${e}`);

                if (config.mountType === 'CIFS' || config.mountType === 'NFS' || config.mountType === 'Expert') {
                    await umount(config, log);
                }
                reject(new Error(e));
            }
        });
    }

    throw new Error('Not configured');
}
