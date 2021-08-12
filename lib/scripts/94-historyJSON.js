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
                let historyArrayJSON;

                if (state && state.val) {
                    historyListJSON = state.val;
                }

                if (historyListJSON !== undefined) {
                    try {
                        historyArrayJSON = JSON.parse(historyListJSON);
                    } catch (e) {
                        options.adapter.log.error('history error: ' + e + ' Please reinstall backitup and run "iobroker fix"!!');
                    }
                }

                let backupDate = tools.getTimeString(options.historyJSON.systemLang);
                let timeStamp = new Date().getTime();

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
                    if (options.context.errors.grafana) {
                        errorMessage += 'grafana ';
                    }
                    if (options.context.errors.javascripts) {
                        errorMessage += 'javascripts ';
                    }
                    if (options.context.errors.webdav) {
                        errorMessage += 'webdav ';
                    }
                    if (options.context.errors.jarvis) {
                        errorMessage += 'jarvis ';
                    }
                    if (options.context.errors.umount) {
                        errorMessage += 'umount ';
                    }
                } else {
                    errorMessage = 'none';
                }
                let storage = [];

                if (options.ftp && options.ftp.enabled) {
                    storage.push(tools._('FTP', options.historyJSON.systemLang));
                    doneSomething = true;
                }
                if (options.cifs && options.cifs.enabled) {
                    storage.push(tools._('NAS / Copy', options.historyJSON.systemLang));
                    doneSomething = true;
                }
                if (options.dropbox && options.dropbox.enabled) {
                    storage.push(tools._('Dropbox', options.historyJSON.systemLang));
                    doneSomething = true;
                }
                if (options.webdav && options.webdav.enabled) {
                    storage.push(tools._('WebDAV', options.historyJSON.systemLang));
                    doneSomething = true;
                }
                if (options.googledrive && options.googledrive.enabled) {
                    storage.push(tools._('Google Drive', options.historyJSON.systemLang));
                    doneSomething = true;
                }
                if (!doneSomething) {
                    storage.push(tools._('Only stored locally', options.historyJSON.systemLang));
                }
                // push history to json
                try {
                    historyArrayJSON.unshift({
                        "date": backupDate,
                        "name": onlyFileName,
                        "type": options.name,
                        "storage": storage.length > 1 ? storage : storage[0],
                        "filesize": fileSize,
                        "error": errorMessage,
                        "timestamp": timeStamp
                    });
                } catch (err) {
                    callback && callback('history json could not be created: ' + err);
                }

                if (historyArrayJSON && historyArrayJSON.length > options.historyJSON.entriesNumber) {
                    historyArrayJSON.splice(options.historyJSON.entriesNumber, historyArrayJSON.length - options.historyJSON.entriesNumber);
                }

                try {
                    options.adapter.setState('history.json', JSON.stringify(historyArrayJSON), true);
                    log.debug('new history json values created');
                } catch (err) {
                    callback && callback('history json could not be created: ' + err);
                }

                callback && callback(null, 'done');
                callback = null;
            });
        } catch (e) {
            callback && callback('history json could not be created ...' + e);
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