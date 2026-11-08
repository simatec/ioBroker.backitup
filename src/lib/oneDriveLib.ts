import type { BackItUpLogger } from './types';
import axios from 'axios';
import { createReadStream, createWriteStream, statSync } from 'node:fs';
import got from '@esm2cjs/got';
import { basename } from 'node:path';
import { listedBackupType } from './tools';

const OAUTH_URL = 'https://onedriveauth.simateccloud.de/v2.0';
const redirect_uri = 'https://onedriveauth.simateccloud.de/v2.0/nativeclient';
const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// Old Auth-URL's
//const url = 'https://login.live.com/oauth20_token.srf';
//const redirect_uri = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
//const auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
//const auth_url = 'https://login.live.com/oauth20_authorize.srf';

/** The subset of a Microsoft Graph driveItem this adapter reads */
interface OneDriveItem {
    id: string;
    name: string;
    size: number;
    /** ISO timestamp; used by 55-onedrive to find the oldest backups */
    lastModifiedDateTime?: string;
    '@microsoft.graph.downloadUrl'?: string;
}

interface OneDriveChildren {
    value?: OneDriveItem[];
}

/** Backups grouped by backup type, as produced by `listBackups` */
type OneDriveBackups = Record<string, { path: string; name: string; size: number; id: string }[]>;

export default class onedrive {
    getAuthorizeUrl(log: BackItUpLogger): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/1.6.2',
                    },
                    responseType: 'json',
                });

                if (urlRequest && urlRequest.data) {
                    const authUrl = `${urlRequest.data.authURL}&client_id=${urlRequest.data.client_id}`;
                    resolve(authUrl);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getAuthorizeUrl Onedrive: ${e}`);
                reject();
            }
        });
    }

    getClientID(log: BackItUpLogger): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/1.6.2',
                    },
                    responseType: 'json',
                });

                if (urlRequest && urlRequest.data && urlRequest.data.client_id) {
                    resolve(urlRequest.data.client_id);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getClientID Onedrive: ${e}`);
                reject();
            }
        });
    }

    getRefreshToken(code: string, log: BackItUpLogger): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                const data = `redirect_uri=${redirect_uri}&code=${code}&grant_type=authorization_code&client_id=${await this.getClientID(log)}`;

                const refreshToken = await axios(url, {
                    method: 'post',
                    data,
                });

                if (refreshToken && refreshToken.data && refreshToken.data.refresh_token) {
                    resolve(refreshToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getRefreshToken Onedrive: ${e}`);
                reject();
            }
        });
    }

    getToken(refreshToken: string, log: BackItUpLogger): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await this.getClientID(log)}`;

                const accessToken = await axios(url, {
                    method: 'post',
                    data,
                });

                if (accessToken && accessToken.data && accessToken.data.access_token) {
                    resolve(accessToken.data.access_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getToken Onedrive: ${e}`);
                reject();
            }
        });
    }

    renewToken(refreshToken: string, log: BackItUpLogger): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await this.getClientID(log)}`;

                const accessToken = await axios(url, {
                    method: 'post',
                    data,
                });

                if (accessToken && accessToken.data && accessToken.data.refresh_token) {
                    resolve(accessToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`refresh_token Onedrive: ${e}`);
                reject();
            }
        });
    }

    async fileUpload({
        accessToken,
        parentPath,
        filePath,
        log,
        onProgress = (): void => {},
    }: {
        accessToken: string;
        parentPath?: string;
        filePath: string;
        log: BackItUpLogger;
        onProgress?: (uploaded: number) => void;
    }): Promise<OneDriveItem> {
        const fileSize = statSync(filePath).size;
        const fileName = basename(filePath);

        const sessionUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${parentPath ? `${parentPath}/` : ''}${fileName}:/createUploadSession`;

        log.debug(`Starting upload session for file: ${fileName}`);

        const sessionRes = await got.post(sessionUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            json: {
                item: {
                    '@microsoft.graph.conflictBehavior': 'replace',
                    name: fileName,
                },
            },
            responseType: 'json',
        });

        const uploadUrl = (sessionRes.body as { uploadUrl?: string }).uploadUrl;
        if (!uploadUrl) {
            throw new Error('Upload URL could not be created');
        }

        const chunkSize = 4 * 1024 * 1024; // 4MB
        const fileStream = createReadStream(filePath, { highWaterMark: chunkSize });

        let position = 0;
        let chunkIndex = 0;

        for await (const chunk of fileStream) {
            const start = position;
            const end = position + chunk.length - 1;
            const contentRange = `bytes ${start}-${end}/${fileSize}`;

            const formattedStart = start === 0 ? '0' : (start / (1024 * 1024)).toFixed(2);
            const formattedEnd = (end / (1024 * 1024)).toFixed(2);

            log.debug(`Uploading chunk ${chunkIndex + 1}: ${formattedStart}-${formattedEnd} MB`);

            const res = await got.put(uploadUrl, {
                headers: {
                    'Content-Length': chunk.length,
                    'Content-Range': contentRange,
                },
                body: chunk,
                responseType: 'json',
                throwHttpErrors: false,
            });

            const body = res.body as OneDriveItem | undefined;

            if (res.statusCode >= 200 && res.statusCode < 300 && body?.id) {
                onProgress(fileSize); // 100%
                log.debug(`Upload completed: ${body.name}`);
                return body;
            }

            if (res.statusCode === 202 || (res.statusCode >= 200 && res.statusCode < 300)) {
                chunkIndex++;
                onProgress(end + 1);
                const percent = Math.round(((end + 1) / fileSize) * 100);
                log.debug(`Chunk ${chunkIndex} uploaded: ${percent}%`);
            } else {
                log.error(`Error during chunk upload [${res.statusCode}]: ${JSON.stringify(res.body)}`);
                throw new Error(`Chunk upload failed with status ${res.statusCode}`);
            }

            position += chunk.length;
        }

        throw new Error('Upload did not complete properly');
    }

    async deleteFileById({ accessToken, itemId }: { accessToken: string; itemId: string }): Promise<void> {
        const itemUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
        await got.delete(itemUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
    }

    async getMetadata({
        accessToken,
        itemPath,
    }: {
        accessToken: string;
        itemPath: string;
    }): Promise<OneDriveItem | undefined> {
        const targetPath = itemPath === 'root' ? 'root' : `root:/${itemPath}`;
        const itemUrl = `https://graph.microsoft.com/v1.0/me/drive/${targetPath}`;

        const response = await got.get(itemUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'json',
        });

        return response.body as OneDriveItem | undefined;
    }

    async listChildren({
        accessToken,
        itemId,
    }: {
        accessToken: string;
        itemId: string;
    }): Promise<OneDriveChildren | undefined> {
        const childrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/children`;

        const response = await got.get(childrenUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'json',
        });

        return response.body as OneDriveChildren | undefined;
    }

    async listBackups({
        accessToken,
        dir,
        types,
        log,
    }: {
        accessToken: string;
        dir: string;
        types: string[];
        log: BackItUpLogger;
    }): Promise<OneDriveBackups | null> {
        try {
            // Normalize path
            let normalizedDir = (dir || '').replace(/\\/g, '/');
            if (!normalizedDir || normalizedDir === '/') {
                normalizedDir = 'root';
            } else if (normalizedDir.startsWith('/')) {
                normalizedDir = normalizedDir.slice(1);
            }

            const metadata = await this.getMetadata({ accessToken, itemPath: normalizedDir });
            if (!metadata?.id) {
                throw new Error('Could not retrieve metadata');
            }

            const childrenRes = await this.listChildren({ accessToken, itemId: metadata.id });
            const children = childrenRes?.value;
            if (!children) {
                return null;
            }

            // Filter and transform children
            const entries = children
                .map(file => ({
                    path: file.name,
                    name: file.name,
                    size: file.size,
                    id: file.id,
                }))
                .filter(file => listedBackupType(file.name, types) !== null);

            // Group by type
            const files: OneDriveBackups = {};
            for (const file of entries) {
                const type = listedBackupType(file.name, types) as string;
                if (!files[type]) {
                    files[type] = [];
                }
                files[type].push(file);
            }

            return files;
        } catch (error) {
            log.error(`listBackups error: ${(error as Error).message}`);
            throw error;
        }
    }

    async downloadFileByName({
        accessToken,
        dir,
        fileName,
        targetPath,
        log,
    }: {
        accessToken: string;
        dir: string;
        fileName: string;
        targetPath: string;
        log: BackItUpLogger;
    }): Promise<void> {
        try {
            // Normalize directory path
            let normalizedDir = (dir || '').replace(/\\/g, '/');
            if (!normalizedDir || normalizedDir === '/') {
                normalizedDir = 'root';
            } else if (normalizedDir.startsWith('/')) {
                normalizedDir = normalizedDir.slice(1);
            }

            // Get metadata of the directory to find its ID
            const metadata = await this.getMetadata({
                accessToken,
                itemPath: normalizedDir,
            });

            if (!metadata?.id) {
                throw new Error(`Could not retrieve metadata for path "${normalizedDir}"`);
            }

            // List all files inside the directory
            const childrenRes = await this.listChildren({
                accessToken,
                itemId: metadata.id,
            });

            const children = childrenRes?.value || [];
            const file = children.find(f => f.name === fileName);

            if (!file) {
                throw new Error(`File "${fileName}" not found in OneDrive`);
            }

            const downloadUrl = file['@microsoft.graph.downloadUrl'];
            if (!downloadUrl) {
                throw new Error(`Download URL missing for "${fileName}"`);
            }

            log.debug(`OneDrive: Download of "${fileName}" started`);

            // Stream download to local file
            await new Promise<void>((resolve, reject) => {
                const writeStream = createWriteStream(targetPath);
                writeStream.on('finish', () => {
                    log.debug(`OneDrive: Download of "${fileName}" finished`);
                    resolve();
                });
                writeStream.on('error', reject);

                got.stream(downloadUrl).on('error', reject).pipe(writeStream);
            });
        } catch (err) {
            log.error(`downloadFileByName error: ${(err as Error).message}`);
            throw err;
        }
    }

    async getFolderChildrenByPath({
        accessToken,
        dir,
    }: {
        accessToken: string;
        dir: string;
    }): Promise<OneDriveItem[]> {
        // Normalize path
        let itemPath = (dir || '').replace(/\\/g, '/');
        itemPath = !itemPath || itemPath === '/' ? 'root' : itemPath.startsWith('/') ? itemPath.slice(1) : itemPath;

        // Get metadata
        const metadata = await this.getMetadata({ accessToken, itemPath });
        if (!metadata?.id) {
            throw new Error(`Could not resolve metadata for path: ${dir}`);
        }

        // List children
        const children = await this.listChildren({ accessToken, itemId: metadata.id });
        return children?.value || [];
    }
}
