/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const {exec} = require('child_process');
const schedule = require('node-schedule');
const words = require('./admin/words');

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

function _(word) {
    if (words[word]) {
        return words[word][systemLang] || words[word].en;
    } else {
        adapter.log.warn('Please translate ind words.js: ' + word);
        return word;
    }
}
// Wird ausgefürt wenn sich ein State ändert
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
    // Leere Datenpunkte mit Standardwerten befüllen.
    adapter.getState('history.html', (err, state) => {
        if (!state || state.val === null) {
            adapter.setState('history.html', {
                // TODO translate
                val: '<span class="backup-type-total">' + _('Noch keine Backups erstellt') + '</span>',
                ack: true
            });
        }
    });
    adapter.getState('history.minimalLastTime', (err, state) => {
        if (!state || state.val === null) {
            // TODO translate
            adapter.setState('history.minimalLastTime', {val: _('Noch keine Backups erstellt'), ack: true});
        }
    });
    adapter.getState('history.totalLastTime', (err, state) => {
        if (!state || state.val === null) {
            // TODO translate
            adapter.setState('history.totalLastTime', {val: _('Noch keine Backups erstellt'), ack: true});
        }
    });
    adapter.getState('history.ccuLastTime', (err, state) => {
        if (!state || state.val === null) {
            // TODO translate
            adapter.setState('history.ccuLastTime', {val: _('Noch keine Backups erstellt'), ack: true});
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
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$

// #############################################################################
// #                                                                           #
// #  Funktion zum anlegen eines Schedules fuer Backupzeit                     #
// #                                                                           #
// #############################################################################

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

function listAttributes(obj, result, prefix) {
    result = result || [];
    prefix = prefix || '';
    for (const attr in obj) {
        if (obj.hasOwnProperty(attr)) {
            if (typeof obj[attr] === 'object') {
                listAttributes(obj[attr], result, prefix + attr + '.');
            } else {
                result.push(`${prefix + attr}=${obj[attr]}`);
            }
        }
    }
    return result;
}
// #############################################################################
// #                                                                           #
// #  Funktion zum Ausführen des Backups mit obigen Einstellungen              #
// #                                                                           #
// #############################################################################
function createBackup(type) {
    return new Promise((resolve, reject) => {
        const command = bashScript + ' "' +
            (type                                   || '') + '|' +
            (backupConfig[type].nameSuffix          || '') + '|' +
            (backupConfig[type].deleteBackupAfter   || '') + '|' +
            (backupConfig[type].ftp.host            || '') + '|' +
            (backupConfig[type].ftp.dir             || '') + '|' +
            (backupConfig[type].ftp.user            || '') + '|' +
            (backupConfig[type].ftp.pass            || '') + '|' +
            (backupConfig[type].ccu.host            || '') + '|' +
            (backupConfig[type].ccu.user            || '') + '|' +
            (backupConfig[type].ccu.pass            || '') + '|' +
            (backupConfig[type].cifs.mount          || '') + '|' +
            (backupConfig[type].stopIoB             || '') + '|' +
            (backupConfig[type].backupRedis         || '') + '|' +
            (mySqlConfig.dbName                     || '') + '|' +
            (mySqlConfig.user                       || '') + '|' +
            (mySqlConfig.pass                       || '') + '|' +
            (mySqlConfig.deleteBackupAfter          || '') + '|' +
            (mySqlConfig.host                       || '') + '|' +
            (mySqlConfig.port                       || '') +
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

// #############################################################################
// #                                                                           #
// #  Funktion zum erstellen eines Datum-Strings                               #
// #                                                                           #
// #############################################################################
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

// #############################################################################
// #                                                                           #
// #  Backupdurchführung in History eintragen                                  #
// #                                                                           #
// #############################################################################

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


// #############################################################################
// #                                                                           #
// #  Beobachten der drei One-Click-Backup Datenpunkte                         #
// #  - Bei Aktivierung start des jeweiligen Backups                           #
// #                                                                           #
// #############################################################################

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
    // -----------------------------------------------------------------------------
    // allgemeine Variablen
    // -----------------------------------------------------------------------------
    logging = adapter.config.logEnabled;                                                 // Logging on/off
    debugging = adapter.config.debugLevel;										         // Detailiertere Loggings
    historyEntriesNumber = adapter.config.historyEntriesNumber;                          // Anzahl der Einträge in der History

    // Konfigurationen für das Standard-IoBroker Backup
    backupConfig.minimal = {
        enabled: adapter.config.minimalEnabled,
        time: adapter.config.minimalTime,
        everyXDays: adapter.config.minimalEveryXDays,
        nameSuffix: adapter.config.minimalNameSuffix,   // Names Zusatz, wird an den Dateinamen angehängt
        deleteBackupAfter: adapter.config.minimalDeleteAfter,// Alte Backups löschen nach X Tagen
        ftp: {
            host: adapter.config.ftpHost,               // FTP-Host
            // genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server
            dir: (adapter.config.ownDir === true) ? adapter.config.minimalFtpDir : adapter.config.ftpDir,
            user: adapter.config.ftpUser,               // Username für FTP Server - Verbindung
            pass: adapter.config.ftpPassword            // Passwort für FTP Server - Verbindung
        },
        cifs: {
            mount: adapter.config.cifsMount             // Festlegen ob CIFS-Mount genutzt werden soll
        }
    };

    // Konfigurationen für das Komplette-IoBroker Backup
    backupConfig.total = {
        enabled: adapter.config.totalEnabled,
        time: adapter.config.totalTime,
        everyXDays: adapter.config.totalEveryXDays,
        nameSuffix: adapter.config.totalNameSuffix,   // Names Zusatz, wird an den Dateinamen angehängt
        deleteBackupAfter: adapter.config.totalDeleteAfter,// Alte Backups löschen nach X Tagen
        ftp: {
            host: adapter.config.ftpHost,               // FTP-Host
            // genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server
            dir: (adapter.config.ownDir === true) ? adapter.config.totalFtpDir : adapter.config.ftpDir,
            user: adapter.config.ftpUser,               // Username für FTP Server - Verbindung
            pass: adapter.config.ftpPassword            // Passwort für FTP Server - Verbindung
        },
        cifs: {
            mount: adapter.config.cifsMount             // Festlegen ob CIFS-Mount genutzt werden soll
        },
        backupRedis: adapter.config.backupRedis,        // Festlegen ob die Redis-DB mit gesichert werden soll
        stopIoB: adapter.config.totalStopIoB                 // Festlegen ob IoBroker gestoppt/gestartet wird
    };

    // Konfiguration für das CCU / pivCCU / Raspberrymatic Backup
    backupConfig.ccu = {
        enabled: adapter.config.ccuEnabled,
        time: adapter.config.ccuTime,
        everyXDays: adapter.config.ccuEveryXDays,
        nameSuffix: adapter.config.ccuNameSuffix,   // Names Zusatz, wird an den Dateinamen angehängt
        deleteBackupAfter: adapter.config.ccuDeleteAfter,// Alte Backups löschen nach X Tagen
        ftp: {
            host: adapter.config.ftpHost,               // FTP-Host
            // genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server
            dir: (adapter.config.ownDir === true) ? adapter.config.ccuFtpDir : adapter.config.ftpDir,
            user: adapter.config.ftpUser,               // Username für FTP Server - Verbindung
            pass: adapter.config.ftpPassword            // Passwort für FTP Server - Verbindung
        },
        cifs: {
            mount: adapter.config.cifsMount             // Festlegen ob CIFS-Mount genutzt werden soll
        },
        ccu: {
            host: adapter.config.ccuHost,               // IP-Adresse der CCU
            user: adapter.config.ccuUser,               // Username der CCU
            pass: adapter.config.ccuPassword            // Passwort der CCU
        }
    };

    mySqlConfig.dbName = adapter.config.mySqlName;          // Name der Datenbank
    mySqlConfig.user = adapter.config.mySqlName;            // Benutzername für Datenbank
    mySqlConfig.pass = adapter.config.mySqlPassword;        // Passwort für Datenbank
    mySqlConfig.deleteBackupAfter = adapter.config.mySqlDeleteAfter;// DB-Backup löschen nach X Tagen
    mySqlConfig.host = adapter.config.mySqlHost;            // Hostname der Datenbank
    mySqlConfig.port = adapter.config.mySqlPort;            // Port der Datenbank
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
