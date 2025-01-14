import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getIobDir } from './tools';
import type {
    BackItUpConfig,
    BackItUpConfigInternal,
    BackItUpConfigStorage,
    BackItUpStorage,
    BackItUpWhatToSave,
} from './types';
import type { BackItUpStorageEngine, BackItUpStorageEngineResult, BackItUpStorageFiles } from './list/types';

const storages: { [storage: string]: BackItUpStorageEngine } = {};

async function listStorage(options: {
    storage: BackItUpStorage;
    config: BackItUpConfigStorage;
    restoreSource: BackItUpStorage | '';
    creators: BackItUpWhatToSave[];
    log: ioBroker.Log;
}): Promise<BackItUpStorageEngineResult | null> {
    if (!storages[options.storage]) {
        try {
            const strObject = await import(`./list/${options.storage}`);
            storages[options.storage] = strObject.default as BackItUpStorageEngine;
        } catch (e) {
            throw new Error(`Cannot load list module "${options.storage}": ${e}`);
        }
    }

    try {
        return await storages[options.storage].list(options);
    } catch (err) {
        throw new Error(`Cannot list files with "${options.storage}": ${err}`);
    }
}

async function list(
    restoreSource: BackItUpStorage | '',
    config: BackItUpConfigInternal,
    log: ioBroker.Log,
): Promise<BackItUpStorageFiles> {
    const files: BackItUpStorageFiles = {};

    const creators: BackItUpWhatToSave[] = ['iobroker', 'ccu'];

    // Collect all creators
    Object.keys(config.iobroker).forEach(type => {
        const subConfig: Record<string, BackItUpConfig> = config.iobroker as unknown as Record<string, BackItUpConfig>;
        if (typeof subConfig[type] === 'object') {
            const cfg: BackItUpConfig = subConfig[type];
            if (cfg.type === 'creator') {
                if (!creators.includes(type as BackItUpWhatToSave)) {
                    creators.push(type as BackItUpWhatToSave);
                }
            }
        }
    });
    Object.keys(config.ccu).forEach(type => {
        const subConfig: Record<string, BackItUpConfig> = config.ccu as unknown as Record<string, BackItUpConfig>;
        if (typeof subConfig[type] === 'object') {
            const cfg: BackItUpConfig = subConfig[type];
            if (cfg.type === 'creator') {
                if (!creators.includes(type as BackItUpWhatToSave)) {
                    creators.push(type as BackItUpWhatToSave);
                }
            }
        }
    });

    const backupDir = join(getIobDir(), 'backups').replace(/\\/g, '/');

    if (existsSync(backupDir) && (!restoreSource || restoreSource === 'local')) {
        const fff: string[] = readdirSync(backupDir)
            .sort()
            .map(file => join(backupDir, file).replace(/\\/g, '/'));

        const pathNameSize: { path: string; name: string; size: number }[] = fff
            .map(file => {
                const stat = statSync(file);
                return { path: file, name: file.split('/').pop() || '', size: stat.size };
            })
            .filter(
                file =>
                    (file.name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/) ||
                        creators.includes(file.name.split('_')[0] as BackItUpWhatToSave) ||
                        creators.includes(file.name.split('.')[0] as BackItUpWhatToSave)) &&
                    file.name.split('.').pop() === 'gz',
            );

        files.local = {};
        pathNameSize.forEach(file => {
            if (files.local) {
                if (file.name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
                    files.local.iobroker = files.local.iobroker || [];
                    files.local.iobroker.push(file);
                } else {
                    const type = file.name.split('_')[0] as BackItUpWhatToSave;
                    files.local[type] = files.local[type] || [];
                    files.local[type].push(file);
                }
            }
        });
    }

    const done: BackItUpStorage[] = [];
    const main: ('iobroker' | 'ccu')[] = Object.keys(config) as ('iobroker' | 'ccu')[];

    const promises: Promise<BackItUpStorageEngineResult | null>[] = [];
    const mapping: BackItUpStorage[] = [];

    for (let m = 0; m < main.length; m++) {
        const subConfig: Record<string, BackItUpConfigStorage> = config[main[m]] as unknown as Record<
            string,
            BackItUpConfigStorage
        >;
        for (const attr in subConfig) {
            const storage: BackItUpStorage = attr as BackItUpStorage;
            if (typeof subConfig[storage] === 'object' && subConfig[storage].type === 'storage') {
                if (done.includes(storage)) {
                    continue;
                }
                done.push(storage);

                mapping.push(storage);
                promises[mapping.length - 1] = listStorage({
                    storage,
                    restoreSource,
                    config: subConfig[attr],
                    creators,
                    log,
                }).catch(error => {
                    log.error(error);
                    return null;
                });
                //     if (result) {
                //         if (type === 'cifs') {
                //             for (const type in result) {
                //                 if (result.hasOwnProperty(type)) {
                //                     result[type] = result[type].filter(
                //                         file => !files.local[type].find(f => f.path === file.path),
                //                     );
                //                 }
                //             }
                //         }
                //
                //         files[type] = result;
                //     }
                //     setTimeout(() => !--counter && callback && callback({ error: err, data: files }), 2000);
                // });
            }
        }
    }
    const results = await Promise.all(promises);
    results.forEach((res, i) => {
        if (res) {
            files[mapping[i]] = res;
        }
    })
    // Remove double files
    if (files.cifs && files.local) {
        for (const type in files.cifs) {
            const storage: BackItUpWhatToSave = type as BackItUpWhatToSave;
            if (files.cifs[storage]) {
                files.cifs[storage] = files.cifs[storage].filter(file => !files.local?.[storage]?.find(f => f.path === file.path));
                if (!files.cifs[storage]?.length) {
                    delete files.cifs[storage];
                }
            }
        }
    }

    return files;
}

export default list;
