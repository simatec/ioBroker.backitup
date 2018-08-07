/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

const tools = require('./lib/tools');
const executeScripts = require('./lib/execute');

const adapter = new utils.Adapter('backitup');

let systemLang = 'de';                                  // system language
const backupConfig = {};
const backupTimeSchedules = [];                         // Array für die Backup Zeiten

function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

// Is executed when a State has changed
adapter.on('stateChange', (id, state) => {
    if ((state.val === true || state.val === 'true') && !state.ack) {

        if (id === adapter.namespace + '.oneClick.minimal' ||
            id === adapter.namespace + '.oneClick.total' ||
            id === adapter.namespace + '.oneClick.ccu') {
            const type = id.split('.').pop();
            const config = JSON.parse(JSON.stringify(backupConfig[type]));
            if (type === 'minimal') {
                config.enabled = true;
            } else
            if (type === 'total') {
                config.enabled = true;
            } else
            if (type === 'ccu') {
                config.enabled = true;
            }
            
            // function will not be copied
            if (config.telegram && config.telegram.enabled) {
                config.telegram.sendTo = adapter.sendTo;
            }
            if (config.history && config.history.enabled) {
                config.history.setState = adapter.setState;
                config.history.getState = adapter.getState;
            }

            executeScripts(adapter, config, err => {
                if (err) {
                    adapter.log.error(`[${type}] ${err}`);
                } else {
                    adapter.log.debug(`[${type}] exec: done`);
                }
                adapter.setState('oneClick.' + type, false, true);
                adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang));
            });
        }
    }
});

adapter.on('ready', main);

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
    adapter.getState('history.minimalLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.minimalLastTime', {val: tools._('No backups yet', systemLang), ack: true});
        }
    });
    adapter.getState('history.totalLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.totalLastTime', {val: tools._('No backups yet', systemLang), ack: true});
        }
    });
    adapter.getState('history.ccuLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.ccuLastTime', {val: tools._('No backups yet', systemLang), ack: true});
        }
    });
    adapter.getState('oneClick.minimal', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('oneClick.minimal', {val: false, ack: true});
        }
    });
    adapter.getState('oneClick.total', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('oneClick.total', {val: false, ack: true});
        }
    });
    adapter.getState('oneClick.ccu', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('oneClick.ccu', {val: false, ack: true});
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

                executeScripts(adapter, backupConfig[type], err => {
                    if (err) {
                        adapter.log.error(`[${type}] ${err}`);
                    } else {
                        adapter.log.debug(`[${type}] exec: done`);
                    }
                    adapter.setState('oneClick.' + type, false, true);
                    adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang));
                });
            });

            adapter.log.debug(`[${type}] ${cron}`);
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

    const mySql = {
        enabled: adapter.config.mySqlEnabled === undefined ? true : adapter.config.mySqlEnabled,
        dbName: adapter.config.mySqlName,              // database name
        user: adapter.config.mySqlUser,                // database user
        pass: adapter.config.mySqlPassword ? decrypt(secret, adapter.config.mySqlPassword) : '',            // database password
        deleteBackupAfter: adapter.config.mySqlDeleteAfter, // delete old backupfiles after x days
        host: adapter.config.mySqlHost,                // database host
        port: adapter.config.mySqlPort,                // database port
        exe: adapter.config.mySqlDumpExe               // path to mysqldump
    };

    const telegram = {
        enabled: adapter.config.telegramEnabled,
        instance: adapter.config.telegramInstance,
        sendTo: adapter.sendTo, // provide sendTo
        systemLang
    };
    
    const history = {
        enabled: true,
        entriesNumber: adapter.config.historyEntriesNumber,
        setState: adapter.setState, // provide setState
        getState: adapter.getState, // provide setState
        systemLang
    };
    
    const ftp = {
        enabled: adapter.config.ftpEnabled,
        host: adapter.config.ftpHost,                       // ftp-host
        dir: (adapter.config.ftpOwnDir === true) ? null : adapter.config.ftpDir, // directory on FTP server
        user: adapter.config.ftpUser,                       // username for FTP Server
        pass: adapter.config.ftpPassword ? decrypt(secret, adapter.config.ftpPassword) : '',  // password for FTP Server
        port: adapter.config.ftpPort || 21                  // FTP port
    };
    
    const dropbox = {
        enabled: adapter.config.dropboxEnabled,
        accessToken: adapter.config.dropboxAccessToken,
    };
    
    const cifs = {
        enabled: adapter.config.cifsEnabled,
        mount: adapter.config.cifsMount,
        dir: (adapter.config.cifsOwnDir === true) ? null : adapter.config.cifsDir,                       // specify if CIFS mount should be used
        user: adapter.config.cifsUser,                     // specify if CIFS mount should be used
        pass: adapter.config.cifsPassword ? decrypt(secret, adapter.config.cifsPassword) : ''  // password for FTP Server
    };

    // Configurations for standart-IoBroker backup
    backupConfig.minimal = {
        name: 'minimal',
        enabled: adapter.config.minimalEnabled,
        time: adapter.config.minimalTime,
        debugging: adapter.config.debugLevel,
        everyXDays: adapter.config.minimalEveryXDays,
        nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
        deleteBackupAfter: adapter.config.minimalDeleteAfter,   // delete old backupfiles after x days

        ftp:  Object.assign({}, ftp,  (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir} : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir}  : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxMinimalDir}  : {}),
        history,
        telegram
    };
    
    // Configurations for CCU / pivCCU / Raspberrymatic backup
    backupConfig.ccu = {
        name: 'ccu',
        enabled: adapter.config.ccuEnabled,
        time: adapter.config.ccuTime,
        debugging: adapter.config.debugLevel,
        everyXDays: adapter.config.ccuEveryXDays,
        nameSuffix: adapter.config.ccuNameSuffix,               // names addition, appended to the file name
        deleteBackupAfter: adapter.config.ccuDeleteAfter,       // delete old backupfiles after x days

        ftp:  Object.assign({}, ftp,  (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsCcuDir} : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.ftpCcuDir}  : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxCcuDir}  : {}),
        history,
        telegram,

        host: adapter.config.ccuHost,                           // IP-address CCU
        user: adapter.config.ccuUser,                           // username CCU
        pass: adapter.config.ccuPassword ? decrypt(secret, adapter.config.ccuPassword) : '',                       // password der CCU
    };

    // Configurations for total-IoBroker backup
    backupConfig.total = {
        name: 'total',
        enabled: adapter.config.totalEnabled,
        time: adapter.config.totalTime,
        debugging: adapter.config.debugLevel,
        everyXDays: adapter.config.totalEveryXDays,
        nameSuffix: adapter.config.totalNameSuffix,             // names addition, appended to the file name

        deleteBackupAfter: adapter.config.totalDeleteAfter,     // delete old backupfiles after x days
        ftp:  Object.assign({}, ftp,  (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.ftpTotalDir}  : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsTotalDir} : {}),
        dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? {dir:  adapter.config.dropboxTotalDir}  : {}),
        history,
        telegram,

        mySql,
        dir: tools.getIobDir(),
        redis: {
            enabled: adapter.config.redisEnabled,
            path: adapter.config.redisPath || '/var/lib/redis/dump.rdb', // specify Redis path
        },
        stopIoB: adapter.config.totalStopIoB,                   // specify if ioBroker should be stopped/started
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
                    if (line.startsWith('[DEBUG] [total/total] Packed ')) return;

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

            // make an messaging
            const config = require(__dirname + '/lib/total.json');
            config.afterBackup = true;
            executeScripts(adapter, config, () => {

            });
        }
    } catch (e) {
        adapter.log.warn(`Cannot read log file: ${e}`);
    }
}

function createBashScripts() {
    const isWin = process.platform.startsWith('win');

    let jsPath;
    try {
        jsPath = require.resolve('iobroker.js-controller/iobroker.bat');
        jsPath = jsPath.replace(/\\/g, '/');
        const parts = jsPath.split('/');
        parts.pop();
        jsPath = parts.join('/');
    } catch (e) {
        jsPath = path.join(tools.getIobDir(), 'node_modules/iobroker.js-controller');
    }

    if (isWin) {
        // todo detect service
        if (!fs.existsSync(__dirname + '/lib/stopIOB.bat')) {
            fs.writeFileSync(__dirname + '/lib/stopIOB.bat', `cd "${jsPath}"\ncall iobroker.bat stop\ncd "${path.join(__dirname, 'lib')}"\nnode execute.js`);
        }
        if (!fs.existsSync(__dirname + '/lib/startIOB.bat')) {
            fs.writeFileSync(__dirname + '/lib/startIOB.bat', `cd "${jsPath}"\ncall iobroker.bat start\n`);
        }
    } else {
        // todo detect pm2 or systemd
        if (!fs.existsSync(__dirname + '/lib/stopIOB.sh')) {
            fs.writeFileSync(__dirname + '/lib/stopIOB.sh', `cd "${jsPath}"\n./iobroker.sh stop\ncd "${path.join(__dirname, 'lib')}"\nnode execute.js`);
            fs.chmodSync(__dirname + '/lib/stopIOB.sh', 508);
        }
        if (!fs.existsSync(__dirname + '/lib/startIOB.sh')) {
            fs.writeFileSync(__dirname + '/lib/startIOB.sh', `cd "${jsPath}"\n./iobroker.sh start\n`);
            fs.chmodSync(__dirname + '/lib/startIOB.sh', 508);
        }
    }
}

function main() {
    createBashScripts();
    readLogFile();

    adapter.getForeignObject('system.config', (err, obj) => {
        systemLang = obj.common.language;
        initConfig((obj && obj.native && obj.native.secret) || 'Zgfr56gFe87jJOM');

        checkStates();

        createBackupSchedule();
    });

    // subscribe on all variables of this adapter instance with pattern "adapterName.X.memory*"
    adapter.subscribeStates('oneClick.*');
}