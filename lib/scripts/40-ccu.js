'use strict';

const request = require('request');
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    // Login
    request.post({
        url: `http://${options.host}/api/homematic.cgi`,
        body: JSON.stringify({
                method: 'Session.login',
                params:{
                    username: options.user,
                    password: options.pass
                }
            })
        },
    (err, response, body) => {
        if (err) {
            options.context.errors.ccu = err;
            return callback(err);
        }

        try {
            body = JSON.parse(body);
        } catch (e) {
            options.context.errors.ccu = 'Cannot parse answer: ' + e;
            return callback('Cannot parse answer: ' + e);
        }
        if (body.error) {
            options.context.errors.ccu = body.error.message || JSON.stringify(body.error);
            return callback(body.error.message || JSON.stringify(body.error));
        }
        const sid = body.result;
        if (!sid) {
            return callback('No session ID found');
        }

        // Get version
        request(`http://${options.host}/api/backup/version.cgi`, (err, response, body) => {
            const version = (body || '').split('\n')[0].split('=')[1] || 'Unknown';
            log.debug('CCU Version: ' + version);

            // Get backup
            log.debug('Requesting backup from CCU');
            request.get({
                url: `http://${options.host}/config/cp_security.cgi?sid=@${sid}@&action=create_backup`,
                encoding: null
            }, (err, response, body)=> {
                if (err) {
                    options.context.errors.ccu = err;
                    callback(err);
                }

                const fileName = path.join(options.backupDir , `homematic${options.nameSuffix ? '_' + options.nameSuffix : ''}_${version}_${getDate()}_backupiobroker.tar.sbk`);

                options.context.fileNames.push(fileName);

                try {
                    fs.writeFileSync(fileName, body);
                } catch (e) {
                    log.error('Cannot write file: ' + e);
                    options.context.errors.ccu = 'Cannot write file: ' + e;
                }

                // Logout
                request.post({
                        url: `http://${options.host}/api/homematic.cgi`,
                        body: JSON.stringify({method: 'Session.logout', params: {_session_id_: sid}})
                    },
                (err, response, body) => {
                    if (err) {
                        options.context.errors.ccu = err;
                        return callback(err);
                    }

                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        options.context.errors.ccu = 'Cannot parse answer: ' + e;
                        return callback('Cannot parse answer: ' + e);
                    }
                    if (body.error) {
                        options.context.errors.ccu = body.error.message || JSON.stringify(body.error);
                        return callback(body.error.message || JSON.stringify(body.error));
                    }
                    options.context.done.push('ccu');
                    options.context.types.push('homematic');
                    callback();
                });
            });
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};