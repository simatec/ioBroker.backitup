"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const OAUTH_URL = 'https://dropboxauth.simateccloud.de/';
class Dropbox {
    static async getAuthorizeUrl(log) {
        try {
            const response = await (0, axios_1.default)({
                method: 'get',
                url: OAUTH_URL,
                headers: {
                    'User-Agent': 'axios/1.6.5',
                },
                responseType: 'json',
            });
            return `${response.data.authURL}&client_id=${response.data.client_id}`;
        }
        catch (err) {
            log.error(`[Dropbox] error getAuthorizeUrl: ${err}`);
            throw new Error(`Cannot get auth URL: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static getCodeChallenge(log, dropboxCodeChallenge) {
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
    static async getRefreshToken(code, code_verifier, log) {
        try {
            const response = await (0, axios_1.default)('https://api.dropbox.com/1/oauth2/token', {
                method: 'post',
                params: {
                    code: code,
                    grant_type: 'authorization_code',
                    code_verifier: code_verifier,
                    client_id: await this.getClientID(log),
                },
            });
            return response?.data?.refresh_token;
        }
        catch (err) {
            log.warn(`[Dropbox] getRefreshToken: ${err}`);
            throw new Error(`Cannot get refresh token: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static async getClientID(log) {
        try {
            const response = await (0, axios_1.default)({
                method: 'get',
                url: OAUTH_URL,
                headers: {
                    'User-Agent': 'axios/1.6.5',
                },
                responseType: 'json',
            });
            return response?.data?.client_id;
        }
        catch (err) {
            log.warn(`[Dropbox] getClientID: ${err}`);
            throw new Error(`Cannot get client ID: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static async getToken(refreshToken, log) {
        try {
            const response = await (0, axios_1.default)('https://api.dropbox.com/1/oauth2/token', {
                method: 'post',
                params: {
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                    client_id: await this.getClientID(log),
                },
            }).catch(err => log.warn(`getToken Dropbox: ${err}`));
            return response?.data?.access_token;
        }
        catch (err) {
            log.warn(`[Dropbox] getToken: ${err}`);
            throw new Error(`Cannot get client ID: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static sessionStart(dbx, log) {
        return new Promise((resolve, reject) => {
            dbx({
                resource: 'files/upload_session/start',
                parameters: {
                    close: false,
                },
            }, (err, result) => {
                if (err) {
                    log.error(`[Dropbox] sessionStart error: ${JSON.stringify(err)}`);
                    reject(err);
                }
                else if (result?.session_id) {
                    resolve(result.session_id);
                }
                else {
                    reject(new Error('Empty session ID'));
                }
            });
        });
    }
    static async sessionUpload(dbx, fileName, dir, log) {
        try {
            const chunkLength = 1000000;
            const fileSize = (0, node_fs_1.statSync)(fileName).size;
            if (fileSize) {
                const onlyFileName = fileName.split('/').pop() || fileName;
                const dbxPth = (0, node_path_1.join)(dir, onlyFileName).replace(/\\/g, '/');
                const getNextChunkStream = (start, end) => (0, node_fs_1.createReadStream)(fileName, { start, end });
                const append = async (sessionId, start, end) => {
                    if (start === fileSize) {
                        log.debug(`[Dropbox] ${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                        return this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                    }
                    if (end > fileSize) {
                        end = fileSize - 1;
                        log.debug(`[Dropbox] ${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                        return this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, fileSize - 1).then(() => {
                            log.debug(`[Dropbox] ${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                            return this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                        });
                    }
                    log.debug(`[Dropbox] ${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                    return this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, end).then(() => append(sessionId, end + 1, end + chunkLength));
                };
                const sessionId = await this.sessionStart(dbx, log);
                if (sessionId) {
                    return append(sessionId, 0, chunkLength - 1);
                }
            }
            else {
                return Promise.reject(new Error('Error Session Upload'));
            }
        }
        catch (err) {
            return Promise.reject(new Error('Error Session Upload: ${JSON.stringify(err)}'));
        }
    }
    static sessionAppend(sessionId, dbx, getNextChunkStream, log, start, end) {
        return new Promise((resolve, reject) => {
            dbx({
                resource: 'files/upload_session/append_v2',
                parameters: {
                    cursor: {
                        session_id: sessionId,
                        offset: start,
                    },
                    close: false,
                },
                readStream: getNextChunkStream(start, end),
            }, err => {
                if (err) {
                    log.error(`[Dropbox] sessionAppend error: ${JSON.stringify(err)}`);
                    reject(new Error(err));
                }
                else {
                    resolve();
                }
            });
        });
    }
    static sessionFinish(sessionId, dbx, log, dbxPth, fileSize) {
        return new Promise((resolve, reject) => {
            dbx({
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
            }, err => {
                if (err) {
                    log.error(`[Dropbox] sessionFinish error: ${JSON.stringify(err)}`);
                    reject(new Error(err));
                }
                else {
                    resolve();
                }
            });
        });
    }
}
exports.default = Dropbox;
//# sourceMappingURL=dropboxLib.js.map