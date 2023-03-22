'use strict';
const tools = require('../tools');

async function command(options, log, callback) {
    if (options.historyHTML.enabled && options.adapter) {
        let historyArray = [];
        try {
            // function for entering the backup execution in the history-log
            let historyList;
            const state = await options.adapter.getStateAsync('history.html');

            if (state && state.val) {
                historyList = state.val;
                if (historyList === '<span class="backup-type-total">' + tools._('No backups yet', options.historyHTML.systemLang) + '</span>') {
                    historyList = '';
                }
            }

            // analyse here the info from options.context.error and  options.context.done
            if (historyList !== undefined) {
                try {
                    historyArray = historyList.split('&nbsp;');
                } catch (err) {
                    log.error(`history error: ${err} Please reinstall backitup and run "iobroker fix"!!`);
                }
            }
            let timeStamp = tools.getTimeString(options.historyHTML.systemLang);
            let doneSomething = false;

            const errors = Object.keys(options.context.errors);

            if (!errors.length) {
                if (options.ftp && options.ftp.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.historyHTML.systemLang)}: ${options.name} - ${tools._('FTP-Backup: Yes', options.historyHTML.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (options.cifs && options.cifs.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.historyHTML.systemLang)}: ${options.name} - ${tools._('CIFS-Mount: Yes', options.historyHTML.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (options.dropbox && options.dropbox.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.historyHTML.systemLang)}: ${options.name} - ${tools._('Dropbox: Yes', options.historyHTML.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (options.webdav && options.webdav.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.historyHTML.systemLang)}: ${options.name} - ${tools._('WebDAV: Yes', options.historyHTML.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (options.googledrive && options.googledrive.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.historyHTML.systemLang)}: ${options.name} - ${tools._('Google Drive: Yes', options.historyHTML.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (!doneSomething) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.historyHTML.systemLang)}: ${options.name} - ${tools._('Only stored locally', options.historyHTML.systemLang)}</span>`);
                }
            } else {
                let errorMessage = tools._('Backup error on: ', options.historyHTML.systemLang);

                if (options.context.errors.mount) errorMessage += 'mount ';
                if (options.context.errors.iobroker) errorMessage += 'iobroker ';
                if (options.context.errors.redis) errorMessage += 'redis ';
                if (options.context.errors.historyDB) errorMessage += 'historyDB ';
                if (options.context.errors.influxDB) errorMessage += 'influxDB ';
                if (options.context.errors.mysql) errorMessage += 'mysql ';
                if (options.context.errors.pgsql) errorMessage += 'pgsql ';
                if (options.context.errors.sqlite) errorMessage += 'sqlite ';
                if (options.context.errors.nodered) errorMessage += 'nodered ';
                if (options.context.errors.ccu) errorMessage += 'ccu ';
                if (options.context.errors.ftp) errorMessage += 'ftp ';
                if (options.context.errors.dropbox) errorMessage += 'dropbox ';
                if (options.context.errors.onedrive) errorMessage += 'onedrive ';
                if (options.context.errors.googledrive) errorMessage += 'googledrive ';
                if (options.context.errors.cifs) errorMessage += 'cifs ';
                if (options.context.errors.clean) errorMessage += 'clean ';
                if (options.context.errors.grafana) errorMessage += 'grafana ';
                if (options.context.errors.zigbee) errorMessage += 'zigbee ';
                if (options.context.errors.zigbee2mqtt) errorMessage += 'zigbee2mqtt ';
                if (options.context.errors.yahka) errorMessage += 'yahka ';
                if (options.context.errors.javascripts) errorMessage += 'javascripts ';
                if (options.context.errors.webdav) errorMessage += 'webdav ';
                if (options.context.errors.jarvis) errorMessage += 'jarvis ';
                if (options.context.errors.umount) errorMessage += 'umount ';

                historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.historyHTML.systemLang)}: ${options.name} - ${errorMessage}</span>`);
            }

            if (historyArray.length > options.historyHTML.entriesNumber) {
                historyArray.splice(options.historyHTML.entriesNumber, historyArray.length - options.historyHTML.entriesNumber);
            }
            log.debug('new history html values created');
            await options.adapter.setStateAsync('history.html', { val: historyArray.join('&nbsp;'), ack: true });

            callback && callback(null, 'done');
            callback = null;
        } catch (err) {
            callback && callback(`history html could not be created: ${err}`);
        }
    } else {
        callback && callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};