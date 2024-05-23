'use strict';

const fs = require('node:fs');
const getDate = require('../tools').getDate;
const path = require('node:path');
const axios = require('axios');
const https = require('node:https');

async function command(options, log, callback) {
    if (options.ccuMulti) {
        for (let i = 0; i < options.ccuEvents.length; i++) {
            options.usehttps = options.ccuEvents[i].usehttps;
            options.host = options.ccuEvents[i].host;
            options.user = options.ccuEvents[i].user;
            options.pass = options.ccuEvents[i].pass;
            options.nameSuffix = options.ccuEvents[i].nameSuffix;
            options.signedCertificates = options.ccuEvents[i].signedCertificates

            log.debug(`CCU-Backup for ${options.nameSuffix} is started ...`);
            await startBackup(options, log, callback);
            log.debug(`CCU-Backup for ${options.nameSuffix} is finish`);
        }
        options.context.done.push('ccu');
        options.context.types.push('homematic');
        return callback && callback();
    } else if (!options.ccuMulti) {
        log.debug('CCU-Backup started ...');
        const ccuBackup = await startBackup(options, log);
        log.debug(ccuBackup);
        options.context.done.push('ccu');
        options.context.types.push('homematic');
        return callback && callback();
    }
}

async function startBackup(options, log) {
    return new Promise(async (resolve) => {
        const connectType = options.usehttps ? 'https' : 'http';

        // Login
        try {
            const sessionAxios = await axios.create({
                httpsAgent: new https.Agent({ rejectUnauthorized: options.signedCertificates === true || options.signedCertificates === 'true' })
            });

            const loginResponse = await sessionAxios.post(`${connectType}://${options.host}/api/homematic.cgi`, {
                method: 'Session.login',
                params: {
                    username: options.user,
                    password: options.pass,
                }
            });

            const sid = loginResponse.data.result;
            if (!sid) {
                resolve('No session ID found');
            }

            // Get version
            const versionResponse = await sessionAxios.get(`${connectType}://${options.host}/api/backup/version.cgi`);

            const version = (versionResponse.data || '').split('\n')[0].split('=')[1] || 'Unknown';
            log.debug(`CCU Version: ${version}`);

            // Get backup
            log.debug('Requesting backup from CCU');

            const fileName = path.join(options.backupDir, `homematic_${getDate()}${options.nameSuffix ? `_${options.nameSuffix}` : ''}_${version}_backupiobroker.tar.sbk`);

            options.context.fileNames.push(fileName);

            let createBackupError = null;

            const writeStream = fs.createWriteStream(fileName);
            writeStream.on('error', err => createBackupError = `CCU: Cannot write file: ${err}`);

            const protocolType = require(`node:${connectType}`);

            protocolType.get(`${connectType}://${options.host}/config/cp_security.cgi?sid=@${sid}@&action=create_backup`, { rejectUnauthorized: options.signedCertificates }, async res => {
                res.on('end', () => {
                    if (!res.complete) {
                        createBackupError = 'CCU: The connection was terminated while the message was still being sent';
                    }
                });

                res.pipe(writeStream);
            })
                .on('error', err => {
                    createBackupError = `CCU: Response Error: ${err}`;
                })
                .on('close', async () => {
                    // Logout
                    try {
                        await sessionAxios.post(`${connectType}://${options.host}/api/homematic.cgi`, {
                            method: 'Session.logout',
                            params: { _session_id_: sid },
                        });

                        log.debug('CCU Session logout successful')
                        resolve('CCU-Backup is finish');
                    } catch (logoutError) {
                        const errs = [];
                        createBackupError && errs.push(createBackupError);

                        if (logoutError) {
                            errs.push(logoutError);
                            options.context.errors.ccu = errs.join(', ');
                            resolve(options.context.errors.ccu);
                        }
                    }
                });
        } catch (err) {
            options.context.errors.ccu = err;
            resolve(err);
        }
    });
}

module.exports = {
    command,
    ignoreErrors: true
};
