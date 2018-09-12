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
            if (!doneSomething) {
                historyArray.unshift(`<span class="backup-type-${options.name}">${timeStamp} - ${tools._('Type', options.history.systemLang)}: ${options.name} - ${tools._('Only stored locally', options.history.systemLang)}</span>`);
            }

            if (historyArray.length > options.entriesNumber) {
                // todo: test it!
                historyArray.splice(options.entriesNumber, historyArray.length - options.entriesNumber);
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