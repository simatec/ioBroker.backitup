'use strict';

const axios = require('axios');

const OAUTH_URL = 'https://onedriveauth.simateccloud.de/';
//const url = 'https://login.live.com/oauth20_token.srf';
const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const redirect_uri = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
// const auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

class onedrive {
    getAuthorizeUrl(log) {
        return new Promise(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/1.6.2'
                    },
                    responseType: 'json'
                });

                if (urlRequest && urlRequest.data) {
                    const url = `${urlRequest.data.authURL}&client_id=${urlRequest.data.client_id}`;
                    resolve(url);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn('getAuthorizeUrl Onedrive: ' + e);
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
                        'User-Agent': 'axios/1.6.2'
                    },
                    responseType: 'json'
                });

                if (urlRequest && urlRequest.data && urlRequest.data.client_id) {
                    resolve(urlRequest.data.client_id)
                } else {
                    reject();
                }
            } catch (e) {
                log.warn('getClientID Onedrive: ' + e);
                reject();
            }
        });
    }

    getRefreshToken(code, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const data = `redirect_uri=${redirect_uri}&code=${code}&grant_type=authorization_code&client_id=${await this.getClientID(log)}`;

                const refreshToken = await axios(url, {
                    method: 'post',
                    data: data
                });

                if (refreshToken && refreshToken.data && refreshToken.data.refresh_token) {
                    resolve(refreshToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn('getRefreshToken Onedrive: ' + e);
                reject();
            }
        });
    }

    getToken(refreshToken, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await this.getClientID(log)}`;

                const accessToken = await axios(url, {
                    method: 'post',
                    data: data
                });

                if (accessToken && accessToken.data && accessToken.data.access_token) {
                    resolve(accessToken.data.access_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn('getToken Onedrive: ' + e);
                reject();
            }
        });
    }

    renewToken(refreshToken, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await this.getClientID(log)}`;

                const accessToken = await axios(url, {
                    method: 'post',
                    data: data
                });

                if (accessToken && accessToken.data && accessToken.data.refresh_token) {
                    resolve(accessToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn('refresh_token Onedrive: ' + e);
                reject();
            }
        });
    }
}

module.exports = onedrive;