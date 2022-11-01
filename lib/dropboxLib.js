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
}

module.exports = dropbox;