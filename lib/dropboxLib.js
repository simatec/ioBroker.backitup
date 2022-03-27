'use strict';

const axios = require('axios').default;

//const OAUTH_URL = 'http://dropboxauth.simateccloud.de/dropboxauth.json';
const OAUTH_URL = 'http://dropboxauth.simateccloud.de/';

class dropbox {
    getAuthorizeUrl() {
        return new Promise(async (resolve, reject) => {
            const urlRequest = await axios({
                method: 'get',
                url: OAUTH_URL,
                //timeout: 2000,
                headers: {
                    'User-Agent': 'axios/0.21.1'
                },
                responseType: 'json'
            });

            if (urlRequest && urlRequest.data) {
                const url = `${urlRequest.data.authURL}&client_id=${urlRequest.data.client_id}`;
                resolve(url);
            } else {
                reject();
            }
        });
    }

    getCodeChallage() {
        return new Promise((resolve, reject) => {
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
        });
    }

    getRefreshToken(code, code_verifier) {
        return new Promise(async (resolve, reject) => {
            const refreshToken = await axios('https://api.dropbox.com/1/oauth2/token', {
                method: 'post',
                params: {
                    code: code,
                    grant_type: 'authorization_code',
                    code_verifier: code_verifier,
                    client_id: await this.getClientID()
                }
            });

            if (refreshToken && refreshToken.data && refreshToken.data.refresh_token) {
                resolve(refreshToken.data.refresh_token);
            } else {
                reject();
            }
        });
    }

    getClientID() {
        return new Promise(async (resolve, reject) => {
            const urlRequest = await axios({
                method: 'get',
                url: OAUTH_URL,
                //timeout: 2000,
                headers: {
                    'User-Agent': 'axios/0.21.1'
                },
                responseType: 'json'
            });

            if (urlRequest && urlRequest.data && urlRequest.data.client_id) {
                resolve(urlRequest.data.client_id)
            } else {
                reject();
            }
        });
    }

    getToken(refreshToken) {
        return new Promise(async (resolve, reject) => {
            try {
                const accessToken = await axios('https://api.dropbox.com/1/oauth2/token', {
                    method: 'post',
                    params: {
                        refresh_token: refreshToken,
                        grant_type: 'refresh_token',
                        client_id: await this.getClientID()
                    }
                });

                if (accessToken && accessToken.data && accessToken.data.access_token) {
                    resolve(accessToken.data.access_token);
                } else {
                    reject();
                }
            } catch (e) {
                console.log('error getToken Dropbox: ' + e);
            }
        });
    }
}

module.exports = dropbox;