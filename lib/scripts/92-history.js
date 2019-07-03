'use strict';
const tools = require('../tools');

function command(options, log, callback) {
    if (options.history.enabled &&
        options.adapter) {
        let historyArray = [];    
        
        // function for entering the backup execution in the history-log
        options.adapter.getState('history.html', (err, state) => {
            let historyList = state.val;
            if (historyList === '<span class="backup-type-total">' + tools._('No backups yet', options.history.systemLang) + '</span>') {
                historyList = '';
            }

            // analyse here the info from options.context.error and  options.context.done
            console.log(JSON.stringify(options.context.errors));
            console.log(JSON.stringify(options.context.done));

            historyArray = historyList.split('&nbsp;');
            let timeStamp = tools.getTimeString(options.history.systemLang);
            let doneSomething = false;

            if (JSON.stringify(options.context.errors) === '{}') {
                if (options.ftp && options.ftp.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.history.systemLang)}: ${options.name} - ${tools._('FTP-Backup: Yes', options.history.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (options.cifs && options.cifs.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.history.systemLang)}: ${options.name} - ${tools._('CIFS-Mount: Yes', options.history.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (options.dropbox && options.dropbox.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.history.systemLang)}: ${options.name} - ${tools._('Dropbox: Yes', options.history.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (options.googledrive && options.googledrive.enabled) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.history.systemLang)}: ${options.name} - ${tools._('Google Drive: Yes', options.history.systemLang)}</span>`);
                    doneSomething = true;
                }
                if (!doneSomething) {
                    historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.history.systemLang)}: ${options.name} - ${tools._('Only stored locally', options.history.systemLang)}</span>`);
                }
            } else {
                let errorMessage = tools._('Backup error on: ', options.history.systemLang);

                if (options.context.errors.mount) {
                    errorMessage += 'mount ';
                }
                if (options.context.errors.minimal) {
                    errorMessage += 'minimal ';
                }
                if (options.context.errors.total) {
                    errorMessage += 'total ';
                }
                if (options.context.errors.redis) {
                    errorMessage += 'redis ';
                }
                if (options.context.errors.mysql) {
                    errorMessage += 'mysql ';
                }
                if (options.context.errors.ccu) {
                    errorMessage += 'ccu ';
                }
                if (options.context.errors.ftp) {
                    errorMessage += 'ftp ';
                }
                if (options.context.errors.dropbox) {
                    errorMessage += 'dropbox ';
                }
                if (options.context.errors.googledrive) {
                    errorMessage += 'googledrive ';
                }
                if (options.context.errors.cifs) {
                    errorMessage += 'cifs ';
                }
                if (options.context.errors.clean) {
                    errorMessage += 'clean ';
                }
                if (options.context.errors.umount) {
                    errorMessage += 'umount ';
                }
                historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.history.systemLang)}: ${options.name} - ${errorMessage}</span>`);
            }

            if (historyArray.length > options.history.entriesNumber) {
                historyArray.splice(options.history.entriesNumber, historyArray.length - options.history.entriesNumber);
            }
            options.adapter.setState('history.html', historyArray.join('&nbsp;'), callback);
        });
    }
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};