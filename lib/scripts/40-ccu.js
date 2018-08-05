'use strict';

const request = require('request');
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    // Login
    request.post({
        url: `http://${options.host}/api/homematic.cgi`,
        body: `{"method":"Session.login","params":{"username":"${options.user}","password":"${options.pass}"}}`
        },
        (err, response, body) => {
            if (err) {
                return callback(err);
            }

            try {
                body = JSON.parse(body);
            } catch (e) {
                return callback('Cannot parse answer: ' + e);
            }
            if (body.error) {
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
                        callback(err);
                    }

                    const fileName = path.join(options.backupDir , `homematic${options.nameSuffix ? '_' + options.nameSuffix : ''}_${getDate()}_${version}_backupiobroker.tar.gz`);

                    options.context.fileNames = options.context.fileNames || [];
                    options.context.fileNames.push(fileName);

                    try {
                        fs.writeFileSync(fileName, body);
                    } catch (e) {
                        log.error('Cannot write file: ' + e);
                    }

                    // Logout
                    request.post({
                            url: `http://${options.host}/api/homematic.cgi`,
                            body: `{"method":"Session.logout","params":{"_session_id_":"${sid}"}}`
                        },
                        (err, response, body) => {
                            if (err) {
                                return callback(err);
                            }

                            try {
                                body = JSON.parse(body);
                            } catch (e) {
                                return callback('Cannot parse answer: ' + e);
                            }
                            if (body.error) {
                                return callback(body.error.message || JSON.stringify(body.error));
                            }
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