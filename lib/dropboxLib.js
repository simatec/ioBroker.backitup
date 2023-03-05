'use strict';

const axios = require('axios');

const OAUTH_URL = 'http://dropboxauth.simateccloud.de/';

class dropbox {
    getAuthorizeUrl(log) {
        return new Promise(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/0.21.1'
                    },
                    responseType: 'json'
                }).catch(err => log.warn('getAuthorizeUrl Dropbox: ' + err));

                if (urlRequest && urlRequest.data) {
                    const url = `${urlRequest.data.authURL}&client_id=${urlRequest.data.client_id}`;
                    resolve(url);
                } else {
                    reject();
                }
            } catch (e) {
                console.log('error getAuthorizeUrl Dropbox: ' + e);
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
                    console.log('error getCodeChallage Dropbox: ' + e);
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
                }).catch(err => log.warn('getRefreshToken Dropbox: ' + err));

                if (refreshToken && refreshToken.data && refreshToken.data.refresh_token) {
                    resolve(refreshToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                console.log('error getRefreshToken Dropbox: ' + e);
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
                        'User-Agent': 'axios/0.21.1'
                    },
                    responseType: 'json'
                }).catch(err => log.warn('getClientID Dropbox: ' + err));

                if (urlRequest && urlRequest.data && urlRequest.data.client_id) {
                    resolve(urlRequest.data.client_id)
                } else {
                    reject();
                }
            } catch (e) {
                console.log('error getClientID Dropbox: ' + e);
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
                }).catch(err => log.warn('getToken Dropbox: ' + err));

                if (accessToken && accessToken.data && accessToken.data.access_token) {
                    resolve(accessToken.data.access_token);
                } else {
                    reject();
                }
            } catch (e) {
                console.log('error getToken Dropbox: ' + e);
                reject();
            }
        });
    }

    getUpload(dropbox, fileName, dir, log) {
        return new Promise(async (resolve) => {
            const fs = require('fs');

            const chunkLength = 1000000;
            const fileSize = fs.statSync(fileName).size;
            const onlyFileName = fileName.split('/').pop();

            const getNextChunkStream = (start, end) => fs.createReadStream(fileName, { start, end });

            const append = (sessionId, start, end) => {
                if (start === fileSize) {
                    log.debug(`${Math.round((end / fileSize) * 100) }% uploaded from ${onlyFileName}`);
                    resolve();
                    return this.sessionFinish(sessionId, dropbox, log, dir, onlyFileName, fileSize);
                }

                if (end > fileSize) {
                    end = fileSize - 1;
                    log.debug(`${Math.round((start / fileSize) * 100) }% uploaded from ${onlyFileName}`);
                    return this.sessionAppend(sessionId, dropbox, getNextChunkStream, log, start, fileSize - 1, () => {
                        log.debug(`${Math.round((end / fileSize) * 100) }% uploaded from ${onlyFileName}`);
                        resolve();
                        return this.sessionFinish(sessionId, dropbox, log, dir, onlyFileName, fileSize);
                    })
                }
                log.debug(`${Math.round((start / fileSize) * 100) }% uploaded from ${onlyFileName}`);
                this.sessionAppend(sessionId, dropbox, getNextChunkStream, log, start, end, () => {
                    append(sessionId, end + 1, end + chunkLength)
                });
            }

            this.sessionStart(dropbox, log, (sessionId) => {
                append(sessionId, 0, chunkLength - 1)
            });
        });
    }

    sessionStart(dropbox, log, cb) {
        dropbox({
            resource: 'files/upload_session/start',
            parameters: {
                close: false
            },
        }, (err, result) => {
            if (err) {
                return log.error('sessionStart error: ' + JSON.stringify(err));
            }
            cb(result.session_id);
        });
    }

    sessionAppend(sessionId, dropbox, getNextChunkStream, log, start, end, cb) {
        dropbox({
            resource: 'files/upload_session/append_v2',
            parameters: {
                cursor: {
                    session_id: sessionId,
                    offset: start
                },
                close: false,
            },
            readStream: getNextChunkStream(start, end)
        }, (err) => {
            if (err) {
                log.error();('sessionAppend error: ' + JSON.stringify(err));
                return log.error('sessionAppend error: ' + err);
            }
            cb();
        });
    }

    sessionFinish(sessionId, dropbox, log, dir, onlyFileName, fileSize) {
        const path = require('path');

        dropbox({
            resource: 'files/upload_session/finish',
            parameters: {
                cursor: {
                    session_id: sessionId,
                    offset: fileSize
                },
                commit: {
                    path: path.join(dir, onlyFileName).replace(/\\/g, '/'),
                    mode: "add",
                    autorename: true,
                    mute: false
                }
            }
        }, (err) => {
            if (err) {
                return log.error('sessionFinish error: ' + JSON.stringify(err));
            }
        });
    }
}

module.exports = dropbox;