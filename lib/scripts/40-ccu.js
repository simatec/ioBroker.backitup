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
        let resolved = false;

        const safeResolve = (msg) => {
            if (!resolved) {
                resolved = true;
                resolve(msg);
            }
        };

        try {
            const sessionAxios = axios.create({
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
                options.context.errors.ccu = 'CCU: No session ID';
                return safeResolve(options.context.errors.ccu);
            }

            // Version
            const versionResponse = await sessionAxios.get(
                `${connectType}://${options.host}/api/backup/version.cgi`
            );

            const version =
                (versionResponse.data || '').split('\n')[0].split('=')[1] || 'Unknown';

            const fileName = path.join(
                options.backupDir,
                `homematic_${getDate()}${options.nameSuffix ? `_${options.nameSuffix}` : ''}_${version}_backupiobroker.tar.sbk`
            );

            options.context.fileNames.push(fileName);

            log.debug('Requesting backup from CCU');

            const protocolType = require(`node:${connectType}`);
            const writeStream = fs.createWriteStream(fileName);
            let backupError = null;

            const request = protocolType.get(
                `${connectType}://${options.host}/config/cp_security.cgi?sid=@${sid}@&action=create_backup`,
                { rejectUnauthorized: options.signedCertificates },
                res => {
                    if (res.statusCode !== 200) {
                        backupError = `CCU: HTTP ${res.statusCode}`;
                        res.resume();
                        writeStream.destroy();
                        return;
                    }

                    res.on('aborted', () => {
                        backupError = 'CCU: Download aborted';
                        writeStream.destroy();
                    });

                    res.pipe(writeStream);
                }
            );

            request.setTimeout(120000, () => {
                backupError = 'CCU: Backup request timeout';
                request.destroy();
                writeStream.destroy();
            });

            request.on('error', err => {
                backupError = `CCU: Request error: ${err.message}`;
                writeStream.destroy();
            });

            writeStream.on('error', err => {
                backupError = `CCU: Write error: ${err.message}`;
                safeResolve(backupError);
            });

            writeStream.on('close', async () => {
                try {
                    await sessionAxios.post(
                        `${connectType}://${options.host}/api/homematic.cgi`,
                        {
                            method: 'Session.logout',
                            params: { _session_id_: sid },
                        }
                    );
                } catch (e) {
                    // ignore logout errors
                }

                let stats;
                try {
                    stats = fs.existsSync(fileName) && fs.statSync(fileName);
                } catch (e) { /* empty */ }

                if (!backupError) {
                    if (!stats || stats.size < MIN_BACKUP_SIZE) {
                        backupError = `CCU: Backup invalid (${stats ? stats.size : 0} bytes)`;
                    }
                }

                if (backupError) {
                    options.context.errors.ccu = backupError;
                    return safeResolve(backupError);
                }

                safeResolve(
                    `CCU backup successful (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
                );
            });

        } catch (err) {
            options.context.errors.ccu = err.message || err;
            safeResolve(options.context.errors.ccu);
        }
    });
}



module.exports = {
    command,
    ignoreErrors: true
};
