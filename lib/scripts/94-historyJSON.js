'use strict';
const tools = require('../tools');
const fs = require('fs');

function command(options, log, callback) {
    // Build DP JSON
    if (options.historyJSON.enabled && options.adapter) {

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
                //console.log(JSON.stringify(options.context.errors));
                //console.log(JSON.stringify(options.context.done));

                if (historyListJSON !== undefined) {
                    try {
                        historyListJSON = historyListJSON.replace(/\[/g, '').replace(/\]/g, '');
                        historyArrayJSON = historyListJSON.split();
                    } catch (e) {
                        options.adapter.log.error('history error: ' + e + ' Please reinstall backitup and run "iobroker fix"!!');
                    }
                }

                let timeStamp = tools.getTimeString(options.historyJSON.systemLang);
                let doneSomething = false;
                let errorMessage = ''

                if (!JSON.stringify(options.context.errors) === '{}') {
                    errorMessage = tools._('Backup error on: ', options.historyJSON.systemLang);

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
                    if (options.context.errors.influxDB) {
                        errorMessage += 'influxDB ';
                    }
                    if (options.context.errors.mysql) {
                        errorMessage += 'mysql ';
                    }
                    if (options.context.errors.pgsql) {
                        errorMessage += 'pgsql ';
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
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('FTP-Backup: Yes', options.historyJSON.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (options.cifs && options.cifs.enabled) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('CIFS-Mount: Yes', options.historyJSON.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (options.dropbox && options.dropbox.enabled) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('Dropbox: Yes', options.historyJSON.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (options.googledrive && options.googledrive.enabled) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('Google Drive: Yes', options.historyJSON.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                    doneSomething = true;
                }
                if (!doneSomething) {
                    historyArrayJSON.unshift(`{"date":"${timeStamp}", "name":"${onlyFileName}", "type":"${options.name}", "storage":"${tools._('Only stored locally', options.historyJSON.systemLang)}", "filesize":"${fileSize}", "error":"${errorMessage}"}`);
                }

                historyArrayJSON = historyArrayJSON.join(',');

                const sub = historyArrayJSON.substring(historyArrayJSON.length - 1, historyArrayJSON.length);

                if (sub == ',') {
                    historyArrayJSON = historyArrayJSON.substr(0, historyArrayJSON.length - 1);
                }

                historyArrayJSON = JSON.parse('[' + historyArrayJSON + ']');

                if (historyArrayJSON.length > options.historyJSON.entriesNumber) {
                    historyArrayJSON.splice(options.historyJSON.entriesNumber, historyArrayJSON.length - options.historyJSON.entriesNumber);
                }
                log.debug('new history json values created');
                options.adapter.setState('history.json', JSON.stringify(historyArrayJSON), true);
                callback(null, 'done');
                callback = null;
            });
        } catch (e) {
            callback('history json could not be created ...' + e);
        }
    } else {
        callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};