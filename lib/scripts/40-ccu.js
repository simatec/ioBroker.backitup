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
        const MIN_BACKUP_SIZE = 256 * 1024; // 256 KB

        try {
            const sessionAxios = await axios.create({
                httpsAgent: new https.Agent({
                    rejectUnauthorized:
                        options.signedCertificates === true ||
                        options.signedCertificates === 'true'
                })
            });

            // Login
            const loginResponse = await sessionAxios.post(
                `${connectType}://${options.host}/api/homematic.cgi`,
                {
                    method: 'Session.login',
                    params: {
                        username: options.user,
                        password: options.pass,
                    }
                }
            );

            const sid = loginResponse.data.result;
            if (!sid) {
                options.context.errors.ccu = 'CCU: No session ID received';
                return resolve(options.context.errors.ccu);
            }

            // Version
            const versionResponse = await sessionAxios.get(
                `${connectType}://${options.host}/api/backup/version.cgi`
            );

            const version =
                (versionResponse.data || '').split('\n')[0].split('=')[1] || 'Unknown';

            log.debug(`CCU Version: ${version}`);

            // Backup-Dateiname
            const fileName = path.join(
                options.backupDir,
                `homematic_${getDate()}${options.nameSuffix ? `_${options.nameSuffix}` : ''}_${version}_backupiobroker.tar.sbk`
            );

            options.context.fileNames.push(fileName);

            let createBackupError = null;
            const protocolType = require(`node:${connectType}`);
            const writeStream = fs.createWriteStream(fileName);

            writeStream.on('error', err => {
                createBackupError = `CCU: Cannot write file: ${err.message}`;
            });

            log.debug('Requesting backup from CCU');

            protocolType.get(
                `${connectType}://${options.host}/config/cp_security.cgi?sid=@${sid}@&action=create_backup`,
                { rejectUnauthorized: options.signedCertificates === true || options.signedCertificates === 'true' },
                res => {
                    if (res.statusCode !== 200) {
                        createBackupError = `CCU: HTTP status ${res.statusCode}`;
                        res.resume();
                        return;
                    }

                    const contentType = res.headers['content-type'] || '';
                    if (!contentType.includes('application') && !contentType.includes('octet')) {
                        createBackupError = `CCU: Invalid content-type ${contentType}`;
                        res.resume();
                        return;
                    }

                    res.on('aborted', () => {
                        createBackupError = 'CCU: Backup download aborted';
                    });

                    res.pipe(writeStream);
                }
            ).on('error', err => {
                createBackupError = `CCU: Request error: ${err.message}`;
            });

            writeStream.on('finish', async () => {
                let stats;

                try {
                    stats = fs.statSync(fileName);
                } catch (e) {
                    createBackupError = `CCU: Backup file not found`;
                }

                if (!createBackupError) {
                    if (!stats.size || stats.size < MIN_BACKUP_SIZE) {
                        createBackupError = `CCU: Backup file too small (${stats.size} bytes)`;
                    }
                }

                // Logout
                try {
                    await sessionAxios.post(
                        `${connectType}://${options.host}/api/homematic.cgi`,
                        {
                            method: 'Session.logout',
                            params: { _session_id_: sid },
                        }
                    );

                    log.debug('CCU Session logout successful');

                    if (createBackupError) {
                        options.context.errors.ccu = createBackupError;
                        resolve(createBackupError);
                    } else {
                        resolve(
                            `CCU backup successful (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
                        );
                    }

                } catch (logoutError) {
                    const errs = [];
                    if (createBackupError) errs.push(createBackupError);
                    if (logoutError) errs.push(logoutError.message);
                    options.context.errors.ccu = errs.join(', ');
                    resolve(options.context.errors.ccu);
                }
            });

        } catch (err) {
            options.context.errors.ccu = err.message || err;
            resolve(options.context.errors.ccu);
        }
    });
}


module.exports = {
    command,
    ignoreErrors: true
};
