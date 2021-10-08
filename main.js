/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
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

let systemLang = 'de';                                  // system language
const backupConfig = {};
const backupTimeSchedules = [];                         // Array für die Backup Zeiten
let taskRunning = false;

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
            adapter.log.warn('Backup error: ' + e + ' ... please check your config and and try again!!');
        }
    }
}

/**
 * Change the external Sentry Logging. After changing the Logging
 * the adapter restarts once
 * @param {*} id : adapter.config.sentry_enable for example
 */
async function setSentryLogging(value) {
    try {
        value = value === true;
        let idSentry = 'system.adapter.' + adapter.namespace + '.plugins.sentry.enabled';
        let stateSentry = await adapter.getForeignStateAsync(idSentry);
        if (stateSentry && stateSentry.val !== value) {
            await adapter.setForeignStateAsync(idSentry, value);
            adapter.log.info('Restarting Adapter because of changeing Sentry settings');
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
                                adapter.setState('history.' + type + 'Success', true, true);
                                adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                            } else {
                                adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                adapter.setState('history.' + type + 'Success', false, true);
                            }

                        }), 500);
                    adapter.setState('oneClick.' + type, false, true);

                    if (adapter.config.slaveInstance && type == 'iobroker' && adapter.config.hostType == 'Master') {
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
            callback();
        } catch (e) {
            callback();
        }
    });

    adapter.on('message', obj => {
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
                        const google = new GoogleDrive();
                        google.getToken(obj.message.code)
                            .then(json => adapter.sendTo(obj.from, obj.command, { done: true, json: JSON.stringify(json) }, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: err }, obj.callback));
                    } else if (obj.callback) {
                        const google = new GoogleDrive();
                        google.getAuthorizeUrl().then(url =>
                            adapter.sendTo(obj.from, obj.command, { url }, obj.callback));
                    }
                    break;

                case 'restore':
                    if (obj.message) {
                        const restore = require('./lib/restore');
                        restore(adapter, backupConfig, obj.message.type, obj.message.fileName, adapter.log, res => obj.callback && adapter.sendTo(obj.from, obj.command, res, obj.callback));
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
                        let systemInfo;
                        if (fs.existsSync('/opt/scripts/.docker_config/.thisisdocker')) { // Docker Image Support >= 5.2.0
                            systemInfo = 'docker';
                        } else {
                            systemInfo = process.platform;
                        }
                        try {
                            adapter.sendTo(obj.from, obj.command, systemInfo, obj.callback);
                        } catch (err) {
                            err && adapter.log.error(err);
                        }
                    }
                    break;

                case 'testWebDAV':
                    if (obj.message) {
                        const { createClient } = require("webdav");
                        const agent = require("https").Agent({ rejectUnauthorized: obj.message.config.signedCertificates });

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
                        if (adapter.config.hostType == 'Slave') {
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
                                            adapter.setState('history.' + type + 'Success', true, true);
                                            adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                                            try {
                                                adapter.sendTo(obj.from, obj.command, state.val, obj.callback);
                                            } catch (err) {
                                                err && adapter.log.error(err);
                                                adapter.log.error('slave Backup not finish!');
                                            }
                                        } else {
                                            adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                            adapter.setState('history.' + type + 'Success', false, true);
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
        await adapter.setStateAsync('history.html', { val: '<span class="backup-type-total">' + tools._('No backups yet', systemLang) + '</span>', ack: true });
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
    if (!iobrokerState || iobrokerState.val === null) {
        await adapter.setStateAsync('oneClick.iobroker', { val: false, ack: true });
    }

    const ccuState = await adapter.getStateAsync('oneClick.ccu');
    if (!ccuState || ccuState.val === null) {
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
            const cron = '10 ' + time[1] + ' ' + time[0] + ' */' + config.everyXDays + ' * * ';
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
                                adapter.setState('history.' + type + 'Success', true, true);
                                adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                            } else {
                                adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                adapter.setState('history.' + type + 'Success', false, true);
                            }
                        }), 500);
                    nextBackup(0, false, type);
                    adapter.setState('oneClick.' + type, false, true);

                    if (adapter.config.slaveInstance && type == 'iobroker' && adapter.config.hostType == 'Master') {
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
        systemLang
    };

    const historyHTML = {
        enabled: true,
        type: 'message',
        entriesNumber: adapter.config.historyEntriesNumber,
        systemLang
    };

    const historyJSON = {
        enabled: true,
        type: 'message',
        entriesNumber: adapter.config.historyEntriesNumber,
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
        port: adapter.config.ftpPort || 21                  // FTP port
    };

    const dropbox = {
        enabled: adapter.config.dropboxEnabled,
        type: 'storage',
        source: adapter.config.restoreSource,
        debugging: adapter.config.debugLevel,
        deleteOldBackup: adapter.config.dropboxDeleteOldBackup, // Delete old Backups from Dropbox
        accessToken: adapter.config.dropboxAccessToken,
        ownDir: adapter.config.dropboxOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.dropboxOwnDir === true) ? null : adapter.config.dropboxDir,
        dirMinimal: adapter.config.dropboxMinimalDir
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
        signedCertificates: adapter.config.webdavSignedCertificates
    };

    const googledrive = {
        enabled: adapter.config.googledriveEnabled,
        type: 'storage',
        source: adapter.config.restoreSource,
        debugging: adapter.config.debugLevel,
        deleteOldBackup: adapter.config.googledriveDeleteOldBackup, // Delete old Backups from google drive
        accessJson: adapter.config.googledriveAccessJson,
        ownDir: adapter.config.googledriveOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.googledriveOwnDir === true) ? null : adapter.config.googledriveDir,
        dirMinimal: adapter.config.googledriveMinimalDir
    };

    const cifs = {
        enabled: adapter.config.cifsEnabled,
        mountType: adapter.config.connectType,
        type: 'storage',
        source: adapter.config.restoreSource,
        mount: adapter.config.cifsMount,
        debugging: adapter.config.debugLevel,
        fileDir: __dirname,
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
        pass: adapter.config.cifsPassword ? decrypt(secret, adapter.config.cifsPassword) : ''  // password for NAS Server
    };

    // Configurations for standard-IoBroker backup
    backupConfig.iobroker = {
        name: 'iobroker',
        type: 'creator',
        enabled: adapter.config.minimalEnabled,
        time: adapter.config.minimalTime,
        debugging: adapter.config.debugLevel,
        slaveBackup: adapter.config.hostType,
        everyXDays: adapter.config.minimalEveryXDays,
        nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
        deleteBackupAfter: adapter.config.minimalDeleteAfter,   // delete old backupfiles after x days
        ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
        webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
        googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            deleteBackupAfter: adapter.config.influxDBDeleteAfter,  // delete old backupfiles after x days
            dbName: adapter.config.influxDBName,                    // database name
            host: adapter.config.influxDBHost,                      // database host
            port: adapter.config.influxDBPort,                      // database port
            exe: adapter.config.influxDBDumpExe,                    // path to influxDBdump
            dbType: adapter.config.influxDBType,                    // type of influxdb Backup
            influxDBEvents: adapter.config.influxDBEvents,
            influxDBMulti: adapter.config.influxDBMulti,
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            dbName: adapter.config.pgSqlName,              // database name
            user: adapter.config.pgSqlUser,                // database user
            pass: adapter.config.pgSqlPassword ? decrypt(secret, adapter.config.pgSqlPassword) : '',            // database password
            deleteBackupAfter: adapter.config.pgSqlDeleteAfter, // delete old backupfiles after x days
            host: adapter.config.pgSqlHost,                // database host
            port: adapter.config.pgSqlPort,                // database port
            pgSqlEvents: adapter.config.pgSqlEvents,
            pgSqlMulti: adapter.config.pgSqlMulti,
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            path: adapter.config.redisPath || '/var/lib/redis', // specify Redis path
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
        },
        javascripts: {
            enabled: adapter.config.javascriptsEnabled,
            type: 'creator',
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
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
            slaveSuffix: adapter.config.hostType == 'Slave' ? adapter.config.slaveNameSuffix : '',
            hostType: adapter.config.hostType,
        },
        historyHTML,
        historyJSON,
        telegram,
        email,
        pushover,
        whatsapp,
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
        //deleteBackupAfter: adapter.config.ccuMulti === true ? adapter.config.ccuDeleteAfter * adapter.config.ccuEvents.length : adapter.config.ccuDeleteAfter,       // delete old backupfiles after x days
        deleteBackupAfter: adapter.config.ccuDeleteAfter,       // delete old backupfiles after x days
        signedCertificates: adapter.config.ccuSignedCertificates,

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
                    //if (line.startsWith('[DEBUG] [total/total] Packed ')) return;

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

            // make the messaging
            //config.afterBackup = true;
            //executeScripts(adapter, config, err => {

            //});
        }
    } catch (e) {
        adapter.log.warn(`Cannot read log file: ${e}`);
    }
}

function createBashScripts() {
    const isWin = process.platform.startsWith('win');

    if (isWin) {
        adapter.log.debug(`Backitup has recognized a ${process.platform} system`);
        if (!fs.existsSync(__dirname + '/lib/stopIOB.bat')) {
            try {
                fs.writeFileSync(__dirname + '/lib/stopIOB.bat', `cd "${path.join(tools.getIobDir())}"\ncall iobroker stop\ntimeout /T 10\nif exist "${path.join(__dirname, 'lib/.redis.info')}" (\nredis-server --service-stop\n)\ncd "${path.join(__dirname, 'lib')}"\nnode restore.js`);
            } catch (e) {
                adapter.log.error('cannot create stopIOB.bat: ' + e + 'Please run "iobroker fix"');
            }
        }
        if (!fs.existsSync(__dirname + '/lib/startIOB.bat')) {
            try {
                fs.writeFileSync(__dirname + '/lib/startIOB.bat', `if exist "${path.join(__dirname, 'lib/.redis.info')}" (\nredis-server --service-start\n)\ncd "${path.join(tools.getIobDir())}"\ncall iobroker host this\ncall iobroker start\nif exist "${path.join(__dirname, 'lib/.startAll')}" (\ncd "${path.join(tools.getIobDir(), 'node_modules/iobroker.js-controller')}"\nnode iobroker.js start all\n)`);
            } catch (e) {
                adapter.log.error('cannot create startIOB.bat: ' + e + 'Please run "iobroker fix"');
            }
        }
    } else if (fs.existsSync('/opt/scripts/.docker_config/.thisisdocker')) { // Docker Image Support >= 5.2.0
        adapter.log.debug(`Backitup has recognized a Docker system`);
        if (!fs.existsSync(__dirname + '/lib/stopIOB.sh')) {
            try {
                fs.writeFileSync(__dirname + '/lib/stopIOB.sh', `#!/bin/bash\n# iobroker stop for restore\ngosu iobroker ${path.join(__dirname, 'lib')}/external.sh`);
                fs.chmodSync(__dirname + '/lib/stopIOB.sh', 508);
            } catch (e) {
                adapter.log.error('cannot create stopIOB.sh: ' + e + 'Please run "iobroker fix"');
            }
        }
        if (!fs.existsSync(__dirname + '/lib/startIOB.sh')) {
            try {
                fs.writeFileSync(__dirname + '/lib/startIOB.sh', `#!/bin/bash\n# iobroker start after restore\nif [ -f ${path.join(__dirname, 'lib')}\.startAll ] ; then\ncd "${path.join(tools.getIobDir())}"\niobroker start all;\nfi\ngosu root /opt/scripts/maintenance.sh off -y`);
                fs.chmodSync(__dirname + '/lib/startIOB.sh', 508);
            } catch (e) {
                adapter.log.error('cannot create startIOB.sh: ' + e + 'Please run "iobroker fix"');
            }
        }
        if (!fs.existsSync(__dirname + '/lib/external.sh')) {
            try {
                fs.writeFileSync(__dirname + '/lib/external.sh', `#!/bin/bash\n# restore\ngosu iobroker /opt/scripts/maintenance.sh on -y -kbn\nsleep 3\ncd "${path.join(__dirname, 'lib')}"\ngosu iobroker node restore.js`);
                fs.chmodSync(__dirname + '/lib/external.sh', 508);
            } catch (e) {
                adapter.log.error('cannot create external.sh: ' + e + 'Please run "iobroker fix"');
            }
        }
    } else {
        adapter.log.debug(`Backitup has recognized a ${process.platform} system`);
        if (!fs.existsSync(__dirname + '/lib/stopIOB.sh')) {
            try {
                fs.writeFileSync(__dirname + '/lib/stopIOB.sh', `# iobroker stop for restore\nsudo systemd-run --uid=iobroker bash ${path.join(__dirname, 'lib')}/external.sh`);
                fs.chmodSync(__dirname + '/lib/stopIOB.sh', 508);
            } catch (e) {
                adapter.log.error('cannot create stopIOB.sh: ' + e + 'Please run "iobroker fix"');
            }
        }
        if (!fs.existsSync(__dirname + '/lib/startIOB.sh')) {
            try {
                fs.writeFileSync(__dirname + '/lib/startIOB.sh', `# iobroker start after restore\nif [ -f ${path.join(__dirname, 'lib')}/.redis.info ] ; then\nsudo service redis-server start\nfi\nbash iobroker host this\nif [ -f ${path.join(__dirname, 'lib')}\.startAll ] ; then\ncd "${path.join(tools.getIobDir())}"\nbash iobroker start all\nfi\ncd "${path.join(tools.getIobDir())}"\nbash iobroker start`);
                fs.chmodSync(__dirname + '/lib/startIOB.sh', 508);
            } catch (e) {
                adapter.log.error('cannot create startIOB.sh: ' + e + 'Please run "iobroker fix"');
            }
        }
        if (!fs.existsSync(__dirname + '/lib/external.sh')) {
            try {
                fs.writeFileSync(__dirname + '/lib/external.sh', `# restore\nif [ -f ${path.join(__dirname, 'lib')}/.redis.info ] ; then\nsudo service redis-server stop\nfi\ncd "${path.join(tools.getIobDir())}"\nbash iobroker stop;\ncd "${path.join(__dirname, 'lib')}"\nnode restore.js`);
                fs.chmodSync(__dirname + '/lib/external.sh', 508);
            } catch (e) {
                adapter.log.error('cannot create external.sh: ' + e + 'Please run "iobroker fix"');
            }
        }
    }
}

// umount after restore
function umount() {

    const backupDir = path.join(tools.getIobDir(), 'backups');
    const child_process = require('child_process');

    if (fs.existsSync(__dirname + '/.mount')) {
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
                                            fs.existsSync(__dirname + '/.mount') && fs.unlinkSync(__dirname + '/.mount');
                                        } catch (e) {
                                            adapter.log.debug('file ".mount" not deleted ...');
                                        }
                                    }
                                }), 300000);
                        } else {
                            adapter.log.debug('umount successfully completed');
                            try {
                                fs.existsSync(__dirname + '/.mount') && fs.unlinkSync(__dirname + '/.mount');
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
    fs.existsSync(__dirname + '/lib/.redis.info') && fs.unlinkSync(__dirname + '/lib/.redis.info');
}
// delete temp dir after restore
function delTmp() {
    if (fs.existsSync(path.join(tools.getIobDir(), 'backups/tmp'))) {
        try {
            fs.rmdirSync(path.join(tools.getIobDir(), 'backups/tmp'));
            adapter.log.debug('delete tmp files');
        } catch (e) {
            adapter.log.warn('can not delete tmp files: ' + e + 'Please run "iobroker fix" and try again or delete the tmp folder manually!!');
        }
    }
}
// set start Options after restore
function setStartAll() {
    if (adapter.config.startAllRestore == true && !fs.existsSync(__dirname + '/lib/.startAll')) {
        try {
            fs.writeFileSync(__dirname + '/lib/.startAll', 'Start all Adapter after Restore');
            adapter.log.debug('Start all Adapter after Restore enabled');
        } catch (e) {
            adapter.log.warn('can not create startAll files: ' + e + 'Please run "iobroker fix" and try again');
        }
    } else if (adapter.config.startAllRestore == false && fs.existsSync(__dirname + '/lib/.startAll')) {
        try {
            fs.unlinkSync(__dirname + '/lib/.startAll');
            adapter.log.debug('Start all Adapter after Restore disabled');
        } catch (e) {
            adapter.log.warn('can not delete startAll file: ' + e + 'Please run "iobroker fix" and try again');
        }
    }
}

function getName(name, filenumbers, storage) {
    try {
        const parts = name.split('_');
        if (parseInt(parts[0], 10).toString() !== parts[0]) {
            parts.shift();
        }
        adapter.log.debug(name ? 'detect backup file ' + filenumbers + ' from ' + storage + ': ' + name : 'No backup name was found');
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
                    // find newest file
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

    if (adapter.config.ccuEnabled == true && setMain == true || type == 'ccu') {
        if (adapter.config.ccuTime < currentTime) {
            diffDays = 0;
        }
        let everyXDays = (parseFloat(adapter.config.ccuEveryXDays) - diffDays);
        adapter.setState(`info.ccuNextTime`, tools.getNextTimeString(systemLang, adapter.config.ccuTime, parseFloat(everyXDays)), true);
        diffDays = 1;
    } else if (adapter.config.ccuEnabled == false) {
        adapter.setState(`info.ccuNextTime`, 'none', true);
    }
    if (adapter.config.minimalEnabled == true && setMain == true || type == 'iobroker') {
        if (adapter.config.minimalTime < currentTime) {
            diffDays = 0;
        }
        let everyXDays = (parseFloat(adapter.config.minimalEveryXDays) - diffDays);
        adapter.setState(`info.iobrokerNextTime`, tools.getNextTimeString(systemLang, adapter.config.minimalTime, parseFloat(everyXDays)), true);
    } else if (adapter.config.minimalEnabled == false) {
        adapter.setState(`info.iobrokerNextTime`, 'none', true);
    }
}

async function startSlaveBackup(slaveInstance, num) {
    let waitForInstance = 1000;

    if (num == null) {
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

async function main(adapter) {
    createBashScripts();
    readLogFile();

    if (!fs.existsSync(path.join(tools.getIobDir(), 'backups'))) createBackupDir();
    if (fs.existsSync(__dirname + '/lib/.redis.info')) deleteHideFiles();
    if (fs.existsSync(path.join(tools.getIobDir(), 'backups/tmp'))) delTmp();

    timerMain = setTimeout(function () {
        if (fs.existsSync(__dirname + '/.mount')) umount();
        if (adapter.config.startAllRestore == true && !fs.existsSync(__dirname + '/lib/.startAll')) setStartAll();
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