'use strict';

const axios = require('axios');

const OAUTH_URL = 'https://dropboxauth.simateccloud.de/';

class dropbox {
    getAuthorizeUrl(log) {
        return new Promise(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/1.6.5'
                    },
                    responseType: 'json'
                }).catch(err => log.warn(`getAuthorizeUrl Dropbox: ${err}`));

                if (urlRequest && urlRequest.data) {
                    const url = `${urlRequest.data.authURL}&client_id=${urlRequest.data.client_id}`;
                    resolve(url);
                } else {
                    reject();
                }
            } catch (e) {
                console.log(`error getAuthorizeUrl Dropbox: ${e}`);
                reject();
            }
        });
    }

    getCodeChallage(log, dropboxCodeChallenge) {
        return new Promise((resolve, reject) => {
            if (dropboxCodeChallenge && dropboxCodeChallenge.length == 48) {
                log.debug('Dropbox code verifier already exists');
                resolve(dropboxCodeChallenge);
            } else {
                try {
                    let codeChallenge = '';
                    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

                    for (var i = 0; i < 48; i++) {
                        codeChallenge += characters.charAt(Math.floor(Math.random() * characters.length));
                    }

                    if (codeChallenge) {
                        resolve(codeChallenge);
                    } else {
                        reject();
                    }
                } catch (e) {
                    console.log(`error getCodeChallage Dropbox: ${e}`);
                    reject();
                }
            }
        });
    }

    getRefreshToken(code, code_verifier, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const refreshToken = await axios('https://api.dropbox.com/1/oauth2/token', {
                    method: 'post',
                    params: {
                        code: code,
                        grant_type: 'authorization_code',
                        code_verifier: code_verifier,
                        client_id: await this.getClientID(log)
                    }
                }).catch(err => log.warn(`getRefreshToken Dropbox: ${err}`));

                if (refreshToken && refreshToken.data && refreshToken.data.refresh_token) {
                    resolve(refreshToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                console.log(`error getRefreshToken Dropbox: ${e}`);
                reject();
            }
        });
    }

    getClientID(log) {
        return new Promise(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/1.6.5'
                    },
                    responseType: 'json'
                }).catch(err => log.warn(`getClientID Dropbox: ${err}`));

                if (urlRequest && urlRequest.data && urlRequest.data.client_id) {
                    resolve(urlRequest.data.client_id)
                } else {
                    reject();
                }
            } catch (e) {
                console.log(`error getClientID Dropbox: ${e}`);
                reject();
            }
        });
    }

    getToken(refreshToken, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const accessToken = await axios('https://api.dropbox.com/1/oauth2/token', {
                    method: 'post',
                    params: {
                        refresh_token: refreshToken,
                        grant_type: 'refresh_token',
                        client_id: await this.getClientID(log)
                    }
                }).catch(err => log.warn(`getToken Dropbox: ${err}`));

                if (accessToken && accessToken.data && accessToken.data.access_token) {
                    resolve(accessToken.data.access_token);
                } else {
                    reject();
                }
            } catch (e) {
                console.log(`error getToken Dropbox: ${e}`);
                reject();
            }
        });
    }

    sessionUpload(dbx, fileName, dir, log) {
        return new Promise(async (resolve, reject) => {
            const fs = require('node:fs');
            const path = require('node:path');

            try {
                const chunkLength = 1000000;
                const fileSize = fs.statSync(fileName).size;

                if (fileSize) {
                    const onlyFileName = fileName.split('/').pop();
                    const dbxPth = path.join(dir, onlyFileName).replace(/\\/g, '/');

                    const getNextChunkStream = (start, end) => fs.createReadStream(fileName, { start, end });

                    const append = async (sessionId, start, end) => {
                        if (start === fileSize) {
                            log.debug(`${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                            resolve('done');
                            return await this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                        }

                        if (end > fileSize) {
                            end = fileSize - 1;
                            log.debug(`${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                            return await this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, fileSize - 1)
                                .then(async () => {
                                    log.debug(`${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                                    resolve('done');
                                    return await this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                                });
                        }

                        log.debug(`${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                        await this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, end)
                            .then(async () => {
                                append(sessionId, end + 1, end + chunkLength);
                            });
                    }

                    const sessionId = await this.sessionStart(dbx, log);
                    if (sessionId) {
                        append(sessionId, 0, chunkLength - 1);
                    }
                } else {
                    reject('Error Session Upload');
                }
            } catch (err) {
                reject(`Error Session Upload: ${JSON.stringify(err)}`);
            }
        });
    }

    sessionStart(dbx, log) {
        return new Promise(async (resolve, reject) => {
            dbx({
                resource: 'files/upload_session/start',
                parameters: {
                    close: false
                },
            }, async (err, result) => {
                if (err) {
                    log.error(`sessionStart error: ${JSON.stringify(err)}`);
                    reject(err);
                }
                if (result && result.session_id) {
                    resolve(result.session_id);
                } else {
                    reject();
                }
            });
        });
    }

    sessionAppend(sessionId, dbx, getNextChunkStream, log, start, end) {
        return new Promise(async (resolve, reject) => {
            dbx({
                resource: 'files/upload_session/append_v2',
                parameters: {
                    cursor: {
                        session_id: sessionId,
                        offset: start
                    },
                    close: false,
                },
                readStream: getNextChunkStream(start, end)
            }, async (err) => {
                if (err) {
                    log.error(); (`sessionAppend error: ${JSON.stringify(err)}`);
                    reject(err);
                }
                // @ts-ignore
                resolve();
            });
        });
    }

    sessionFinish(sessionId, dbx, log, dbxPth, fileSize) {
        return new Promise(async (resolve, reject) => {
            dbx({
                resource: 'files/upload_session/finish',
                parameters: {
                    cursor: {
                        session_id: sessionId,
                        offset: fileSize
                    },
                    commit: {
                        path: dbxPth,
                        mode: "add",
                        autorename: true,
                        mute: false
                    }
                }
            }, (err) => {
                if (err) {
                    log.error(`sessionFinish error: ${JSON.stringify(err)}`);
                    reject(err);
                }
            });
            // @ts-ignore
            resolve();
        });
    }
}

module.exports = dropbox;
