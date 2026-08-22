import { existsSync } from 'node:fs';
import Client from 'ftp';

import type { BackItUpContext, BackItUpProps } from '../types';

interface FtpUploadOptions {
    host: string;
    port?: number | string;
    user?: string;
    pass?: string;
    secure?: boolean;
    signedCertificates?: boolean;
    dir: string;
    deleteOldBackup?: boolean;
    advancedDelete?: boolean;
    deleteBackupAfter?: number;
    ftpDeleteAfter?: number;
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
 * A failed upload is recorded and logged but does not stop the remaining files, exactly as the
 * `setImmediate` recursion did.
 *
 * @param client connected ftp client
 * @param dir target directory on the server
 * @param fileNames the files to send; this list is consumed
 * @param ctx run context, for the logger and the error store
 */
async function uploadFiles(client: Client, dir: string, fileNames: string[], ctx: BackItUpContext): Promise<void> {
    while (fileNames.length) {
        let fileName = fileNames.shift() as string;
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        ctx.log.debug(`Send ${onlyFileName}`);
        if (existsSync(fileName)) {
            await new Promise<void>(resolve => {
                client.put(fileName, `${dir}/${onlyFileName}`, err => {
                    if (err) {
                        ctx.errors.ftp = err;
                        ctx.log.error(err);
                    }
                    resolve();
                });
            });
        } else {
            ctx.log.error(`File "${fileName}" not found`);
        }
    }
}

/**
 * Deletes the given files, keeping going past any that fail.
 *
 * @param client connected ftp client
 * @param files absolute paths on the server; this list is consumed
 * @param ctx run context, for the logger
 */
async function deleteFiles(client: Client, files: string[], ctx: BackItUpContext): Promise<void> {
    while (files.length) {
        ctx.log.debug(`delete ${files[0]}`);
        const file = files.shift() as string;
        try {
            await new Promise<void>(resolve => {
                client.delete(file, err => {
                    if (err) {
                        ctx.log.error(err);
                    }
                    resolve();
                });
            });
        } catch (e) {
            ctx.log.error(e);
        }
    }
}

/**
 * Drops everything but the newest `num` backups per backup type.
 *
 * @param client connected ftp client
 * @param options script options, for the multi-instance counts
 * @param dir directory to clean
 * @param names backup types of this run
 * @param num how many to keep per type
 * @param ctx run context, for the logger and the error store
 */
async function cleanFiles(
    client: Client,
    options: FtpUploadOptions,
    dir: string,
    names: string[],
    num: number,
    ctx: BackItUpContext,
): Promise<void> {
    if (!num) {
        return;
    }

    if (dir[dir.length - 1] !== '/') {
        dir += '/';
    }

    const result = await new Promise<Client.ListingElement[]>(resolve => {
        client.list(dir, (err, list) => {
            if (err) {
                ctx.errors.ftp = ctx.errors.ftp || err;
            }
            resolve(list);
        });
    });

    if (!names || !result || !result.length) {
        return;
    }

    const files: string[] = [];
    names.forEach(name => {
        if (name) {
            let subResult;

            try {
                subResult = result.filter(a => a.name.startsWith(name));
            } catch (e) {
                ctx.log.error(`FTP error: ${e}`);
            }
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

            if (subResult && subResult.length > numDel) {
                // delete oldest files
                subResult.sort((a, b) => {
                    const at = new Date(a.date).getTime();
                    const bt = new Date(b.date).getTime();
                    if (at > bt) {
                        return -1;
                    }
                    if (at < bt) {
                        return 1;
                    }
                    return 0;
                });

                for (let i = numDel; i < subResult.length; i++) {
                    files.push(dir + subResult[i].name);
                }
            }
        }
    });

    await deleteFiles(client, files, ctx);
}

/**
 * Sends this run's archives to an FTP server and prunes the old ones.
 *
 * @param props the run context and the ftp slice of the config
 */
export async function run(props: BackItUpProps<FtpUploadOptions>): Promise<void> {
    const { context: ctx, options } = props;

    if (!options.host || !ctx.fileNames || !ctx.fileNames.length) {
        return;
    }

    const client = new Client();
    const fileNames: string[] = JSON.parse(JSON.stringify(ctx.fileNames));

    // Note: this writes back onto the shared options object.
    if (!options.dir.startsWith('/')) {
        options.dir = `/${options.dir}`;
    }

    let dir = (options.dir || '').replace(/\\/g, '/');

    if (!dir || dir[0] !== '/') {
        dir = `/${dir || ''}`;
    }

    await new Promise<void>((resolve, reject) => {
        client.on('ready', () => {
            void (async (): Promise<void> => {
                ctx.log.debug('FTP connected.');
                await uploadFiles(client, dir, fileNames, ctx);

                if (options.deleteOldBackup === true) {
                    const ftpDeleteAfter =
                        options.advancedDelete === false ? options.deleteBackupAfter : options.ftpDeleteAfter;

                    try {
                        await cleanFiles(client, options, dir, ctx.types, ftpDeleteAfter as number, ctx);
                    } catch (err) {
                        // Only a synchronous failure of the listing call gets here, as before. Note
                        // that an upload error does not: the step is still counted as done then.
                        ctx.errors.ftp = ctx.errors.ftp || (err as Error);
                        client.end();
                        reject(err as Error);
                        return;
                    }
                    ctx.done.push('ftp');
                    client.end();
                    resolve();
                } else {
                    client.end();
                    if (!ctx.errors.ftp) {
                        ctx.done.push('ftp');
                    }
                    resolve();
                }
            })();
        });

        client.on('error', err => {
            ctx.errors.ftp = err;
            reject(err);
        });

        client.connect({
            host: options.host,
            port: (options.port as number) || 21,
            secure: !!options.secure || false,
            // `!!x || true` was always true, so "allow only signed certificates" had no effect.
            // Fixed: default true (strict) if unset, otherwise honor the setting.
            secureOptions: { rejectUnauthorized: options.signedCertificates !== false },
            user: options.user,
            password: options.pass,
        });
    });
}

export const ignoreErrors = true;
