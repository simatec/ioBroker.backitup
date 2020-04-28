'use strict';
const tools = require('../tools');
const fs = require('fs');

function command(options, log, callback) {
    if (options.history.enabled && options.adapter) {
        let historyArray = [];
        try {
            // function for entering the backup execution in the history-log
            options.adapter.getState('history.html', (err, state) => {
                let historyList;

                if (state) {
                    historyList = state.val;
                    if (historyList === '<span class="backup-type-total">' + tools._('No backups yet', options.history.systemLang) + '</span>') {
                        historyList = '';
                    }
                }

                // analyse here the info from options.context.error and  options.context.done
                console.log(JSON.stringify(options.context.errors));
                console.log(JSON.stringify(options.context.done));

                if (historyList !== undefined) {
                    try {
                        historyArray = historyList.split('&nbsp;');
                    } catch (e) {
                        options.adapter.log.error('history error: ' + e + ' Please reinstall backitup and run "iobroker fix"!!');
                    }
                }
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
                    if (options.context.errors.iobroker) {
                        errorMessage += 'iobroker ';
                    }
                    if (options.context.errors.total) {
                        errorMessage += 'total ';
                    }
                    if (options.context.errors.redis) {
                        errorMessage += 'redis ';
                    }
                    if (options.context.errors.historyDB) {
                        errorMessage += 'historyDB ';
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
                options.adapter.setState('history.html', historyArray.join('&nbsp;'), true, callback);

            });
        } catch (e) {
            callback('history html could not be created ...');
        }
    }

    // Build DP JSON
    if (options.history.enabled && options.adapter) {

        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
        let fileName = fileNames.shift();

        let onlyFileName;
        let fileSize;

        if (fs.existsSync(fileName)) {
            fileName = fileName.replace(/\\/g, '/');
            onlyFileName = fileName.split('/').pop();
            const stats = fs.statSync(fileName);
            fileSize = (Math.floor(stats.size / (1024 * 1024)) + 'MB');
        }
        try {
            options.adapter.getState('history.json', (err, state) => {

                let historyListJSON;
                let historyArrayJSON = [];

                if (state && state.val) {
                    historyListJSON = state.val;
                }

                // analyse here the info from options.context.error and  options.context.done
                console.log(JSON.stringify(options.context.errors));
                console.log(JSON.stringify(options.context.done));

                if (historyListJSON !== undefined) {
                    try {
                        historyListJSON = historyListJSON.replace(/\[/g, '').replace(/\]/g, '');
                        historyArrayJSON = historyListJSON.split();
                    } catch (e) {
                        options.adapter.log.error('history error: ' + e + ' Please reinstall backitup and run "iobroker fix"!!');
                    }
                }

                let timeStamp = tools.getTimeString(options.history.systemLang);
                let doneSomething = false;
                let errorMessage = ''

                if (!JSON.stringify(options.context.errors) === '{}') {
                    errorMessage = tools._('Backup error on: ', options.history.systemLang);

                    if (options.context.errors.mount) {
                        errorMessage += 'mount ';
                    }
                    if (options.context.errors.iobroker) {
                        errorMessage += 'iobroker ';
                    }
                    if (options.context.errors.redis) {
                        errorMessage += 'redis ';
                    }
                    if (options.context.errors.historyDB) {
                        errorMessage += 'historyDB ';
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
                } else {
                    errorMessage = 'none';
                }
                if (options.ftp && options.ftp.enabled) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('FTP-Backup: Yes', options.history.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (options.cifs && options.cifs.enabled) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('CIFS-Mount: Yes', options.history.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (options.dropbox && options.dropbox.enabled) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('Dropbox: Yes', options.history.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (options.googledrive && options.googledrive.enabled) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('Google Drive: Yes', options.history.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (!doneSomething) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('Only stored locally', options.history.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                }

                historyArrayJSON = historyArrayJSON.join(',');

                const sub = historyArrayJSON.substring(historyArrayJSON.length - 1, historyArrayJSON.length);

                if (sub == ',') {
                    historyArrayJSON = historyArrayJSON.substr(0, historyArrayJSON.length - 1);
                }

                historyArrayJSON = JSON.parse('[' + historyArrayJSON + ']');

                if (historyArrayJSON.length > options.history.entriesNumber) {
                    historyArrayJSON.splice(options.history.entriesNumber, historyArrayJSON.length - options.history.entriesNumber);
                }

                options.adapter.setState('history.json', JSON.stringify(historyArrayJSON), true, callback);
            });
        } catch (e) {
            callback('history json could not be created ...');
        }
    }
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};