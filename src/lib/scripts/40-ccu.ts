import {
    closeSync,
    createWriteStream,
    existsSync,
    openSync,
    readSync,
    statSync,
    unlinkSync,
    type Stats,
} from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { join } from 'node:path';
import axios from 'axios';

import { getDate } from '../tools';
import type { BackItUpContext, BackItUpProps } from '../types';

/** `ccu`: a CCU3, RaspberryMatic, OpenCCU or piVCCU (WebUI login); `openccu-lite`: its backup API with a token */
type CcuSystem = 'ccu' | 'openccu-lite';

interface CcuEvent {
    system?: CcuSystem;
    token?: string;
    host: string;
    user: string;
    pass: string;
    nameSuffix: string;
    usehttps: boolean;
    signedCertificates: boolean;
}

interface CcuOptions {
    system?: CcuSystem;
    token?: string;
    host: string;
    user: string;
    pass: string;
    usehttps?: boolean;
    signedCertificates?: boolean;
    nameSuffix?: string;
    ccuMulti?: boolean;
    ccuEvents: CcuEvent[];
}

/**
 * Downloads a backup from every configured CCU.
 *
 * @param props the run context and the ccu slice of the config
 */
export async function run(props: BackItUpProps<CcuOptions>): Promise<void> {
    const { context: ctx, options } = props;

    if (options.ccuMulti) {
        // The per-event settings are written onto `options` itself, one CCU after another.
        for (let i = 0; i < options.ccuEvents.length; i++) {
            options.system = options.ccuEvents[i].system;
            options.token = options.ccuEvents[i].token;
            options.usehttps = options.ccuEvents[i].usehttps;
            options.host = options.ccuEvents[i].host;
            options.user = options.ccuEvents[i].user;
            options.pass = options.ccuEvents[i].pass;
            options.nameSuffix = options.ccuEvents[i].nameSuffix;
            options.signedCertificates = options.ccuEvents[i].signedCertificates;

            ctx.log.debug(`CCU-Backup for ${options.nameSuffix} is started ...`);
            // `startBackup` takes two parameters; the callback the original passed as a third was
            // silently dropped. Removed rather than wired up.
            await startBackup(ctx, options);
            ctx.log.debug(`CCU-Backup for ${options.nameSuffix} is finish`);
        }
        // Reported as done even when a CCU failed - kept as found.
        ctx.done.push('ccu');
        ctx.types.push('homematic');
    } else {
        ctx.log.debug('CCU-Backup started ...');
        const ccuBackup = await startBackup(ctx, options);
        ctx.log.debug(ccuBackup);
        ctx.done.push('ccu');
        ctx.types.push('homematic');
    }
}

/**
 * Logs into one CCU, downloads its backup and reports the outcome as a message.
 *
 * Always resolves - failures are recorded in `context.errors.ccu` and returned as text.
 *
 * @param ctx run context
 * @param options script options, already pointed at the CCU to back up
 */
async function startBackup(ctx: BackItUpContext, options: CcuOptions): Promise<string> {
    if (options.system === 'openccu-lite') {
        return startOpenccuLiteBackup(ctx, options);
    }
    return new Promise(resolve => {
        void (async (): Promise<void> => {
            const connectType = options.usehttps ? 'https' : 'http';
            const MIN_BACKUP_SIZE = 20 * 1024; // 20 KB
            let resolved = false;

            const safeResolve = (msg: string): void => {
                if (!resolved) {
                    resolved = true;
                    resolve(msg);
                }
            };

            try {
                const sessionAxios = axios.create({
                    httpsAgent: new https.Agent({
                        // Older instance configurations stored the flag as a string.
                        rejectUnauthorized:
                            options.signedCertificates === true ||
                            (options.signedCertificates as unknown) === 'true',
                    }),
                });

                // Login
                const loginResponse = await sessionAxios.post(
                    `${connectType}://${options.host}/api/homematic.cgi`,
                    {
                        method: 'Session.login',
                        params: {
                            username: options.user,
                            password: options.pass,
                        },
                    },
                );

                const sid = loginResponse.data.result;
                if (!sid) {
                    const message = 'CCU: No session ID';
                    ctx.errors.ccu = message;
                    safeResolve(message);
                    return;
                }

                // Version
                const versionResponse = await sessionAxios.get(
                    `${connectType}://${options.host}/api/backup/version.cgi`,
                );

                const version = (versionResponse.data || '').split('\n')[0].split('=')[1] || 'Unknown';

                const fileName = join(
                    ctx.backupDir,
                    `homematic_${getDate()}${options.nameSuffix ? `_${options.nameSuffix}` : ''}_${version}_backupiobroker.tar.sbk`,
                );

                ctx.fileNames.push(fileName);

                ctx.log.debug('Requesting backup from CCU');

                const protocolType = connectType === 'https' ? https : http;
                const writeStream = createWriteStream(fileName);
                let backupError: string | null = null;

                const request = protocolType.get(
                    `${connectType}://${options.host}/config/cp_security.cgi?sid=@${sid}@&action=create_backup`,
                    // Note: unlike the axios instance above this passes the flag straight through,
                    // so a string value would be truthy here. Kept as found.
                    { rejectUnauthorized: options.signedCertificates } as https.RequestOptions,
                    res => {
                        if (res.statusCode !== 200) {
                            backupError = `CCU: HTTP ${res.statusCode}`;
                            res.resume();
                            writeStream.destroy();
                            return;
                        }

                        res.on('aborted', () => {
                            backupError = 'CCU: Download aborted';
                            writeStream.destroy();
                        });

                        res.pipe(writeStream);
                    },
                );

                request.setTimeout(300000, () => {
                    backupError = 'CCU: Backup request timeout';
                    request.destroy();
                    writeStream.destroy();
                });

                request.on('error', err => {
                    backupError = `CCU: Request error: ${err.message}`;
                    writeStream.destroy();
                });

                writeStream.on('error', err => {
                    backupError = `CCU: Write error: ${err.message}`;
                    safeResolve(backupError);
                });

                writeStream.on('close', async () => {
                    try {
                        await sessionAxios.post(`${connectType}://${options.host}/api/homematic.cgi`, {
                            method: 'Session.logout',
                            params: { _session_id_: sid },
                        });
                    } catch {
                        // ignore logout errors
                    }

                    let stats: Stats | false | undefined;
                    try {
                        stats = existsSync(fileName) && statSync(fileName);
                    } catch {
                        /* empty */
                    }

                    if (!backupError) {
                        if (!stats || stats.size < MIN_BACKUP_SIZE) {
                            backupError = `CCU: Backup invalid (${stats ? stats.size : 0} bytes)`;
                        }
                    }

                    if (backupError) {
                        ctx.errors.ccu = backupError;
                        safeResolve(backupError);
                        return;
                    }

                    safeResolve(`CCU backup successful (${((stats as Stats).size / 1024 / 1024).toFixed(2)} MB)`);
                });
            } catch (err) {
                const message = (err as Error).message || String(err);
                ctx.errors.ccu = message;
                safeResolve(message);
            }
        })();
    });
}

/** how long openccu-lite may take to build the backup (a large /usr/local takes minutes) */
const LITE_PREPARE_TIMEOUT = 30 * 60 * 1000;
/** how often to ask whether the backup is ready */
const LITE_POLL_INTERVAL = 5000;
/** one API request; the download has its own idle timeout */
const LITE_REQUEST_TIMEOUT = 60 * 1000;
/** the download may stall this long */
const LITE_DOWNLOAD_IDLE_TIMEOUT = 5 * 60 * 1000;
/** answers to the job poll that may fail before the backup counts as failed (a network blip, a 5xx) */
const LITE_POLL_RETRIES = 5;

/** the outcome of the download: an HTTP status other than 200, an error, or the file */
interface LiteDownload {
    status?: number;
    error?: string;
    name?: string;
    size?: number;
}

interface LiteJob {
    id?: string;
    state?: string;
    error?: string;
    code?: string;
}

/**
 * The version in openccu-lite's file name `<hostname>-<version>-YYYY-MM-DD-HHMM.sbk[.age]`, which is
 * the name the CCU's createBackup.sh gives a backup.
 *
 * @param name the file name from Content-Disposition
 */
function liteBackupVersion(name: string): string {
    const m = name.match(/-(\d[\d.]*)-\d{4}-\d{2}-\d{2}-\d{4}\.sbk(?:\.age)?$/);
    return m ? m[1] : 'Unknown';
}

/**
 * The file name from a Content-Disposition header: a plain name ending in `.sbk` or `.sbk.age`, else ''.
 *
 * @param header the header's value
 */
function liteDispositionName(header: string | undefined): string {
    const m = (header || '').match(/filename="?([^";]*)"?/i);
    const name = m ? m[1].split('/').pop() || '' : '';
    return /^[A-Za-z0-9][A-Za-z0-9._-]*\.sbk(?:\.age)?$/.test(name) ? name : '';
}

/**
 * Tells whether a downloaded file starts like the backup it claims to be: an age file
 * (`age-encryption.org/v1`) for an encrypted backup, else a tar archive (`ustar` at offset 257).
 *
 * @param fileName the downloaded file
 * @param encrypted whether openccu-lite sent an encrypted backup (`.sbk.age`)
 */
function liteLooksValid(fileName: string, encrypted: boolean): boolean {
    const buf = Buffer.alloc(512);
    const fd = openSync(fileName, 'r');
    let read: number;
    try {
        read = readSync(fd, buf, 0, buf.length, 0);
    } finally {
        closeSync(fd);
    }
    if (encrypted) {
        return buf.subarray(0, Math.min(read, 21)).toString('latin1') === 'age-encryption.org/v1';
    }
    return read >= 262 && buf.subarray(257, 262).toString('latin1') === 'ustar';
}

/**
 * Backs up one openccu-lite system through its backup API: the system prepares the backup as a job
 * (`POST /api/system/v1/backup/prepare`), BackItUp polls it and downloads the finished file. A system
 * without the job API (before 1.0.0-beta.12) answers 404, then the backup is fetched in one request.
 * The token needs the `backup` scope. The file is what openccu-lite's web UI hands out: a CCU
 * compatible `.sbk`, or `.sbk.age` when backup encryption is switched on there.
 *
 * Always resolves - failures are recorded in `context.errors.ccu` and returned as text.
 *
 * @param ctx run context
 * @param options script options, already pointed at the system to back up
 */
async function startOpenccuLiteBackup(ctx: BackItUpContext, options: CcuOptions): Promise<string> {
    const host = (options.host || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
    const token = (options.token || '').trim();
    const base = `https://${host}/api/system/v1`;
    const rejectUnauthorized =
        options.signedCertificates === true || (options.signedCertificates as unknown) === 'true';
    const agent = new https.Agent({ rejectUnauthorized });
    const headers = { Authorization: `Bearer ${token}` };
    const api = axios.create({
        httpsAgent: agent,
        headers,
        timeout: LITE_REQUEST_TIMEOUT,
        validateStatus: () => true,
    });

    let jobId = '';
    let ownJob = false;
    let fileName = '';

    const fail = async (message: string): Promise<string> => {
        const text = `openccu-lite: ${message}`;
        if (jobId && ownJob) {
            // the system keeps a prepared backup for 30 minutes; one we give up on is cancelled at once
            try {
                await api.delete(`${base}/backup/prepare/${encodeURIComponent(jobId)}`, { timeout: 20000 });
            } catch {
                // ignore
            }
        }
        if (fileName) {
            try {
                unlinkSync(fileName);
            } catch {
                // ignore
            }
        }
        ctx.errors.ccu = text;
        return text;
    };
    const httpFail = (status: number): Promise<string> => {
        if (status === 401) {
            return fail('HTTP 401: the token is not accepted (wrong, expired or deleted)');
        }
        if (status === 403) {
            return fail('HTTP 403: the token lacks the "backup" scope, or is not allowed from this address');
        }
        return fail(`HTTP ${status} from the system`);
    };
    const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

    if (!host) {
        return fail('no host configured');
    }
    if (!token) {
        return fail('no API token configured');
    }

    const deadline = Date.now() + LITE_PREPARE_TIMEOUT;
    let prepared = true;

    try {
        // 1. the system builds the backup as a job of its own
        let res = await api.post(`${base}/backup/prepare`);
        while (res.status === 409) {
            // backup-busy: a cancelled backup is still finishing on the system
            if (Date.now() > deadline) {
                return fail('the system was still finishing a cancelled backup (HTTP 409)');
            }
            await sleep(LITE_POLL_INTERVAL);
            res = await api.post(`${base}/backup/prepare`);
        }
        if (res.status === 404 || res.status === 405) {
            prepared = false;
            ctx.log.debug('openccu-lite: no backup job API, downloading the backup directly');
        } else if (res.status !== 200 && res.status !== 202) {
            return httpFail(res.status);
        }

        if (prepared) {
            let job = (res.data || {}) as LiteJob;
            if (!job.id || !/^[0-9A-Za-z_-]+$/.test(job.id)) {
                return fail('the system answered the backup job without an id');
            }
            jobId = job.id;
            // 202: this run started the job, 200: it joined one that was running already
            ownJob = res.status === 202;
            ctx.log.debug(`openccu-lite: backup job ${jobId} ${ownJob ? 'started' : 'joined'}`);

            let errors = 0;
            for (;;) {
                if (job.state === 'ready') {
                    break;
                }
                if (job.state === 'failed') {
                    jobId = '';
                    if (job.error === 'expired') {
                        return fail('the prepared backup expired before its download');
                    }
                    if (job.code === 'no-space') {
                        return fail('the system has not enough free space for a backup');
                    }
                    return fail(`the system could not make the backup (${job.error || 'no reason given'})`);
                }
                if (job.state === 'downloaded') {
                    jobId = '';
                    return fail('the prepared backup was downloaded by someone else meanwhile');
                }
                if (job.state !== 'running') {
                    return fail(`the system answered the backup job with the state "${job.state}"`);
                }
                if (Date.now() > deadline) {
                    return fail(`the system had not finished the backup after ${LITE_PREPARE_TIMEOUT / 60000} minutes`);
                }
                await sleep(LITE_POLL_INTERVAL);

                let status = 0;
                try {
                    res = await api.get(`${base}/backup/prepare/${encodeURIComponent(jobId)}`);
                    status = res.status;
                } catch (err) {
                    ctx.log.debug(`openccu-lite: asking for the backup job failed: ${(err as Error).message}`);
                }
                if (status === 200) {
                    errors = 0;
                    job = (res.data || {}) as LiteJob;
                    continue;
                }
                if (status === 404) {
                    jobId = '';
                    return fail('the system no longer knows the backup job (restarted?)');
                }
                if (status === 401 || status === 403) {
                    return httpFail(status);
                }
                if (++errors >= LITE_POLL_RETRIES) {
                    return fail(
                        `asking for the backup job failed ${LITE_POLL_RETRIES} times (HTTP ${status || 'none'})`,
                    );
                }
            }
        }

        // 2. the download, which streams from the first byte for a prepared backup
        const url = prepared ? `${base}/backup?prepared=${encodeURIComponent(jobId)}` : `${base}/backup`;
        ctx.log.debug('openccu-lite: downloading the backup');

        const result = await new Promise<LiteDownload>(resolve => {
            let settled = false;
            const done = (r: LiteDownload): void => {
                if (!settled) {
                    settled = true;
                    resolve(r);
                }
            };
            const request = https.get(url, { agent, headers }, response => {
                if (response.statusCode !== 200) {
                    response.resume();
                    done({ status: response.statusCode });
                    return;
                }
                // handed out: nothing left to cancel on the system
                jobId = '';
                const name = liteDispositionName(response.headers['content-disposition']);
                if (!name) {
                    response.resume();
                    done({ error: 'the system named no backup file (Content-Disposition)' });
                    return;
                }
                const encrypted = name.endsWith('.age');
                fileName = join(
                    ctx.backupDir,
                    `homematic_${getDate()}${options.nameSuffix ? `_${options.nameSuffix}` : ''}_${liteBackupVersion(name)}_backupiobroker.tar.sbk${encrypted ? '.age' : ''}`,
                );
                const expected = Number(response.headers['content-length']) || 0;
                const writeStream = createWriteStream(fileName);
                let failed = '';
                response.on('aborted', () => {
                    failed = 'the download was aborted';
                    writeStream.destroy();
                });
                response.on('error', err => {
                    failed = failed || `the download failed: ${err.message}`;
                    writeStream.destroy();
                });
                writeStream.on('error', err => {
                    failed = failed || `write error: ${err.message}`;
                });
                writeStream.on('close', () => {
                    if (failed) {
                        done({ error: failed });
                        return;
                    }
                    let size = 0;
                    try {
                        size = statSync(fileName).size;
                    } catch {
                        // empty
                    }
                    if (expected && size !== expected) {
                        done({ error: `the download is incomplete: ${size} of ${expected} bytes` });
                    } else if (!size || !liteLooksValid(fileName, encrypted)) {
                        done({ error: `${name} is not a valid backup (${size} bytes)` });
                    } else {
                        done({ name, size });
                    }
                });
                response.pipe(writeStream);
            });
            // without the job API the system sends nothing until the backup is built
            const idle = prepared ? LITE_DOWNLOAD_IDLE_TIMEOUT : LITE_PREPARE_TIMEOUT;
            request.setTimeout(idle, () => {
                request.destroy(new Error(`no data for ${idle / 60000} minutes`));
            });
            request.on('error', err => done({ error: `the download failed: ${err.message}` }));
        });

        if (result.status) {
            if (result.status === 410) {
                jobId = '';
                return fail('HTTP 410: the prepared backup is gone (expired, cancelled or downloaded)');
            }
            return httpFail(result.status);
        }
        if (result.error) {
            return fail(result.error);
        }

        ctx.fileNames.push(fileName);
        const message = `openccu-lite backup successful: ${result.name} (${((result.size as number) / 1024 / 1024).toFixed(2)} MB)`;
        fileName = '';
        return message;
    } catch (err) {
        return fail((err as Error).message || String(err));
    }
}

export const ignoreErrors = true;
