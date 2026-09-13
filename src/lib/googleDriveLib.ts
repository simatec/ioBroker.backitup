import type { BackItUpLogger } from './types';
import { drive_v3 } from '@googleapis/drive';
import { OAuth2Client, type Credentials } from 'google-auth-library';
import { createWriteStream, type WriteStream } from 'node:fs';
import axios from 'axios';
import type { Readable } from 'node:stream';

const OAUTH_URL = 'https://googleauth.iobroker.in/googleDriveOAuth';

const NOT_FOUND = 'Not found';

/** Alias kept local - `export =` below rules out any other export from this module */
type GoogleDriveFile = drive_v3.Schema$File;

// The error is either the NOT_FOUND sentinel or a GaxiosError coming out of googleapis.
type IdCallback = (error?: Error | string | null, folderId?: string | null) => void;
type ListCallback = (error?: Error | string | null, list?: GoogleDriveFile[]) => void;

/** Only the logging surface this class needs - `BackItUpLogger` satisfies it */
interface Logger {
    error: (message: string) => void;
}

export default class GoogleDrive {
    private readonly oAuth2Client: OAuth2Client;
    private readonly newToken: boolean | string | undefined;
    private drive: drive_v3.Drive | null;

    constructor(accessJson?: string | Record<string, unknown>, newToken?: boolean | string) {
        this.oAuth2Client = new OAuth2Client();
        this.newToken = newToken;

        // The token arrives either already parsed, as raw JSON, or base64 encoded.
        let credentials: Credentials | undefined;
        if (typeof accessJson === 'string') {
            credentials =
                accessJson[0] === '{'
                    ? JSON.parse(accessJson)
                    : JSON.parse(Buffer.from(accessJson, 'base64').toString('utf8'));
        } else {
            credentials = accessJson;
        }
        if (credentials) {
            this.oAuth2Client.setCredentials(credentials);
        }
        this.drive = null;
    }

    _authorize(): Promise<OAuth2Client | undefined> {
        if (
            this.oAuth2Client.credentials.access_token &&
            Date.now() > (this.oAuth2Client.credentials.expiry_date as number)
        ) {
            let url = OAUTH_URL;
            if (!this.newToken) {
                url = OAUTH_URL.replace('googleDriveOAuth', '');
            }

            return axios
                .post(url, this.oAuth2Client.credentials, { headers: { 'content-type': 'application/json' } })
                .then(response => {
                    if (response.data) {
                        // BF: TODO - this token should be saved in the state variable and used by the next token request
                        this.oAuth2Client.setCredentials(response.data);
                        return this.oAuth2Client;
                    }
                    return undefined;
                });
        }
        return Promise.resolve(this.oAuth2Client);
    }

    getAuthorizeUrl(): Promise<string> {
        return axios(OAUTH_URL).then(response => {
            if (response.data) {
                return response.data.authURL;
            }
            throw new Error('Cannot get authorize URL');
        });
    }

    /**
     * Resolves to `undefined` when authorization fails - callers then run into the rejection of
     * their own promise chain, which is how this behaved before.
     */
    _getDrive(): Promise<drive_v3.Drive | undefined> {
        // Typed as drive_v3.Options rather than inlined: the constructor takes the wider
        // GlobalOptions, which has no `version`, so an inline literal would trip excess-property
        // checking. The object handed over is the same one as before.
        const driveOptions: drive_v3.Options = {
            version: 'v3',
            // googleapis-common pins google-auth-library to 10.5.0 while this adapter depends on
            // ^11, so npm installs both and the two OAuth2Client declarations are nominally
            // incompatible (private `redirectUri`). The objects are interchangeable at runtime; the
            // cast keeps the client this class has always used instead of silently swapping in
            // `google.auth.OAuth2` from the nested copy.
            auth: this.oAuth2Client,
        };

        this.drive = this.drive || new drive_v3.Drive(driveOptions);

        // update access_token
        return this._authorize()
            .then(() => this.drive ?? undefined)
            .catch(() => {
                console.log('Error Google Drive _getDrive');
                return undefined;
            });
    }

    _createFolder(parts: string | string[], folderId: string | null, callback?: IdCallback): void {
        // `parts` is consumed with shift() and handed to the recursive call, so the array identity
        // has to survive - only a string input is turned into a fresh array.
        const remaining: string[] =
            typeof parts === 'string'
                ? parts
                      .replace(/\\/g, '/')
                      .split('/')
                      .filter(p => !!p)
                : parts;

        if (!remaining.length) {
            callback?.(NOT_FOUND);
            return;
        }

        const dir = remaining.shift() as string;
        this._getFileOrFolderId([dir], folderId, (_err, _folderId) => {
            if (!_folderId) {
                const fileMetadata: drive_v3.Schema$File = {
                    name: dir,
                    mimeType: 'application/vnd.google-apps.folder',
                };

                if (folderId) {
                    fileMetadata.parents = [folderId];
                }

                this._getDrive()
                    .then(drive =>
                        drive!.files.create(
                            {
                                requestBody: fileMetadata,
                                fields: 'id',
                            },
                            (err, file) => {
                                if (err) {
                                    callback?.(err);
                                } else {
                                    const __folderId = file?.data.id;
                                    if (!remaining.length || !__folderId) {
                                        callback?.(null, __folderId);
                                    } else {
                                        setTimeout(() => this._createFolder(remaining, __folderId, callback), 150);
                                    }
                                }
                            },
                        ),
                    )
                    .catch(err => {
                        console.log(`Error Google Drive _getDrive: ${err}`);
                        callback?.(err);
                    });
            } else if (!remaining.length || !_folderId) {
                callback?.(null, _folderId);
            } else {
                setTimeout(() => this._createFolder(remaining, _folderId, callback), 150);
            }
        });
    }

    createFolder(path: string, log: Logger): Promise<string | null | undefined> {
        return new Promise((resolve, reject) => {
            this.getFileOrFolderId(path)
                .then(id => {
                    if (id) {
                        resolve(id);
                    } else {
                        this._createFolder(path, null, (err, folderId) => {
                            if (err) {
                                log.error(`Error Google Drive create folder: ${String(err)}`);
                                reject(err);
                            } else {
                                resolve(folderId);
                            }
                        });
                    }
                })
                .catch(err => {
                    log.error(`Error Google Drive create folder: ${String(err)}`);
                    reject(err);
                });
        });
    }

    writeFile(
        folderId: string,
        fileName: string,
        dataStream: Readable,
        log: Logger,
    ): Promise<string | null | undefined> {
        const fileMetadata: drive_v3.Schema$File = {
            name: fileName,
            parents: [folderId],
        };
        const media = {
            mimeType: 'application/gzip',
            body: dataStream,
        };

        return new Promise((resolve, reject) => {
            this._getDrive()
                .then(drive =>
                    drive!.files.create(
                        {
                            requestBody: fileMetadata,
                            media,
                            fields: 'id',
                        },
                        (err, file) => {
                            if (err) {
                                log.error(`Error Google Drive write file: ${String(err)}`);
                                // Handle error
                                reject(err);
                            } else {
                                resolve(file?.data.id);
                            }
                        },
                    ),
                )
                .catch(err => {
                    log.error(`Error Google Drive write file: ${String(err)}`);
                    reject(err);
                });
        });
    }

    async deleteFile(folderOrFileId: string, fileName?: string): Promise<void> {
        try {
            const drive = await this._getDrive();
            if (folderOrFileId && !fileName) {
                await drive!.files.delete({ fileId: folderOrFileId });
            } else {
                const fileId = await this.getFileOrFolderId(fileName as string, folderOrFileId);
                await drive!.files.delete({ fileId: fileId as string });
            }
        } catch (e) {
            console.log(`error delete files on GoogleDrive: ${e}`);
        }
    }

    _getFileOrFolderId(parts: string | string[], folderId: string | null | undefined, callback?: IdCallback): void {
        const remaining: string[] =
            typeof parts === 'string'
                ? parts
                      .replace(/\\/g, '/')
                      .split('/')
                      .filter(part => part)
                : parts;

        if (!remaining.length) {
            callback?.(NOT_FOUND);
            return;
        }

        const dir = remaining.shift() as string;
        const q = folderId
            ? `"${folderId}" in parents and name="${dir}" and trashed=false`
            : `name="${dir}" and trashed=false`;
        try {
            this._getDrive()
                .then(drive =>
                    drive!.files.list(
                        {
                            q,
                            fields: 'files(id)',
                            spaces: 'drive',
                            pageToken: undefined,
                        },
                        (err, res) => {
                            if (err) {
                                // Handle error
                                callback?.(err);
                            } else {
                                const found = res?.data.files?.[0] ? res.data.files[0].id : null;
                                if (!remaining.length || !found) {
                                    callback?.(!found ? NOT_FOUND : null, found);
                                } else {
                                    setTimeout(() => this._getFileOrFolderId(remaining, found, callback), 150);
                                }
                            }
                        },
                    ),
                )
                .catch(() => console.log('Error Google Drive getFileOrFolderId'));
        } catch (e) {
            console.log(`error get File or FolderId on GoogleDrive: ${e}`);
        }
    }

    getFileOrFolderId(path: string, folderId?: string | null): Promise<string | null | undefined> {
        return new Promise((resolve, reject) => {
            this._getFileOrFolderId(path, folderId, (err, found) => {
                if (err && err !== NOT_FOUND) {
                    reject(err);
                } else {
                    resolve(found);
                }
            });
        });
    }

    _listFilesInFolder(
        folderId: string,
        cb: ListCallback,
        pageToken?: string | null,
        _list?: GoogleDriveFile[],
    ): void {
        const token = pageToken || undefined;
        const collected = _list || [];

        this._getDrive()
            .then(drive =>
                drive!.files.list(
                    {
                        q: `"${folderId}" in parents and trashed=false`,
                        fields: 'nextPageToken, files(name, id, modifiedTime, size)',
                        spaces: 'drive',
                        pageToken: token,
                    },
                    (err, res) => {
                        if (err) {
                            // Handle error
                            cb(err);
                        } else {
                            res?.data.files?.forEach(file => collected.push(file));
                            // Note: the paging cursor is read off the response object rather than
                            // off `res.data`, exactly as before.
                            const next = (res as unknown as { nextPageToken?: string })?.nextPageToken;
                            if (next) {
                                setTimeout(() => this._listFilesInFolder(folderId, cb, next, collected), 150);
                            } else {
                                cb(null, collected);
                            }
                        }
                    },
                ),
            )
            .catch(() => console.log('Error Google Drive _listFilesInFolder'));
    }

    listFilesInFolder(folderId: string): Promise<GoogleDriveFile[]> {
        return new Promise((resolve, reject) =>
            this._listFilesInFolder(folderId, (err, list) => (err ? reject(err) : resolve(list as GoogleDriveFile[]))),
        );
    }

    readFile(fileId: string, localFileName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            let dest: WriteStream;
            try {
                dest = createWriteStream(localFileName);
                dest.on('error', err => reject(err));
            } catch (e) {
                reject(e);
                return;
            }

            this._getDrive()
                .then(drive =>
                    drive!.files.get(
                        {
                            fileId,
                            alt: 'media',
                        },
                        { responseType: 'stream' },
                        (err, res) => {
                            if (err) {
                                console.error(err);
                                reject(err);
                                return;
                            }
                            (res?.data as unknown as Readable)
                                .on('end', () => resolve())
                                .on('error', (e: Error) => reject(e))
                                .pipe(dest);
                        },
                    ),
                )
                .catch(e => reject(e));
        });
    }
}
