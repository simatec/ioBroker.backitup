import axios, { type AxiosError } from 'axios';
import { statSync, createReadStream, type ReadStream } from 'node:fs';
import { join } from 'node:path';

const OAUTH_URL = 'https://dropboxauth.simateccloud.de/';

export type DBX = (
    options: {
        resource:
            | 'files/list_folder'
            | 'files/upload_session/start'
            | 'files/upload_session/finish'
            | 'files/upload_session/append_v2'
            | 'files/download';
        parameters: {
            path?: string;
            close?: boolean;
            cursor?: {
                session_id: string,
                offset: number,
            },
            commit?: {
                path: string,
                mode: 'add',
                autorename: boolean,
                mute: boolean,
            },
        };
        readStream?: ReadStream;
    },
    callback: (err: any, result?: any) => void,
) => void;

class Dropbox {
    static async getAuthorizeUrl(log: ioBroker.Log): Promise<string> {
        try {
            const response = await axios({
                method: 'get',
                url: OAUTH_URL,
                headers: {
                    'User-Agent': 'axios/1.6.5',
                },
                responseType: 'json',
            });

            return `${response.data.authURL}&client_id=${response.data.client_id}`;
        } catch (err) {
            log.error(`[Dropbox] error getAuthorizeUrl: ${err}`);
            throw new Error(
                `Cannot get auth URL: ${JSON.stringify((err as AxiosError).response?.data || (err as AxiosError).response?.status || err)}`,
            );
        }
    }

    static getCodeChallenge(log: ioBroker.Log, dropboxCodeChallenge?: string): string {
        if (dropboxCodeChallenge?.length === 48) {
            log.debug('[Dropbox] challenge already exists');
            return dropboxCodeChallenge;
        }

        let codeChallenge = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (let i = 0; i < 48; i++) {
            codeChallenge += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        return codeChallenge;
    }

    static async getRefreshToken(
        code: string,
        code_verifier: (code: number) => boolean,
        log: ioBroker.Log,
    ): Promise<string> {
        try {
            const response = await axios('https://api.dropbox.com/1/oauth2/token', {
                method: 'post',
                params: {
                    code: code,
                    grant_type: 'authorization_code',
                    code_verifier: code_verifier,
                    client_id: await this.getClientID(log),
                },
            });

            return response?.data?.refresh_token;
        } catch (err) {
            log.warn(`[Dropbox] getRefreshToken: ${err}`);
            throw new Error(
                `Cannot get refresh token: ${JSON.stringify(err.response?.data || err.response?.status || err)}`,
            );
        }
    }

    static async getClientID(log: ioBroker.Log): Promise<string> {
        try {
            const response = await axios({
                method: 'get',
                url: OAUTH_URL,
                headers: {
                    'User-Agent': 'axios/1.6.5',
                },
                responseType: 'json',
            });

            return response?.data?.client_id;
        } catch (err) {
            log.warn(`[Dropbox] getClientID: ${err}`);
            throw new Error(
                `Cannot get client ID: ${JSON.stringify(err.response?.data || err.response?.status || err)}`,
            );
        }
    }

    static async getToken(refreshToken: string, log: ioBroker.Log): Promise<string> {
        try {
            const response = await axios('https://api.dropbox.com/1/oauth2/token', {
                method: 'post',
                params: {
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                    client_id: await this.getClientID(log),
                },
            }).catch(err => log.warn(`getToken Dropbox: ${err}`));

            return response?.data?.access_token;
        } catch (err) {
            log.warn(`[Dropbox] getToken: ${err}`);
            throw new Error(
                `Cannot get client ID: ${JSON.stringify(err.response?.data || err.response?.status || err)}`,
            );
        }
    }

    static sessionStart(dbx: DBX, log: ioBroker.Log): Promise<string> {
        return new Promise((resolve, reject): void => {
            dbx(
                {
                    resource: 'files/upload_session/start',
                    parameters: {
                        close: false,
                    },
                },
                (err: Error | null, result: { session_id: string }): void => {
                    if (err) {
                        log.error(`[Dropbox] sessionStart error: ${JSON.stringify(err)}`);
                        reject(err);
                    } else if (result?.session_id) {
                        resolve(result.session_id);
                    } else {
                        reject(new Error('Empty session ID'));
                    }
                },
            );
        });
    }

    static async sessionUpload(dbx: DBX, fileName: string, dir: string, log: ioBroker.Log): Promise<void> {
        try {
            const chunkLength = 1000000;
            const fileSize = statSync(fileName).size;

            if (fileSize) {
                const onlyFileName = fileName.split('/').pop() || fileName;
                const dbxPth = join(dir, onlyFileName).replace(/\\/g, '/');

                const getNextChunkStream = (start: number, end: number): ReadStream =>
                    createReadStream(fileName, { start, end });

                const append = async (sessionId: string, start: number, end: number): Promise<void> => {
                    if (start === fileSize) {
                        log.debug(`[Dropbox] ${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                        return this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                    }

                    if (end > fileSize) {
                        end = fileSize - 1;
                        log.debug(
                            `[Dropbox] ${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`,
                        );
                        return this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, fileSize - 1).then(
                            () => {
                                log.debug(
                                    `[Dropbox] ${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`,
                                );
                                return this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                            },
                        );
                    }

                    log.debug(`[Dropbox] ${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                    return this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, end).then(() =>
                        append(sessionId, end + 1, end + chunkLength),
                    );
                };

                const sessionId = await this.sessionStart(dbx, log);
                if (sessionId) {
                    return append(sessionId, 0, chunkLength - 1);
                }
            } else {
                return Promise.reject(new Error('Error Session Upload'));
            }
        } catch (err) {
            return Promise.reject(new Error('Error Session Upload: ${JSON.stringify(err)}'));
        }
    }

    static sessionAppend(
        sessionId: string,
        dbx: DBX,
        getNextChunkStream: (start: number, end: number) => ReadStream,
        log: ioBroker.Log,
        start: number,
        end: number,
    ): Promise<void> {
        return new Promise((resolve, reject): void => {
            dbx(
                {
                    resource: 'files/upload_session/append_v2',
                    parameters: {
                        cursor: {
                            session_id: sessionId,
                            offset: start,
                        },
                        close: false,
                    },
                    readStream: getNextChunkStream(start, end),
                },
                err => {
                    if (err) {
                        log.error(`[Dropbox] sessionAppend error: ${JSON.stringify(err)}`);
                        reject(new Error(err));
                    } else {
                        resolve();
                    }
                },
            );
        });
    }

    static sessionFinish(
        sessionId: string,
        dbx: DBX,
        log: ioBroker.Log,
        dbxPth: string,
        fileSize: number,
    ): Promise<void> {
        return new Promise((resolve, reject): void => {
            dbx(
                {
                    resource: 'files/upload_session/finish',
                    parameters: {
                        cursor: {
                            session_id: sessionId,
                            offset: fileSize,
                        },
                        commit: {
                            path: dbxPth,
                            mode: 'add',
                            autorename: true,
                            mute: false,
                        },
                    },
                },
                err => {
                    if (err) {
                        log.error(`[Dropbox] sessionFinish error: ${JSON.stringify(err)}`);
                        reject(new Error(err));
                    } else {
                        resolve();
                    }
                },
            );
        });
    }
}

export default Dropbox;
