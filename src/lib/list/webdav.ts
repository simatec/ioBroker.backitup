import { createWriteStream } from 'node:fs';
import { Agent } from 'node:https';
// webdav ships as ESM only; this module stays CommonJS, so the types have to be pulled in with an
// explicit resolution mode and the value import below has to remain a dynamic `import()`.
import type { FileStat, WebDAVClient } from 'webdav' with { 'resolution-mode': 'import' };

import type { BackItUpConfigStorageWebDav } from '../types';
import type {
    BackItUpGetFileProps,
    BackItUpListProps,
    BackItUpStorageEngineResult,
    BackItUpStorageEngineResultFile,
} from './types';
import { listedBackupType } from '../tools';

/**
 * The engines are handed either the storage node itself or the enclosing creator node, which
 * carries the storage under its own key - hence the two-step lookup on every setting.
 */
type WebDavOptions = Partial<BackItUpConfigStorageWebDav> & {
    webdav?: Partial<BackItUpConfigStorageWebDav>;
};

interface WebDavSettings {
    username: string;
    pass: string;
    url: string;
    dir: string;
    dirMinimal: string;
    ownDir: boolean;
    signedCertificates: boolean;
}

function settings(options: WebDavOptions): WebDavSettings {
    return {
        username:
            options.username !== undefined
                ? options.username
                : options.webdav && options.webdav.username !== undefined
                  ? options.webdav.username
                  : '',
        pass:
            options.pass !== undefined
                ? options.pass
                : options.webdav && options.webdav.pass !== undefined
                  ? options.webdav.pass
                  : '',
        url:
            options.url !== undefined
                ? options.url
                : options.webdav && options.webdav.url !== undefined
                  ? options.webdav.url
                  : '',
        dir:
            options.dir !== undefined
                ? (options.dir as string)
                : options.webdav && options.webdav.dir !== undefined
                  ? (options.webdav.dir as string)
                  : '/',
        dirMinimal:
            options.dirMinimal !== undefined
                ? options.dirMinimal
                : options.webdav && options.webdav.dirMinimal !== undefined
                  ? options.webdav.dirMinimal
                  : '/',
        ownDir:
            options.ownDir !== undefined
                ? options.ownDir
                : options.webdav && options.webdav.ownDir !== undefined
                  ? options.webdav.ownDir
                  : false,
        signedCertificates:
            options.signedCertificates !== undefined
                ? options.signedCertificates
                : options.webdav && options.webdav.signedCertificates !== undefined
                  ? options.webdav.signedCertificates
                  : true,
    };
}

/**
 * Applies the "own directory" switch and makes sure the path is absolute
 *
 * @param dir configured target directory
 * @param ownDir whether the minimal backup uses its own directory
 * @param dirMinimal directory used when `ownDir` is set
 */
function targetDir(dir: string, ownDir: boolean, dirMinimal: string): string {
    let result = (dir || '').replace(/\\/g, '/');

    if (ownDir === true) {
        result = (dirMinimal || '').replace(/\\/g, '/');
    }

    if (!result || result[0] !== '/') {
        result = `/${result || ''}`;
    }

    return result;
}

/**
 * Lists the backups stored on the WebDAV share.
 *
 * NOTE: when `createClient` failed, the callback version reported "nothing to file" and then
 * carried on without returning. Dereferencing the client that was never created threw a TypeError,
 * which reported a *second* time - and lib/list decremented its outstanding-request counter twice,
 * so the whole listing could finish early with incomplete data. A promise settles once, and the
 * early return below means that TypeError is never produced in the first place. The outcome kept
 * is the one that was reported first: nothing to file, with the reason already in the log.
 *
 * @param props run context, storage config, requested source and backup types
 */
export async function list(
    props: BackItUpListProps<WebDavOptions>,
): Promise<BackItUpStorageEngineResult | undefined> {
    const {
        context: { log },
        options,
        restoreSource,
        types,
    } = props;

    try {
        const cfg = settings(options);

        if (!cfg.username || !cfg.pass || !cfg.url || (restoreSource && restoreSource !== 'webdav')) {
            // Not configured, or another storage was asked for - nothing to file.
            return undefined;
        }

        // webdav is ESM only, so it has to be pulled in with a dynamic import
        const { createClient } = await import('webdav');
        const agent = new Agent({ rejectUnauthorized: Boolean(cfg.signedCertificates) });
        let client: WebDAVClient;
        try {
            client = createClient(cfg.url, {
                username: cfg.username,
                password: cfg.pass,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                httpsAgent: agent,
            });
        } catch (err) {
            log.error(`cannot conntect to WebDAV: ${err}`);
            return undefined;
        }

        const dir = targetDir(cfg.dir, cfg.ownDir, cfg.dirMinimal);

        let contents;
        try {
            contents = await client.getDirectoryContents(dir);
        } catch (err) {
            log.error(`cannot conntect to WebDAV: ${err}`);
            return undefined;
        }

        if (!contents) {
            return undefined;
        }

        const entries: BackItUpStorageEngineResultFile[] = contents
            .map(file => ({
                path: file.filename,
                name: file.filename.replace(/\\/g, '/').split('/').pop() as string,
                size: file.size,
            }))
            .filter(file => listedBackupType(file.name, types) !== null);

        const files: BackItUpStorageEngineResult = {};
        entries.forEach(file => {
            const type = listedBackupType(file.name, types) as string;
            files[type] = files[type] || [];
            files[type].push(file);
        });
        return files;
    } catch (err) {
        log.error(`WebDAV: ${err}`);
        return undefined;
    }
}

/**
 * Downloads one backup from the WebDAV share.
 *
 * Same repaired pattern as in `list`: a failing `createClient` reported success and then threw a
 * TypeError that reported again. The early return keeps the outcome that was reported first.
 *
 * @param props run context, storage config, the file to fetch and where to put it
 */
export async function getFile(props: BackItUpGetFileProps<WebDavOptions>): Promise<void> {
    const {
        context: { log },
        options,
        fileName,
        toStoreName,
    } = props;

    const cfg = settings(options);

    if (!cfg.username || !cfg.pass || !cfg.url) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Not configured';
    }

    // webdav is ESM only, so it has to be pulled in with a dynamic import
    const { createClient } = await import('webdav');
    // Note: unlike in `list` the flag is passed through without Boolean() - kept as it was.
    const agent = new Agent({ rejectUnauthorized: cfg.signedCertificates });
    // copy file to backupDir
    let client: WebDAVClient;
    try {
        client = createClient(cfg.url, {
            username: cfg.username,
            password: cfg.pass,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            httpsAgent: agent,
        });
    } catch (err) {
        log.error(`cannot conntect to WebDAV: ${err}`);
        return;
    }

    return new Promise<void>((resolve, reject) => {
        try {
            log.debug(`WebDAV: Download of "${fileName}" started`);

            // The promise takes over the single-fire guard the old `finish` helper provided.
            const finish = (err?: Error | string | null): void => (err ? reject(err) : resolve());

            const writeStream = createWriteStream(toStoreName);
            writeStream
                .on('error', err => {
                    log.error(`WebDAV: ${err}`);
                    finish(err);
                })
                .on('close', () => {
                    log.debug(`WebDAV: Download of "${fileName}" finish`);
                    finish();
                });
            client.createReadStream(fileName).pipe(writeStream);
        } catch (e) {
            log.debug(String(e));
            reject(e as Error);
        }
    });
}
