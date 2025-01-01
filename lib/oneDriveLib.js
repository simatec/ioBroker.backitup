"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const OAUTH_URL = 'https://onedriveauth.simateccloud.de/v2.0';
const redirect_uri = 'https://onedriveauth.simateccloud.de/v2.0/nativeclient';
const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
// Old Auth-URL's
//const url = 'https://login.live.com/oauth20_token.srf';
//const redirect_uri = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
//const auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
//const auth_url = 'https://login.live.com/oauth20_authorize.srf';
class OneDrive {
    static async getAuthorizeUrl(log) {
        try {
            const response = await (0, axios_1.default)({
                method: 'get',
                url: OAUTH_URL,
                headers: {
                    'User-Agent': 'axios/1.6.2',
                },
                responseType: 'json',
            });
            return `${response.data.authURL}&client_id=${response.data.client_id}`;
        }
        catch (err) {
            log.warn(`[OneDrive] Cannot get auth URL: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
            throw new Error(`Cannot get auth URL: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static async getClientID(log) {
        try {
            const response = await (0, axios_1.default)({
                method: 'get',
                url: OAUTH_URL,
                headers: {
                    'User-Agent': 'axios/1.6.2',
                },
                responseType: 'json',
            });
            return response.data.client_id;
        }
        catch (err) {
            log.warn(`[OneDrive] getClientID: ${err}`);
            throw new Error(`Cannot get client ID: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static async getRefreshToken(code, log) {
        try {
            const data = `redirect_uri=${redirect_uri}&code=${code}&grant_type=authorization_code&client_id=${await OneDrive.getClientID(log)}`;
            const response = await (0, axios_1.default)(url, {
                method: 'post',
                data: data,
            });
            return response.data.refresh_token;
        }
        catch (err) {
            log.warn(`[OneDrive] getRefreshToken: ${err}`);
            throw new Error(`Cannot get refresh token: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static async getToken(refreshToken, log) {
        try {
            const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await OneDrive.getClientID(log)}`;
            const response = await (0, axios_1.default)(url, {
                method: 'post',
                data: data,
            });
            return response.data.access_token;
        }
        catch (err) {
            log.warn(`[OneDrive] getToken: ${err}`);
            throw new Error(`Cannot get access token: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
    static async renewToken(refreshToken, log) {
        try {
            const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await OneDrive.getClientID(log)}`;
            const response = await (0, axios_1.default)(url, {
                method: 'post',
                data: data,
            });
            return response.data.refresh_token;
        }
        catch (err) {
            log.warn(`[OneDrive] renewToken: ${err}`);
            throw new Error(`Cannot renew token: ${JSON.stringify(err.response?.data || err.response?.status || err)}`);
        }
    }
}
exports.default = OneDrive;
//# sourceMappingURL=oneDriveLib.js.map