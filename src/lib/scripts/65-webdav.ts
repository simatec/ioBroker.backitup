import { existsSync, readFileSync } from 'node:fs';
import { Agent } from 'node:https';
import { join } from 'node:path';
// webdav ships as ESM only; this module stays CommonJS, so the types have to be pulled in with an
// explicit resolution mode and the value import below has to remain a dynamic `import()`.
import type { WebDAVClient } from 'webdav' with { 'resolution-mode': 'import' };

import type { BackItUpContext, BackItUpProps } from '../types';

interface WebDavUploadOptions {
    username?: string;
    pass?: string;
    url?: string;
    dir: string;
    signedCertificates?: boolean;
    deleteOldBackup?: boolean;
    advancedDelete?: boolean;
    deleteBackupAfter?: number;
    webdavDeleteAfter?: number;
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
 * A failed upload is recorded and logged but does not stop the remaining files.
 *
 * @param client connected webdav client
 * @param dir target directory
 * @param fileNames the files to send; this list is consumed
 * @param ctx run context, for the logger
 */
async function copyFiles(client: WebDAVClient, dir: string, fileNames: string[], ctx: BackItUpContext): Promise<void> {
    while (fileNames.length) {
        let fileName = fileNames.shift() as string;
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop() as string;

        if (!existsSync(fileName)) {
            ctx.log.error(`WebDAV: File "${fileName}" not found`);
            ctx.errors.webdav = ctx.errors.webdav || `File "${fileName}" not found`;
            continue;
        }

        try {
            const webdavFilename = join(dir, onlyFileName);

            ctx.log.debug(`WebDAV: Copy ${onlyFileName}...`);
            const fileContent: Buffer = readFileSync(fileName);

            // Upload File
            await client.putFileContents(webdavFilename, fileContent, {
                format: 'binary',
                'Content-Type': 'application/octet-stream',
                contentLength: fileContent.length,
            } as never);
        } catch (e) {
            // Recorded, so the run is reported as failed and the local backups are kept (#1498)
            ctx.errors.webdav = ctx.errors.webdav || (e as Error);
            ctx.log.error(`WebDAV: ${e}`);
        }
    }
}

/**
 * Deletes the given files, keeping going past any that fail.
 *
 * @param client connected webdav client
 * @param files paths to delete; this list is consumed
 * @param ctx run context, for the logger
 */
async function deleteFiles(client: WebDAVClient, files: string[], ctx: BackItUpContext): Promise<void> {
    while (files.length) {
        ctx.log.debug(`WebDAV: delete ${files[0]}`);
        const file = files.shift() as string;

        try {
            await client.deleteFile(file);
        } catch (err) {
            ctx.log.error(`WebDAV: ${err}`);
        }
    }
}

/**
 * Drops everything but the newest `num` backups per backup type.
 *
 * @param client connected webdav client
 * @param options script options, for the multi-instance counts
 * @param dir directory to clean
 * @param names backup types of this run
 * @param num how many to keep per type
 * @param ctx run context, for the logger
 */
async function cleanFiles(
    client: WebDAVClient,
    options: WebDavUploadOptions,
    dir: string,
    names: string[],
    num: number,
    ctx: BackItUpContext,
): Promise<void> {
    if (!num) {
        return;
    }

    const result = await client.getDirectoryContents(dir.replace(/^\/$/, ''));

    if (!result) {
        return;
    }

    const files: string[] = [];
    names.forEach(name => {
        const subResult = result.filter(a => a.basename.startsWith(name));
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
                const at = new Date(a.lastmod).getTime();
                const bt = new Date(b.lastmod).getTime();
                if (at > bt) {
                    return -1;
                }
                if (at < bt) {
                    return 1;
                }
                return 0;
            });

            for (let i = numDel; i < subResult.length; i++) {
                files.push(subResult[i].filename);
            }
        }
    });

    await deleteFiles(client, files, ctx);
}

/**
 * Sends this run's archives to a WebDAV server and prunes the old ones.
 *
 * The callback version reported up to three times on a broken connection: a failed `createClient`
 * reported success, the dereference of the missing client then threw into the next `try`, which
 * reported success again, and the third `try` finally reported the error. It reports once now, and
 * an unusable client ends the step instead of running into the follow-up failures.
 *
 * @param props the run context and the webdav slice of the config
 */
export async function run(props: BackItUpProps<WebDavUploadOptions>): Promise<void> {
    const { context: ctx, options } = props;

    if (!options.username || !options.pass || !options.url || !ctx.fileNames.length) {
        return;
    }

    const fileNames: string[] = JSON.parse(JSON.stringify(ctx.fileNames));
    ctx.log.debug('Start WebDAV Upload ...');

    let dir = (options.dir || '').replace(/\\/g, '/');

    if (!dir || dir[0] !== '/') {
        dir = `/${dir || ''}`;
    }

    const { createClient } = await import('webdav');
    const agent = new Agent({ rejectUnauthorized: Boolean(options.signedCertificates) });

    let client: WebDAVClient;

    try {
        client = createClient(options.url, {
            username: options.username,
            password: options.pass,
            maxBodyLength: Infinity,
            httpsAgent: agent,
        });
    } catch (err) {
        ctx.errors.webdav = err as Error;
        ctx.log.error(`cannot connect to WebDAV: ${err}`);
        throw err;
    }

    try {
        if ((await client.exists(dir)) === false) {
            await client.createDirectory(dir);
        }
    } catch (e) {
        // Recorded and carried on with, as before - the directory may well exist already, and the
        // error store keeps the step from being counted as done further down.
        ctx.log.warn(`cannot created the backup directory: ${e}`);
        ctx.errors.webdav = e as Error;
    }

    try {
        await client.getDirectoryContents(dir);
    } catch (err) {
        ctx.log.error(`cannot connect to WebDAV: ${err}`);
        ctx.errors.webdav = err as Error;
        throw err;
    }

    await copyFiles(client, dir, fileNames, ctx);

    if (options.deleteOldBackup === true) {
        const webdavDeleteAfter =
            options.advancedDelete === false ? options.deleteBackupAfter : options.webdavDeleteAfter;

        if (ctx.errors.webdav) {
            // Nothing is deleted on the target after a failed run, as for the local backups (#1498)
            ctx.log.warn('Old backups on WebDAV were not deleted because of errors in this run');
        } else {
            try {
                await cleanFiles(client, options, dir, ctx.types, webdavDeleteAfter as number, ctx);
            } catch (cleanErr) {
                ctx.errors.webdav = ctx.errors.webdav || (cleanErr as Error);
                throw cleanErr;
            }
        }
    }

    if (!ctx.errors.webdav) {
        ctx.done.push('webdav');
    }
}

export const ignoreErrors = true;
