'use strict';

const dropboxV2Api = require('dropbox-v2-api');

async function dropboxAuthenticate(adapter, code) {
    adapter.log.debug('refresh token started ...');

    const dropbox = dropboxV2Api.authenticate({
        client_id: client_id,
        client_secret: client_secret,
        token_access_type: 'offline'
    });

    dropbox.refreshToken(code, (err, result) => {
        if (!err) {
            adapter.log.debug(`access_token: ${result.access_token}`);
        } else if (err) {
            adapter.log.warn(`refreshToken error: ${err}`);
        }
    });
}

module.exports = {
    dropboxAuthenticate,
    ignoreErrors: true
};