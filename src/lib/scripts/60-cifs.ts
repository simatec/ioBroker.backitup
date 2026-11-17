import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { copyFile } from '../tools';
import type { BackItUpContext, BackItUpProps } from '../types';

interface CifsCopyOptions {
    dir: string;
    mountType?: 'CIFS' | 'NFS' | 'Copy' | 'Expert';
    deleteOldBackup?: boolean;
    deleteBackupAfter?: number;
    influxDBMulti?: boolean;
    influxDBEvents?: unknown[];
    mySqlMulti?: boolean;
    mySqlEvents?: unknown[];
    pgSqlMulti?: boolean;
    pgSqlEvents?: unknown[];
    ccuMulti?: boolean;
    ccuEvents?: unknown[];
}

/**
 * Copies every file of this run into the mounted directory, one after the other.
 *
 * A failed copy is recorded and logged but does not stop the remaining files, as before.
 *
 * @param dir target directory
 * @param fileNames the files to copy; this list is consumed
 * @param ctx run context, for the logger and the error store
 */
async function copyFiles(dir: string, fileNames: string[], ctx: BackItUpContext): Promise<void> {
    while (fileNames.length) {
        let fileName = fileNames.shift() as string;
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop() as string;
        try {
            ctx.log.debug(`Copy ${onlyFileName}...`);
            await new Promise<void>(resolve => {
                copyFile(fileName, join(dir, onlyFileName), err => {
                    if (err) {
                        ctx.errors.cifs = err;
                        ctx.log.error(err);
                    }
                    resolve();
                });
            });
        } catch (e) {
            ctx.log.error(e);
            ctx.errors.cifs = e as Error;
        }
    }
}

/**
 * Deletes the given files, stopping at the first one that fails.
 *
 * @param files absolute paths to delete
 * @param ctx run context, for the logger and the error store
 */
function deleteFiles(files: string[], ctx: BackItUpContext): boolean | undefined {
    try {
        for (let f = 0; f < files.length; f++) {
            ctx.log.debug(`delete ${files[f]}`);
            unlinkSync(files[f]);
        }
        return true;
    } catch (e) {
        ctx.errors.cifs = ctx.errors.cifs || (e as Error);
        ctx.log.error(e);
        return undefined;
    }
}

/**
 * Drops everything but the newest `num` backups per backup type.
 *
 * @param dir directory to clean
 * @param options script options, for the multi-instance counts
 * @param names backup types of this run
 * @param num how many to keep per type
 * @param ctx run context, for the logger and the error store
 */
function cleanFiles(
    dir: string,
    options: CifsCopyOptions,
    names: string[],
    num: number,
    ctx: BackItUpContext,
): void {
    if (!num) {
        return;
    }

    try {
        if (dir[dir.length - 1] !== '/') {
            dir += '/';
        }

        const result = readdirSync(dir);

        if (result && result.length) {
            const files: string[] = [];
            names.forEach(name => {
                const subResult = result.filter(a => a.startsWith(name));
                let numDel = num;

                // Multi-instance setups produce one file per configured target per run.
                if (name === 'influxDB' && options.influxDBMulti) {
                    numDel = num * (options.influxDBEvents as unknown[]).length;
                }
                if (name === 'mysql' && options.mySqlMulti) {
                    numDel = num * (options.mySqlEvents as unknown[]).length;
                }
                if (name === 'pgsql' && options.pgSqlMulti) {
                    numDel = num * (options.pgSqlEvents as unknown[]).length;
                }
                if (name === 'homematic' && options.ccuMulti) {
                    numDel = num * (options.ccuEvents as unknown[]).length;
                }

                if (subResult.length > numDel) {
                    // delete oldest files
                    subResult.sort((a, b) => {
                        const at = statSync(dir + a).ctime;
                        const bt = statSync(dir + b).ctime;
                        if (at > bt) {
                            return -1;
                        }
                        if (at < bt) {
                            return 1;
                        }
                        return 0;
                    });

                    for (let i = numDel; i < subResult.length; i++) {
                        files.push(join(dir, subResult[i]));
                    }
                }
            });
            deleteFiles(files, ctx);
        }
    } catch (e) {
        ctx.errors.cifs = ctx.errors.cifs || (e as Error);
    }
}

/**
 * Copies this run's archives into the mounted NAS directory and prunes the old ones.
 *
 * @param props the run context and the cifs slice of the config
 */
export async function run(props: BackItUpProps<CifsCopyOptions>): Promise<void> {
    const { context: ctx, options } = props;

    if (!options.dir || !ctx.fileNames || !ctx.fileNames.length) {
        return;
    }

    const fileNames: string[] = JSON.parse(JSON.stringify(ctx.fileNames));

    let dir = options.dir.replace(/\\/g, '/');

    if (dir[0] !== '/' && !dir.match(/\w:/)) {
        dir = `/${dir || ''}`;
    }
    ctx.log.debug(`used copy path: ${dir}`);

    if (!existsSync(dir)) {
        if (options.mountType === 'Copy') {
            // A plain string, as before: wrapping it in an Error would prefix the reported text.
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw `Path "${dir}" not found`;
        }
        return;
    }

    if (dir === ctx.backupDir) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw `The storage path "${dir}" for copying is not configured correctly`;
    }

    await copyFiles(dir, fileNames, ctx);

    if (options.deleteOldBackup === true) {
        // The original wraps this call in `if (…)` with its own TODO noting that cleanFiles returns
        // nothing - so the condition is always false and 'cifs' is never recorded as done on this
        // path. The dead branch is dropped here; the call and its effect are unchanged.
        if (ctx.errors.cifs) {
            // Nothing is deleted on the target after a failed run, as for the local backups (#1498)
            ctx.log.warn('Old backups on the NAS were not deleted because of errors in this run');
        } else {
            cleanFiles(dir, options, ctx.types, options.deleteBackupAfter as number, ctx);
        }
    } else if (!ctx.errors.cifs) {
        ctx.done.push('cifs');
    }
}

export const ignoreErrors = true;
