import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Dropbox, files } from 'dropbox';

import { createClient, dropboxErrorText, listFolder, uploadFile } from '../dropboxLib';
import type { BackItUpContext, BackItUpProps } from '../types';

interface DropboxUploadOptions {
    accessToken?: string;
    dir: string;
    deleteOldBackup?: boolean;
    advancedDelete?: boolean;
    deleteBackupAfter?: number;
    dropboxDeleteAfter?: number;
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
 * An empty file used to match neither the single-shot nor the session branch, and the walk simply
 * stopped there without ever reporting - the whole backup run hung on it. It is skipped with a
 * warning now, and the files after it are still sent.
 *
 * Every file goes through an upload session of the SDK now, there is no size limit for a
 * single-shot upload anymore. The step waits until Dropbox has committed each file; the old
 * chunked upload reported success as soon as the last request had been sent.
 *
 * @param dbx authenticated dropbox client
 * @param dir target directory
 * @param fileNames the files to send; this list is consumed
 * @param ctx run context, for the logger and the error store
 */
async function copyFiles(dbx: Dropbox, dir: string, fileNames: string[], ctx: BackItUpContext): Promise<void> {
    while (fileNames.length) {
        const fileName = (fileNames.shift() as string).replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop() as string;

        if (!existsSync(fileName)) {
            ctx.log.error(`Dropbox: File "${fileName}" not found`);
            continue;
        }

        ctx.log.debug(`Dropbox: Copy ${onlyFileName}...`);

        if (!statSync(fileName).size) {
            ctx.log.warn(`Dropbox: File "${fileName}" is empty and was not sent`);
            continue;
        }

        try {
            await uploadFile(dbx, fileName, join(dir, onlyFileName).replace(/\\/g, '/'), ctx.log);
        } catch (e) {
            const text = dropboxErrorText(e);
            ctx.errors.dropbox = text;
            ctx.log.error(`Dropbox: upload of ${onlyFileName} failed: ${text}`);
        }
    }
}

/**
 * Deletes the given files, keeping going past any that fail.
 *
 * @param dbx authenticated dropbox client
 * @param paths paths to delete; this list is consumed
 * @param ctx run context, for the logger
 */
async function deleteFiles(dbx: Dropbox, paths: string[], ctx: BackItUpContext): Promise<void> {
    while (paths.length) {
        const path = paths.shift() as string;
        ctx.log.debug(`Dropbox: delete ${path}`);
        try {
            await dbx.filesDeleteV2({ path });
        } catch (e) {
            ctx.log.error(`Dropbox: ${dropboxErrorText(e)}`);
        }
    }
}

/**
 * Drops everything but the newest `num` backups per backup type.
 *
 * @param dbx authenticated dropbox client
 * @param options script options, for the multi-instance counts
 * @param dir directory to clean
 * @param names backup types of this run
 * @param num how many to keep per type
 * @param ctx run context, for the logger
 */
async function cleanFiles(
    dbx: Dropbox,
    options: DropboxUploadOptions,
    dir: string,
    names: string[],
    num: number,
    ctx: BackItUpContext,
): Promise<void> {
    if (!num) {
        return;
    }

    let entries: files.FileMetadataReference[];
    try {
        entries = (await listFolder(dbx, dir)).filter(
            (entry): entry is files.FileMetadataReference => entry['.tag'] === 'file',
        );
    } catch (e) {
        ctx.log.error(`Dropbox: ${dropboxErrorText(e)}`);
        return;
    }

    const paths: string[] = [];
    names.forEach(name => {
        const subResult = entries.filter(entry => entry.name.startsWith(name));
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
            // delete oldest files: newest first, everything after `numDel` goes
            subResult.sort((a, b) => new Date(b.client_modified).getTime() - new Date(a.client_modified).getTime());

            for (let i = numDel; i < subResult.length; i++) {
                paths.push(subResult[i].path_display as string);
            }
        }
    });

    await deleteFiles(dbx, paths, ctx);
}

/**
 * Sends this run's archives to Dropbox and prunes the old ones.
 *
 * @param props the run context and the dropbox slice of the config
 */
export async function run(props: BackItUpProps<DropboxUploadOptions>): Promise<void> {
    const { context: ctx, options } = props;

    // Token refresh
    const db_accessToken = options.accessToken || '';

    if (!db_accessToken || !ctx.fileNames.length) {
        return;
    }

    const fileNames: string[] = JSON.parse(JSON.stringify(ctx.fileNames));
    const dbx = createClient(db_accessToken);

    let dir = (options.dir || '').replace(/\\/g, '/');

    if (!dir || dir[0] !== '/') {
        dir = `/${dir || ''}`;
    }

    await copyFiles(dbx, dir, fileNames, ctx);

    if (options.deleteOldBackup === true) {
        const dropboxDeleteAfter =
            options.advancedDelete === false ? options.deleteBackupAfter : options.dropboxDeleteAfter;

        await cleanFiles(dbx, options, dir, ctx.types, dropboxDeleteAfter as number, ctx);
    }

    if (!ctx.errors.dropbox) {
        ctx.done.push('dropbox');
    }
}

export const ignoreErrors = true;
