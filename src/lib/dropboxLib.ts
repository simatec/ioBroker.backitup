import { Dropbox, DropboxFileUploader, downloadFile, fileUpload, type files } from 'dropbox';

import type { BackItUpLogger } from './types';

/**
 * Creates a client for one run. The token comes from the ioBroker OAuth server (or is a custom
 * one), the SDK does not refresh it itself.
 *
 * @param accessToken Dropbox access token
 */
export function createClient(accessToken: string): Dropbox {
    return new Dropbox({ accessToken });
}

/**
 * Turns whatever the SDK threw into a readable line.
 * API errors carry the parsed answer of Dropbox in `error`, e.g. `{ error_summary: 'path/not_found/..' }`.
 *
 * @param e the caught value
 */
export function dropboxErrorText(e: unknown): string {
    if (e && typeof e === 'object') {
        const body = (e as { error?: unknown }).error;
        if (body && typeof body === 'object' && 'error_summary' in body) {
            return String(body.error_summary);
        }
        if (typeof body === 'string' && body) {
            return body;
        }
        if (e instanceof Error) {
            return e.message;
        }
    }
    return String(e);
}

/**
 * Lists a folder completely. Dropbox answers in pages, so the cursor is followed until the end.
 *
 * @param dbx client
 * @param dir absolute directory, `/` for the root
 */
export async function listFolder(dbx: Dropbox, dir: string): Promise<files.ListFolderResult['entries']> {
    let page = (await dbx.filesListFolder({ path: dir.replace(/^\/$/, '') })).result;
    const entries = [...page.entries];
    while (page.has_more) {
        page = (await dbx.filesListFolderContinue({ cursor: page.cursor })).result;
        entries.push(...page.entries);
    }
    return entries;
}

/**
 * Uploads one local file. The SDK sends it in 8 MiB parts of an upload session, repeats a part
 * after a network error and only resolves once Dropbox has committed the file.
 *
 * @param dbx client
 * @param localFile file to send
 * @param remotePath full target path on Dropbox
 * @param log run logger, for the progress
 */
export async function uploadFile(
    dbx: Dropbox,
    localFile: string,
    remotePath: string,
    log: BackItUpLogger,
): Promise<files.FileMetadata> {
    const name = remotePath.split('/').pop();
    let reported = 0;
    const uploader = new DropboxFileUploader(dbx, {
        // a line every 10%, not one per part
        progress: ({ bytesCommitted, totalBytes }) => {
            const percent = totalBytes ? Math.floor((bytesCommitted / totalBytes) * 10) * 10 : 100;
            if (percent > reported && percent < 100) {
                reported = percent;
                log.debug(`Dropbox: ${percent}% of ${name} uploaded...`);
            }
        },
    });
    const { metadata } = await uploader.upload(await fileUpload(localFile), {
        path: remotePath,
        mode: { '.tag': 'add' },
        autorename: true,
        mute: false,
    });
    return metadata;
}

/**
 * Downloads one file. The SDK writes into `<localPath>.part` and renames it after checking size
 * and content hash, so a broken download never looks like a complete backup.
 *
 * @param dbx client
 * @param remotePath full path on Dropbox
 * @param localPath where to store it
 */
export async function downloadToFile(dbx: Dropbox, remotePath: string, localPath: string): Promise<void> {
    await downloadFile(dbx, remotePath, localPath);
}
