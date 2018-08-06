/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const schedule = require('node-schedule');
const words = require('./admin/words');
const path = require('path');
const fs = require('fs');

const adapter = new utils.Adapter('backitup');

let systemLang = 'de';                                  // system language
let logging;                                            // Logging on/off
let debugging;										    // Detailiertere Loggings
let historyEntriesNumber;                               // Anzahl der Einträge in der History
const backupConfig = {};
const backupTimeSchedules = [];                         // Array für die Backup Zeiten
let historyArray = [];                                  // Array für das anlegen der Backup-Historie

/**
 * looks for iobroker home folder
 *
 * @returns {string}
 */
function getIobDir() {
    const utils = require('./lib/utils');
    const tools = require(utils.controllerDir + '/lib/tools.js');
    let backupDir = tools.getConfigFileName().replace(/\\/g, '/');
    let parts = backupDir.split('/');
    parts.pop(); // iobroker.json
    parts.pop(); // iobroker-data.json
    return parts.join('/');
}

function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function _(word) {
    if (words[word]) {
        return words[word][systemLang] || words[word].en;
    } else {
        adapter.log.warn('Please translate in words.js: ' + word);
        return word;
    }
}

// Is executed when a State has changed
adapter.on('stateChange', (id, state) => {
    if ((state.val === true || state.val === 'true') && !state.ack) {

        if (id === adapter.namespace + '.oneClick.minimal' ||
            id === adapter.namespace + '.oneClick.total' ||
            id === adapter.namespace + '.oneClick.ccu') {
            const type = id.split('.').pop();
            if (type === 'minimal') {
                backupConfig[type].enabled = true;
            }
            if (type === 'total') {
                backupConfig[type].enabled = true;
            }
            if (type === 'ccu') {
                backupConfig[type].enabled = true;
            }
            executeScripts(backupConfig[type], err => {
                if (err) {
                    adapter.log.error(`[${type}] ${err}`);
                } else {
                    adapter.log.debug(`[${type}] exec: done`);
                }
                adapter.setState('oneClick.' + type, false, true);
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
                val: '<span class="backup-type-total">' + _('No backups yet') + '</span>',
                ack: true
            });
        }
    });
    adapter.getState('history.minimalLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.minimalLastTime', {val: _('No backups yet'), ack: true});
        }
    });
    adapter.getState('history.totalLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.totalLastTime', {val: _('No backups yet'), ack: true});
        }
    });
    adapter.getState('history.ccuLastTime', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.ccuLastTime', {val: _('No backups yet'), ack: true});
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

            if (logging) {
                adapter.log.info(`[${type}] backup was activated at ${config.time} every ${config.everyXDays} day(s)`);
            }

            if (backupTimeSchedules[type]) {
                schedule.clearScheduleJob(backupTimeSchedules[type]);
            }
            const cron = '10 ' + time[1] + ' ' + time[0] + ' */' + config.everyXDays + ' * * ';
            backupTimeSchedules[type] = schedule.scheduleJob(cron, () => {
                adapter.setState('oneClick.' + type, true, true);

                executeScripts(backupConfig[type], err => {
                    if (err) {
                        adapter.log.error(`[${type}] ${err}`);
                    } else {
                        adapter.log.debug(`[${type}] exec: done`);
                    }
                    adapter.setState('oneClick.' + type, false, true);
                });
            });

            if (debugging) {
                adapter.log.debug(`[${type}] ${cron}`);
            }
        } else if (backupTimeSchedules[type]) {
            if (logging) {
                adapter.log.info(`[${type}] backup deactivated`);
            }
            schedule.clearScheduleJob(backupTimeSchedules[type]);
            backupTimeSchedules[type] = null;
        }
    }
}

// function to create a date string                               #
const MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    ru: ['январь',  'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    es: ['enero',   'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    pl: ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'],
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};
const timePattern = {
    en: '%d at %t Hours',
    de: '%d um %t Uhr',
    ru: '%d в %t'
};

function padding0(number) {
    return (number < 10) ? '0' + number : number;
}
function getTimeString(date) {
    date = date || new Date();

    let day = date.getDate();
    let monthIndex = date.getMonth();
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes();

    return (timePattern[systemLang] || timePattern.en)
        .replace('%d', padding0(day)   + ' ' + (MONTHS[systemLang] || MONTHS.en)[monthIndex] + ' ' + year)
        .replace('%t', padding0(hours) + ':' + padding0(minutes));
}

// function for entering the backup execution in the history-log
function createBackupHistory(config) {
    adapter.getState('history.html', (err, state) => {
        let historyList = state.val;
        if (historyList === '<span class="backup-type-total">' + _('No backups yet') + '</span>') {
            historyList = '';
        }
        historyArray = historyList.split('&nbsp;');
        let timeStamp = getTimeString();
        let doneSomething = false;
        if (config.cifs.enabled) {
            historyArray.unshift(`<span class="backup-type-${config.name}">${timeStamp} - ${_('Type')}: ${config.name} - ${_('FTP-Backup: Yes')}</span>`);
            doneSomething = true;
        }
        if (config.cifs.enabled) {
            historyArray.unshift(`<span class="backup-type-${config.name}">${timeStamp} - ${_('Type')}: ${config.name} - ${_('CIFS-Mount: Yes')}</span>`);
            doneSomething = true;
        }
        if (!doneSomething) {
            historyArray.unshift(`<span class="backup-type-${config.name}">${timeStamp} - ${_('Type')}: ${config.name} - ${_('Only stored locally')}</span>`);
        }

        if (historyArray.length > historyEntriesNumber) {
            // todo: test it!
            historyArray.splice(historyEntriesNumber, historyArray.length - historyEntriesNumber);
        }

        adapter.setState('history.html', historyArray.join('&nbsp;'));
    });
}

function initVariables(secret) {
    // general variables
    logging = adapter.config.logEnabled;                                                 // Logging on/off
    debugging = adapter.config.debugLevel;										         // Detailiertere Loggings
    historyEntriesNumber = adapter.config.historyEntriesNumber;                          // Anzahl der Einträge in der History

    if (adapter.config.cifsMount === 'CIFS') {
        adapter.config.cifsMount = '';
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
        _: _,
        debugging
    };

    const ftp = {
        enabled: adapter.config.ftpEnabled,
        host: adapter.config.ftpHost,                       // ftp-host
        dir: (adapter.config.ftpOwnDir === true) ? null : adapter.config.ftpDir, // directory on FTP server
        user: adapter.config.ftpUser,                       // username for FTP Server
        pass: adapter.config.ftpPassword ? decrypt(secret, adapter.config.ftpPassword) : '',  // password for FTP Server
        port: adapter.config.ftpPort || 21                  // FTP port
    };

    const cifs = {
        enabled: adapter.config.cifsEnabled,
        mount: adapter.config.cifsMount,
        dir: (adapter.config.cifsOwnDir === true) ? null : adapter.config.cifsDir,                       // specify if CIFS mount should be used
        user: adapter.config.cifsUser,                     // specify if CIFS mount should be used
        pass: adapter.config.cifsPassword ? decrypt(secret, adapter.config.cifsPassword) : ''  // password for FTP Server
    };

    // konfigurations for standart-IoBroker backup
    backupConfig.minimal = {
        name: 'minimal',
        enabled: adapter.config.minimalEnabled,
        time: adapter.config.minimalTime,
        everyXDays: adapter.config.minimalEveryXDays,
        nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
        deleteBackupAfter: adapter.config.minimalDeleteAfter,   // delete old backupfiles after x days
        ftp:  Object.assign({}, ftp,  (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsMinimalDir} : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.ftpMinimalDir}  : {}),
        telegram
    };

    if (adapter.config.redisEnabled === undefined) {
        adapter.config.redisEnabled = adapter.config.backupRedis
    }

    // konfigurations for CCU / pivCCU / Raspberrymatic backup
    backupConfig.ccu = {
        name: 'ccu',
        enabled: adapter.config.ccuEnabled,
        time: adapter.config.ccuTime,
        everyXDays: adapter.config.ccuEveryXDays,
        nameSuffix: adapter.config.ccuNameSuffix,               // names addition, appended to the file name
        deleteBackupAfter: adapter.config.ccuDeleteAfter,       // delete old backupfiles after x days
        host: adapter.config.ccuHost,                           // IP-address CCU
        user: adapter.config.ccuUser,                           // username CCU
        pass: adapter.config.ccuPassword ? decrypt(secret, adapter.config.ccuPassword) : '',                       // password der CCU
        ftp:  Object.assign({}, ftp,  (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsCcuDir} : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.ftpCcuDir}  : {}),
        telegram
     };

    // Configurations for total-IoBroker backup
    backupConfig.total = {
        name: 'total',
        dir: getIobDir(),
        enabled: adapter.config.totalEnabled,
        time: adapter.config.totalTime,
        everyXDays: adapter.config.totalEveryXDays,
        nameSuffix: adapter.config.totalNameSuffix,             // names addition, appended to the file name
        deleteBackupAfter: adapter.config.totalDeleteAfter,     // delete old backupfiles after x days
        redis: {
            enabled: adapter.config.redisEnabled,
            path: adapter.config.redisPath || '/var/lib/redis/dump.rdb', // specify Redis path
        },
        stopIoB: adapter.config.totalStopIoB,                   // specify if ioBroker should be stopped/started
        ftp:  Object.assign({}, ftp,  (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.ftpTotalDir}  : {}),
        cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? {dir:  adapter.config.cifsTotalDir} : {}),
        mySql,
        telegram
    };
}

function readLogFile(type) {
    try {
        const logName = __dirname + '/' + type + '.txt';
        if (fs.existsSync(logName)) {
            adapter.log.debug(`[${type}] Printing logs of previous backup`);
            const text = fs.readFileSync(logName).toString();
            const lines = text.split('\n');
            lines.forEach((line, i) => lines[i] = line.replace(/\r$|^\r/, ''));
            lines.forEach(line => {
                if (line.trim()) {
                    adapter.setState('output.line', '[DEBUG] ' + line);
                    adapter.log.debug(`[${type}] ${line}`);
                }
            });
            adapter.setState('output.line', '[EXIT] 0');
            fs.unlinkSync(logName);
        }
    } catch (e) {
        adapter.log.warn(`[${type}] Cannot read log file: ${e}`);
    }
}

function createBashLogger() {
    if (!fs.existsSync(__dirname + '/backitupl.sh')) {
        let text = '#!/bin/bash\n' +
            '\n' +
            'STRING=$1\n' +
            'IFS="|"\n' +
            'VAR=($STRING)\n' +
            '\n' +
            'BACKUP_TYPE=${VAR[0]}\n' +
            '\n' +
            __dirname + '/backitup.sh "$1" > "' + __dirname + '/${BACKUP_TYPE}.txt"';
        fs.writeFileSync(__dirname + '/backitupl.sh', text, {mode: 508}); // 508 => 0774
    }
    fs.chmodSync(__dirname + '/backitup.sh', 508);
}

function loadScripts() {
    const scripts = {};
    const files = fs.readdirSync(__dirname + '/lib/scripts');
    files.forEach(file => {
        scripts[file.substring(3, file.length - 3)] = require('./lib/scripts/' + file);
    });
    return scripts;
}

function executeScripts(config, callback, scripts, code) {
    if (!scripts) {
        scripts = loadScripts();
        config.backupDir = path.join(getIobDir(), 'backups').replace(/\\/g, '/');
        config.context = {}; // common variables between scripts

        if (!fs.existsSync(config.backupDir)) {
            fs.mkdirSync(config.backupDir);
        }

        adapter.setState(`history.${config.name}LastTime`, getTimeString());

        createBackupHistory(config.name);
    }

    adapter.getForeignObject('system.config', (err, obj) => {
        systemLang = obj.common.language;
        initVariables((obj && obj.native && obj.native.secret) || 'Zgfr56gFe87jJOM');
    });

    for (const name in scripts) {
        if (scripts.hasOwnProperty(name) && scripts[name]) {
            let func;
            let options;
            switch (name) {
                case 'mount':
                case 'umount':
                    if (config.cifs && config.cifs.enabled && config.cifs.mount) {
                        func = scripts[name];
                        options = config.cifs;
                    }
                    break;

                case 'cifs':
                    if (config.cifs && config.cifs.enabled && config.cifs.dir) {
                        func = scripts[name];
                        options = config.cifs;
                    }
                    break;


                case 'minimal':
                    if (config.name === 'minimal') {
                        func = scripts[name];
                        options = config;
                    }
                    break;

                case 'mysql':
                    if (config.name === 'total' && config.mysql && config.mysql.enabled) {
                        func = scripts[name];
                        options = config.mysql;
                    }
                    break;

                case 'redis':
                    if (config.name === 'total' && config.redis && config.redis.enabled) {
                        func = scripts[name];
                        options = config.redis;
                    }
                    break;

                case 'ccu':
                    if (config.name === 'ccu' && config.enabled) {
                        func = scripts[name];
                        options = config;
                    }
                    break;

                case 'total':
                    if (config.name === 'total' && config.enabled) {
                        func = scripts[name];
                        options = config;
                    }
                    break;

                case 'clean':
                    if (config.deleteBackupAfter) {
                        func = scripts[name];
                        options = {deleteBackupAfter: config.deleteBackupAfter, name: config.name};
                    }
                    break;

                case 'ftp':
                    if (config.ftp && config.ftp.enabled && config.ftp.host) {
                        func = scripts[name];
                        options = Object.assign({}, config.ftp, {name: config.name});
                    }
                    break;

                case 'telegram':
                    if (config.telegram && config.telegram.enabled) {
                        func = scripts[name];
                        options = config;
                        options.telegram.time = getTimeString(); // provide name
                    }
                    break;
            }
            scripts[name] = null;

            if (func) {
                const _options = JSON.parse(JSON.stringify(options));
                if (_options.pass) _options.pass = '****';
                if (_options.ftp  && !_options.ftp.enabled) delete _options.ftp;
                if (_options.ftp  && _options.ftp.backupDir !== undefined) delete _options.ftp.backupDir;
                if (_options.cifs  && _options.cifs.backupDir !== undefined) delete _options.cifs.backupDir;
                if (_options.mySql  && _options.mySql.backupDir !== undefined) delete _options.mySql.backupDir;
                if (_options.redis  && _options.redis.backupDir !== undefined) delete _options.redis.backupDir;
                if (_options.cifs  && !_options.cifs.enabled) delete _options.cifs;
                if (_options.mySql && !_options.mySql.enabled) delete _options.mySql;
                if (!_options.nameSuffix && _options.nameSuffix !== undefined) delete _options.nameSuffix;
                if (_options.enabled !== undefined) delete _options.enabled;
                if (_options.context !== undefined) delete _options.context;
                if (_options.name !== undefined) delete _options.name;

                if (_options.ftp  && _options.ftp.pass) _options.ftp.pass = '****';
                if (_options.cifs && _options.cifs.pass) _options.cifs.pass = '****';
                if (_options.mySql && _options.mySql.pass) _options.mySql.pass = '****';

                adapter.setState('output.line', `[DEBUG] [${name}] start with ${JSON.stringify(_options)}`);

                options.context = config.context;
                options.backupDir = config.backupDir;

                const log = {
                    debug: function (text) {
                        const lines = text.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter.log.debug(`[${config.name}/${name}] ${line}`);
                        });
                        adapter.setState('output.line', '[DEBUG] [' + name + '] - ' + text);
                    },
                    error: function (err) {
                        const lines = err.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter.log.debug(`[${config.name}/${name}] ${line}`);
                        });
                        adapter.setState('output.line', '[ERROR] [' + name + '] - ' + err);
                    }
                };

                func.command(options, log, (err, output, _code) => {
                    if (_code !== undefined) {
                        code = _code
                    }
                    if (err) {
                        if (func.ignoreErrors) {
                            log.error('[IGNORED] ' + err);
                            setImmediate(executeScripts, config, callback, scripts, code);
                        } else {
                            log.error(err);
                            callback && callback(err);
                        }
                    } else {
                        log.debug(output || 'done');
                        setImmediate(executeScripts, config, callback, scripts, code);
                    }
                });
            } else {
                setImmediate(executeScripts, config, callback, scripts, code);
            }
            return;
        }
    }

    // todo
    // delete all local files if required from config.context.fileNames
    // or delete all files from past backups

    adapter.setState('output.line', '[EXIT] ' + (code || 0));
    callback && callback();
}

function main() {
    createBashLogger();
    readLogFile('ccu');
    readLogFile('minimal');
    readLogFile('total');

    adapter.getForeignObject('system.config', (err, obj) => {
        systemLang = obj.common.language;
        initVariables((obj && obj.native && obj.native.secret) || 'Zgfr56gFe87jJOM');

        checkStates();

        createBackupSchedule();
    });

    // subscribe on all variables of this adapter instance with pattern "adapterName.X.memory*"
    adapter.subscribeStates('oneClick.*');
}