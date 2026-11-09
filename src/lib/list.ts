import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { getIobDir, isPureIobrokerBackup, listedBackupType } from './tools';
import type { BackItUpContext, BackItUpStorage } from './types';
import type {
    BackItUpListCallback,
    BackItUpListResult,
    BackItUpStorageEngine,
    BackItUpStorageEngineResultFile,
    BackItUpStorageFiles,
    BackItUpStorageKey,
} from './list/types';

const storages: Record<string, BackItUpStorageEngine> = {};

/**
 * The backup configuration is walked generically here - `list` does not care which creators and
 * storages exist, only that a node carries `type: 'creator'` or `type: 'storage'`.
 */
interface ConfigNode {
    type?: string;
    [attr: string]: unknown;
}

function isNode(value: unknown): value is ConfigNode {
    return typeof value === 'object' && value !== null;
}

export default function listBackups(
    restoreSource: BackItUpStorage | '' | undefined,
    config: Record<string, unknown>,
    log: ioBroker.Logger,
    callback?: (result: BackItUpListResult) => void,
): void {
    const files: BackItUpStorageFiles = {};

    // Listing is read-only, so the engines only ever reach for `log` here. The scratch pad and the
    // adapter stay empty until lib/list itself is called with a real context.
    const context: BackItUpContext = {
        adapter: null,
        log,
        backupDir: join(getIobDir(), 'backups').replace(/\\/g, '/'),
        timestamp: 0,
        fileNames: [],
        errors: {},
        done: [],
        types: [],
    };

    let counter = 0;
    const creators: string[] = [];
    for (const type in config) {
        if (Object.prototype.hasOwnProperty.call(config, type)) {
            const node = config[type];
            if (isNode(node) && node.type === 'creator') {
                if (!creators.includes(type)) {
                    creators.push(type);
                }
            }
            try {
                if (isNode(node)) {
                    for (const attr in node) {
                        if (Object.prototype.hasOwnProperty.call(node, attr)) {
                            const child = node[attr];
                            if (isNode(child) && child.type === 'creator' && !creators.includes(attr)) {
                                creators.push(attr);
                            }
                        }
                    }
                }
            } catch {
                log.debug('Backup list cannot be read ...');
            }
        }
    }

    const backupDir = join(getIobDir(), 'backups').replace(/\\/g, '/');

    if (existsSync(backupDir) && (!restoreSource || restoreSource === 'local')) {
        const local: NonNullable<BackItUpStorageFiles['local']> = {};

        readdirSync(backupDir)
            .sort()
            .map(file => join(backupDir, file).replace(/\\/g, '/'))
            .map((file): BackItUpStorageEngineResultFile => {
                const stat = statSync(file);
                return { path: file, name: file.split('/').pop() as string, size: stat.size };
            })
            .filter(file => isPureIobrokerBackup(file.name) || listedBackupType(file.name, creators) !== null)
            .forEach(file => {
                const type = isPureIobrokerBackup(file.name)
                    ? 'iobroker'
                    : (listedBackupType(file.name, creators) as string);
                local[type] = local[type] || [];
                local[type].push(file);
            });

        files.local = local;
    }

    /**
     * Asks one storage engine for its backups and files the answer under the engine's key.
     *
     * @param attr name of the storage (ftp, dropbox, ...)
     * @param storageConfig settings of the storage
     * @param types backup types to look for
     */
    const run = (attr: string, storageConfig: ConfigNode, types: string[]): void => {
        counter++;
        const onListed: BackItUpListCallback = (err, result, storage) => {
            if (err) {
                log.error(String(err));
            }
            if (result && storage) {
                if (storage === 'cifs') {
                    // Meant to drop NAS entries that are really the local backup directory seen
                    // through a mount. It never runs: lib/list/cifs reports itself as
                    // 'nas / copy' (the key the restore tab and lib/restore expect), so this
                    // comparison has always been false and NAS duplicates are listed twice.
                    // Left as found - switching the key on would start hiding entries that
                    // users currently see.
                    //
                    // The optional chaining below is defensive: `files.local` is only filled
                    // when local backups were requested, so it is absent whenever
                    // `restoreSource` names another storage.
                    for (const backupType in result) {
                        if (Object.prototype.hasOwnProperty.call(result, backupType)) {
                            result[backupType] = result[backupType]?.filter(
                                file => !files.local?.[backupType]?.find(f => f.path === file.path),
                            );
                        }
                    }
                }

                // a storage can be listed twice (CCU backups in their own directory): merge both answers
                const target = (files[storage] = files[storage] || {});
                for (const backupType in result) {
                    if (Object.prototype.hasOwnProperty.call(result, backupType)) {
                        const known = target[backupType] || [];
                        target[backupType] = [
                            ...known,
                            ...(result[backupType] || []).filter(f => !known.some(k => k.path === f.path)),
                        ];
                    }
                }
            }
            setTimeout(() => {
                if (!--counter && callback) {
                    callback({ error: err, data: files });
                }
            }, 2000);
        };

        const engine = storages[attr];
        engine
            .list({
                context,
                options: storageConfig as never,
                restoreSource,
                types,
            })
            .then(
                // undefined means the engine had nothing to file; anything else is filed under
                // its own key, exactly like the callback contract did.
                result =>
                    onListed(
                        null,
                        result,
                        result === undefined ? undefined : (engine.storageKey ?? (attr as BackItUpStorageKey)),
                    ),
                (e: Error) => onListed(e),
            );
    };

    const done: string[] = [];

    for (const type in config) {
        if (!Object.prototype.hasOwnProperty.call(config, type)) {
            continue;
        }
        const node = config[type];
        if (!isNode(node)) {
            continue;
        }

        for (const attr in node) {
            if (!Object.prototype.hasOwnProperty.call(node, attr)) {
                continue;
            }
            const storageConfig = node[attr];
            if (!isNode(storageConfig) || storageConfig.type !== 'storage') {
                continue;
            }
            if (done.includes(attr)) {
                continue;
            }
            done.push(attr);

            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                storages[attr] = storages[attr] || require(`./list/${attr}`);
            } catch (e) {
                log.error(`Cannot load list module ${attr}: ${e}`);
                continue;
            }

            run(attr, storageConfig, creators);
        }
    }

    // With "own directory" the CCU backups are uploaded into the CCU directory of the storage, which the
    // listing above does not read (it uses the directory of the ioBroker backup). Read it additionally.
    // A NAS mounted with CIFS / NFS holds the ioBroker directory on the backup directory, so the CCU
    // directory is mounted for a moment onto a second mount point (`separateMount`).
    const ccu = config.ccu;
    if (isNode(ccu) && ccu.enabled) {
        for (const attr in ccu) {
            if (!Object.prototype.hasOwnProperty.call(ccu, attr)) {
                continue;
            }
            const storageConfig = ccu[attr];
            if (
                !isNode(storageConfig) ||
                storageConfig.type !== 'storage' ||
                storageConfig.ownDir !== true ||
                !storages[attr]
            ) {
                continue;
            }
            run(
                attr,
                attr === 'cifs'
                    ? { ...storageConfig, ownDir: false, separateMount: true }
                    : { ...storageConfig, ownDir: false },
                ['ccu'],
            );
        }
    }

    if (!counter) {
        callback?.({ error: null, data: files });
    }
}
