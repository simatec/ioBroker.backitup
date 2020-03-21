/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

const utils       = require('@iobroker/adapter-core'); // Get common adapter utils
const schedule    = require('node-schedule');
const fs          = require('fs');
const path        = require('path');
const adapterName = require('./package.json').name.split('.').pop();

const tools       = require('./lib/tools');
const executeScripts = require('./lib/execute');
const list        = require('./lib/list');
const restore     = require('./lib/restore');
const GoogleDrive = require('./lib/googleDriveLib');

let adapter;

let timerOutput;
let timerOutput2;
let timerUmount1;
let timerUmount2;
let timerMain;

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
    for(let i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function startBackup(config, cb) {
    if (taskRunning) {
        return setTimeout(startBackup, 10000, config, cb);
    } else {
        taskRunning = true;
        executeScripts(adapter, config, err => {
            taskRunning = false;
            cb && cb(err);
        });
    }
}

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {name: adapterName});

    adapter = new utils.Adapter(options);

    adapter.on('stateChange', (id, state) => {
        if (state && (state.val === true || state.val === 'true') && !state.ack) {

            if (id === adapter.namespace + '.oneClick.iobroker' ||
                id === adapter.namespace + '.oneClick.ccu') {
                const type = id.split('.').pop();
                const config = JSON.parse(JSON.stringify(backupConfig[type]));
                config.enabled = true;
                config.deleteBackupAfter = 0; // do not delete files by custom backup

                startBackup(config, err => {
                    if (err) {
                        adapter.log.error(`[${type}] ${err}`);

                    } else {
                        adapter.log.debug(`[${type}] exec: done`);
                    }
                    timerOutput = setTimeout(() =>
                        adapter.getState('output.line', (err, state) => {
                            if (state.val === '[EXIT] 0') {
                                adapter.setState('history.' + type + 'Success', true, true);
                                adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                            } else {
                                adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                adapter.setState('history.' + type + 'Success', false, true);
                            }

                        }), 500);
                    adapter.setState('oneClick.' + type, false, true);
                });
            }
        }
    });

    adapter.on('ready', () => main(adapter));

    // is called when adapter shuts down - callback has to be called under any circumstances!
    adapter.on('unload', (callback) => {
        try {
            adapter.log.info('cleaned everything up...');
            clearTimeout(timerOutput2);
            clearTimeout(timerOutput);
            clearTimeout(timerUmount1);
            clearTimeout(timerUmount2);
            clearTimeout(timerMain);
            callback();
        } catch (e) {
            callback();
        }
    });

    adapter.on('message', obj => {
        if (obj) {
            switch (obj.command) {
                case 'list':
                    list(obj.message, backupConfig, adapter.log, res => obj.callback && adapter.sendTo(obj.from, obj.command, res, obj.callback));
                    break;

                case 'authGoogleDrive':
                    if (obj.message && obj.message.code) {
                        const google = new GoogleDrive();
                        google.getToken(obj.message.code)
                            .then(json => adapter.sendTo(obj.from, obj.command, {done: true, json: JSON.stringify(json)}, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, {error: err}, obj.callback));
                    } else if (obj.callback) {
                        const google = new GoogleDrive();
                        google.getAuthorizeUrl().then(url =>
                            adapter.sendTo(obj.from, obj.command, {url}, obj.callback));
                    }
                    break;

                case 'restore':
                    if (obj.message) {
                        restore(adapter, backupConfig, obj.message.type, obj.message.fileName, adapter.log, res => obj.callback && adapter.sendTo(obj.from, obj.command, res, obj.callback));
                    } else if (obj.callback) {
                        obj.callback({error: 'Invalid parameters'});
                    }
                    break;

                case 'getTelegramUser':
                    adapter.getForeignState(adapter.config.telegramInstance + '.communicate.users', (err, state) => {
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
                    break;
            }
        }
    });

    return adapter;
}

function checkStates() {
    // Fill empty data points with default values
    adapter.getState('history.html', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.html', {
                val: '<span class="backup-type-total">' + tools._('No backups yet', systemLang) + '</span>',
                ack: true
            });
        }
    });
    adapter.getState('history.iobrokerLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.iobrokerLastTime', {val: tools._('No backups yet', systemLang), ack: true});
        }
    });
    adapter.getState('history.ccuLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.ccuLastTime', {val: tools._('No backups yet', systemLang), ack: true});
        }
    });
    adapter.getState('oneClick.iobroker', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('oneClick.iobroker', {val: false, ack: true});
        }
    });
    adapter.getState('oneClick.ccu', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('oneClick.ccu', {val: false, ack: true});
        }
    });
    adapter.getState('history.ccuSuccess', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('history.ccuSuccess', {val: false, ack: true});
        }
    });
    adapter.getState('history.iobrokerSuccess', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('history.iobrokerSuccess', {val: false, ack: true});
        }
    });
    adapter.getState('history.json', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('history.json', {val: '[]', ack: true});
        }
    });
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
                            if (state.val === '[EXIT] 0') {
                                adapter.setState('history.' + type + 'Success', true, true);
                                adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                            } else {
                                adapter.setState(`history.${type}LastTime`, 'error: ' + tools.getTimeString(systemLang), true);
                                adapter.setState('history.' + type + 'Success', false, true);
                            }
                        }), 500);
                    nextBackup(0, false, type);
                    adapter.setState('oneClick.' + type, false, true);
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
        systemLang
    };

    const history = {
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
        deleteOldBackup: adapter.config.cifsDeleteOldBackup, //Delete old Backups from Network Disk
        ownDir: adapter.config.cifsOwnDir,
        bkpType: adapter.config.restoreType,
        dir: (adapter.config.cifsOwnDir === true) ? null : adapter.config.cifsDir,                       // specify if CIFS mount should be used
        dirMinimal: adapter.config.cifsMinimalDir,
        user: adapter.config.cifsUser,                     // specify if CIFS mount should be used
        pass: adapter.config.cifsPassword ? decrypt(secret, adapter.config.cifsPassword) : ''  // password for NAS Server
    };

    // TODO: Not used anywere
    const mysql = {
        enabled: adapter.config.mySqlEnabled === undefined ? true : adapter.config.mySqlEnabled,
        type: 'creator',
        ftp:  Object.assign({}, ftp,  (adapter.config.ftpOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir} : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir}  : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxMinimalDir}  : {}),
        googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? {dir:  adapter.config.googledriveMinimalDir}  : {}),
        nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
        mysqlQuick: adapter.config.mysqlQuick,
        mysqlSingleTransaction: adapter.config.mysqlSingleTransaction,
        dbName: adapter.config.mySqlName,              // database name
        user: adapter.config.mySqlUser,                // database user
        pass: adapter.config.mySqlPassword ? decrypt(secret, adapter.config.mySqlPassword) : '',            // database password
        deleteBackupAfter: adapter.config.mySqlDeleteAfter, // delete old backupfiles after x days
        host: adapter.config.mySqlHost,                // database host
        port: adapter.config.mySqlPort,                // database port
        exe: adapter.config.mySqlDumpExe               // path to mysqldump
    };

    // Configurations for standard-IoBroker backup
    backupConfig.iobroker = {
        name: 'iobroker',
        type: 'creator',
        enabled: adapter.config.minimalEnabled,
        time: adapter.config.minimalTime,
        debugging: adapter.config.debugLevel,
        everyXDays: adapter.config.minimalEveryXDays,
        nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
        deleteBackupAfter: adapter.config.minimalDeleteAfter,   // delete old backupfiles after x days
        ftp:  Object.assign({}, ftp,  (adapter.config.ftpOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir} : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir}  : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxMinimalDir}  : {}),
        googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? {dir:  adapter.config.googledriveMinimalDir}  : {}),
        mysql: {
            enabled: adapter.config.mySqlEnabled === undefined ? true : adapter.config.mySqlEnabled,
            type: 'creator',
            ftp:  Object.assign({}, ftp,  (adapter.config.ftpOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir} : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir}  : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxMinimalDir}  : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? {dir:  adapter.config.googledriveMinimalDir}  : {}),
            nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
            mysqlQuick: adapter.config.mysqlQuick,
            mysqlSingleTransaction: adapter.config.mysqlSingleTransaction,
            dbName: adapter.config.mySqlName,              // database name
            user: adapter.config.mySqlUser,                // database user
            pass: adapter.config.mySqlPassword ? decrypt(secret, adapter.config.mySqlPassword) : '',            // database password
            deleteBackupAfter: adapter.config.mySqlDeleteAfter, // delete old backupfiles after x days
            host: adapter.config.mySqlHost,                // database host
            port: adapter.config.mySqlPort,                // database port
            exe: adapter.config.mySqlDumpExe               // path to mysqldump
        },
        dir: tools.getIobDir(),
		redis: {
			enabled: adapter.config.redisEnabled,
            type: 'creator',
            ftp:  Object.assign({}, ftp,  (adapter.config.ftpOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir}  : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir} : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxMinimalDir}  : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? {dir:  adapter.config.googledriveMinimalDir}  : {}),
			path: adapter.config.redisPath || '/var/lib/redis', // specify Redis path
        },
        historyDB: {
			enabled: adapter.config.historyEnabled,
            type: 'creator',
            ftp:  Object.assign({}, ftp,  (adapter.config.ftpOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir}  : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir} : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxMinimalDir}  : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? {dir:  adapter.config.googledriveMinimalDir}  : {}),
			path: adapter.config.historyPath,
        },
        zigbee: {
			enabled: adapter.config.zigbeeEnabled,
            type: 'creator',
            ftp:  Object.assign({}, ftp,  (adapter.config.ftpOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir}  : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir} : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxMinimalDir}  : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? {dir:  adapter.config.googledriveMinimalDir}  : {}),
			path: tools.getIobDir() + '/iobroker-data', // specify zigbee path
        },
        history,
        telegram,
        email,
        pushover,
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

        ftp:  Object.assign({}, ftp,  (adapter.config.ftpOwnDir === true) ? {dir:  adapter.config.ftpCcuDir} : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsCcuDir}  : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxCcuDir}  : {}),
        googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? {dir:  adapter.config.googledriveCcuDir}  : {}),
        history,
        telegram,
        email,
        pushover,

        host: adapter.config.ccuHost,                           // IP-address CCU
        user: adapter.config.ccuUser,                           // username CCU
        pass: adapter.config.ccuPassword ? decrypt(secret, adapter.config.ccuPassword) : '',                       // password der CCU
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
                    adapter.setState('output.line', line);
                }
            });
            adapter.setState('output.line', '[EXIT] 0');
            fs.unlinkSync(logName);

            // make the messaging
            config.afterBackup = true;
            executeScripts(adapter, config, err => {

            });
        }
    } catch (e) {
        adapter.log.warn(`Cannot read log file: ${e}`);
    }
}

function createBashScripts() {
    const isWin = process.platform.startsWith('win');

    /*let jsPath;
    try {
        jsPath = require.resolve('iobroker.js-controller/iobroker.bat');
        jsPath = jsPath.replace(/\\/g, '/');
        const parts = jsPath.split('/');
        parts.pop();
        jsPath = parts.join('/');
    } catch (e) {
        jsPath = path.join(tools.getIobDir(), 'node_modules/iobroker.js-controller');
    }*/

    // delete .sh and .bat for updates
    if (fs.existsSync(__dirname + '/lib/.update')) {
        if (isWin) {
            fs.existsSync(__dirname + '/lib/stopIOB.bat') && fs.unlinkSync(__dirname + '/lib/stopIOB.bat');
            fs.existsSync(__dirname + '/lib/startIOB.bat') && fs.unlinkSync(__dirname + '/lib/startIOB.bat');
            fs.unlinkSync(__dirname + '/lib/.update');
        } else {
            fs.existsSync(__dirname + '/lib/stopIOB.sh') && fs.unlinkSync(__dirname + '/lib/stopIOB.sh');
            fs.existsSync(__dirname + '/lib/startIOB.sh') && fs.unlinkSync(__dirname + '/lib/startIOB.sh');
            fs.existsSync(__dirname + '/lib/external.sh') && fs.unlinkSync(__dirname + '/lib/external.sh');
            fs.unlinkSync(__dirname + '/lib/.update');
        }
    }

    if (isWin) {
        if (!fs.existsSync(__dirname + '/lib/stopIOB.bat')) {
            fs.writeFileSync(__dirname + '/lib/stopIOB.bat', `cd "${path.join(tools.getIobDir())}"\ncall iobroker stop\ntimeout /T 10\nif exist "${path.join(__dirname, 'lib/.redis.info')}" (\nredis-server --service-stop\n)\ncd "${path.join(__dirname, 'lib')}"\nnode restore.js`);
        }
        if (!fs.existsSync(__dirname + '/lib/startIOB.bat')) {
            fs.writeFileSync(__dirname + '/lib/startIOB.bat', `if exist "${path.join(__dirname, 'lib/.redis.info')}" (\nredis-server --service-start\n)\ncd "${path.join(tools.getIobDir())}"\niobroker host this\ncall iobroker start\nif exist "${path.join(__dirname, 'lib/.startAll')}" (\ncd "${path.join(tools.getIobDir(), 'node_modules/iobroker.js-controller')}"\nnode iobroker.js start all\n)`);
        }
    } else {
        if (!fs.existsSync(__dirname + '/lib/stopIOB.sh')) {
            fs.writeFileSync(__dirname + '/lib/stopIOB.sh', `# iobroker stop for restore\nsudo systemd-run --uid=iobroker bash ${path.join(__dirname, 'lib')}/external.sh`);
            fs.chmodSync(__dirname + '/lib/stopIOB.sh', 508);
        }
        if (!fs.existsSync(__dirname + '/lib/startIOB.sh')) {
            fs.writeFileSync(__dirname + '/lib/startIOB.sh', `# iobroker start after restore\nif [ -f ${path.join(__dirname, 'lib')}/.redis.info ] ; then\nsudo systemctl start redis-server\nfi\niobroker host this\nif [ -f ${path.join(__dirname, 'lib')}\.startAll ] ; then\ncd "${path.join(tools.getIobDir())}"\niobroker start all\nfi\ncd "${path.join(tools.getIobDir())}"\nbash iobroker start`);
            fs.chmodSync(__dirname + '/lib/startIOB.sh', 508);
        }
        if (!fs.existsSync(__dirname + '/lib/external.sh')) {
            fs.writeFileSync(__dirname + '/lib/external.sh', `# restore\nif [ -f ${path.join(__dirname, 'lib')}/.redis.info ] ; then\nsudo systemctl stop redis-server\nfi\ncd "${path.join(tools.getIobDir())}"\nbash iobroker stop;\ncd "${path.join(__dirname, 'lib')}"\nnode restore.js`);
            fs.chmodSync(__dirname + '/lib/external.sh', 508);
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
                let rootUmount = 'umount';
                if (adapter.config.sudoMount === 'true' || adapter.config.sudoMount === true) {
                    rootUmount = 'sudo umount';
                }
                timerUmount1 = setTimeout(() =>
                    child_process.exec(`${rootUmount} ${backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            adapter.log.debug('umount: device is busy... wait 5 Minutes!!');
                            timerUmount2 = setTimeout(() =>
                                child_process.exec(`${rootUmount} ${backupDir}`, (error, stdout, stderr) => {
                                    if (error) {
                                        adapter.log.error(error);
                                    } else {
                                        fs.existsSync(__dirname + '/.mount') && fs.unlinkSync(__dirname + '/.mount');
                                    }
                                }), 300000);
                        } else {
                            fs.existsSync(__dirname + '/.mount') && fs.unlinkSync(__dirname + '/.mount');
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
        fs.mkdirSync(path.join(tools.getIobDir(), 'backups'));
        adapter.log.debug('Created BackupDir');
    }
}
// delete Hide Files after restore
function deleteHideFiles() {
    fs.existsSync(__dirname + '/lib/.redis.info') && fs.unlinkSync(__dirname + '/lib/.redis.info');
}
// delete temp dir after restore
function delTmp() {
    if (fs.existsSync(path.join(tools.getIobDir(), 'backups/tmp'))) {
        fs.rmdirSync(path.join(tools.getIobDir(), 'backups/tmp'));
        adapter.log.debug('delete tmp files');
    } 
}
// set start Options after restore
function setStartAll() {
    if (adapter.config.startAllRestore == true && !fs.existsSync(__dirname + '/lib/.startAll')) {
        fs.writeFileSync(__dirname + '/lib/.startAll', 'Start all Adapter after Restore');
        adapter.log.debug('Start all Adapter after Restore enabled');
    } else if (adapter.config.startAllRestore == false && fs.existsSync(__dirname + '/lib/.startAll')) {
        fs.unlinkSync(__dirname + '/lib/.startAll');
        adapter.log.debug('Start all Adapter after Restore disabled');
    }
}

function getName(name) {
    const parts = name.split('_');
    if (parseInt(parts[0], 10).toString() !== parts[0]) {
        parts.shift();
    }
    return new Date(
        parts[0],
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2].split('-')[0], 10),
        parseInt(parts[2].split('-')[1], 10),
        parseInt(parts[3], 10));
}

function detectLatestBackupFile(adapter) {
    // get all 'storage' types that enabled
    const stores = Object.keys(backupConfig.iobroker)
        .filter(attr =>
            typeof backupConfig.iobroker[attr] === 'object' &&
            backupConfig.iobroker[attr].type === 'storage' &&
            backupConfig.iobroker[attr].enabled);

    // read one time all stores to detect if some backups detected
    const promises = stores.map(storage => new Promise(resolve =>
        list(storage, backupConfig, adapter.log, result => {
            // find newest file
            let file = null;

            if (result && result.data) {
                const data = result.data;
                Object.keys(data).forEach(type => {
                    data[type].iobroker && data[type].iobroker
                        .filter(f => f.size)
                        .forEach(f => {
                            const date = getName(f.name);
                            if (!file || file.date < date) {
                                file = f;
                                file.date = date;
                                file.storage = storage;
                            }
                        });
                });
            }
            resolve(file);
        })));

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
                file.date = file.date.toISOString();
            } else {
                file = null;
            }
            // this information will be used by admin at the first start if some backup was detected and we can restore from it instead of new configuration
            adapter.setState('info.latestBackup', file ? JSON.stringify(file) : '', true);
        });
}
function delOldObjects () {
    adapter.getState('history.minimalSuccess', (err, state) => {
        if (state) {
            adapter.delObject('history.minimalSuccess');
        }
    });
    adapter.getState('history.minimalLastTime', (err, state) => {
        if (state) {
            adapter.delObject('history.minimalLastTime');
        }
    });
    adapter.getState('history.totalLastTime', (err, state) => {
        if (state) {
            adapter.delObject('history.totalLastTime');
        }
    });
    adapter.getState('history.totalSuccess', (err, state) => {
        if (state) {
            adapter.delObject('history.totalSuccess');
        }
    });
    adapter.getState('oneClick.minimal', (err, state) => {
        if (state) {
            adapter.delObject('oneClick.minimal');
        }
    });
    adapter.getState('oneClick.total', (err, state) => {
        if (state) {
            adapter.delObject('oneClick.total');
        }
    });
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

function main(adapter) {
    createBashScripts();
    readLogFile();
    createBackupDir();
    deleteHideFiles();
    delTmp();
    delOldObjects();

    timerMain = setTimeout(function() {
        umount();
        setStartAll();
    }, 10000);

    adapter.getForeignObject('system.config', (err, obj) => {
        systemLang = obj.common.language;
        initConfig((obj && obj.native && obj.native.secret) || 'Zgfr56gFe87jJOM');

        checkStates();

        createBackupSchedule();
        nextBackup(1, true, null);

        detectLatestBackupFile(adapter);
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