/* V 1.0.0
 _____                   _         ___        _   _
|  __ \                 | |       / _ \      | | | |
| |  \/ ___   ___   __ _| | ___  / /_\ \_   _| |_| |__
| | __ / _ \ / _ \ / _` | |/ _ \ |  _  | | | | __| '_ \
| |_\ \ (_) | (_) | (_| | |  __/ | | | | |_| | |_| | | |
 \____/\___/ \___/ \__, |_|\___| \_| |_/\__,_|\__|_| |_|
                    __/ |
                   |___/


This file is used to hide client ID and client secret.
It does not store any tokens or user related information.
 */

const {OAuth2Client} = require('google-auth-library');

const CLIENT_ID = process.env.CLIENT_ID; // Google oAuth2 APP client ID
const CLIENT_SECRET = process.env.CLIENT_SECRET; // Google oAuth2 APP client secret
const REDIRECT_URL = ['urn:ietf:wg:oauth:2.0:oob'];
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

exports.handler = async (event) => {
    if (event.httpMethod === 'GET') {
        if (event.queryStringParameters && event.queryStringParameters.code) {
            try {
                const {tokens} = await oAuth2Client.getToken(event.queryStringParameters.code);

                return {
                    statusCode: 200,
                    body: JSON.stringify(tokens)
                };
            } catch (e) {
                console.error(JSON.stringify(e));
                return {
                    statusCode: 500,
                    body: JSON.stringify((e.response && e.response.data) || e)
                };
            }
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    authURL: oAuth2Client.generateAuthUrl({
                        access_type: 'offline',
                        scope: SCOPES.join(' ')
                    })
                })
            };
        }
    } else
    if (event.httpMethod === 'POST') {
        let accessJson;
        try {
            accessJson = JSON.parse(event.body);
        } catch (e) {
            return {
                statusCode: 501,
                body: JSON.stringify({error: 'Cannot parse JSON'}),
            };
        }

        oAuth2Client.setCredentials(accessJson);

        try {
            const result = await oAuth2Client.getAccessToken();
            console.log('TOken: ' + JSON.stringify(result));
            if (result.res) {
                return {
                    statusCode: 200,
                    body: JSON.stringify(result.res.data),
                };
            } else {
                accessJson.access_token = result.token;
                return {
                    statusCode: 200,
                    body: JSON.stringify(accessJson),
                };
            }
        } catch (e) {
            return {
                statusCode: 501,
                body: JSON.stringify({error: 'Cannot get access token: ' + e}),
            }
        }
    }

    return {
        statusCode: 501,
        body: JSON.stringify('Missing JSON'),
    };
};
