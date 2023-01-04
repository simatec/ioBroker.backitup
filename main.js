/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const adapterName = require('./package.json').name.split('.').pop();

const tools = require('./lib/tools');

let adapter;

let timerOutput;
let timerOutput2;
let timerUmount1;
let timerUmount2;
let timerMain;
let slaveTimeOut;
let waitToSlaveBackup;
let stopServer;
let dlServer;

let systemLang = 'de';              // system language
const backupConfig = {};
const backupTimeSchedules = [];     // Array for Backup Times
let taskRunning = false;

const bashDir = path.join(utils.getAbsoluteDefaultDataDir(), adapterName).replace(/\\/g, '/');

/**
 * Decrypt the password/value with given key
 * @param {string} key - Secret key
 * @param {string} value - value to decript
 * @returns {string}
 */
function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function startBackup(config, cb) {
    const executeScripts = require('./lib/execute');

    if (taskRunning) {
        return setTimeout(startBackup, 10000, config, cb);
    } else {
        taskRunning = true;
        try {
            executeScripts(adapter, config, err => {
                taskRunning = false;
                cb && cb(err);
            });
            adapter.log.debug('Backup has started ...');
        } catch (e) {
            adapter.log.warn(`Backup error: ${e} ... please check your config and and try again!!`);
        }
    }
}

/**
 * Change the external Sentry Logging. After changing the Logging
 * the adapter restarts once
 * @param {*} value : adapter.config.sentry_enable for example
 */
async function setSentryLogging(value) {
    try {
        value = value === true;
        let idSentry = `system.adapter.${adapter.namespace}.plugins.sentry.enabled`;
        let stateSentry = await adapter.getForeignStateAsync(idSentry);
        if (stateSentry && stateSentry.val !== value) {
            await adapter.setForeignStateAsync(idSentry, value);
            adapter.log.info('Restarting Adapter because of changed Sentry settings');
            adapter.restart();
            return true;
        }
    } catch (error) {
        return false;
    }
    return false;
}

function startAdapter(options) {
    options = options || {};
    Object.assign(options, { name: adapterName });

    adapter = new utils.Adapter(options);

    adapter.on('stateChange', (id, state) => {
        if (state && (state.val === true || state.val === 'true') && !state.ack) {

            if (id === adapter.namespace + '.oneClick.iobroker' ||
                id === adapter.namespace + '.oneClick.ccu') {
                const type = id.split('.').pop();
                let config;
                try {
                    config = JSON.parse(JSON.stringify(backupConfig[type]));
                    config.enabled = true;
                    config.deleteBackupAfter = 0; // do not delete files by custom backup
                } catch (e) {
                    adapter.log.warn(`backup error: ${e} ... please check your config and try again!!`);
                }
                startBackup(config, err => {
                    if (err) {
                        adapter.log.error(`[${type}] ${err}`);

                    } else {
                        adapter.log.debug(`[${type}] exec: done`);
                    }
                    timerOutput = setTimeout(() => {
                        return adapter.getState('output.line', (err, state) => {
                            if (state && state.val === '[EXIT] 0') {
                                adapter.setState(`history.${type}Success`, true, true);
                                adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                            } else {
                                adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                adapter.setState(`history.${type}Success`, false, true);
                            }

                        });
                    }, 500);
                    adapter.setState('oneClick.' + type, false, true);

                    if (adapter.config.slaveInstance && type === 'iobroker' && adapter.config.hostType === 'Master') {
                        adapter.log.debug('Slave backup from Backitup-Master is started ...');
                        startSlaveBackup(adapter.config.slaveInstance[0], null);
                    }
                });
            }
        }
    });

    adapter.on('ready', async () => {
        try {
            if (await setSentryLogging(adapter.config.sentry_enable)) return;
            await main(adapter);
        } catch (e) {
            //ignore errors
        }
    });

    // is called when adapter shuts down - callback has to be called under any circumstances!
    adapter.on('unload', (callback) => {
        try {
            adapter.log.info('cleaned everything up...');
            clearTimeout(timerOutput2);
            clearTimeout(timerOutput);
            clearTimeout(timerUmount1);
            clearTimeout(timerUmount2);
            clearTimeout(timerMain);
            clearTimeout(slaveTimeOut);
            clearTimeout(waitToSlaveBackup);
            clearTimeout(stopServer);
            callback();
        } catch (e) {
            callback();
        }
    });

    adapter.on('message', async obj => {
        if (obj) {
            switch (obj.command) {
                case 'list':
                    try {
                        const list = require('./lib/list');

                        list(obj.message, backupConfig, adapter.log, res => obj.callback && adapter.sendTo(obj.from, obj.command, res, obj.callback));
                        adapter.log.debug('Backup list be read ...');
                    } catch (e) {
                        adapter.log.debug('Backup list cannot be read ...');
                    }
                    break;

                case 'authGoogleDrive':
                    const GoogleDrive = require('./lib/googleDriveLib');

                    if (obj.message && obj.message.code) {
                        // BF(2022_10_18): following code is unused because of the new Google auth
                        const google = new GoogleDrive();
                        google.getToken(obj.message.code)
                            .then(json => adapter.sendTo(obj.from, obj.command, { done: true, json: JSON.stringify(json) }, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: err }, obj.callback));
                    } else if (obj.callback) {
                        const google = new GoogleDrive();
                        google.getAuthorizeUrl()
                            .then(url =>
                                adapter.sendTo(obj.from, obj.command, { url }, obj.callback));
                    }
                    break;

                case 'authDropbox':
                    const Dropbox = require('./lib/dropboxLib');

                    if (obj.message && obj.message.code && obj.message.codeChallenge) {
                        const dropbox = new Dropbox();

                        dropbox.getRefreshToken(obj.message.code, obj.message.codeChallenge, adapter.log)
                            .then(json => adapter.sendTo(obj.from, obj.command, { done: true, json: json }, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: err }, obj.callback));
                    } else if (obj.callback) {
                        const dropbox = new Dropbox();
                        let auth_url;

                        dropbox.getAuthorizeUrl(adapter.log)
                            .then(url => auth_url = url)
                            .then(() => dropbox.getCodeChallage(adapter.log, adapter.config.dropboxCodeChallenge))
                            .then(code_challenge => adapter.sendTo(obj.from, obj.command, { url: auth_url, code_challenge: code_challenge }, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: err }, obj.callback));

                    }
                    break;

                case 'restore':
                    if (obj.message) {
                        if (obj.message.stopIOB) {
                            await getCerts(obj.from);
                        }

                        const _restore = require('./lib/restore');
                        _restore.restore(adapter, backupConfig, obj.message.type, obj.message.fileName, obj.message.currentTheme, bashDir, adapter.log, res => obj.callback && adapter.sendTo(obj.from, obj.command, res, obj.callback));
                    } else if (obj.callback) {
                        obj.callback({ error: 'Invalid parameters' });
                    }
                    break;

                case 'getFile':
                    if (obj.message && obj.message.type && obj.message.fileName && obj.message.protocol) {
                        if (obj.message.protocol === 'https:') {
                            await getCerts(obj.from);
                        }
                        if (dlServer && dlServer._connectionKey) {
                            try {
                                dlServer.close();
                                dlServer = null;
                            } catch (e) {
                                adapter.log.debug('Download server could not be closed');
                            }
                        }
                        try {
                            fileServer(obj.message.protocol);
                        } catch (e) {
                            adapter.log.debug('Downloadserver cannot started');
                        }

                        const fileName = obj.message.fileName.split('/').pop();
                        if (obj.message.type !== 'local') {
                            const backupDir = path.join(tools.getIobDir(), 'backups');
                            const toSaveName = path.join(backupDir, fileName);

                            const _getFile = require('./lib/restore');

                            _getFile.getFile(backupConfig, obj.message.type, obj.message.fileName, toSaveName, adapter.log, err => {
                                if (!err && fs.existsSync(toSaveName)) {
                                    try {
                                        adapter.sendTo(obj.from, obj.command, { fileName: fileName, listenPort: dlServer.address().port }, obj.callback);
                                    } catch (error) {
                                        adapter.sendTo(obj.from, obj.command, { error }, obj.callback);
                                    }
                                } else {
                                    adapter.log.warn(`File ${toSaveName} not found`);
                                }
                            });
                        } else {
                            if (fs.existsSync(obj.message.fileName)) {
                                try {
                                    adapter.sendTo(obj.from, obj.command, { fileName: fileName, listenPort: dlServer.address().port }, obj.callback);
                                } catch (error) {
                                    adapter.sendTo(obj.from, obj.command, { error }, obj.callback);
                                }

                            }
                        }
                    } else if (obj.callback) {
                        obj.callback({ error: 'Invalid parameters' });
                    }
                    break;

                case 'serverClose':
                    if (obj.message && obj.message.downloadFinish) {
                        stopServer = setTimeout(() => {
                            dlServer.close();
                            adapter.log.debug('Downloadserver closed ...');
                            adapter.sendTo(obj.from, obj.command, { serverClose: true }, obj.callback);
                        }, 2000);
                    } else if (obj.callback) {
                        obj.callback({ error: 'Invalid parameters' });
                    }
                    break;

                case 'getTelegramUser':
                    if (obj && obj.message) {
                        const inst = obj.message.config.instance ? obj.message.config.instance : adapter.config.telegramInstance;
                        adapter.log.debug('telegram-instance: ' + inst)
                        adapter.getForeignState(inst + '.communicate.users', (err, state) => {
                            err && adapter.log.error(err);
                            if (state && state.val) {
                                try {
                                    adapter.sendTo(obj.from, obj.command, state.val, obj.callback);
                                } catch (err) {
                                    err && adapter.log.error(err);
                                    adapter.log.error('Cannot parse stored user IDs from Telegram!');
                                }
                            }
                        });
                    }
                    break;

                case 'getSystemInfo':
                    if (obj) {
                        let systemInfo = process.platform;;
                        let dbInfo = false;

                        if (fs.existsSync('/opt/scripts/.docker_config/.thisisdocker')) { // Docker Image Support >= 5.2.0
                            systemInfo = 'docker';

                            if (fs.existsSync('/opt/scripts/.docker_config/.backitup')) {
                                dbInfo = true;
                            }
                        }

                        try {
                            adapter.sendTo(obj.from, obj.command, { systemOS: systemInfo, dockerDB: dbInfo }, obj.callback);
                        } catch (err) {
                            err && adapter.log.error(err);
                        }
                    }
                    break;

                case 'testWebDAV':
                    if (obj.message) {
                        const { createClient } = require('webdav');
                        const agent = require('https').Agent({ rejectUnauthorized: obj.message.config.signedCertificates });

                        const client = createClient(
                            obj.message.config.host,
                            {
                                username: obj.message.config.username,
                                password: obj.message.config.password,
                                maxBodyLength: Infinity,
                                httpsAgent: agent
                            });

                        client
                            .getDirectoryContents('')
                            .then(contents => obj.callback && adapter.sendTo(obj.from, obj.command, contents, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: JSON.stringify(err.message) }, obj.callback));
                    }
                    break;
                case 'slaveBackup':
                    if (obj && obj.message) {
                        if (adapter.config.hostType === 'Slave') {
                            adapter.log.debug('Slave Backup started ...');
                            const type = 'iobroker';
                            let config;
                            try {
                                config = JSON.parse(JSON.stringify(backupConfig[type]));
                                config.enabled = true;
                                config.deleteBackupAfter = obj.message.config.deleteAfter ? obj.message.config.deleteAfter : 0; // do delete files with specification from Master
                            } catch (e) {
                                adapter.log.warn('backup error: ' + e + ' ... please check your config and try again!!');
                            }
                            startBackup(config, err => {
                                if (err) {
                                    adapter.log.error(`[${type}] ${err}`);

                                } else {
                                    adapter.log.debug(`[${type}] exec: done`);
                                }
                                timerOutput = setTimeout(() =>
                                    adapter.getState('output.line', (err, state) => {
                                        if (state && state.val === '[EXIT] 0') {
                                            adapter.setState(`history.${type}Success`, true, true);
                                            adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                                            try {
                                                adapter.sendTo(obj.from, obj.command, state.val, obj.callback);
                                            } catch (err) {
                                                err && adapter.log.error(err);
                                                adapter.log.error('slave Backup not finish!');
                                            }
                                        } else {
                                            adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                            adapter.setState(`history.${type}Success`, false, true);
                                            if (state && state.val) {
                                                try {
                                                    adapter.sendTo(obj.from, obj.command, state.val, obj.callback);
                                                } catch (err) {
                                                    err && adapter.log.error(err);
                                                    adapter.log.error('slave Backup not finish!');
                                                }
                                            }
                                        }

                                    }), 500);
                                adapter.setState('oneClick.' + type, false, true);
                            });
                        } else {
                            adapter.log.warn('Your Backitup Instance is not configured as a slave');
                            adapter.sendTo(obj.from, obj.command, 'not configured as a slave', obj.callback);
                        }
                    }
                    break;
            }
        }
    });

    return adapter;
}

async function checkStates() {

    // Fill empty data points with default values
    const historyState = await adapter.getStateAsync('history.html');
    if (!historyState || historyState.val === null) {
        await adapter.setStateAsync('history.html', { val: `<span class="backup-type-total">${tools._('No backups yet', systemLang)}</span>`, ack: true });
    }

    const iobrokerLastTime = await adapter.getStateAsync('history.iobrokerLastTime');
    if (!iobrokerLastTime || iobrokerLastTime.val === null) {
        await adapter.setStateAsync('history.iobrokerLastTime', { val: tools._('No backups yet', systemLang), ack: true });
    }

    const ccuLastTime = await adapter.getStateAsync('history.ccuLastTime');
    if (!ccuLastTime || ccuLastTime.val === null) {
        await adapter.setStateAsync('history.ccuLastTime', { val: tools._('No backups yet', systemLang), ack: true });
    }

    const iobrokerState = await adapter.getStateAsync('oneClick.iobroker');
    if (!iobrokerState || iobrokerState.val === null || iobrokerState.val === true) {
        await adapter.setStateAsync('oneClick.iobroker', { val: false, ack: true });
    }

    const ccuState = await adapter.getStateAsync('oneClick.ccu');
    if (!ccuState || ccuState.val === null || ccuState.val === true) {
        await adapter.setStateAsync('oneClick.ccu', { val: false, ack: true });
    }

    const ccuSuccess = await adapter.getStateAsync('history.ccuSuccess');
    if (!ccuSuccess || ccuSuccess.val === null) {
        await adapter.setStateAsync('history.ccuSuccess', { val: false, ack: true });
    }

    const iobrokerSuccess = await adapter.getStateAsync('history.iobrokerSuccess');
    if (!iobrokerSuccess || iobrokerSuccess.val === null) {
        await adapter.setStateAsync('history.iobrokerSuccess', { val: false, ack: true });
    }

    const jsonState = await adapter.getStateAsync('history.json');
    if (!jsonState || jsonState.val === null) {
        await adapter.setStateAsync('history.json', { val: '[]', ack: true });
    }
}

// function to create Backup schedules (Backup time)
function createBackupSchedule() {
    for (const type in backupConfig) {
        if (!backupConfig.hasOwnProperty(type)) continue;

        const config = backupConfig[type];
        if (config.enabled === true || config.enabled === 'true') {
            let time = config.time.split(':');

            adapter.log.info(`[${type}] backup was activated at ${config.time} every ${config.everyXDays} day(s)`);

            if (backupTimeSchedules[type]) {
                backupTimeSchedules[type].cancel();
            }
            const cron = `10 ${time[1]} ${time[0]} */${config.everyXDays} * * `;
            backupTimeSchedules[type] = schedule.scheduleJob(cron, () => {
                adapter.setState('oneClick.' + type, true, true);

                startBackup(backupConfig[type], err => {
                    if (err) {
                        adapter.log.error(`[${type}] ${err}`);
                    } else {
                        adapter.log.debug(`[${type}] exec: done`);
                    }
                    timerOutput2 = setTimeout(() =>
                        adapter.getState('output.line', (err, state) => {
                            if (state && state.val === '[EXIT] 0') {
                                adapter.setState(`history.${type}Success`, true, true);
                                adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                            } else {
                                adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                adapter.setState(`history.${type}Success`, false, true);
                            }
                        }), 500);
                    nextBackup(0, false, type);
                    adapter.setState('oneClick.' + type, false, true);

                    if (adapter.config.slaveInstance && type === 'iobroker' && adapter.config.hostType === 'Master') {
                        adapter.log.debug('Slave backup from Backitup-Master is started ...');
                        startSlaveBackup(adapter.config.slaveInstance[0], null);
                    }
                });
            });

            if (config.debugging) {
                adapter.log.debug(`[${type}] ${cron}`);
            }
        } else if (backupTimeSchedules[type]) {
            adapter.log.info(`[${type}] backup deactivated`);
            backupTimeSchedules[type].cancel();
            backupTimeSchedules[type] = null;
        }
    }
}

function initConfig(secret) {
    // compatibility
    if (adapter.config.cifsMount === 'CIFS') {
        adapter.config.cifsMount = '';
    }
    if (adapter.config.redisEnabled === undefined) {
        adapter.config.redisEnabled = adapter.config.backupRedis
    }
    let ioPath;

    try {
        ioPath = require.resolve('iobroker.js-controller/iobroker.js');
    } catch (e) {
        adapter.log.error(`Unable to read iobroker path: +${e}`);
    }

    decryptEvents(secret);

    const telegram = {
        enabled: adapter.config.notificationEnabled,
        notificationsType: adapter.config.notificationsType,
        type: 'message',
        instance: adapter.config.telegramInstance,
        SilentNotice: adapter.config.telegramSilentNotice,
        NoticeType: adapter.config.telegramNoticeType,
        User: adapter.config.telegramUser,
        onlyError: adapter.config.telegramOnlyError,
        telegramWaiting: adapter.config.telegramWaitToSend * 1000,
        hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix : '',
        ignoreErrors: adapter.config.ignoreErrors,
        systemLang
    };

    const whatsapp = {
        enabled: adapter.config.notificationEnabled,
        notificationsType: adapter.config.notificationsType,
        type: 'message',
        instance: adapter.config.whatsappInstance,
        NoticeType: adapter.config.whatsappNoticeType,
        onlyError: adapter.config.whatsappOnlyError,
        whatsappWaiting: adapter.config.whatsappWaitToSend * 1000,
        hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix : '',
        ignoreErrors: adapter.config.ignoreErrors,
        systemLang
    };

    const signal = {
        enabled: adapter.config.notificationEnabled,
        notificationsType: adapter.config.notificationsType,
        type: 'message',
        instance: adapter.config.signalInstance,
        NoticeType: adapter.config.signalNoticeType,
        onlyError: adapter.config.signalOnlyError,
        signalWaiting: adapter.config.signalWaitToSend * 1000,
        hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix : '',
        ignoreErrors: adapter.config.ignoreErrors,
        systemLang
    };

    const pushover = {
        enabled: adapter.config.notificationEnabled,
        notificationsType: adapter.config.notificationsType,
        type: 'message',
        instance: adapter.config.pushoverInstance,
        SilentNotice: adapter.config.pushoverSilentNotice,
        NoticeType: adapter.config.pushoverNoticeType,
        deviceID: adapter.config.pushoverDeviceID,
        onlyError: adapter.config.pushoverOnlyError,
        pushoverWaiting: adapter.config.pushoverWaitToSend * 1000,
        hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix : '',
        ignoreErrors: adapter.config.ignoreErrors,
        systemLang
    };

    const email = {
        enabled: adapter.config.notificationEnabled,
        notificationsType: adapter.config.notificationsType,
        type: 'message',
        instance: adapter.config.emailInstance,
        NoticeType: adapter.config.emailNoticeType,
        emailReceiver: adapter.config.emailReceiver,
        emailSender: adapter.config.emailSender,
        onlyError: adapter.config.emailOnlyError,
        emailWaiting: adapter.config.emailWaitToSend * 1000,
        hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix : '',
        ignoreErrors: adapter.config.ignoreErrors,
        systemLang
    };

    const historyHTML = {
        enabled: true,
        type: 'message',
        entriesNumber: adapter.config.historyEntriesNumber,
        ignoreErrors: adapter.config.ignoreErrors,
        systemLang
    };

    const historyJSON = {
        enabled: true,
        type: 'message',
        entriesNumber: adapter.config.historyEntriesNumber,
        ignoreErrors: adapter.config.ignoreErrors,
        systemLang
    };

    const ftp = {
        enabled: adapter.config.ftpEnabled,
        type: 'storage',
        source: adapter.config.restoreSource,
        host: adapter.config.ftpHost,                       // ftp-host
        debugging: adapter.config.debugLevel,
        deleteOldBackup: adapter.config.ftpDeleteOldBackup, // Delete old Backups from FTP
        ownDir: adapter.config.ftpOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.ftpOwnDir === true) ? null : adapter.config.ftpDir, // directory on FTP server
        dirMinimal: adapter.config.ftpMinimalDir,
        user: adapter.config.ftpUser,                       // username for FTP Server
        pass: adapter.config.ftpPassword ? decrypt(secret, adapter.config.ftpPassword) : '',  // password for FTP Server
        port: adapter.config.ftpPort || 21,                  // FTP port
        secure: adapter.config.ftpSecure || false,  // secure FTP connection
        ignoreErrors: adapter.config.ignoreErrors
    };

    const dropbox = {
        enabled: adapter.config.dropboxEnabled,
        type: 'storage',
        source: adapter.config.restoreSource,
        debugging: adapter.config.debugLevel,
        deleteOldBackup: adapter.config.dropboxDeleteOldBackup, // Delete old Backups from Dropbox
        accessToken: adapter.config.dropboxAccessToken ? adapter.config.dropboxAccessToken : '',
        dropboxAccessJson: adapter.config.dropboxAccessJson,
        dropboxTokenType: adapter.config.dropboxTokenType,
        ownDir: adapter.config.dropboxOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.dropboxOwnDir === true) ? null : adapter.config.dropboxDir,
        dirMinimal: adapter.config.dropboxMinimalDir,
        ignoreErrors: adapter.config.ignoreErrors
    };

    const webdav = {
        enabled: adapter.config.webdavEnabled,
        type: 'storage',
        source: adapter.config.restoreSource,
        debugging: adapter.config.debugLevel,
        deleteOldBackup: adapter.config.webdavDeleteOldBackup, // Delete old Backups from webdav
        username: adapter.config.webdavUsername,
        pass: adapter.config.webdavPassword ? decrypt(secret, adapter.config.webdavPassword) : '',            // webdav password
        url: adapter.config.webdavURL,
        ownDir: adapter.config.webdavOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.webdavOwnDir === true) ? null : adapter.config.webdavDir,
        dirMinimal: adapter.config.webdavMinimalDir,
        signedCertificates: adapter.config.webdavSignedCertificates,
        ignoreErrors: adapter.config.ignoreErrors
    };

    const googledrive = {
        enabled: adapter.config.googledriveEnabled,
        type: 'storage',
        source: adapter.config.restoreSource,
        debugging: adapter.config.debugLevel,
        deleteOldBackup: adapter.config.googledriveDeleteOldBackup, // Delete old Backups from google drive
        accessJson: adapter.config.googledriveAccessTokens || adapter.config.googledriveAccessJson,
        newToken: !!adapter.config.googledriveAccessTokens,
        ownDir: adapter.config.googledriveOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.googledriveOwnDir === true) ? null : adapter.config.googledriveDir,
        dirMinimal: adapter.config.googledriveMinimalDir,
        ignoreErrors: adapter.config.ignoreErrors
    };

    const cifs = {
        enabled: adapter.config.cifsEnabled,
        mountType: adapter.config.connectType,
        type: 'storage',
        source: adapter.config.restoreSource,
        mount: adapter.config.cifsMount,
        debugging: adapter.config.debugLevel,
        fileDir: bashDir,
        wakeOnLAN: adapter.config.wakeOnLAN,
        macAd: adapter.config.macAd,
        wolTime: adapter.config.wolWait,
        smb: adapter.config.smbType,
        sudo: adapter.config.sudoMount,
        cifsDomain: adapter.config.cifsDomain,
        clientInodes: adapter.config.noserverino,
        deleteOldBackup: adapter.config.cifsDeleteOldBackup, //Delete old Backups from Network Disk
        ownDir: adapter.config.cifsOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.cifsOwnDir === true) ? null : adapter.config.cifsDir,                       // specify if CIFS mount should be used
        dirMinimal: adapter.config.cifsMinimalDir,
        user: adapter.config.cifsUser,                     // specify if CIFS mount should be used
        pass: adapter.config.cifsPassword ? decrypt(secret, adapter.config.cifsPassword) : '',  // password for NAS Server
        ignoreErrors: adapter.config.ignoreErrors
    };

    // Configurations for standard-IoBroker backup
    backupConfig.iobroker = {
        name: 'iobroker',
        type: 'creator',
        workDir: ioPath,
        enabled: adapter.config.minimalEnabled,
        time: adapter.config.minimalTime,
        debugging: adapter.config.debugLevel,
        slaveBackup: adapter.config.hostType,
        everyXDays: adapter.config.minimalEveryXDays,
        nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
        deleteBackupAfter: adapter.config.minimalDeleteAfter,   // delete old backup files after x days
        ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
        webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
        googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
        ignoreErrors: adapter.config.ignoreErrors,
        mysql: {
            enabled: adapter.config.mySqlEnabled === undefined ? true : adapter.config.mySqlEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            mysqlQuick: adapter.config.mysqlQuick,
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            mysqlSingleTransaction: adapter.config.mysqlSingleTransaction,
            dbName: adapter.config.mySqlName,              // database name
            user: adapter.config.mySqlUser,                // database user
            pass: adapter.config.mySqlPassword ? decrypt(secret, adapter.config.mySqlPassword) : '',            // database password
            deleteBackupAfter: adapter.config.mySqlDeleteAfter, // delete old backupfiles after x days
            host: adapter.config.mySqlHost,                // database host
            port: adapter.config.mySqlPort,                // database port
            mySqlEvents: adapter.config.mySqlEvents,
            mySqlMulti: adapter.config.mySqlMulti,
            ignoreErrors: adapter.config.ignoreErrors,
            exe: adapter.config.mySqlDumpExe               // path to mysqldump
        },
        dir: tools.getIobDir(),
        influxDB: {
            enabled: adapter.config.influxDBEnabled === undefined ? true : adapter.config.influxDBEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            deleteBackupAfter: adapter.config.influxDBDeleteAfter,  // delete old backupfiles after x days
            dbName: adapter.config.influxDBName,                    // database name
            host: adapter.config.influxDBHost,                      // database host
            port: adapter.config.influxDBPort,                      // database port
            dbversion: adapter.config.influxDBVersion,              // dbversion from Influxdb
            token: adapter.config.influxDBToken,                    // Token from Influxdb
            protocol: adapter.config.influxDBProtocol,              // Protocol Type from Influxdb
            exe: adapter.config.influxDBDumpExe,                    // path to influxDBdump
            dbType: adapter.config.influxDBType,                    // type of influxdb Backup
            influxDBEvents: adapter.config.influxDBEvents,
            influxDBMulti: adapter.config.influxDBMulti,
            ignoreErrors: adapter.config.ignoreErrors,
            deleteDataBase: adapter.config.deleteOldDataBase             // delete old database for restore
        },
        pgsql: {
            enabled: adapter.config.pgSqlEnabled === undefined ? true : adapter.config.pgSqlEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            dbName: adapter.config.pgSqlName,              // database name
            user: adapter.config.pgSqlUser,                // database user
            pass: adapter.config.pgSqlPassword ? decrypt(secret, adapter.config.pgSqlPassword) : '',            // database password
            deleteBackupAfter: adapter.config.pgSqlDeleteAfter, // delete old backupfiles after x days
            host: adapter.config.pgSqlHost,                // database host
            port: adapter.config.pgSqlPort,                // database port
            pgSqlEvents: adapter.config.pgSqlEvents,
            pgSqlMulti: adapter.config.pgSqlMulti,
            ignoreErrors: adapter.config.ignoreErrors,
            exe: adapter.config.pgSqlDumpExe               // path to mysqldump
        },
        redis: {
            enabled: adapter.config.redisEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            aof: adapter.config.redisAOFactive,
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            path: adapter.config.redisPath || '/var/lib/redis', // specify Redis path
            redisType: adapter.config.redisType, // local or Remote Backup
            host: adapter.config.redisHost, // Host for Remote Backup
            port: adapter.config.redisPort, // Port for Remote Backup
            user: adapter.config.redisUser, // User for Remote Backup
            pass: adapter.config.redisPassword ? decrypt(secret, adapter.config.redisPassword) : '', // Password for Remote Backup
            ignoreErrors: adapter.config.ignoreErrors
        },
        historyDB: {
            enabled: adapter.config.historyEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            path: adapter.config.historyPath,
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            ignoreErrors: adapter.config.ignoreErrors
        },
        zigbee: {
            enabled: adapter.config.zigbeeEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            path: path.join(tools.getIobDir(), 'iobroker-data'), // specify zigbee path
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            ignoreErrors: adapter.config.ignoreErrors
        },
        yahka: {
            enabled: adapter.config.yahkaEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            path: path.join(tools.getIobDir(), 'iobroker-data'), // specify yahka path
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            ignoreErrors: adapter.config.ignoreErrors
        },
        jarvis: {
            enabled: adapter.config.jarvisEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            path: path.join(tools.getIobDir(), 'iobroker-data'), // specify jarvis backup path
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            ignoreErrors: adapter.config.ignoreErrors
        },
        javascripts: {
            enabled: adapter.config.javascriptsEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            ignoreErrors: adapter.config.ignoreErrors
        },
        grafana: {
            enabled: adapter.config.grafanaEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            host: adapter.config.grafanaHost,                      // database host
            port: adapter.config.grafanaPort,                      // database port
            protocol: adapter.config.grafanaProtocol,              // database protocol
            username: adapter.config.grafanaUsername,
            pass: adapter.config.grafanaPassword ? decrypt(secret, adapter.config.grafanaPassword) : '',
            apiKey: adapter.config.grafanaApiKey,
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            ignoreErrors: adapter.config.ignoreErrors,
            signedCertificates: adapter.config.grafanaSignedCertificates
        },
        historyHTML,
        historyJSON,
        telegram,
        email,
        pushover,
        whatsapp,
        signal,
    };

    // Configurations for CCU / pivCCU / RaspberryMatic backup
    backupConfig.ccu = {
        name: 'ccu',
        type: 'creator',
        enabled: adapter.config.ccuEnabled,
        time: adapter.config.ccuTime,
        debugging: adapter.config.debugLevel,
        everyXDays: adapter.config.ccuEveryXDays,
        nameSuffix: adapter.config.ccuNameSuffix,               // names addition, appended to the file name
        deleteBackupAfter: adapter.config.ccuDeleteAfter,       // delete old backupfiles after x days
        signedCertificates: adapter.config.ccuSignedCertificates,
        ignoreErrors: adapter.config.ignoreErrors,

        ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpCcuDir } : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsCcuDir } : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxCcuDir } : {}),
        webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavCcuDir } : {}),
        googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveCcuDir } : {}),
        historyHTML,
        historyJSON,
        telegram,
        email,
        pushover,
        whatsapp,
        signal,

        host: adapter.config.ccuHost,                                                           // IP-address CCU
        user: adapter.config.ccuUser,                                                           // username CCU
        usehttps: adapter.config.ccuUsehttps,                                                   // Use https for CCU Connect
        pass: adapter.config.ccuPassword ? decrypt(secret, adapter.config.ccuPassword) : '',    // password der CCU
        ccuEvents: adapter.config.ccuEvents,
        ccuMulti: adapter.config.ccuMulti,
    };
}

function readLogFile() {
    try {
        const logName = path.join(tools.getIobDir(), 'backups', 'logs.txt').replace(/\\/g, '/');
        if (fs.existsSync(logName)) {
            adapter.log.debug(`Printing logs of previous backup`);
            const text = fs.readFileSync(logName).toString();
            const lines = text.split('\n');
            lines.forEach((line, i) => lines[i] = line.replace(/\r$|^\r/, ''));
            lines.forEach(line => {
                line = line.trim();

                if (line) {
                    if (line.startsWith('[ERROR]')) {
                        adapter.log.error(line);
                    } else {
                        adapter.log.debug(line);
                    }
                    adapter.setState('output.line', line, true);
                }
            });
            adapter.setState('output.line', '[EXIT] 0', true);
            fs.unlinkSync(logName);
        }
    } catch (e) {
        adapter.log.warn(`Cannot read log file: ${e}`);
    }
}

function createBashScripts() {
    const isWin = process.platform.startsWith('win');
    if (!fs.existsSync(bashDir)) {
        fs.mkdirSync(bashDir);
        adapter.log.debug('Backitup data-directory created');
    }
    if (isWin) {
        adapter.log.debug(`Backitup has recognized a ${process.platform} system`);

        try {
            fs.writeFileSync(bashDir + '/stopIOB.bat', `cd "${path.join(tools.getIobDir())}"\ncall iobroker stop\ntimeout /T 10\nif exist "${path.join(bashDir, '.redis.info')}" (\nredis-server --service-stop\n)\nif exist "${bashDir}/.redis.info" (\ncd "${path.join(__dirname, 'lib')}"\n) else (\ncd "${bashDir}"\n)\nnode restore.js`);
        } catch (e) {
            adapter.log.error('cannot create stopIOB.bat: ' + e + 'Please run "iobroker fix"');
        }

        try {
            fs.writeFileSync(bashDir + '/startIOB.bat', `if exist "${path.join(bashDir, '.redis.info')}" (\nredis-server --service-start\n)\ncd "${path.join(tools.getIobDir())}"\ncall iobroker host this\ncall iobroker start\nif exist "${path.join(bashDir, '.startAll')}" (\ncd "${path.join(tools.getIobDir(), 'node_modules/iobroker.js-controller')}"\nnode iobroker.js start all\n)`);
        } catch (e) {
            adapter.log.error('cannot create startIOB.bat: ' + e + 'Please run "iobroker fix"');
        }
    } else if (fs.existsSync('/opt/scripts/.docker_config/.thisisdocker')) { // Docker Image Support >= 5.2.0
        adapter.log.debug(`Backitup has recognized a Docker system`);

        try {
            fs.writeFileSync(bashDir + '/stopIOB.sh', `#!/bin/bash\n# iobroker stop for restore\ngosu iobroker ${bashDir}/external.sh`);
            fs.chmodSync(bashDir + '/stopIOB.sh', 508);
        } catch (e) {
            adapter.log.error('cannot create stopIOB.sh: ' + e + 'Please run "iobroker fix"');
        }

        try {
            fs.writeFileSync(bashDir + '/startIOB.sh', `#!/bin/bash\n# iobroker start after restore\nif [ -f ${bashDir}/.startAll ]; then\ncd "${path.join(tools.getIobDir())}"\niobroker start all;\nfi\nsleep 6\ngosu root /opt/scripts/maintenance.sh off -y`);
            fs.chmodSync(bashDir + '/startIOB.sh', 508);
        } catch (e) {
            adapter.log.error('cannot create startIOB.sh: ' + e + 'Please run "iobroker fix"');
        }

        try {
            fs.writeFileSync(bashDir + '/external.sh', `#!/bin/bash\n# restore\ngosu iobroker /opt/scripts/maintenance.sh on -y -kbn\nsleep 3\nif [ -f ${bashDir}/.redis.info ]; then\ncd "${path.join(__dirname, 'lib')}"\nelse\ncd "${bashDir}"\nfi\ngosu iobroker node restore.js`);
            fs.chmodSync(bashDir + '/external.sh', 508);
        } catch (e) {
            adapter.log.error('cannot create external.sh: ' + e + 'Please run "iobroker fix"');
        }
    } else {
        adapter.log.debug(`Backitup has recognized a ${process.platform} system`);

        try {
            fs.writeFileSync(bashDir + '/stopIOB.sh', `# iobroker stop for restore\nsudo systemd-run --uid=iobroker bash ${bashDir}/external.sh`);
            fs.chmodSync(bashDir + '/stopIOB.sh', 508);
        } catch (e) {
            adapter.log.error('cannot create stopIOB.sh: ' + e + 'Please run "iobroker fix"');
        }

        try {
            fs.writeFileSync(bashDir + '/startIOB.sh', `# iobroker start after restore\nif [ -f ${bashDir}/.redis.info ]; then\nredis-cli shutdown nosave && echo "[DEBUG] [redis] Redis restart successfully"\nfi\nif [ -f ${bashDir}/.startAll ]; then\ncd "${path.join(tools.getIobDir())}"\nbash iobroker start all && echo "[EXIT] **** iobroker start upload all now... ****"\nfi\ncd "${path.join(tools.getIobDir())}"\nbash iobroker host this && echo "[DEBUG] [iobroker] Host this successfully"\nbash iobroker start && echo "[EXIT] **** iobroker restart now... ****"`);
            fs.chmodSync(bashDir + '/startIOB.sh', 508);
        } catch (e) {
            adapter.log.error('cannot create startIOB.sh: ' + e + 'Please run "iobroker fix"');
        }

        try {
            fs.writeFileSync(bashDir + '/external.sh', `# restore\ncd "${path.join(tools.getIobDir())}"\nbash iobroker stop && echo "[DEBUG] [iobroker] iobroker stop successfully"\nif [ -f ${bashDir}/.redis.info ]; then\ncd "${path.join(__dirname, 'lib')}"\nelse\ncd "${bashDir}"\nfi\nnode restore.js`);
            fs.chmodSync(bashDir + '/external.sh', 508);
        } catch (e) {
            adapter.log.error('cannot create external.sh: ' + e + 'Please run "iobroker fix"');
        }
    }
}

// umount after restore
function umount() {

    const backupDir = path.join(tools.getIobDir(), 'backups');
    const child_process = require('child_process');

    if (fs.existsSync(bashDir + '/.mount')) {
        child_process.exec(`mount | grep -o "${backupDir}"`, (error, stdout, stderr) => {
            if (stdout.indexOf(backupDir) !== -1) {
                adapter.log.debug('mount activ... umount in 2 Seconds!!');
                timerUmount1 = setTimeout(() =>
                    child_process.exec(`${adapter.config.sudoMount ? 'sudo umount' : 'umount'} ${backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            adapter.log.debug('umount: device is busy... wait 5 Minutes!!');
                            timerUmount2 = setTimeout(() =>
                                child_process.exec(`${adapter.config.sudoMount ? 'sudo umount' : 'umount'} -l ${backupDir}`, (error, stdout, stderr) => {
                                    if (error) {
                                        adapter.log.error(error);
                                    } else {
                                        adapter.log.debug('umount successfully completed');
                                        try {
                                            fs.existsSync(bashDir + '/.mount') && fs.unlinkSync(bashDir + '/.mount');
                                        } catch (e) {
                                            adapter.log.debug('file ".mount" not deleted ...');
                                        }
                                    }
                                }), 300000);
                        } else {
                            adapter.log.debug('umount successfully completed');
                            try {
                                fs.existsSync(bashDir + '/.mount') && fs.unlinkSync(bashDir + '/.mount');
                            } catch (e) {
                                adapter.log.debug('file ".mount" not deleted ...');
                            }
                        }
                    }), 2000);
            } else {
                adapter.log.debug('mount inactiv!!');
            }
        });
    }
}

// Create Backupdir on first start
function createBackupDir() {
    if (!fs.existsSync(path.join(tools.getIobDir(), 'backups'))) {
        try {
            fs.mkdirSync(path.join(tools.getIobDir(), 'backups'));
            adapter.log.debug('Created BackupDir');
        } catch (e) {
            adapter.log.warn('Backup folder not created: ' + e + 'Please run "iobroker fix" and try again or create the backup folder manually!!');
        }
    }
}
// delete Hide Files after restore
function deleteHideFiles() {
    fs.existsSync(bashDir + '/.redis.info') && fs.unlinkSync(bashDir + '/.redis.info');
}
// delete temp dir after restore
function delTmp() {
    if (fs.existsSync(path.join(tools.getIobDir(), 'backups/tmp'))) {
        try {
            fs.rmdirSync(path.join(tools.getIobDir(), 'backups/tmp'));
            adapter.log.debug('delete tmp files');
        } catch (e) {
            adapter.log.warn(`can not delete tmp files: ${e}Please run "iobroker fix" and try again or delete the tmp folder manually!!`);
        }
    }
}
// set start Options after restore
function setStartAll() {
    if (adapter.config.startAllRestore && !fs.existsSync(bashDir + '/.startAll')) {
        try {
            fs.writeFileSync(bashDir + '/.startAll', 'Start all Adapter after Restore');
            adapter.log.debug('Start all Adapter after Restore enabled');
        } catch (e) {
            adapter.log.warn(`can not create startAll files: ${e}Please run "iobroker fix" and try again`);
        }
    } else if (!adapter.config.startAllRestore && fs.existsSync(bashDir + '/.startAll')) {
        try {
            fs.unlinkSync(bashDir + '/.startAll');
            adapter.log.debug('Start all Adapter after Restore disabled');
        } catch (e) {
            adapter.log.warn(`can not delete startAll file: ${e}Please run "iobroker fix" and try again`);
        }
    }
}

function getName(name, filenumbers, storage) {
    try {
        const parts = name.split('_');
        if (parseInt(parts[0], 10).toString() !== parts[0]) {
            parts.shift();
        }
        const storageType = storage === 'cifs' ? 'NAS' : storage;
        adapter.log.debug(name ? `detect backup file ${filenumbers} from ${storageType}: ${name}` : 'No backup name was found');
        return new Date(
            parts[0],
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2].split('-')[0], 10),
            parseInt(parts[2].split('-')[1], 10),
            parseInt(parts[3], 10));
    } catch (err) {
        if (err) {
            adapter.log.warn('No backup name was found');
        }
    }
}

function detectLatestBackupFile(adapter) {
    // get all 'storage' types that enabled
    try {
        let stores = Object.keys(backupConfig.iobroker)
            .filter(attr =>
                typeof backupConfig.iobroker[attr] === 'object' &&
                backupConfig.iobroker[attr].type === 'storage' &&
                backupConfig.iobroker[attr].enabled === true);

        // read one time all stores to detect if some backups detected
        let promises;
        const list = require('./lib/list');
        try {
            promises = stores.map(storage => new Promise(resolve =>
                list(storage, backupConfig, adapter.log, result => {
                    // find the newest file
                    let file = null;

                    if (result && result.data && result.data !== 'undefined') {
                        let filenumbers = 0;
                        let data = result.data;
                        Object.keys(data).forEach(type => {
                            data[type].iobroker && data[type].iobroker
                                .filter(f => f.size)
                                .forEach(f => {
                                    filenumbers++;
                                    const date = getName(f.name, filenumbers, storage);
                                    if (!file || file.date < date) {
                                        file = f;
                                        file.date = date;
                                        file.storage = storage;
                                    }
                                });
                        });
                        result = null;
                        data = null;
                    }
                    resolve(file);
                })));
        } catch (e) {
            adapter.log.warn('No backup file was found');
        }


        // find the newest file between storages
        Promise.all(promises)
            .then(results => {
                results = results.filter(f => f);
                let file;
                if (results.length) {
                    results.sort((a, b) => {
                        if (a.date > b.date) {
                            return 1;
                        } else if (a.date < b.date) {
                            return -1;
                        } else {
                            return 0;
                        }
                    });
                    file = results[0];
                    if (file.date !== undefined) {
                        try {
                            file.date = file.date.toISOString();
                        } catch (e) {
                            adapter.log.warn('No backup file date was found: ' + e);
                        }
                    }
                } else {
                    file = null;
                }
                // this information will be used by admin at the first start if some backup was detected and we can restore from it instead of new configuration
                adapter.setState('info.latestBackup', file ? JSON.stringify(file) : '', true);
                adapter.log.debug(file ? 'detect last backup file: ' + file.name : 'No backup file was found');

                results = null;
            });
        promises = null;
        stores = null;

    } catch (e) {
        adapter.log.warn('No backup file was found');
    }
}

function nextBackup(diffDays, setMain, type, date) {
    date = date || new Date();

    let hours = date.getHours();
    let minutes = date.getMinutes();
    let currentTime = (hours + ':' + minutes);

    if (adapter.config.ccuEnabled && setMain || type === 'ccu') {
        if (adapter.config.ccuTime < currentTime) {
            diffDays = 0;
        }
        let everyXDays = (parseFloat(adapter.config.ccuEveryXDays) - diffDays);
        adapter.setState(`info.ccuNextTime`, tools.getNextTimeString(systemLang, adapter.config.ccuTime, parseFloat(everyXDays)), true);
        diffDays = 1;
    } else if (!adapter.config.ccuEnabled) {
        adapter.setState(`info.ccuNextTime`, 'none', true);
    }
    if (adapter.config.minimalEnabled && setMain || type === 'iobroker') {
        if (adapter.config.minimalTime < currentTime) {
            diffDays = 0;
        }
        let everyXDays = (parseFloat(adapter.config.minimalEveryXDays) - diffDays);
        adapter.setState(`info.iobrokerNextTime`, tools.getNextTimeString(systemLang, adapter.config.minimalTime, parseFloat(everyXDays)), true);
    } else if (!adapter.config.minimalEnabled) {
        adapter.setState(`info.iobrokerNextTime`, 'none', true);
    }
}

async function startSlaveBackup(slaveInstance, num) {
    let waitForInstance = 1000;

    if (num === null || num === undefined) {
        num = 0;
    }

    try {
        const currentState = await adapter.getForeignStateAsync(`system.adapter.${slaveInstance}.alive`, 'state');

        if (currentState && currentState.val === false) {
            waitForInstance = 10000;
            adapter.log.debug(`Try to start ${slaveInstance}`);
            await adapter.setForeignStateAsync(`system.adapter.${slaveInstance}.alive`, true);
        }
    } catch (err) {
        adapter.log.error(`error on slave State: ${err}`)
    }

    waitToSlaveBackup = setTimeout(async () => {
        try {
            const currentStateAfter = await adapter.getForeignStateAsync(`system.adapter.${slaveInstance}.alive`, 'state');

            if (currentStateAfter && currentStateAfter.val && currentStateAfter.val === true) {
                const sendToSlave = await adapter.sendToAsync(slaveInstance, 'slaveBackup', { config: { deleteAfter: adapter.config.minimalDeleteAfter } });

                if (sendToSlave) {
                    adapter.log.debug(`Slave Backup from ${slaveInstance} is finish with result: ${sendToSlave}`);
                } else {
                    adapter.log.debug(`Slave Backup error from ${slaveInstance}: ${error}`);
                }

                if (adapter.config.stopSlaveAfter) {
                    await adapter.setForeignStateAsync(`system.adapter.${slaveInstance}.alive`, false);
                    adapter.log.debug(`${slaveInstance} is stopped after backup`);
                }

                num++;

                if (adapter.config.slaveInstance.length > 1 && num != adapter.config.slaveInstance.length) {
                    return slaveTimeOut = setTimeout(startSlaveBackup, 3000, adapter.config.slaveInstance[num], num);
                } else {
                    adapter.log.debug('slave backups are completed');
                }
            } else {
                num++;
                adapter.log.warn(`${slaveInstance} is not running. The slave backup for this instance is not possible`);

                if (adapter.config.slaveInstance.length > 1 && num != adapter.config.slaveInstance.length) {
                    return slaveTimeOut = setTimeout(startSlaveBackup, 3000, adapter.config.slaveInstance[num], num);
                } else {
                    adapter.log.debug('slave backups are completed');
                }
            }
        } catch (err) {
            adapter.log.error(`error on slave Backup: ${err}`)
        }
    }, waitForInstance);
}

function decryptEvents(secret) {
    if (adapter.config.ccuEvents && adapter.config.ccuMulti) {
        for (let i = 0; i < adapter.config.ccuEvents.length; i++) {
            if (adapter.config.ccuEvents[i].pass) {
                const val = adapter.config.ccuEvents[i].pass;
                adapter.config.ccuEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
    if (adapter.config.mySqlEvents && adapter.config.mySqlMulti) {
        for (let i = 0; i < adapter.config.mySqlEvents.length; i++) {
            if (adapter.config.mySqlEvents[i].pass) {
                const val = adapter.config.mySqlEvents[i].pass;
                adapter.config.mySqlEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
    if (adapter.config.pgSqlEvents && adapter.config.pgSqlMulti) {
        for (let i = 0; i < adapter.config.pgSqlEvents.length; i++) {
            if (adapter.config.pgSqlEvents[i].pass) {
                const val = adapter.config.pgSqlEvents[i].pass;
                adapter.config.pgSqlEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
}

function clearbashDir() {
    // delete restore files
    if (fs.existsSync(bashDir)) {
        const fse = require('fs-extra');
        const restoreDir = path.join(bashDir, 'restore');

        try {
            fs.existsSync(path.join(bashDir, 'restore.js')) && fs.unlinkSync(path.join(bashDir, 'restore.js'));
            fs.existsSync(path.join(bashDir, 'restore.json')) && fs.unlinkSync(path.join(bashDir, 'restore.json'));
            fs.existsSync(restoreDir) && fse.removeSync(restoreDir);

            fs.existsSync(path.join(bashDir, 'iob.key')) && fs.unlinkSync(path.join(bashDir, 'iob.key'));
            fs.existsSync(path.join(bashDir, 'iob.crt')) && fs.unlinkSync(path.join(bashDir, 'iob.crt'));
        } catch (e) {
            adapter.log.debug(`old restore files could not be deleted: ${e}`);
        }
    }
}

async function getCerts(instance) {
    const _adminCert = await adapter.getForeignObjectAsync(instance, 'state');

    if (_adminCert && _adminCert.native && _adminCert.native.certPrivate && _adminCert.native.certPublic) {
        const _cert = await adapter.getForeignObjectAsync('system.certificates', 'state');

        if (_cert && _cert.native && _cert.native.certificates) {
            try {
                if (_cert.native.certificates[`${_adminCert.native.certPrivate}`].startsWith('/') && fs.existsSync(path.join(_cert.native.certificates[`${_adminCert.native.certPrivate}`]))) {
                    fs.writeFileSync(path.join(bashDir, 'iob.key'), fs.readFileSync(path.join(_cert.native.certificates[`${_adminCert.native.certPrivate}`]), 'utf8'));
                } else {
                    fs.writeFileSync(path.join(bashDir, 'iob.key'), _cert.native.certificates[`${_adminCert.native.certPrivate}`]);
                }
                if (_cert.native.certificates[`${_adminCert.native.certPublic}`].startsWith('/') && fs.existsSync(path.join(_cert.native.certificates[`${_adminCert.native.certPublic}`]))) {
                    fs.writeFileSync(path.join(bashDir, 'iob.crt'), fs.readFileSync(path.join(_cert.native.certificates[`${_adminCert.native.certPublic}`]), 'utf8'));
                } else {
                    fs.writeFileSync(path.join(bashDir, 'iob.crt'), _cert.native.certificates[`${_adminCert.native.certPublic}`]);
                }
            } catch (e) {
                adapter.log.debug('no certificates found');
            }
        }
    }
}

function fileServer(protocol) {
    const express = require('express');
    const downloadServer = express();
    const https = require('https');

    let httpsServer;

    downloadServer.use(express.static(path.join(tools.getIobDir(), 'backups')));

    if (protocol === 'https:') {
        let privateKey = '';
        let certificate = '';

        if (fs.existsSync(path.join(bashDir, 'iob.key')) && fs.existsSync(path.join(bashDir, 'iob.crt'))) {
            try {
                privateKey = fs.readFileSync(path.join(bashDir, 'iob.key'), 'utf8');
                certificate = fs.readFileSync(path.join(bashDir, 'iob.crt'), 'utf8');
            } catch (e) {
                adapter.log.debug('no certificates found');
            }
        }
        const credentials = { key: privateKey, cert: certificate };

        try {
            httpsServer = https.createServer(credentials, downloadServer);
        } catch (e) {
            adapter.log.debug(`The https server cannot be created: ${e}`);
        }

        try {
            dlServer = httpsServer.listen(0);
            adapter.log.debug(`Downloadserver on port ${dlServer.address().port} started`);
        } catch (e) {
            adapter.log.debug('Downloadserver cannot started');
        }
    } else {
        try {
            dlServer = downloadServer.listen(0);
            adapter.log.debug(`Downloadserver on port ${dlServer.address().port} started`);
        } catch (e) {
            adapter.log.debug('Downloadserver cannot started');
        }
    }
}

async function main(adapter) {
    createBashScripts();
    readLogFile();

    if (!fs.existsSync(path.join(tools.getIobDir(), 'backups'))) createBackupDir();
    if (fs.existsSync(bashDir + '/.redis.info')) deleteHideFiles();
    if (fs.existsSync(path.join(tools.getIobDir(), 'backups/tmp'))) delTmp();
    clearbashDir();

    timerMain = setTimeout(function () {
        if (fs.existsSync(bashDir + '/.mount')) {
            umount();
        }
        if (adapter.config.startAllRestore && !fs.existsSync(bashDir + '/.startAll')) {
            setStartAll();
        }
    }, 10000);

    adapter.getForeignObject('system.config', (err, obj) => {
        if (obj && obj.common && obj.common.language) {
            systemLang = obj.common.language;
        }
        initConfig((obj && obj.native && obj.native.secret) || 'Zgfr56gFe87jJOM');

        checkStates();

        if (adapter.config.hostType !== 'Slave') {
            createBackupSchedule();
            nextBackup(1, true, null);

            detectLatestBackupFile(adapter);
        }
    });

    // subscribe on all variables of this adapter instance with pattern "adapterName.X.memory*"
    adapter.subscribeStates('oneClick.*');
}
// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}