import { createReadStream, existsSync } from 'node:fs';

import GoogleDrive from '../googleDriveLib';
import type { BackItUpContext, BackItUpProps } from '../types';

interface GoogleDriveUploadOptions {
    accessJson?: string;
    newToken?: boolean | string;
    dir: string;
    deleteOldBackup?: boolean;
    advancedDelete?: boolean;
    deleteBackupAfter?: number;
    googledriveDeleteAfter?: number;
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
 * A failed write used to schedule the next file from its own `catch` while the `.then` behind it
 * scheduled the next file as well: the walk advanced twice, skipped a file and carried on as two
 * parallel walks that each reported when they reached the end. Awaiting each upload settles all of
 * that - no file is skipped and the step reports once.
 *
 * @param gDrive client instance
 * @param dir target directory
 * @param fileNames the files to send; this list is consumed
 * @param ctx run context, for the logger and the error store
 */
async function copyFiles(gDrive: GoogleDrive, dir: string, fileNames: string[], ctx: BackItUpContext): Promise<void> {
    while (fileNames.length) {
        let fileName = fileNames.shift() as string;
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop() as string;

        if (!existsSync(fileName)) {
            ctx.log.error(`Google Drive: File "${fileName}" not found`);
            ctx.errors.googledrive = ctx.errors.googledrive || `File "${fileName}" not found`;
            // The original waited 150ms before the next file here too; the API is rate limited.
            await new Promise(resolve => setTimeout(resolve, 150));
            continue;
        }

        try {
            const folderId = await gDrive.createFolder(dir, ctx.log);

            const readStream = createReadStream(fileName);
            readStream.on('error', err => {
                if (err) {
                    ctx.log.error(`Google Drive: ${err}`);
                }
            });

            ctx.log.debug(`Google Drive: Copy ${onlyFileName}...`);

            try {
                await gDrive.writeFile(folderId as string, onlyFileName, readStream, ctx.log);
            } catch (err) {
                // Recorded, so the run is reported as failed and the local backups are kept (#1498)
                ctx.errors.googledrive = ctx.errors.googledrive || (err as Error);
                ctx.log.error(`Google Drive writeFile failed: ${err}`);
            }
        } catch (err) {
            ctx.errors.googledrive = ctx.errors.googledrive || (err as Error);
            ctx.log.error(`Google Drive writeFile Error: ${err}`);
        }

        await new Promise(resolve => setTimeout(resolve, 150));
    }
}

/**
 * Deletes the given files, keeping going past any that fail.
 *
 * @param gDrive client instance
 * @param fileIds file ids to delete; this list is consumed
 * @param fileNames matching names, for the log; this list is consumed
 * @param ctx run context, for the logger
 */
async function deleteFiles(
    gDrive: GoogleDrive,
    fileIds: string[],
    fileNames: string[],
    ctx: BackItUpContext,
): Promise<void> {
    while (fileIds.length || fileNames.length) {
        const fileId = fileIds.shift() as string;
        const fileName = fileNames.shift();
        ctx.log.debug(`Google Drive: delete ${fileName}`);

        try {
            await gDrive.deleteFile(fileId);
        } catch (err) {
            if (err) {
                ctx.log.error(`Google Drive: ${err}`);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 150));
    }
}

/**
 * Drops everything but the newest `num` backups per backup type.
 *
 * @param gDrive client instance
 * @param options script options, for the multi-instance counts
 * @param dir directory to clean
 * @param names backup types of this run
 * @param num how many to keep per type
 * @param ctx run context, for the logger
 */
async function cleanFiles(
    gDrive: GoogleDrive,
    options: GoogleDriveUploadOptions,
    dir: string,
    names: string[],
    num: number,
    ctx: BackItUpContext,
): Promise<void> {
    if (!num) {
        return;
    }

    let result;
    try {
        const folderId = await gDrive.getFileOrFolderId(dir);
        result = await gDrive.listFilesInFolder(folderId as string);
    } catch (err) {
        ctx.log.error(`Google Drive: ${err}`);
        throw err;
    }

    if (!result || !result.length) {
        return;
    }

    const fileIds: string[] = [];
    const fileNames: string[] = [];
    names.forEach(name => {
        const subResult = result.filter(a => (a.name as string).startsWith(name));
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

        // sort files
        if (subResult.length > numDel) {
            // delete oldest files
            subResult.sort((a, b) => {
                const at = new Date(a.modifiedTime as string).getTime();
                const bt = new Date(b.modifiedTime as string).getTime();
                if (at > bt) {
                    return -1;
                }
                if (at < bt) {
                    return 1;
                }
                return 0;
            });

            for (let i = numDel; i < subResult.length; i++) {
                fileIds.push(subResult[i].id as string);
                fileNames.push(subResult[i].name as string);
            }
        }
    });

    await deleteFiles(gDrive, fileIds, fileNames, ctx);
}

/**
 * Sends this run's archives to Google Drive and prunes the old ones.
 *
 * @param props the run context and the googledrive slice of the config
 */
export async function run(props: BackItUpProps<GoogleDriveUploadOptions>): Promise<void> {
    const { context: ctx, options } = props;

    if (!options.accessJson || !ctx.fileNames.length) {
        return;
    }

    const fileNames: string[] = JSON.parse(JSON.stringify(ctx.fileNames));
    const gDrive = new GoogleDrive(options.accessJson, options.newToken);

    if (!gDrive) {
        // A plain string, as before: wrapping it in an Error would prefix the reported text.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'No or invalid access key';
    }

    let dir = (options.dir || '').replace(/\\/g, '/');

    if (!dir || dir[0] !== '/') {
        dir = `/${dir || ''}`;
    }

    await copyFiles(gDrive, dir, fileNames, ctx);

    if (options.deleteOldBackup === true) {
        const googledriveDeleteAfter =
            options.advancedDelete === false ? options.deleteBackupAfter : options.googledriveDeleteAfter;

        if (ctx.errors.googledrive) {
            // Nothing is deleted on the target after a failed run, as for the local backups (#1498)
            ctx.log.warn('Old backups on Google Drive were not deleted because of errors in this run');
        } else {
            try {
                await cleanFiles(gDrive, options, dir, ctx.types, googledriveDeleteAfter as number, ctx);
            } catch (cleanErr) {
                ctx.errors.googledrive = ctx.errors.googledrive || (cleanErr as Error);
                throw cleanErr;
            }
        }
    }

    if (!ctx.errors.googledrive) {
        ctx.done.push('googledrive');
    }
}

export const ignoreErrors = true;
