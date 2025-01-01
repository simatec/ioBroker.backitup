import { drive_v3 } from '@googleapis/drive';
import { OAuth2Client } from 'google-auth-library';
import type { Credentials } from 'google-auth-library/build/src/auth/credentials';
import { createWriteStream, type WriteStream } from 'node:fs';
import axios from 'axios';

const OAUTH_URL = 'https://googleauth.iobroker.in/googleDriveOAuth';

const NOT_FOUND = 'Not found';

class GoogleDrive {
    private readonly oAuth2Client: OAuth2Client;
    private readonly newToken: boolean;
    private drive: drive_v3.Drive | null = null;
    private log: ioBroker.Log;

    constructor(accessJson: string | Credentials, log?: ioBroker.Log, newToken?: boolean) {
        this.oAuth2Client = new OAuth2Client();
        this.newToken = !!newToken;
        this.log = log || console;
        let credentials: Credentials;
        if (typeof accessJson === 'string') {
            if (accessJson[0] === '{') {
                credentials = JSON.parse(accessJson);
            } else {
                credentials = JSON.parse(Buffer.from(accessJson, 'base64').toString('utf8'));
            }
        } else {
            credentials = accessJson;
        }
        if (credentials) {
            this.oAuth2Client.setCredentials(credentials);
        }
    }

    async #authorize(): Promise<OAuth2Client> {
        if (
            this.oAuth2Client.credentials.access_token &&
            (!this.oAuth2Client.credentials?.expiry_date || Date.now() > this.oAuth2Client.credentials?.expiry_date)
        ) {
            let url = OAUTH_URL;
            if (!this.newToken) {
                url = OAUTH_URL.replace('googleDriveOAuth', '');
            }

            const response = await axios.post(url, this.oAuth2Client.credentials, {
                headers: { 'content-type': 'application/json' },
            });

            if (response.data) {
                // BF: TODO - this token should be saved in the state variable and used by the next token request
                this.oAuth2Client.setCredentials(response.data);
                return this.oAuth2Client;
            }
            throw new Error('No token received');
        }

        return Promise.resolve(this.oAuth2Client);
    }

    async getAuthorizeUrl(): Promise<string> {
        const response = await axios(OAUTH_URL);
        if (response.data) {
            return response.data.authURL;
        }
        throw new Error('Cannot get authorize URL');
    }

    async #getDrive(): Promise<drive_v3.Drive> {
        if (!this.drive) {
            this.drive = new drive_v3.Drive({
                apiVersion: 'v3',
                auth: this.oAuth2Client,
            });
        }

        // update access_token
        try {
            await this.#authorize();
            return this.drive;
        } catch (err) {
            this.log.error('[GoogleDrive] Error Google Drive #getDrive');
            throw new Error(`Google Drive #getDrive ${err}`);
        }
    }

    #createFolder(
        parts: string | string[],
        folderId: string | undefined,
        callback: (err?: Error | null, folderId?: string) => void,
    ): void {
        if (typeof parts !== 'object') {
            parts = parts
                .replace(/\\/g, '/')
                .split('/')
                .filter(p => !!p);
        }

        if (!parts.length) {
            callback && callback(new Error(NOT_FOUND));
        } else {
            const dir = parts.shift() || '';
            this.#getFileOrFolderId([dir], folderId, (err, _folderId): void => {
                if (!_folderId) {
                    const fileMetadata: Record<string, any> = {
                        name: dir,
                        mimeType: 'application/vnd.google-apps.folder',
                    };

                    if (folderId) {
                        fileMetadata.parents = [folderId];
                    }

                    this.#getDrive()
                        .then(drive =>
                            drive.files.create(
                                {
                                    // @ts-expect-error fix it
                                    resource: fileMetadata,
                                    fields: 'id',
                                },
                                (err: Error | null, file: any): void => {
                                    if (err) {
                                        callback && callback(err);
                                    } else {
                                        const __folderId = file.data.id;
                                        if (!parts.length || !__folderId) {
                                            callback && callback(null, __folderId);
                                        } else {
                                            setTimeout(() => this.#createFolder(parts, __folderId, callback), 150);
                                        }
                                    }
                                },
                            ),
                        )
                        .catch(err => this.log.error(`[GoogleDrive] #getDrive: ${err}`));
                } else {
                    if (!parts.length || !_folderId) {
                        callback && callback(null, _folderId);
                    } else {
                        setTimeout(() => this.#createFolder(parts, _folderId, callback), 150);
                    }
                }
            });
        }
    }

    createFolder(path: string): Promise<string | undefined> {
        return new Promise((resolve, reject): void => {
            this.getFileOrFolderId(path)
                .then(id => {
                    if (id) {
                        resolve(id);
                    } else {
                        this.#createFolder(path, undefined, (err, folderId) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(folderId);
                            }
                        });
                    }
                })
                .catch(err => this.log.error(`[GoogleDrive] create folder: ${err}`));
        });
    }

    async writeFile(folderId: string, fileName: string, dataStream: ReadableStream): Promise<void> {
        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };
        const media = {
            mimeType: 'application/gzip',
            body: dataStream,
        };

        const drive: drive_v3.Drive = await this.#getDrive();
        return new Promise((resolve, reject) => {
            void drive.files.create(
                {
                    // @ts-expect-error fix it
                    resource: fileMetadata,
                    media,
                    fields: 'id',
                },
                (err: Error | null, file: any): void => {
                    if (err) {
                        // Handle error
                        reject(err);
                    } else {
                        resolve(file.data.id);
                    }
                },
            );
        });
    }

    /*
    deleteFile(folderOrFileId, fileName) {
        return new Promise((resolve, reject) => {
            if (folderOrFileId && !fileName) {
                this.#getDrive()
                    .then(drive => drive.files.delete({fileId: folderOrFileId}, err => {
                        if (err) {
                            // Handle error
                            reject(err);
                        } else {
                            resolve();
                        }
                    }));
            } else {
                this.#getFileOrFolderId(fileName, folderOrFileId)
                    .then(fileId => {
                        this.#getDrive()
                            .then(drive => drive.files.delete({fileId}, err => {
                                if (err) {
                                    // Handle error
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            }));
                    });
            }
        });
    }
    */

    async deleteFile(folderOrFileId: string, fileName: string): Promise<void> {
        try {
            const drive = await this.#getDrive();
            if (folderOrFileId && !fileName) {
                await drive.files.delete({ fileId: folderOrFileId });
            } else {
                const fileId = await this.getFileOrFolderId(fileName, folderOrFileId);
                // @ts-expect-error fix it!
                await drive.files.delete({ fileId });
            }
        } catch (err) {
            this.log.error(`[GoogleDrive] delete files: ${err}`);
        }
    }

    #getFileOrFolderId(
        parts: string | string[],
        folderId: string | undefined,
        callback: (err: null | Error, folderId?: string) => void,
    ): void {
        if (typeof parts === 'string') {
            parts = parts
                .replace(/\\/g, '/')
                .split('/')
                .filter(part => part);
        }
        if (!parts.length) {
            return callback && callback(new Error(NOT_FOUND));
        }

        const dir = parts.shift() || '';
        const q = folderId
            ? `"${folderId}" in parents and name="${dir}" and trashed=false`
            : `name="${dir}" and trashed=false`;
        try {
            this.#getDrive()
                .then(drive =>
                    drive.files.list(
                        {
                            q,
                            fields: 'files(id)',
                            spaces: 'drive',
                            pageToken: undefined,
                        },
                        (err: Error | null, res?: any): void => {
                            if (err) {
                                // Handle error
                                callback(err);
                            } else {
                                folderId = res.data.files[0] ? res.data.files[0].id : null;
                                if (!parts.length || !folderId) {
                                    callback && callback(!folderId ? new Error(NOT_FOUND) : null, folderId);
                                } else {
                                    setTimeout(() => this.#getFileOrFolderId(parts, folderId, callback), 150);
                                }
                            }
                        },
                    ),
                )
                .catch(err => this.log.error(`[GoogleDrive] getFileOrFolderId: ${err}`));
        } catch (err) {
            this.log.error(`[GoogleDrive] get File or FolderId: ${err}`);
        }
    }

    getFileOrFolderId(path: string, folderId?: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            this.#getFileOrFolderId(path, folderId, (err, folderId): void => {
                if (err && !err.toString().includes(NOT_FOUND)) {
                    reject(err);
                } else {
                    resolve(folderId || null);
                }
            });
        });
    }

    #listFilesInFolder(
        folderId: string,
        cb: (err: Error | null, files?: { name: string; size: number }[]) => void,
        pageToken?: string,
        _list?: { name: string; size: number }[],
    ): void {
        pageToken = pageToken || undefined;
        _list = _list || [];
        this.#getDrive()
            .then(drive =>
                drive.files.list(
                    {
                        q: `"${folderId}" in parents and trashed=false`,
                        fields: 'nextPageToken, files(name, id, modifiedTime, size)',
                        spaces: 'drive',
                        pageToken,
                    },
                    (err: Error | null, res: any): void => {
                        if (err) {
                            // Handle error
                            cb(err);
                        } else {
                            // @ts-expect-error TODO
                            res?.data.files?.forEach(file => _list.push(file));
                            if (res?.nextPageToken) {
                                const nextPageToken = res.nextPageToken;
                                setTimeout(() => this.#listFilesInFolder(folderId, cb, nextPageToken, _list), 150);
                            } else {
                                cb(null, _list);
                            }
                        }
                    },
                ),
            )
            .catch(err => this.log.error(`[GoogleDrive] #listFilesInFolder: ${err}`));
    }

    listFilesInFolder(folderId: string): Promise<{ name: string; size: number }[] | undefined> {
        return new Promise((resolve, reject) =>
            this.#listFilesInFolder(folderId, (err, list) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(list);
                }
            }),
        );
    }

    readFile(fileId: string, localFileName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            let dest: WriteStream;
            try {
                dest = createWriteStream(localFileName);
                dest.on('error', err => reject(err));
            } catch (e) {
                reject(new Error(e));
                return;
            }

            this.#getDrive()
                .then(drive =>
                    drive.files.get(
                        {
                            fileId,
                            alt: 'media',
                        },
                        { responseType: 'stream' },
                        (err: Error | null, res: any): void => {
                            if (err) {
                                this.log.error(`[GoogleDrive] by readFile: ${err}`);
                                reject(err);
                            } else {
                                res.data
                                    .on('end', () => resolve())
                                    .on('error', (err: any): void => reject(new Error(err)))
                                    .pipe(dest);
                            }
                        },
                    ),
                )
                .catch(e => {
                    reject(new Error(e));
                });
        });
    }
}

export default GoogleDrive;
