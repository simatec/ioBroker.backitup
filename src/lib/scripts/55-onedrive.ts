import { existsSync, statSync } from 'node:fs';

import Onedrive from '../oneDriveLib';
import type { BackItUpContext, BackItUpProps } from '../types';

interface OneDriveUploadOptions {
    onedriveAccessJson: string;
    dir: string;
    deleteOldBackup?: boolean;
    advancedDelete?: boolean;
    deleteBackupAfter?: number;
    onedriveDeleteAfter?: number;
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
 * Uploads every file of this run, one after the other.
 *
 * A failed upload is recorded and logged but does not stop the remaining files, as before.
 *
 * @param od_accessToken current access token
 * @param onedrive client instance
 * @param dir target directory
 * @param fileNames the files to send; this list is consumed
 * @param ctx run context, for the logger and the error store
 */
async function copyFiles(
    od_accessToken: string,
    onedrive: Onedrive,
    dir: string,
    fileNames: string[],
    ctx: BackItUpContext,
): Promise<void> {
    while (fileNames.length) {
        let fileName = fileNames.shift() as string;
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        if (!existsSync(fileName)) {
            ctx.log.error(`Onedrive: File "${fileName}" not found`);
            ctx.errors.onedrive = ctx.errors.onedrive || `File "${fileName}" not found`;
            continue;
        }

        ctx.log.debug(`Onedrive: Copy ${onlyFileName}...`);

        try {
            const item = await onedrive.fileUpload({
                accessToken: od_accessToken,
                parentPath: dir,
                filePath: fileName,
                log: ctx.log,
                onProgress: bytes => {
                    ctx.log.debug(
                        `Progress: ${Math.round((bytes / statSync(fileName).size) * 100)}% uploaded from ${onlyFileName}`,
                    );
                },
            });
            ctx.log.debug(
                `${item && item.name ? item.name : fileName} with Id: ${item && item.id ? item.id : 'undefined'} saved on Onedrive`,
            );
        } catch (err) {
            if (err) {
                // JSON.stringify turns an Error into "{}", which is what the notification showed
                const text = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
                ctx.errors.onedrive = text;
                ctx.log.error(`upload Onedrive: ${text}`);
            }
        }
    }
}

/**
 * Deletes the given items, keeping going past any that fail.
 *
 * @param od_accessToken current access token
 * @param onedrive client instance
 * @param fileIds item ids to delete; this list is consumed
 * @param fileNames matching names, for the log; this list is consumed
 * @param ctx run context, for the logger
 */
async function deleteFiles(
    od_accessToken: string,
    onedrive: Onedrive,
    fileIds: string[],
    fileNames: string[],
    ctx: BackItUpContext,
): Promise<void> {
    while (fileIds.length || fileNames.length) {
        const fileId = fileIds.shift() as string;
        const fileName = fileNames.shift();

        ctx.log.debug(`Onedrive: delete ${fileName} with Id: ${fileId}`);

        try {
            await onedrive.deleteFileById({
                accessToken: od_accessToken,
                itemId: fileId,
            });
        } catch (error) {
            if (error) {
                ctx.log.error(`Onedrive: ${JSON.stringify(error)}`);
            }
        }
    }
}

/**
 * Drops everything but the newest `num` backups per backup type.
 *
 * @param od_accessToken current access token
 * @param options script options, for the multi-instance counts
 * @param dir directory to clean
 * @param names backup types of this run
 * @param num how many to keep per type
 * @param ctx run context, for the logger
 */
async function cleanFiles(
    od_accessToken: string,
    options: OneDriveUploadOptions,
    dir: string,
    names: string[],
    num: number,
    ctx: BackItUpContext,
): Promise<void> {
    if (!num) {
        return;
    }

    // A second client instance, as in the original.
    const onedrive = new Onedrive();

    let children;
    try {
        children = await onedrive.getFolderChildrenByPath({ accessToken: od_accessToken, dir });
    } catch (err) {
        ctx.log.error(`OneDrive cleanFiles error: ${(err as Error).message}`);
        throw err;
    }

    if (!children) {
        return;
    }

    const fileIds: string[] = [];
    const fileNames: string[] = [];

    names.forEach(name => {
        const subResult = children.filter(a => a.name.startsWith(name));
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
                const at = new Date(a.lastModifiedDateTime as string).getTime();
                const bt = new Date(b.lastModifiedDateTime as string).getTime();
                if (at > bt) {
                    return -1;
                }
                if (at < bt) {
                    return 1;
                }
                return 0;
            });

            for (let i = numDel; i < subResult.length; i++) {
                fileIds.push(subResult[i].id);
                fileNames.push(subResult[i].name);
            }
        }
    });

    await deleteFiles(od_accessToken, onedrive, fileIds, fileNames, ctx);
}

/**
 * Sends this run's archives to OneDrive and prunes the old ones.
 *
 * @param props the run context and the onedrive slice of the config
 */
export async function run(props: BackItUpProps<OneDriveUploadOptions>): Promise<void> {
    const { context: ctx, options } = props;

    // Token refresh
    const onedrive = new Onedrive();
    const od_accessToken = await onedrive.getToken(options.onedriveAccessJson, ctx.log).catch(err => {
        ctx.log.warn(`Onedrive Token: ${err} | Please refresh your Token!`);
        ctx.errors.onedrive = `Onedrive Token: ${err} | Please refresh your Token!`;
    });

    if (!od_accessToken || !ctx.fileNames.length) {
        return;
    }

    const fileNames: string[] = JSON.parse(JSON.stringify(ctx.fileNames));

    let dir = (options.dir || '').replace(/\\/g, '/');

    if (!dir) {
        dir = 'root';
    }
    if (dir.startsWith('/')) {
        dir = dir.substring(1);
    }

    await copyFiles(od_accessToken, onedrive, dir, fileNames, ctx);

    if (options.deleteOldBackup === true) {
        const onedriveDeleteAfter =
            options.advancedDelete === false ? options.deleteBackupAfter : options.onedriveDeleteAfter;

        if (ctx.errors.onedrive) {
            // Nothing is deleted on the target after a failed run, as for the local backups (#1498)
            ctx.log.warn('Old backups on OneDrive were not deleted because of errors in this run');
        } else {
            try {
                await cleanFiles(od_accessToken, options, dir, ctx.types, onedriveDeleteAfter as number, ctx);
            } catch (cleanErr) {
                ctx.errors.onedrive = ctx.errors.onedrive || (cleanErr as Error);
                throw cleanErr;
            }
        }
    }

    if (!ctx.errors.onedrive) {
        ctx.done.push('onedrive');
    }
}

export const ignoreErrors = true;
