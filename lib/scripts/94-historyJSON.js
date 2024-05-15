'use strict';
const tools = require('../tools');
const fs = require('node:fs');

async function fileSizeCheck(fileName, log) {
    return new Promise(async (resolve) => {
        const fsAsync = fs.promises;

        let fileSize = null;

        if (fileName && fs.existsSync(fileName)) {
            const stats = await fsAsync.stat(fileName)
                .catch(err => log.warn(`Filesize error: ${err}`));

            fileSize = stats ? `${Math.floor(stats.size / (1024 * 1024))} MB` : null;
        }
        resolve(fileSize);
    });
}

async function command(options, log, callback) {
    // Build DP JSON
    if (options.historyJSON.enabled && options.adapter) {
        let fileName;

        try {
            const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
            fileName = fileNames.shift();

            if (fileName && fs.existsSync(fileName)) {
                fileName = fileName ? fileName.replace(/\\/g, '/') : undefined;
            }
        } catch (err) {
            log.error(`FileName error: ${err}`);
        }

        try {
            const state = await options.adapter.getStateAsync('history.json');

            if (state && state.val) {
                let historyListJSON;
                let historyArrayJSON;

                if (state && state.val) {
                    historyListJSON = state.val;
                }

                if (historyListJSON !== undefined) {
                    try {
                        historyArrayJSON = JSON.parse(historyListJSON);
                    } catch (err) {
                        log.error(`history error: ${err} Please reinstall BackItUp and run "iobroker fix"!!`);
                    }
                }

                const errors = Object.keys(options.context.errors);
                let errorMessage = '';

                if (errors.length) {
                    errorMessage = tools._('Backup error on: ', options.historyJSON.systemLang);

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
                } else {
                    errorMessage = 'none';
                }
                let storage = [];

                if (options.ftp && options.ftp.enabled) storage.push(tools._('FTP', options.historyJSON.systemLang));
                if (options.cifs && options.cifs.enabled) storage.push(tools._('NAS / Copy', options.historyJSON.systemLang));
                if (options.dropbox && options.dropbox.enabled) storage.push(tools._('Dropbox', options.historyJSON.systemLang));
                if (options.webdav && options.webdav.enabled) storage.push(tools._('WebDAV', options.historyJSON.systemLang));
                if (options.googledrive && options.googledrive.enabled) storage.push(tools._('Google Drive', options.historyJSON.systemLang));
                if (options.onedrive && options.onedrive.enabled) storage.push(tools._('OneDrive', options.historyJSON.systemLang));
                if (!storage.length) storage.push(tools._('Only stored locally', options.historyJSON.systemLang));

                // push history to json
                try {
                    historyArrayJSON.unshift({
                        date: tools.getTimeString(options.historyJSON.systemLang),
                        name: fileName ? fileName.split('/').pop() : undefined,
                        type: options.name,
                        storage: storage.length > 1 ? storage : storage[0],
                        filesize: await fileSizeCheck(fileName, log),
                        error: errorMessage,
                        timestamp: new Date().getTime()
                    });
                } catch (err) {
                    callback && callback(`history json could not be created: ${err}`);
                }

                if (historyArrayJSON && historyArrayJSON.length > options.historyJSON.entriesNumber) {
                    historyArrayJSON.splice(options.historyJSON.entriesNumber, historyArrayJSON.length - options.historyJSON.entriesNumber);
                }

                try {
                    await options.adapter.setStateAsync('history.json', { val: JSON.stringify(historyArrayJSON), ack: true });
                    log.debug('new history json values created');
                } catch (err) {
                    callback && callback(`history json could not be created: ${err}`);
                }

                callback && callback(null, 'done');
                callback = null;
            }
        } catch (err) {
            callback && callback(`history json could not be created: ${err}`);
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
