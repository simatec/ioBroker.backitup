/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const {exec} = require('child_process');
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
const mySqlConfig = {};
const bashScript = `bash ${__dirname}/backitup.sh `;    // Pfad zu backup.sh Datei
const iobDir = getIobDir();

/**
 * looks for iobroker home folder
 *
 * @returns {string}
 */
function getIobDir() {
    /** @type {string} */
    let sPath = __dirname.replace(/\\/g, '/');
    const parts = sPath.split('/');
    parts.pop(); // ioBroker.backitup
    sPath = parts.join('/');
    if (fs.existsSync(path.join(sPath, 'node_modules'))) {
        return sPath;
    }
    parts.pop(); // node_modules
    sPath = parts.join('/');
    if (fs.existsSync(path.join(sPath, 'node_modules'))) {
        return sPath;
    }

    return '/opt/' + utils.appName;
}


function _(word) {
    if (words[word]) {
        return words[word][systemLang] || words[word].en;
    } else {
        adapter.log.warn('Please translate ind words.js: ' + word);
        return word;
    }
}
// Is executed when a State has changed
adapter.on('stateChange', (id, state) => {
    if ((state.val === true || state.val === 'true') && !state.ack) {
        if (id === adapter.namespace + '.oneClick.minimal') {
            startBackup('minimal');
        }
        if (id === adapter.namespace + '.oneClick.total') {
            startBackup('total');
        }
        if (id === adapter.namespace + '.oneClick.ccu') {
            startBackup('ccu');
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
                adapter.log.info(`[${type}] backup was activated at ${config.time} every ${config.everyXDays} days`);
            }

            if (backupTimeSchedules[type]) {
                schedule.clearScheduleJob(backupTimeSchedules[type]);
            }
            const cron = '10 ' + time[1] + ' ' + time[0] + ' */' + config.everyXDays + ' * * ';
            backupTimeSchedules[type] = schedule.scheduleJob(cron, () => {
                createBackup(type).then(text => {
                    adapter.log.debug('exec: ' + text);
                }).catch(err => {
                    adapter.log.error(err);
                })
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

// function to create the Backupfile         
function createBackup(type) {
    return new Promise((resolve, reject) => {
        const command = bashScript + ' "' +
            (type                                   || '') + '|' +  // 0
            (backupConfig[type].nameSuffix          || '') + '|' +  // 1
            (backupConfig[type].deleteBackupAfter   || '') + '|' +  // 2
            (backupConfig[type].ftp.host            || '') + '|' +  // 3
            (backupConfig[type].ftp.dir             || '') + '|' +  // 4
            (backupConfig[type].ftp.user            || '') + '|' +  // 5
            (backupConfig[type].ftp.pass            || '') + '|' +  // 6
            (backupConfig[type].host                || '') + '|' +  // 7
            (backupConfig[type].user                || '') + '|' +  // 8
            (backupConfig[type].pass                || '') + '|' +  // 9
            (backupConfig[type].cifs.mount          || '') + '|' +  // 10
            (backupConfig[type].stopIoB             || 'false') + '|' +  // 11
            (backupConfig[type].backupRedis         || 'false') + '|' +  // 12
            (mySqlConfig.dbName                     || '') + '|' +  // 13
            (mySqlConfig.user                       || '') + '|' +  // 14
            (mySqlConfig.pass                       || '') + '|' +  // 15
            (mySqlConfig.deleteBackupAfter          || '') + '|' +  // 16
            (mySqlConfig.host                       || '') + '|' +  // 17
            (mySqlConfig.port                       || '') + '|' +  // 18
            (iobDir                                 || '') +        // 19
            '"';

        if (debugging) {
            adapter.log.info(`[${type}] ${command}`);
        }

        // Telegram Message versenden
        if (debugging) {
            if (adapter.config.telegramInstance !== '') {
                adapter.log.debug(`[${type}] used Telegram-Instance: ${adapter.config.telegramInstance}`);
            } else {
                adapter.log.debug(`[${type}] no Telegram-Instance selected!`);
            }
        }

        const time = getTimeString();

        if (adapter.config.telegramEnabled === true && adapter.config.telegramInstance !== '') {
            adapter.log.debug(`[${type}] Telegram Message enabled`);

            let messageText = _('Es wurde am %t ein neues %e Backup erstellt');
            messageText = messageText.replace('%t', time).replace('%e', type);
            if (backupConfig[type].host !== '') {
                if (backupConfig[type].cifs.mount === 'FTP') {
                    const m = _(', und via FTP nach %h%d kopiert/verschoben');
                    messageText += m.replace('%h', backupConfig[type].ftp.host).replace('%d', backupConfig[type].ftp.dir);
                } else
                if (backupConfig[type].cifs.mount === 'CIFS') {
                    const m = _(', und unter %h%d gespeichert');
                    messageText += m.replace('%h', backupConfig[type].ftp.host).replace('%d', backupConfig[type].ftp.dir);
                }
            }
            messageText += '!';
            adapter.sendTo(adapter.config.telegramInstance, 'send', {text: 'BackItUp:\n' + messageText});
        }

        adapter.setState(`history.${type}LastTime`, time);

        createBackupHistory(type);

        exec(command, (err, stdout, stderr) => {
            if (logging) {
                if (err) {
                    reject(stderr);
                } else {
                    resolve('exec: ' + stdout);
                }
            }
        });
    });
}


// function to create a date string                               #
const MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
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
function createBackupHistory(type) {
    adapter.getState('history.html', (err, state) => {
        let historyList = state.val;
        if (historyList === '<span class="backup-type-total">' + _('Noch keine Backups erstellt') + '</span>') {
            historyList = '';
        }
        historyArray = historyList.split('&nbsp;');
        if (historyArray.length >= historyEntriesNumber) {
            historyArray.splice((historyEntriesNumber - 1), 1);
        }
        let timeStamp = getTimeString();
        let historyText;
        if (backupConfig[type].ftp.host !== '') {
            if (backupConfig[type].cifs.mount === 'FTP') {
                historyText = `<span class="backup-type-${type}">${timeStamp} - ${_('Typ')}: ${type} - ${_('FTP-Sicherung: JA')}</span>`;
            } else
            if (backupConfig[type].cifs.mount === 'CIFS') {
                historyText = `<span class="backup-type-${type}">${timeStamp} - ${_('Typ')}: ${type} - ${_('CIFS-Mount: JA')}</span>`;
            }
        } else {
            historyText = `<span class="backup-type-${type}">${timeStamp} - ${_('Typ')}: ${type} - ${_('Nur lokal gesichert')}</span>`;
        }
        historyArray.unshift(historyText);

        adapter.setState('history.html', historyArray.join('&nbsp;'));
    });
}


// watching the three One-Click-Backup data points, if activated - start backup

function startBackup(type) {
    adapter.log.info(`[${type}] oneClick backup started`);
    createBackup(type).then(text => {
        adapter.log.debug('exec: ' + text);
    }).catch(e => {
        adapter.log.error(e);
    }).then(() => {
        adapter.setState('oneClick.' + type, false, true);
    });
}

function initVariables() {
    // general variables
    logging = adapter.config.logEnabled;                                                 // Logging on/off
    debugging = adapter.config.debugLevel;										         // Detailiertere Loggings
    historyEntriesNumber = adapter.config.historyEntriesNumber;                          // Anzahl der Einträge in der History

    // konfigurations for standart-IoBroker backup
    backupConfig.minimal = {
        enabled: adapter.config.minimalEnabled,
        time: adapter.config.minimalTime,
        everyXDays: adapter.config.minimalEveryXDays,
        nameSuffix: adapter.config.minimalNameSuffix,           // names addition, appended to the file name
        deleteBackupAfter: adapter.config.minimalDeleteAfter,   // delete old backupfiles after x days
        ftp: {
            host: adapter.config.ftpHost,                       // ftp-host
            dir: (adapter.config.ownDir === true) ? adapter.config.minimalFtpDir : adapter.config.ftpDir, // directory on FTP server
            user: adapter.config.ftpUser,                       // username for FTP Server 
            pass: adapter.config.ftpPassword                    // password for FTP Server
        },
        cifs: {
            mount: adapter.config.cifsMount                     // specify if CIFS mount should be used
        }
    };

    // konfigurations for total-IoBroker backup
    backupConfig.total = {
        enabled: adapter.config.totalEnabled,
        time: adapter.config.totalTime,
        everyXDays: adapter.config.totalEveryXDays,
        nameSuffix: adapter.config.totalNameSuffix,             // names addition, appended to the file name
        deleteBackupAfter: adapter.config.totalDeleteAfter,     // delete old backupfiles after x days
        backupRedis: adapter.config.backupRedis,                // specify if Redis-DB should be backuped
        stopIoB: adapter.config.totalStopIoB,                    // specify if ioBroker should be stopped/started 
        ftp: {
            host: adapter.config.ftpHost,                       // ftp-host
            dir: (adapter.config.ownDir === true) ? adapter.config.totalFtpDir : adapter.config.ftpDir, // directory on FTP server
            user: adapter.config.ftpUser,                       // username for FTP Server
            pass: adapter.config.ftpPassword                    // password for FTP Server
        },
        cifs: {
            mount: adapter.config.cifsMount                     // specify if CIFS mount should be used
        },
    };

    // konfigurations for CCU / pivCCU / Raspberrymatic backup
    backupConfig.ccu = {
        enabled: adapter.config.ccuEnabled,
        time: adapter.config.ccuTime,
        everyXDays: adapter.config.ccuEveryXDays,
        nameSuffix: adapter.config.ccuNameSuffix,               // names addition, appended to the file name
        deleteBackupAfter: adapter.config.ccuDeleteAfter,       // delete old backupfiles after x days
        host: adapter.config.ccuHost,                           // IP-address CCU
        user: adapter.config.ccuUser,                           // username CCU
        pass: adapter.config.ccuPassword,                       // password der CCU
        ftp: {
            host: adapter.config.ftpHost,                       // ftp-host
            dir: (adapter.config.ownDir === true) ? adapter.config.ccuFtpDir : adapter.config.ftpDir, // directory on FTP server
            user: adapter.config.ftpUser,                       // username for FTP Server
            pass: adapter.config.ftpPassword                    // password for FTP Server
        },
        cifs: {
            mount: adapter.config.cifsMount                     // specify if CIFS mount should be used
        }
    };

    mySqlConfig.enabled = adapter.config.mySqlEnabled === undefined ? true : adapter.config.mySqlEnabled;
    if (mySqlConfig.enabled) {
        mySqlConfig.dbName = adapter.config.mySqlName;              // database name
        mySqlConfig.user = adapter.config.mySqlName;                // database user
        mySqlConfig.pass = adapter.config.mySqlPassword;            // database password
        mySqlConfig.deleteBackupAfter = adapter.config.mySqlDeleteAfter; // delete old backupfiles after x days
        mySqlConfig.host = adapter.config.mySqlHost;                // database host
        mySqlConfig.port = adapter.config.mySqlPort;                // database port
    }
}

function main() {
    adapter.getForeignObject('system.config', (err, obj) => {
        systemLang = obj.common.language;
        initVariables();

        checkStates();

        createBackupSchedule();
    });

    // subscribe on all variables of this adapter instance with pattern "adapterName.X.memory*"
    adapter.subscribeStates('oneClick.*');
}