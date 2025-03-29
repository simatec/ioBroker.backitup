/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const schedule = require('node-schedule');
const tools = require('./lib/tools');
const executeScripts = require('./lib/execute');
const systemCheck = require('./lib/systemCheck');
const TokenRefresher = require('./lib/tokenRefresher');

const adapterName = require('./package.json').name.split('.').pop();

let adapter;

let timerOutput;
let timerOutput2;
let timerUmount1;
let timerUmount2;
let timerMain;
let slaveTimeOut;
let waitToSlaveBackup;
let dlServer;
let ulServer;
let http;
let https;

let systemLang = 'de';              // system language
const backupConfig = {};
const backupTimeSchedules = [];     // Array for Backup Times
let taskRunning = false;
let dropBoxTokenRefresher = null;

const bashDir = path.join(utils.getAbsoluteDefaultDataDir(), adapterName).replace(/\\/g, '/');

/**
 * Decrypt the password/value with given key
 *
 * @param key - Secret key
 * @param value - value to decrypt
 * @returns
 */
function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

/*
async function updateAccessTokens(config) {
    if (dropBoxTokenRefresher) {
        try {
            const accessToken = await dropBoxTokenRefresher.getAccessToken();
            Object.values(config).forEach((_config) => {
                if (_config && typeof _config === 'object') {
                    if (_config.dropbox) {
                        _config.dropbox.accessToken = accessToken;
                    } else {
                        Object.values(_config).forEach((_config2) => {
                            if (_config.dropbox) {
                                _config.dropbox.accessToken = accessToken;
                            }
                        });
                    }
                }
            });
        } catch (e) {
            adapter.log.error(`Cannot get access tokens for DropBox: ${e}`);
        }
    }
}
*/
async function updateAccessTokens(config) {
    if (dropBoxTokenRefresher) {
        try {
            const accessToken = await dropBoxTokenRefresher.getAccessToken();

            Object.keys(config).forEach((key) => {
                if (config[key] && typeof config[key] === 'object') {
                    if (config[key].dropbox) {
                        config[key].dropbox.accessToken = accessToken;
                        adapter.log.debug(`Dropbox Token Config key: ${accessToken}`);
                    } else {
                        Object.keys(config[key]).forEach((subKey) => {
                            if (config[key][subKey] && config[key][subKey].dropbox) {
                                config[key][subKey].dropbox.accessToken = accessToken;
                                adapter.log.debug(`Dropbox Token Config subKey: ${accessToken}`);
                            }
                        });
                    }
                }
            });

        } catch (e) {
            adapter.log.error(`Cannot get access tokens for DropBox: ${e}`);
        }
    }
}

async function startBackup(config, cb) {
    if (taskRunning) {
        return setTimeout(startBackup, 10000, config, cb);
    }
    await updateAccessTokens(config);

    taskRunning = true;
    try {
        executeScripts(adapter, config, err => {
            taskRunning = false;
            cb && cb(err);
        });
        adapter.log.debug('Backup has started ...');
    } catch (e) {
        adapter.log.warn(`Backup error: ${e.stack}`);
        adapter.log.warn(`Backup error: ${e} ... please check your config and and try again!!`);
    }
}

function startAdapter(options) {
    options = options || {};
    Object.assign(options, { name: adapterName });

    adapter = new utils.Adapter(options);

    adapter.on('stateChange', async (id, state) => {
        dropBoxTokenRefresher?.onStateChange(id, state);

        if (state && (state.val === true || state.val === 'true') && !state.ack) {
            if (id === `${adapter.namespace}.oneClick.iobroker` ||
                id === `${adapter.namespace}.oneClick.ccu`
            ) {
                const sysCheck = await systemCheck.storageSizeCheck(adapter, adapterName, adapter.log);

                const type = id.split('.').pop();

                if ((sysCheck && sysCheck.ready && sysCheck.ready === true) || adapter.config.cifsEnabled === true) {
                    let config;
                    try {
                        config = JSON.parse(JSON.stringify(backupConfig[type]));
                        config.enabled = true;
                        config.deleteBackupAfter = 0; // do not delete files by custom backup
                    } catch (e) {
                        adapter.log.warn(`backup error: ${e.stack}`);
                        adapter.log.warn(`backup error: ${e} ... please check your config and try again!!`);
                    }

                    startBackup(config, err => {
                        if (err) {
                            adapter.log.error(`[${type}] ${err}`);

                        } else {
                            adapter.log.debug(`[${type}] exec: done`);
                        }
                        timerOutput = setTimeout(() => {
                            return adapter.getState('output.line', (err, state) => {
                                if (state && state.val === '[EXIT] 0') {
                                    adapter.setState(`history.${type}Success`, true, true);
                                    adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);

                                    if (adapter.config.onedriveEnabled && adapter.config.hostType === 'Single') {
                                        renewOnedriveToken();
                                    }
                                } else {
                                    adapter.setState(`history.${type}LastTime`, `error: ${tools.getTimeString(systemLang)}`, true);
                                    adapter.setState(`history.${type}Success`, false, true);
                                }

                            });
                        }, 500);
                        adapter.setState(`oneClick.${type}`, false, true);

                        if (adapter.config.slaveInstance && type === 'iobroker' && adapter.config.hostType === 'Master') {
                            adapter.log.debug('Slave backup from BackItUp-Master is started ...');
                            startSlaveBackup(adapter.config.slaveInstance[0], null);
                        }
                    });
                } else {
                    adapter.log.error(`A local backup is currently not possible. The storage space is currently only ${sysCheck && sysCheck.diskFree ? sysCheck.diskFree : null} MB`);
                    systemCheck.systemMessage(adapter, tools._('A local backup is currently not possible. Please check your System!', systemLang));
                    adapter.setState(`oneClick.${type}`, false, true);
                    adapter.setState('output.line', `[EXIT] ${tools._('A local backup is currently not possible. Please check your System!', systemLang)}`, true);
                }
            }
        }
    });

    adapter.on('ready', async () => {
        try {
            await main(adapter);
        } catch (e) {
            //ignore errors
        }
    });

    // is called when adapter shuts down - callback has to be called under any circumstances!
    adapter.on('unload', (callback) => {
        try {
            dropBoxTokenRefresher?.destroy();
            adapter.log.info('cleaned everything up...');
            timerOutput2 && clearTimeout(timerOutput2);
            timerOutput && clearTimeout(timerOutput);
            timerUmount1 && clearTimeout(timerUmount1);
            timerUmount2 && clearTimeout(timerUmount2);
            timerMain && clearTimeout(timerMain);
            slaveTimeOut && clearTimeout(slaveTimeOut);
            waitToSlaveBackup && clearTimeout(waitToSlaveBackup);
            if (dlServer) {
                try {
                    dlServer.closeAllConnections();
                } catch (e) {
                    adapter.log.debug(`Download server Connections could not be closed: ${e}`);
                }
                try {
                    dlServer.close();
                } catch (e) {
                    adapter.log.debug(`Download server Connections could not be closed: ${e}`);
                }
            }
            if (ulServer) {
                try {
                    ulServer.closeAllConnections();
                } catch (e) {
                    adapter.log.debug(`Upload server connections could not be closed: ${e}`);
                }
                try {
                    ulServer.close();
                } catch (e) {
                    adapter.log.debug(`Upload server connections could not be closed: ${e}`);
                }
            }
        } catch (e) {
            console.log(`Cannot unload: ${e}`);
        }
        callback();
    });

    adapter.on('message', async obj => {
        if (obj) {
            switch (obj.command) {
                case 'list':
                    try {
                        const list = require('./lib/list');
                        adapter.log.debug(`Reading backup list...`);
                        await updateAccessTokens(backupConfig);
                        list(obj.message, backupConfig, adapter.log, res => {
                            adapter.log.debug(`Backup list was read: ${JSON.stringify(res)}`);
                            obj.callback && adapter.sendTo(obj.from, obj.command, res, obj.callback);
                        });
                    } catch (e) {
                        adapter.log.debug('Backup list cannot be read ...');
                    }
                    break;

                case 'authGoogleDrive':
                    const GoogleDrive = require('./lib/googleDriveLib');

                    if (obj.callback) {
                        const google = new GoogleDrive();
                        google.getAuthorizeUrl()
                            .then(url =>
                                adapter.sendTo(obj.from, obj.command, { url }, obj.callback));
                    }
                    break;

                case 'authDropbox':
                    if (obj.callback) {
                        TokenRefresher.getAuthUrl('https://oauth2.iobroker.in/dropbox')
                            .then(url => adapter.sendTo(obj.from, obj.command, { url }, obj.callback))
                    }
                    break;

                case 'authOnedrive':
                    const Onedrive = require('./lib/oneDriveLib');

                    if (obj.message && obj.message.code) {
                        const onedrive = new Onedrive();

                        onedrive.getRefreshToken(obj.message.code, adapter.log)
                            .then(json => adapter.sendTo(obj.from, obj.command, { done: true, json }, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: err }, obj.callback));
                    } else if (obj.callback) {
                        const onedrive = new Onedrive();

                        onedrive.getAuthorizeUrl(adapter.log)
                            .then(url => adapter.sendTo(obj.from, obj.command, { url: url }, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: err }, obj.callback));
                    }
                    break;

                case 'restore':
                    if (obj.message) {
                        if (obj.message.stopIOB) {
                            await getCerts(obj.from);
                        }
                        adapter.log.info(`DATA: ${JSON.stringify(obj.message)}`);
                        await updateAccessTokens(backupConfig);

                        const _restore = require('./lib/restore');
                        _restore.restore(
                            adapter,
                            backupConfig,
                            obj.message.type,
                            obj.message.fileName,
                            obj.message.currentTheme,
                            obj.message.currentProtocol,
                            bashDir,
                            adapter.log,
                            res => obj.callback && adapter.sendTo(obj.from, obj.command, res, obj.callback),
                        );
                    } else if (obj.callback) {

                        obj.callback({ error: 'Invalid parameters' });
                    }
                    break;

                case 'uploadFile':
                    if (obj.message && obj.message.protocol) {
                        if (ulServer && ulServer._connectionKey && ulServer.listening) {
                            adapter.log.debug(`Upload server is running on Port ${ulServer.address().port}...`);
                        } else {
                            if (obj.message.protocol === 'https:') {
                                await getCerts(obj.from);
                            }

                            try {
                                ulFileServer(obj.message.protocol);
                            } catch (e) {
                                adapter.log.debug('Upload server cannot started');
                            }
                        }

                        try {
                            adapter.sendTo(obj.from, obj.command, { listenPort: ulServer.address().port }, obj.callback);
                        } catch (e) {
                            adapter.sendTo(obj.from, obj.command, { e }, obj.callback);
                        }
                    } else if (obj.callback) {

                        obj.callback({ error: 'Invalid parameters' });
                    }
                    break;

                case 'getFile':
                    if (obj.message && obj.message.type && obj.message.fileName && obj.message.protocol) {
                        if (dlServer && dlServer._connectionKey && dlServer.listening) {
                            adapter.log.debug(`Download server is running on port ${dlServer.address().port}...`);
                        } else {
                            if (obj.message.protocol === 'https:') {
                                await getCerts(obj.from);
                            }

                            try {
                                dlFileServer(obj.message.protocol);
                            } catch (e) {
                                adapter.log.debug('Downloadserver cannot started');
                            }
                        }

                        const fileName = obj.message.fileName.split('/').pop();
                        if (obj.message.type !== 'local') {
                            const backupDir = path.join(tools.getIobDir(), 'backups');
                            const toSaveName = path.join(backupDir, fileName);

                            const _getFile = require('./lib/restore');
                            await updateAccessTokens(backupConfig);

                            _getFile.getFile(backupConfig, obj.message.type, obj.message.fileName, toSaveName, adapter.log, err => {
                                if (!err && fs.existsSync(toSaveName)) {
                                    try {
                                        adapter.sendTo(obj.from, obj.command, { fileName: fileName, listenPort: dlServer.address().port }, obj.callback);
                                    } catch (error) {
                                        adapter.sendTo(obj.from, obj.command, { error }, obj.callback);
                                    }
                                } else {
                                    adapter.log.warn(`File ${toSaveName} not found`);
                                }
                            });
                        } else if (fs.existsSync(obj.message.fileName)) {
                            try {
                                adapter.sendTo(obj.from, obj.command, { fileName: fileName, listenPort: dlServer.address().port }, obj.callback);
                            } catch (error) {
                                adapter.sendTo(obj.from, obj.command, { error }, obj.callback);
                            }
                        }
                    } else if (obj.callback) {

                        obj.callback({ error: 'Invalid parameters' });
                    }
                    break;

                case 'serverClose':
                    if (obj.message && obj.message.downloadFinish && !obj.message.uploadFinish) {
                        adapter.log.debug('Download finished...');
                        adapter.sendTo(obj.from, obj.command, { serverClose: true }, obj.callback);
                    } else if (obj.message && obj.message.uploadFinish && !obj.message.downloadFinish) {
                        adapter.log.debug('Upload finished...');
                        adapter.sendTo(obj.from, obj.command, { serverClose: true }, obj.callback);
                    } else if (obj.callback) {

                        obj.callback({ error: 'Invalid parameters' });
                    }
                    break;

                case 'getTelegramUser':
                    if (obj && obj.message) {
                        const inst = obj.message.config.instance ? obj.message.config.instance : adapter.config.telegramInstance;
                        adapter.getForeignState(`${inst}.communicate.users`, (err, state) => {
                            err && adapter.log.error(err);
                            if (state && state.val) {
                                try {
                                    adapter.sendTo(obj.from, obj.command, state.val, obj.callback);
                                } catch (err) {
                                    err && adapter.log.error(err);
                                    adapter.log.error('Cannot parse stored user IDs from Telegram!');
                                }
                            }
                        });
                    }
                    break;

                case 'getSystemInfo':
                    if (obj) {
                        let systemInfo = process.platform;;
                        let dbInfo = false;

                        if (fs.existsSync('/opt/scripts/.docker_config/.thisisdocker')) { // Docker Image Support >= 5.2.0

                            systemInfo = 'docker';

                            if (fs.existsSync('/opt/scripts/.docker_config/.backitup')) {
                                dbInfo = true;
                            }
                        } else {
                            const isWin = process.platform.startsWith('win');

                            if (isWin) {

                                systemInfo = 'win';
                            }
                        }

                        try {
                            adapter.sendTo(obj.from, obj.command, { systemOS: systemInfo, dockerDB: dbInfo, backupDir: path.join(tools.getIobDir(), 'backups') }, obj.callback);
                        } catch (err) {
                            err && adapter.log.error(err);
                        }
                    }
                    break;

                case 'getFileSystemInfo':
                    if (obj) {
                        const sysCheck = await systemCheck.storageSizeCheck(adapter, adapterName, adapter.log);

                        if (sysCheck) {
                            try {
                                adapter.sendTo(obj.from, obj.command, sysCheck, obj.callback);
                            } catch (err) {
                                err && adapter.log.error(err);
                            }
                        }
                    }
                    break;

                case 'testWebDAV':
                    if (obj.message) {
                        //const { createClient } = require('webdav');
                        const { createClient } = await import('webdav');
                        const agent = new (require('node:https').Agent)({ rejectUnauthorized: obj.message.config.signedCertificates });

                        const client = createClient(
                            obj.message.config.host,
                            {
                                username: obj.message.config.username,
                                password: obj.message.config.password,
                                maxBodyLength: Infinity,
                                httpsAgent: agent
                            });

                        client
                            .getDirectoryContents('')
                            .then(contents => obj.callback && adapter.sendTo(obj.from, obj.command, contents, obj.callback))
                            .catch(err => adapter.sendTo(obj.from, obj.command, { error: JSON.stringify(err.message) }, obj.callback));
                    }
                    break;
                case 'slaveBackup':
                    if (obj?.message) {
                        if (adapter.config.hostType === 'Slave') {
                            adapter.log.debug('Slave Backup started ...');
                            const type = 'iobroker';
                            let config;
                            try {
                                config = JSON.parse(JSON.stringify(backupConfig[type]));
                                config.enabled = true;
                                config.deleteBackupAfter = obj.message.config.deleteAfter ? obj.message.config.deleteAfter : 0; // do delete files with specification from Master
                            } catch (e) {
                                adapter.log.warn(`backup error: ${e} ... please check your config and try again!!`);
                            }
                            startBackup(config, err => {
                                if (err) {
                                    adapter.log.error(`[${type}] ${err}`);

                                } else {
                                    adapter.log.debug(`[${type}] exec: done`);
                                }
                                timerOutput = setTimeout(() =>
                                    adapter.getState('output.line', (err, state) => {
                                        if (state && state.val === '[EXIT] 0') {
                                            adapter.setState(`history.${type}Success`, true, true);
                                            adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);
                                            try {
                                                adapter.sendTo(obj.from, obj.command, state.val, obj.callback);
                                            } catch (err) {
                                                err && adapter.log.error(err);
                                                adapter.log.error('slave Backup not finish!');
                                            }

                                            if (adapter.config.onedriveEnabled) {
                                                renewOnedriveToken();
                                            }
                                        } else {
                                            adapter.setState(`history.${type}LastTime`, `error: ${tools.getTimeString(systemLang)}`, true);
                                            adapter.setState(`history.${type}Success`, false, true);
                                            if (state && state.val) {
                                                try {
                                                    adapter.sendTo(obj.from, obj.command, state.val, obj.callback);
                                                } catch (err) {
                                                    err && adapter.log.error(err);
                                                    adapter.log.error('slave Backup not finish!');
                                                }
                                            }
                                        }

                                    }), 500);
                                adapter.setState(`oneClick.${type}`, false, true);
                            });
                        } else {
                            adapter.log.warn('Your BackItUp Instance is not configured as a slave');
                            adapter.sendTo(obj.from, obj.command, 'not configured as a slave', obj.callback);
                        }
                    }
                    break;
                case 'slaveInstance':
                    if (obj && obj.command === 'slaveInstance' && obj.message && obj.message.instance) {
                        let resultInstances = [];

                        const instances = await adapter.getObjectViewAsync('system', 'instance', {
                            startkey: `system.adapter.${obj.message.instance}.`,
                            endkey: `system.adapter.${obj.message.instance}.\u9999`,
                        }).catch((err) => adapter.log.error(err));

                        if (instances && instances.rows && instances.rows.length != 0) {
                            instances.rows.forEach(async (row) => {
                                if (row.id.replace('system.adapter.', '') != adapter.namespace) {
                                    resultInstances.push({
                                        label: row.id.replace('system.adapter.', ''),
                                        value: row.id.replace('system.adapter.', ''),
                                    });
                                }
                            });
                        }

                        adapter.sendTo(obj.from, obj.command, resultInstances, obj.callback);
                    }
                    break;
                case 'getLog':
                    const logName = path.join(bashDir, `${adapter.namespace}.log`).replace(/\\/g, '/');

                    if (fs.existsSync(logName) && (obj?.message.backupName || obj?.message.timestamp)) {
                        const data = fs.readFileSync(logName, 'utf8');
                        const backupLog = JSON.parse(data);
                        const backupName = obj?.message.backupName ? obj.message.backupName : null;
                        const timestamp = obj?.message.timestamp;
                        let found = false;

                        backupLog.forEach((item, index) => {
                            if (item.hasOwnProperty(timestamp)) {
                                found = true;
                                adapter.log.debug(`Printing logs of previous backup`);
                                adapter.sendTo(obj.from, obj.command, item[timestamp], obj.callback);
                            } else if (backupName !== null && item.hasOwnProperty(backupName)) {
                                found = true;
                                adapter.log.debug(`Printing logs of previous backup`);
                                adapter.sendTo(obj.from, obj.command, item[backupName], obj.callback);
                            } else if ((backupLog.length - 1) == index && !found) {
                                adapter.log.debug(`No Backuplogs found`);
                                adapter.sendTo(obj.from, obj.command, tools._('No log is available for this backup', systemLang), obj.callback);
                            }
                        });
                    }
                    break;
            }
        }
    });

    return adapter;
}

async function checkStates() {
    // Fill empty data points with default values
    const historyState = await adapter.getStateAsync('history.html');
    if (!historyState || historyState.val === null) {
        await adapter.setStateAsync('history.html', { val: `<span class="backup-type-total">${tools._('No backups yet', systemLang)}</span>`, ack: true });
    }

    const iobrokerLastTime = await adapter.getStateAsync('history.iobrokerLastTime');
    if (!iobrokerLastTime || iobrokerLastTime.val === null) {
        await adapter.setStateAsync('history.iobrokerLastTime', { val: tools._('No backups yet', systemLang), ack: true });
    }

    const ccuLastTime = await adapter.getStateAsync('history.ccuLastTime');
    if (!ccuLastTime || ccuLastTime.val === null) {
        await adapter.setStateAsync('history.ccuLastTime', { val: tools._('No backups yet', systemLang), ack: true });
    }

    const iobrokerState = await adapter.getStateAsync('oneClick.iobroker');
    if (!iobrokerState || iobrokerState.val === null || iobrokerState.val === true) {
        await adapter.setStateAsync('oneClick.iobroker', { val: false, ack: true });
    }

    const ccuState = await adapter.getStateAsync('oneClick.ccu');
    if (!ccuState || ccuState.val === null || ccuState.val === true) {
        await adapter.setStateAsync('oneClick.ccu', { val: false, ack: true });
    }

    const ccuSuccess = await adapter.getStateAsync('history.ccuSuccess');
    if (!ccuSuccess || ccuSuccess.val === null) {
        await adapter.setStateAsync('history.ccuSuccess', { val: false, ack: true });
    }

    const iobrokerSuccess = await adapter.getStateAsync('history.iobrokerSuccess');
    if (!iobrokerSuccess || iobrokerSuccess.val === null) {
        await adapter.setStateAsync('history.iobrokerSuccess', { val: false, ack: true });
    }

    const jsonState = await adapter.getStateAsync('history.json');
    if (!jsonState || jsonState.val === null) {
        await adapter.setStateAsync('history.json', { val: '[]', ack: true });
    }
}

// function to create Backup schedules (Backup time)
function createBackupSchedule() {
    for (const type in backupConfig) {
        if (!backupConfig.hasOwnProperty(type)) {
            continue;
        }

        const config = backupConfig[type];
        if (config.enabled === true || config.enabled === 'true') {
            let time = config.ownCron ? config.cronjob : config.time.split(':');

            const backupInfo = config.ownCron ? `with Cronjob "${config.cronjob}"` : `at ${config.time} every ${config.everyXDays} day(s)`;
            adapter.log.info(`[${type}] backup will be activated ${backupInfo}`);

            if (backupTimeSchedules[type]) {
                backupTimeSchedules[type].cancel();
            }
            const cron = config.ownCron ? time : `10 ${time[1]} ${time[0]} */${config.everyXDays} * * `;
            backupTimeSchedules[type] = schedule.scheduleJob(cron, async () => {
                const sysCheck = await systemCheck.storageSizeCheck(adapter, adapterName, adapter.log);

                if ((sysCheck && sysCheck.ready && sysCheck.ready === true) || adapter.config.cifsEnabled === true) {
                    adapter.setState(`oneClick.${type}`, true, true);

                    startBackup(backupConfig[type], err => {
                        if (err) {
                            adapter.log.error(`[${type}] ${err}`);
                        } else {
                            adapter.log.debug(`[${type}] exec: done`);
                        }
                        timerOutput2 = setTimeout(() =>
                            adapter.getState('output.line', (err, state) => {
                                if (state && state.val === '[EXIT] 0') {
                                    adapter.setState(`history.${type}Success`, true, true);
                                    adapter.setState(`history.${type}LastTime`, tools.getTimeString(systemLang), true);

                                    if (adapter.config.onedriveEnabled && adapter.config.hostType === 'Single') {
                                        renewOnedriveToken();
                                    }
                                } else {
                                    adapter.setState(`history.${type}LastTime`, `error: ${tools.getTimeString(systemLang)}`, true);
                                    adapter.setState(`history.${type}Success`, false, true);
                                }
                            }), 500);
                        nextBackup(false, type);
                        adapter.setState(`oneClick.${type}`, false, true);

                        if (adapter.config.slaveInstance && type === 'iobroker' && adapter.config.hostType === 'Master') {
                            adapter.log.debug('Slave backup from BackItUp-Master is started ...');
                            startSlaveBackup(adapter.config.slaveInstance[0], null);
                        }
                    });
                } else {
                    adapter.log.error(`A local backup is currently not possible. The storage space is currently only ${sysCheck && sysCheck.diskFree ? sysCheck.diskFree : null} MB`);
                    systemCheck.systemMessage(adapter, tools._('A local backup is currently not possible. Please check your System!', systemLang));
                }
            });

            if (config.debugging) {
                adapter.log.debug(`[${type}] ${cron}`);
            }
        } else if (backupTimeSchedules[type]) {
            adapter.log.info(`[${type}] backup deactivated`);
            backupTimeSchedules[type].cancel();
            backupTimeSchedules[type] = null;
        }
    }
}

async function initConfig(secret) {
    return new Promise(async (resolve) => {
        // compatibility
        if (adapter.config.cifsMount === 'CIFS') {
            adapter.config.cifsMount = '';
        }
        if (adapter.config.redisEnabled === undefined) {
            adapter.config.redisEnabled = adapter.config.backupRedis
        }
        let ioPath;

        try {
            // ioPath = `${ioCommon.tools.getControllerDir()}/iobroker.js`; Todo: Error by iob Backup (no such file or directory, uv_cwd)
            // ioPath = require.resolve('iobroker.js-controller/iobroker.js');
            ioPath = path.resolve(__dirname, '../iobroker.js-controller/iobroker.js');
        } catch (e) {
            adapter.log.error(`Unable to read iobroker path: +${e}`);
        }

        decryptEvents(secret);

        const telegram = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.telegramInstance,
            SilentNotice: adapter.config.telegramSilentNotice,
            NoticeType: adapter.config.telegramNoticeType,
            User: adapter.config.telegramUser,
            onlyError: adapter.config.telegramOnlyError,
            telegramWaiting: adapter.config.telegramWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const whatsapp = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.whatsappInstance,
            NoticeType: adapter.config.whatsappNoticeType,
            onlyError: adapter.config.whatsappOnlyError,
            whatsappWaiting: adapter.config.whatsappWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const gotify = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.gotifyInstance,
            NoticeType: adapter.config.gotifyNoticeType,
            onlyError: adapter.config.gotifyOnlyError,
            gotifyWaiting: adapter.config.gotifyWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const signal = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.signalInstance,
            NoticeType: adapter.config.signalNoticeType,
            onlyError: adapter.config.signalOnlyError,
            signalWaiting: adapter.config.signalWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const matrix = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.matrixInstance,
            NoticeType: adapter.config.matrixNoticeType,
            onlyError: adapter.config.matrixOnlyError,
            matrixWaiting: adapter.config.matrixWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const discord = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.discordInstance,
            NoticeType: adapter.config.discordNoticeType,
            target: adapter.config.discordTarget,
            onlyError: adapter.config.discordOnlyError,
            discordWaiting: adapter.config.discordWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const pushover = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.pushoverInstance,
            SilentNotice: adapter.config.pushoverSilentNotice,
            NoticeType: adapter.config.pushoverNoticeType,
            deviceID: adapter.config.pushoverDeviceID,
            onlyError: adapter.config.pushoverOnlyError,
            pushoverWaiting: adapter.config.pushoverWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const email = {
            enabled: adapter.config.notificationEnabled,
            notificationsType: adapter.config.notificationsType,
            type: 'message',
            instance: adapter.config.emailInstance,
            NoticeType: adapter.config.emailNoticeType,
            emailReceiver: adapter.config.emailReceiver,
            emailSender: adapter.config.emailSender,
            onlyError: adapter.config.emailOnlyError,
            emailWaiting: adapter.config.emailWaitToSend * 1000,
            hostName: adapter.config.minimalNameSuffix ? adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const notification = {
            type: 'message',
            ignoreErrors: adapter.config.ignoreErrors,
            bashDir: bashDir,
            entriesNumber: adapter.config.historyEntriesNumber,
            systemLang
        };

        const historyHTML = {
            enabled: true,
            type: 'message',
            entriesNumber: adapter.config.historyEntriesNumber,
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const historyJSON = {
            enabled: true,
            type: 'message',
            entriesNumber: adapter.config.historyEntriesNumber,
            ignoreErrors: adapter.config.ignoreErrors,
            systemLang
        };

        const ftp = {
            enabled: adapter.config.ftpEnabled,
            type: 'storage',
            source: adapter.config.restoreSource,
            host: adapter.config.ftpHost,                                                               // ftp-host
            debugging: adapter.config.debugLevel,
            deleteOldBackup: adapter.config.ftpDeleteOldBackup,                                         // Delete old Backups from FTP
            ftpDeleteAfter: adapter.config.ftpDeleteAfter,
            advancedDelete: adapter.config.advancedDelete,
            ownDir: adapter.config.ftpOwnDir,
            bkpType: adapter.config.restoreType,
            dir: (adapter.config.ftpOwnDir === true) ? null : adapter.config.ftpDir,                    // directory on FTP server
            dirMinimal: adapter.config.ftpMinimalDir,
            user: adapter.config.ftpUser,                                                               // username for FTP Server
            pass: adapter.config.ftpPassword || '',                                                     // password for FTP Server
            port: adapter.config.ftpPort || 21,                                                         // FTP port
            secure: adapter.config.ftpSecure || false,                                                  // secure FTP connection
            signedCertificates: adapter.config.ftpSignedCertificates || true,
            ignoreErrors: adapter.config.ignoreErrors
        };

        let accessToken = '';
        if (adapter.config.dropboxEnabled) {
            dropBoxTokenRefresher = new TokenRefresher(adapter, 'info.dropboxTokens', 'https://oauth2.iobroker.in/dropbox');
            try {
                accessToken = await dropBoxTokenRefresher.getAccessToken();
            } catch (e) {
                adapter.log.error(`No DropBox token found: ${e}`);
            }
        }

        const dropbox = {
            enabled: adapter.config.dropboxEnabled,
            type: 'storage',
            source: adapter.config.restoreSource,
            debugging: adapter.config.debugLevel,
            deleteOldBackup: adapter.config.dropboxDeleteOldBackup,                                     // Delete old Backups from Dropbox
            dropboxDeleteAfter: adapter.config.dropboxDeleteAfter,
            advancedDelete: adapter.config.advancedDelete,
            accessToken: adapter.config.dropboxTokenType === 'custom' ? adapter.config.dropboxAccessToken : accessToken,
            dropboxAccessJson: adapter.config.dropboxAccessJson,
            dropboxTokenType: adapter.config.dropboxTokenType,
            ownDir: adapter.config.dropboxOwnDir,
            bkpType: adapter.config.restoreType,
            dir: (adapter.config.dropboxOwnDir === true) ? null : adapter.config.dropboxDir,
            dirMinimal: adapter.config.dropboxMinimalDir,
            ignoreErrors: adapter.config.ignoreErrors,
        };

        const onedrive = {
            enabled: adapter.config.onedriveEnabled,
            type: 'storage',
            source: adapter.config.restoreSource,
            debugging: adapter.config.debugLevel,
            deleteOldBackup: adapter.config.onedriveDeleteOldBackup,                                    // Delete old Backups from Onedrive
            onedriveDeleteAfter: adapter.config.onedriveDeleteAfter,
            advancedDelete: adapter.config.advancedDelete,
            onedriveAccessJson: adapter.config.onedriveAccessJson,
            ownDir: adapter.config.onedriveOwnDir,
            bkpType: adapter.config.restoreType,
            dir: (adapter.config.onedriveOwnDir === true) ? null : adapter.config.onedriveDir,
            dirMinimal: adapter.config.onedriveMinimalDir,
            ignoreErrors: adapter.config.ignoreErrors
        };

        const webdav = {
            enabled: adapter.config.webdavEnabled,
            type: 'storage',
            source: adapter.config.restoreSource,
            debugging: adapter.config.debugLevel,
            deleteOldBackup: adapter.config.webdavDeleteOldBackup,                                      // Delete old Backups from webdav
            webdavDeleteAfter: adapter.config.webdavDeleteAfter,
            advancedDelete: adapter.config.advancedDelete,
            username: adapter.config.webdavUsername,
            pass: adapter.config.webdavPassword || '',                                                  // webdav password
            url: adapter.config.webdavURL,
            ownDir: adapter.config.webdavOwnDir,
            bkpType: adapter.config.restoreType,
            dir: (adapter.config.webdavOwnDir === true) ? null : adapter.config.webdavDir,
            dirMinimal: adapter.config.webdavMinimalDir,
            signedCertificates: adapter.config.webdavSignedCertificates,
            ignoreErrors: adapter.config.ignoreErrors
        };

        const googledrive = {
            enabled: adapter.config.googledriveEnabled,
            type: 'storage',
            source: adapter.config.restoreSource,
            debugging: adapter.config.debugLevel,
            deleteOldBackup: adapter.config.googledriveDeleteOldBackup,                                 // Delete old Backups from google drive
            googledriveDeleteAfter: adapter.config.googledriveDeleteAfter,
            advancedDelete: adapter.config.advancedDelete,
            accessJson: adapter.config.googledriveAccessTokens || adapter.config.googledriveAccessJson,
            newToken: !!adapter.config.googledriveAccessTokens,
            ownDir: adapter.config.googledriveOwnDir,
            bkpType: adapter.config.restoreType,
            dir: (adapter.config.googledriveOwnDir === true) ? null : adapter.config.googledriveDir,
            dirMinimal: adapter.config.googledriveMinimalDir,
            ignoreErrors: adapter.config.ignoreErrors
        };

        const cifs = {
            enabled: adapter.config.cifsEnabled,
            mountType: adapter.config.connectType,
            type: 'storage',
            source: adapter.config.restoreSource,
            mount: adapter.config.cifsMount,
            debugging: adapter.config.debugLevel,
            fileDir: bashDir,
            wakeOnLAN: adapter.config.wakeOnLAN,
            macAd: adapter.config.macAd,
            wolTime: adapter.config.wolWait,
            wolPort: adapter.config.wolPort || 9,
            wolExtra: adapter.config.wolExtra,
            smb: adapter.config.smbType,
            sudo: adapter.config.sudoMount,
            cifsDomain: adapter.config.cifsDomain,
            clientInodes: adapter.config.noserverino,
            cacheLoose: adapter.config.cacheLoose,
            deleteOldBackup: adapter.config.cifsDeleteOldBackup,                                        //Delete old Backups from Network Disk
            ownDir: adapter.config.cifsOwnDir,
            bkpType: adapter.config.restoreType,
            dir: (adapter.config.cifsOwnDir === true) ? null : adapter.config.cifsDir,                  // specify if CIFS mount should be used
            dirMinimal: adapter.config.cifsMinimalDir,
            user: adapter.config.cifsUser,                                                              // specify if CIFS mount should be used
            pass: adapter.config.cifsPassword || '',                                                    // password for NAS Server
            expertMount: adapter.config.expertMount,
            ignoreErrors: adapter.config.ignoreErrors
        };

        // Configurations for standard-IoBroker backup
        backupConfig.iobroker = {
            name: 'iobroker',
            type: 'creator',
            workDir: ioPath,
            enabled: adapter.config.minimalEnabled,
            time: adapter.config.minimalTime,
            cronjob: adapter.config.iobrokerCronJob,
            ownCron: adapter.config.iobrokerCron,
            debugging: adapter.config.debugLevel,
            slaveBackup: adapter.config.hostType,
            everyXDays: adapter.config.minimalEveryXDays,
            nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                       // names addition, appended to the file name
            deleteBackupAfter: adapter.config.minimalDeleteAfter,                                       // delete old backup files after x days
            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
            onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
            ignoreErrors: adapter.config.ignoreErrors,
            mysql: {
                enabled: adapter.config.mySqlEnabled === undefined ? true : adapter.config.mySqlEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                mysqlQuick: adapter.config.mysqlQuick,
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                mysqlSingleTransaction: adapter.config.mysqlSingleTransaction,
                dbName: adapter.config.mySqlName,                                                       // database name
                user: adapter.config.mySqlUser,                                                         // database user
                pass: adapter.config.mySqlPassword || '',                                               // database password
                deleteBackupAfter: adapter.config.mySqlDeleteAfter,                                     // delete old backupfiles after x days
                host: adapter.config.mySqlHost,                                                         // database host
                port: adapter.config.mySqlPort,                                                         // database port
                mySqlEvents: adapter.config.mySqlEvents,
                mySqlMulti: adapter.config.mySqlMulti,
                ignoreErrors: adapter.config.ignoreErrors,
                exe: adapter.config.mySqlDumpExe                                                        // path to mysqldump
            },
            sqlite: {
                enabled: adapter.config.sqliteEnabled === undefined ? true : adapter.config.sqliteEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                    // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                deleteBackupAfter: adapter.config.sqliteDeleteAfter,                                     // delete old backupfiles after x days
                ignoreErrors: adapter.config.ignoreErrors,
                filePth: adapter.config.sqlitePath,
                exe: adapter.config.sqliteDumpExe                                                        // path to sqlitedump
            },
            dir: tools.getIobDir(),
            influxDB: {
                enabled: adapter.config.influxDBEnabled === undefined ? true : adapter.config.influxDBEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                deleteBackupAfter: adapter.config.influxDBDeleteAfter,                                  // delete old backupfiles after x days
                dbName: adapter.config.influxDBName,                                                    // database name
                host: adapter.config.influxDBHost,                                                      // database host
                port: adapter.config.influxDBPort ? adapter.config.influxDBPort : adapter.config.influxDBVersion == '1.x' ? 8088 : 8086,
                dbversion: adapter.config.influxDBVersion,                                              // dbversion from Influxdb
                token: adapter.config.influxDBToken,                                                    // Token from Influxdb
                protocol: adapter.config.influxDBProtocol,                                              // Protocol Type from Influxdb
                exe: adapter.config.influxDBDumpExe,                                                    // path to influxDBdump
                dbType: adapter.config.influxDBType,                                                    // type of influxdb Backup
                influxDBEvents: adapter.config.influxDBEvents,
                influxDBMulti: adapter.config.influxDBMulti,
                ignoreErrors: adapter.config.ignoreErrors,
                deleteDataBase: adapter.config.deleteOldDataBase                                        // delete old database for restore
            },
            pgsql: {
                enabled: adapter.config.pgSqlEnabled === undefined ? true : adapter.config.pgSqlEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                dbName: adapter.config.pgSqlName,                                                       // database name
                user: adapter.config.pgSqlUser,                                                         // database user
                pass: adapter.config.pgSqlPassword || '',                                               // database password
                deleteBackupAfter: adapter.config.pgSqlDeleteAfter,                                     // delete old backupfiles after x days
                host: adapter.config.pgSqlHost,                                                         // database host
                port: adapter.config.pgSqlPort,                                                         // database port
                pgSqlEvents: adapter.config.pgSqlEvents,
                pgSqlMulti: adapter.config.pgSqlMulti,
                ignoreErrors: adapter.config.ignoreErrors,
                exe: adapter.config.pgSqlDumpExe                                                        // path to mysqldump
            },
            redis: {
                enabled: adapter.config.redisEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                aof: adapter.config.redisAOFactive,
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                path: adapter.config.redisPath || '/var/lib/redis',                                     // specify Redis path
                redisType: adapter.config.redisType,                                                    // local or Remote Backup
                host: adapter.config.redisHost,                                                         // Host for Remote Backup
                port: adapter.config.redisPort,                                                         // Port for Remote Backup
                user: adapter.config.redisUser,                                                         // User for Remote Backup
                pass: adapter.config.redisPassword || '',                                               // Password for Remote Backup
                ignoreErrors: adapter.config.ignoreErrors
            },
            historyDB: {
                enabled: adapter.config.historyEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                path: adapter.config.historyPath,
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                    // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors
            },
            zigbee: {
                enabled: adapter.config.zigbeeEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                path: path.join(tools.getIobDir(), 'iobroker-data'),                                    // specify zigbee path
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors
            },
            esphome: {
                enabled: adapter.config.esphomeEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                path: path.join(tools.getIobDir(), 'iobroker-data'),                                    // specify esphome path
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors
            },
            zigbee2mqtt: {
                enabled: adapter.config.zigbee2mqttEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                path: adapter.config.zigbee2mqttPath,                                                   // specify zigbee2mqtt path
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors
            },
            nodered: {
                enabled: adapter.config.noderedEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                path: path.join(tools.getIobDir(), 'iobroker-data'),                                    // specify Node-Red path
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors
            },
            yahka: {
                enabled: adapter.config.yahkaEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                path: path.join(tools.getIobDir(), 'iobroker-data'),                                    // specify yahka path
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors
            },
            jarvis: {
                enabled: adapter.config.jarvisEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                path: path.join(tools.getIobDir(), 'iobroker-data'),                                    // specify jarvis backup path
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors
            },
            javascripts: {
                enabled: adapter.config.javascriptsEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                   // names addition, appended to the file name
                ignoreErrors: adapter.config.ignoreErrors
            },
            grafana: {
                enabled: adapter.config.grafanaEnabled,
                type: 'creator',
                ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpMinimalDir } : {}),
                cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsMinimalDir } : {}),
                dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxMinimalDir } : {}),
                onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveMinimalDir } : {}),
                webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavMinimalDir } : {}),
                googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveMinimalDir } : {}),
                host: adapter.config.grafanaHost,                                                       // database host
                port: adapter.config.grafanaPort,                                                       // database port
                protocol: adapter.config.grafanaProtocol,                                               // database protocol
                username: adapter.config.grafanaUsername,
                pass: adapter.config.grafanaPassword || '',                                             // database password
                apiKey: adapter.config.grafanaApiKey,
                nameSuffix: adapter.config.minimalNameSuffix.replace(/[.;, ]/g, '_'),                  // names addition, appended to the file name
                slaveSuffix: adapter.config.hostType === 'Slave' ? adapter.config.slaveNameSuffix : '',
                hostType: adapter.config.hostType,
                ignoreErrors: adapter.config.ignoreErrors,
                signedCertificates: adapter.config.grafanaProtocol == 'https' ? adapter.config.grafanaSignedCertificates : true
            },
            historyHTML,
            historyJSON,
            telegram,
            email,
            pushover,
            whatsapp,
            gotify,
            signal,
            matrix,
            discord,
            notification,
        };

        // Configurations for CCU / pivCCU / RaspberryMatic backup
        backupConfig.ccu = {
            name: 'ccu',
            type: 'creator',
            enabled: adapter.config.ccuEnabled,
            time: adapter.config.ccuTime,
            cronjob: adapter.config.ccuCronJob,
            ownCron: adapter.config.ccuCron,
            debugging: adapter.config.debugLevel,
            everyXDays: adapter.config.ccuEveryXDays,
            nameSuffix: adapter.config.ccuNameSuffix,                                                   // names addition, appended to the file name
            deleteBackupAfter: adapter.config.ccuDeleteAfter,                                           // delete old backupfiles after x days
            signedCertificates: adapter.config.ccuSignedCertificates,
            ignoreErrors: adapter.config.ignoreErrors,

            ftp: Object.assign({}, ftp, (adapter.config.ftpOwnDir === true) ? { dir: adapter.config.ftpCcuDir } : {}),
            cifs: Object.assign({}, cifs, (adapter.config.cifsOwnDir === true) ? { dir: adapter.config.cifsCcuDir } : {}),
            dropbox: Object.assign({}, dropbox, (adapter.config.dropboxOwnDir === true) ? { dir: adapter.config.dropboxCcuDir } : {}),
            onedrive: Object.assign({}, onedrive, (adapter.config.onedriveOwnDir === true) ? { dir: adapter.config.onedriveCcuDir } : {}),
            webdav: Object.assign({}, webdav, (adapter.config.webdavOwnDir === true) ? { dir: adapter.config.webdavCcuDir } : {}),
            googledrive: Object.assign({}, googledrive, (adapter.config.googledriveOwnDir === true) ? { dir: adapter.config.googledriveCcuDir } : {}),
            historyHTML,
            historyJSON,
            telegram,
            email,
            pushover,
            whatsapp,
            gotify,
            signal,
            matrix,
            discord,
            notification,

            host: adapter.config.ccuHost,                                                               // IP-address CCU
            user: adapter.config.ccuUser,                                                               // username CCU
            usehttps: adapter.config.ccuUsehttps,                                                       // Use https for CCU Connect
            pass: adapter.config.ccuPassword || '',                                                     // password der CCU
            ccuEvents: adapter.config.ccuEvents,
            ccuMulti: adapter.config.ccuMulti,
        };
        resolve();
    });
}

function readLogFile() {
    try {
        const logName = path.join(tools.getIobDir(), 'backups', 'logs.txt').replace(/\\/g, '/');
        if (fs.existsSync(logName)) {
            adapter.log.debug(`Printing logs of previous backup`);
            const text = fs.readFileSync(logName).toString();
            const lines = text.split('\n');
            lines.forEach((line, i) => lines[i] = line.replace(/\r$|^\r/, ''));
            lines.forEach(line => {
                line = line.trim();

                if (line) {
                    if (line.startsWith('[ERROR]')) {
                        adapter.log.error(line);
                    } else {
                        adapter.log.debug(line);
                    }
                    adapter.setState('output.line', line, true);
                }
            });
            adapter.setState('output.line', '[EXIT] 0', true);
            fs.unlinkSync(logName);
        }
    } catch (e) {
        adapter.log.warn(`Cannot read log file: ${e}`);
    }
}

function createBashScripts() {
    const isWin = process.platform.startsWith('win');
    if (!fs.existsSync(bashDir)) {
        fs.mkdirSync(bashDir);
        adapter.log.debug('BackItUp data-directory created');
    }
    const logFile = path.join(bashDir, `${adapter.namespace}.log`);
    if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '[]');
    }
    if (isWin) {
        adapter.log.debug(`BackItUp has recognized a ${process.platform} system`);

        try {
            fs.writeFileSync(`${bashDir}/stopIOB.bat`, `start "" "${path.join(bashDir, 'external.bat')}"`);
        } catch (e) {
            adapter.log.error(`cannot create stopIOB.bat: ${e}Please run "iobroker fix"`);
        }

        try {
            fs.writeFileSync(`${bashDir}/external.bat`, `cd "${path.join(tools.getIobDir())}"\ncall iobroker stop\ntimeout /T 15\nif exist "${path.join(bashDir, '.redis.info')}" (\nredis-server --service-stop\n)\nif exist "${path.join(bashDir, '.redis.info')}" (\ncd "${path.join(__dirname, 'lib')}"\n) else (\ncd "${path.join(bashDir)}"\n)\nnode restore.js`);
            fs.chmodSync(`${bashDir}/external.bat`, 508);
        } catch (e) {
            adapter.log.error(`cannot create external.sh: ${e}Please run "iobroker fix"`);
        }

        try {
            fs.writeFileSync(`${bashDir}/startIOB.bat`, `if exist "${path.join(bashDir, '.redis.info')}" (\nredis-server --service-start\n)\ncd "${path.join(tools.getIobDir())}"\ncall iobroker host this\ncall iobroker start\nif exist "${path.join(bashDir, '.startAll')}" (\ncd "${path.join(tools.getIobDir(), 'node_modules/iobroker.js-controller')}"\nnode iobroker.js start all\n)`);
        } catch (e) {
            adapter.log.error(`cannot create startIOB.bat: ${e}Please run "iobroker fix"`);
        }
    } else if (fs.existsSync('/opt/scripts/.docker_config/.thisisdocker')) { // Docker Image Support >= 5.2.0
        adapter.log.debug(`BackItUp has recognized a Docker system`);

        try {
            fs.writeFileSync(`${bashDir}/stopIOB.sh`, `#!/bin/bash\n# iobroker stop for restore\nbash ${bashDir}/external.sh`);
            fs.chmodSync(`${bashDir}/stopIOB.sh`, 508);
        } catch (e) {
            adapter.log.error(`cannot create stopIOB.sh: ${e}Please run "iobroker fix"`);
        }

        try {
            fs.writeFileSync(`${bashDir}/startIOB.sh`, `#!/bin/bash\n# iobroker start after restore\nif [ -f ${bashDir}/.startAll ]; then\ncd "${path.join(tools.getIobDir())}"\niobroker start all;\nfi\nsleep 6\nbash /opt/scripts/maintenance.sh off -y`);
            fs.chmodSync(`${bashDir}/startIOB.sh`, 508);
        } catch (e) {
            adapter.log.error(`cannot create startIOB.sh: ${e}Please run "iobroker fix"`);
        }

        try {
            fs.writeFileSync(`${bashDir}/external.sh`, `#!/bin/bash\n# restore\nbash /opt/scripts/maintenance.sh on -y -kbn\nsleep 3\nif [ -f ${bashDir}/.redis.info ]; then\ncd "${path.join(__dirname, 'lib')}"\nelse\ncd "${bashDir}"\nfi\nnode restore.js`);
            fs.chmodSync(`${bashDir}/external.sh`, 508);
        } catch (e) {
            adapter.log.error(`cannot create external.sh: ${e}Please run "iobroker fix"`);
        }
    } else {
        adapter.log.debug(`BackItUp has recognized a ${process.platform} system`);

        try {
            fs.writeFileSync(`${bashDir}/stopIOB.sh`, `# iobroker stop for restore\nsudo systemd-run --uid=iobroker bash ${bashDir}/external.sh`);
            fs.chmodSync(`${bashDir}/stopIOB.sh`, 508);
        } catch (e) {
            adapter.log.error(`cannot create stopIOB.sh: ${e}Please run "iobroker fix"`);
        }

        try {
            fs.writeFileSync(`${bashDir}/startIOB.sh`, `# iobroker start after restore\nif [ -f ${bashDir}/.redis.info ]; then\nredis-cli shutdown nosave && echo "[DEBUG] [redis] Redis restart successfully"\nfi\nif [ -f ${bashDir}/.startAll ]; then\ncd "${path.join(tools.getIobDir())}"\nbash iobroker start all && echo "[EXIT] **** iobroker start upload all now... ****"\nfi\ncd "${path.join(tools.getIobDir())}"\nbash iobroker host this && echo "[DEBUG] [iobroker] Host this successfully"\nbash iobroker start && echo "[EXIT] **** iobroker restart now... ****"`);
            fs.chmodSync(`${bashDir}/startIOB.sh`, 508);
        } catch (e) {
            adapter.log.error(`cannot create startIOB.sh: ${e}Please run "iobroker fix"`);
        }

        try {
            fs.writeFileSync(`${bashDir}/external.sh`, `# restore\ncd "${path.join(tools.getIobDir())}"\nbash iobroker stop && echo "[DEBUG] [iobroker] iobroker stop successfully"\nif [ -f ${bashDir}/.redis.info ]; then\ncd "${path.join(__dirname, 'lib')}"\nelse\ncd "${bashDir}"\nfi\nnode restore.js`);
            fs.chmodSync(`${bashDir}/external.sh`, 508);
        } catch (e) {
            adapter.log.error(`cannot create external.sh: ${e}Please run "iobroker fix"`);
        }
    }
}

// umount after restore
function umount() {

    const backupDir = path.join(tools.getIobDir(), 'backups');
    const child_process = require('node:child_process');

    if (fs.existsSync(`${bashDir}/.mount`)) {
        child_process.exec(`mount | grep -o "${backupDir}"`, (error, stdout, stderr) => {
            if (stdout.includes(backupDir)) {
                adapter.log.debug('mount activ... umount in 2 Seconds!!');
                timerUmount1 = setTimeout(() =>
                    child_process.exec(`${adapter.config.sudoMount ? 'sudo umount' : 'umount'} ${backupDir}`, (error, stdout, stderr) => {
                        if (error) {
                            adapter.log.debug('umount: device is busy... wait 5 Minutes!!');
                            timerUmount2 = setTimeout(() =>
                                child_process.exec(`${adapter.config.sudoMount ? 'sudo umount' : 'umount'} -l ${backupDir}`, (error, stdout, stderr) => {
                                    if (error) {
                                        adapter.log.error(error);
                                    } else {
                                        adapter.log.debug('umount successfully completed');
                                        try {
                                            fs.existsSync(`${bashDir}/.mount`) && fs.unlinkSync(`${bashDir}/.mount`);
                                        } catch (e) {
                                            adapter.log.debug('file ".mount" not deleted ...');
                                        }
                                    }
                                }), 300000);
                        } else {
                            adapter.log.debug('umount successfully completed');
                            try {
                                fs.existsSync(`${bashDir}/.mount`) && fs.unlinkSync(`${bashDir}/.mount`);
                            } catch (e) {
                                adapter.log.debug('file ".mount" not deleted ...');
                            }
                        }
                    }), 2000);
            } else {
                adapter.log.debug('mount inactiv!!');
            }
        });
    }
}

// Create Backupdir on first start
function createBackupDir() {
    if (!fs.existsSync(path.join(tools.getIobDir(), 'backups'))) {
        try {
            fs.mkdirSync(path.join(tools.getIobDir(), 'backups'));
            adapter.log.debug('Created BackupDir');
        } catch (e) {
            adapter.log.warn(`Backup folder not created: ${e}! Please run "iobroker fix" and try again or create the backup folder manually!!`);
        }
    }
}
// delete Hide Files after restore
function deleteHideFiles() {
    fs.existsSync(`${bashDir}/.redis.info`) && fs.unlinkSync(`${bashDir}/.redis.info`);
}
// delete temp dir after restore
function delTmp() {
    if (fs.existsSync(path.join(tools.getIobDir(), 'backups/tmp'))) {
        try {
            fs.rmdirSync(path.join(tools.getIobDir(), 'backups/tmp'));
            adapter.log.debug('delete tmp files');
        } catch (e) {
            adapter.log.warn(`can not delete tmp files: ${e}Please run "iobroker fix" and try again or delete the tmp folder manually!!`);
        }
    }
}
// set start Options after restore
function setStartAll() {
    if (adapter.config.startAllRestore && !fs.existsSync(`${bashDir}/.startAll`)) {
        try {
            fs.writeFileSync(`${bashDir}/.startAll`, 'Start all Adapter after Restore');
            adapter.log.debug('Start all Adapter after Restore enabled');
        } catch (e) {
            adapter.log.warn(`can not create startAll files: ${e}Please run "iobroker fix" and try again`);
        }
    } else if (!adapter.config.startAllRestore && fs.existsSync(`${bashDir}/.startAll`)) {
        try {
            fs.unlinkSync(`${bashDir}/.startAll`);
            adapter.log.debug('Start all Adapter after Restore disabled');
        } catch (e) {
            adapter.log.warn(`can not delete startAll file: ${e}Please run "iobroker fix" and try again`);
        }
    }
}

function getName(name, filenumbers, storage) {
    try {
        const parts = name.split('_');
        if (parseInt(parts[0], 10).toString() !== parts[0]) {
            parts.shift();
        }
        const storageType = storage === 'cifs' ? 'NAS' : storage;
        adapter.log.debug(name ? `detect backup file ${filenumbers} from ${storageType}: ${name}` : 'No backup name was found');
        return new Date(
            parts[0],
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2].split('-')[0], 10),
            parseInt(parts[2].split('-')[1], 10),
            parseInt(parts[3], 10));
    } catch (err) {
        if (err) {
            adapter.log.warn('No backup name was found');
        }
    }
}

async function detectLatestBackupFile(adapter) {
    // get all 'storage' types that enabled
    try {
        let stores = Object.keys(backupConfig.iobroker)
            .filter(attr =>
                typeof backupConfig.iobroker[attr] === 'object' &&
                backupConfig.iobroker[attr].type === 'storage' &&
                backupConfig.iobroker[attr].enabled === true);

        await updateAccessTokens(backupConfig);
        // read one time all stores to detect if some backups detected
        let promises;
        const list = require('./lib/list');
        try {
            promises = stores.map(storage => new Promise(resolve =>
                list(storage, backupConfig, adapter.log, result => {
                    // find the newest file
                    let file = null;

                    if (result && result.data && result.data !== 'undefined') {
                        let filenumbers = 0;
                        let data = result.data;
                        Object.keys(data).forEach(type => {
                            data[type].iobroker && data[type].iobroker
                                .filter(f => f.size)
                                .forEach(f => {
                                    filenumbers++;
                                    const date = getName(f.name, filenumbers, storage);

                                    if (!file || file.date < date) {
                                        file = f;
                                        file.date = date;
                                        file.storage = storage;
                                    }
                                });
                        });
                        result = null;
                        data = null;
                    }
                    resolve(file);
                })));
        } catch (e) {
            adapter.log.warn(`No backup file was found: ${e}`);
        }


        // find the newest file between storages

        Promise.all(promises)
            .then(results => {
                results = results.filter(f => f);
                let file;
                if (results.length) {
                    results.sort((a, b) => {

                        if (a.date > b.date) {
                            return 1;

                        } else if (a.date < b.date) {
                            return -1;
                        } else {
                            return 0;
                        }
                    });
                    file = results[0];

                    if (file.date !== undefined) {
                        try {

                            file.date = file.date.toISOString();
                        } catch (e) {
                            adapter.log.warn(`No backup file date was found: ${e}`);
                        }
                    }
                } else {
                    file = null;
                }
                // this information will be used by admin at the first start if some backup was detected and we can restore from it instead of new configuration
                adapter.setState('info.latestBackup', file ? JSON.stringify(file) : '', true);

                adapter.log.debug(file ? `detect last backup file: ${file.name}` : 'No backup file was found');


                results = null;
            });
        promises = null;

        stores = null;

    } catch (e) {
        adapter.log.warn(`No backup file was found: ${e}`);
    }
}

async function nextBackup(setMain, type) {
    const { CronExpressionParser } = await import('cron-parser');

    if (adapter.config.ccuEnabled && setMain || type === 'ccu') {
        const time = adapter.config.ccuCron ? adapter.config.ccuCronJob : adapter.config.ccuTime.split(':');
        const cron = adapter.config.ccuCron ? time : `00 ${time[1]} ${time[0]} */${adapter.config.ccuEveryXDays} * *`;

        try {
            const cronOptions = {
                currentDate: new Date()
            };

            const interval = CronExpressionParser.parse(cron, cronOptions);
            const nextScheduledDate = interval.next();

            await adapter.setStateAsync(`info.ccuNextTime`, tools.getNextTimeString(systemLang, nextScheduledDate), true);
        } catch (e) {
            adapter.log.warn(`Your configured CCU cronjob is not correct: ${e}`);
        }
    } else if (!adapter.config.ccuEnabled) {
        await adapter.setStateAsync(`info.ccuNextTime`, 'none', true);
    }

    if (adapter.config.minimalEnabled && setMain || type === 'iobroker') {
        const time = adapter.config.iobrokerCron ? adapter.config.iobrokerCronJob : adapter.config.minimalTime.split(':');
        const cron = adapter.config.iobrokerCron ? time : `00 ${time[1]} ${time[0]} */${adapter.config.minimalEveryXDays} * *`;

        try {
            const cronOptions = {
                currentDate: new Date()
            };

            const interval = CronExpressionParser.parse(cron, cronOptions);
            const nextScheduledDate = interval.next();

            await adapter.setStateAsync(`info.iobrokerNextTime`, tools.getNextTimeString(systemLang, nextScheduledDate), true);
        } catch (e) {
            adapter.log.warn(`Your configured iobroker cronjob is not correct: ${e}`);
        }
    } else if (!adapter.config.minimalEnabled) {
        await adapter.setStateAsync(`info.iobrokerNextTime`, 'none', true);
    }
}

async function startSlaveBackup(slaveInstance, num) {
    let waitForInstance = 1000;

    if (num === null || num === undefined) {
        num = 0;
    }

    try {
        const currentState = await adapter.getForeignStateAsync(`system.adapter.${slaveInstance}.alive`);

        if (currentState && currentState.val === false) {
            waitForInstance = 10000;
            adapter.log.debug(`Try to start ${slaveInstance}`);
            await adapter.setForeignStateAsync(`system.adapter.${slaveInstance}.alive`, true);
        }
    } catch (err) {
        adapter.log.error(`error on slave State: ${err}`)
    }

    waitToSlaveBackup = setTimeout(async () => {
        try {
            const currentStateAfter = await adapter.getForeignStateAsync(`system.adapter.${slaveInstance}.alive`);

            if (currentStateAfter && currentStateAfter.val && currentStateAfter.val === true) {
                const sendToSlave = await adapter.sendToAsync(slaveInstance, 'slaveBackup', { config: { deleteAfter: adapter.config.minimalDeleteAfter } });

                if (sendToSlave) {
                    adapter.log.debug(`Slave Backup from ${slaveInstance} is finish with result: ${sendToSlave}`);
                } else {
                    adapter.log.debug(`Slave Backup error from ${slaveInstance}`);
                }

                if (adapter.config.stopSlaveAfter) {
                    await adapter.setForeignStateAsync(`system.adapter.${slaveInstance}.alive`, false);
                    adapter.log.debug(`${slaveInstance} is stopped after backup`);
                }

                num++;

                if (adapter.config.slaveInstance.length > 1 && num != adapter.config.slaveInstance.length) {
                    return slaveTimeOut = setTimeout(startSlaveBackup, 3000, adapter.config.slaveInstance[num], num);
                } else {
                    adapter.log.debug('slave backups are completed');

                    if (adapter.config.onedriveEnabled) {
                        renewOnedriveToken();
                    }
                }
            } else {
                num++;
                adapter.log.warn(`${slaveInstance} is not running. The slave backup for this instance is not possible`);

                if (adapter.config.slaveInstance.length > 1 && num != adapter.config.slaveInstance.length) {
                    return slaveTimeOut = setTimeout(startSlaveBackup, 3000, adapter.config.slaveInstance[num], num);
                } else {
                    adapter.log.debug('slave backups are completed');

                    if (adapter.config.onedriveEnabled) {
                        renewOnedriveToken();
                    }
                }
            }
        } catch (err) {
            adapter.log.error(`error on slave Backup: ${err}`)
        }
    }, waitForInstance);
}

function decryptEvents(secret) {
    if (adapter.config.ccuEvents && adapter.config.ccuMulti) {
        for (let i = 0; i < adapter.config.ccuEvents.length; i++) {
            if (adapter.config.ccuEvents[i].pass) {
                const val = adapter.config.ccuEvents[i].pass;
                adapter.config.ccuEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
    if (adapter.config.mySqlEvents && adapter.config.mySqlMulti) {
        for (let i = 0; i < adapter.config.mySqlEvents.length; i++) {
            if (adapter.config.mySqlEvents[i].pass) {
                const val = adapter.config.mySqlEvents[i].pass;
                adapter.config.mySqlEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
    if (adapter.config.pgSqlEvents && adapter.config.pgSqlMulti) {
        for (let i = 0; i < adapter.config.pgSqlEvents.length; i++) {
            if (adapter.config.pgSqlEvents[i].pass) {
                const val = adapter.config.pgSqlEvents[i].pass;
                adapter.config.pgSqlEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
}

function clearBashDir() {
    // delete restore files
    if (fs.existsSync(bashDir)) {
        const fse = require('fs-extra');
        const restoreDir = path.join(bashDir, 'restore');

        try {
            fs.existsSync(path.join(bashDir, 'restore.js')) && fs.unlinkSync(path.join(bashDir, 'restore.js'));
            fs.existsSync(path.join(bashDir, 'restore.json')) && fs.unlinkSync(path.join(bashDir, 'restore.json'));
            fs.existsSync(restoreDir) && fse.removeSync(restoreDir);

            fs.existsSync(path.join(bashDir, 'iob.key')) && fs.unlinkSync(path.join(bashDir, 'iob.key'));
            fs.existsSync(path.join(bashDir, 'iob.crt')) && fs.unlinkSync(path.join(bashDir, 'iob.crt'));
        } catch (e) {
            adapter.log.debug(`old restore files could not be deleted: ${e}`);
        }
    }
}

async function getCerts(instance) {
    const _adminCert = await adapter.getForeignObjectAsync(instance);

    if (_adminCert && _adminCert.native && _adminCert.native.certPrivate && _adminCert.native.certPublic) {
        const _cert = await adapter.getForeignObjectAsync('system.certificates');

        if (_cert && _cert.native && _cert.native.certificates) {
            try {
                if (_cert.native.certificates[`${_adminCert.native.certPrivate}`].startsWith('/') && fs.existsSync(path.join(_cert.native.certificates[`${_adminCert.native.certPrivate}`]))) {
                    fs.writeFileSync(path.join(bashDir, 'iob.key'), fs.readFileSync(path.join(_cert.native.certificates[`${_adminCert.native.certPrivate}`]), 'utf8'));
                } else {
                    fs.writeFileSync(path.join(bashDir, 'iob.key'), _cert.native.certificates[`${_adminCert.native.certPrivate}`]);
                }
                if (_cert.native.certificates[`${_adminCert.native.certPublic}`].startsWith('/') && fs.existsSync(path.join(_cert.native.certificates[`${_adminCert.native.certPublic}`]))) {
                    fs.writeFileSync(path.join(bashDir, 'iob.crt'), fs.readFileSync(path.join(_cert.native.certificates[`${_adminCert.native.certPublic}`]), 'utf8'));
                } else {
                    fs.writeFileSync(path.join(bashDir, 'iob.crt'), _cert.native.certificates[`${_adminCert.native.certPublic}`]);
                }
            } catch (e) {
                adapter.log.debug('no certificates found');
            }
        }
    }
}

function dlFileServer(protocol) {
    const express = require('express');
    const downloadServer = express();

    // Close all connections from Downloadserver
    if (dlServer && dlServer._connectionKey) {
        try {
            dlServer.closeAllConnections();
        } catch (e) {
            adapter.log.debug(`Download server Connections could not be closed: ${e}`);
        }
        try {
            dlServer.close();
        } catch (e) {
            adapter.log.debug(`Download server Connections could not be closed: ${e}`);
        }
    }
    const port = fs.existsSync('/opt/scripts/.docker_config/.thisisdocker') ? 9081 : 0;

    downloadServer.use(express.static(path.join(tools.getIobDir(), 'backups')));

    let httpServer;
    if (protocol === 'https:') {
        https = https || require('node:https');

        let privateKey = '';
        let certificate = '';

        if (fs.existsSync(path.join(bashDir, 'iob.key')) && fs.existsSync(path.join(bashDir, 'iob.crt'))) {
            try {
                privateKey = fs.readFileSync(path.join(bashDir, 'iob.key'), 'utf8');
                certificate = fs.readFileSync(path.join(bashDir, 'iob.crt'), 'utf8');
            } catch (e) {
                adapter.log.debug('no certificates found');
            }
        }

        try {
            httpServer = https.createServer({ key: privateKey, cert: certificate }, downloadServer);
        } catch (e) {
            adapter.log.debug(`The https server cannot be created: ${e}`);
        }
    } else {
        http = http || require('node:http');

        try {
            httpServer = http.createServer(downloadServer);
        } catch (e) {
            adapter.log.debug(`The http server cannot be created: ${e}`);
        }
    }

    try {
        dlServer = httpServer.listen(port);
        adapter.log.debug(`Download ${protocol.replace(':', '')} server started on port ${dlServer.address().port}`);
    } catch (e) {
        adapter.log.debug('Download server cannot be started');
    }
}

function ulFileServer(protocol) {
    const express = require('express');
    const multer = require('multer');
    const cors = require('cors');

    // Close all Connections from upload server
    try {
        ulServer.closeAllConnections();
    } catch (e) {
        adapter.log.debug('Upload server connections could not be closed');
    }
    try {
        ulServer.close();
    } catch (e) {
        adapter.log.debug('Upload server connections could not be closed');
    }

    const port = fs.existsSync('/opt/scripts/.docker_config/.thisisdocker') ? 9082 : 0;

    const backupDir = path.join(tools.getIobDir(), 'backups');

    const uploadServer = express();
    uploadServer.use(cors());

    const storage = multer.diskStorage({
        destination: (req, file, callback) => callback(null, backupDir),
        filename: function (req, file, callback) {
            adapter.log.debug(`Upload from ${file.originalname} started...`);
            callback(null, file.originalname);
        },
    });

    const upload = multer({ storage });

    uploadServer.post('/', upload.single('files'), (req, res) => {
        adapter.log.debug(req.file);
        res.json({ message: 'File(s) uploaded successfully' });
    });

    let httpServer;
    if (protocol === 'https:') {
        https = https || require('node:https');

        let key = '';
        let cert = '';

        if (fs.existsSync(path.join(bashDir, 'iob.key')) && fs.existsSync(path.join(bashDir, 'iob.crt'))) {
            try {
                key = fs.readFileSync(path.join(bashDir, 'iob.key'), 'utf8');
                cert = fs.readFileSync(path.join(bashDir, 'iob.crt'), 'utf8');
            } catch (e) {
                adapter.log.debug('no certificates found');
            }
        }

        try {
            httpServer = https.createServer({ key, cert }, uploadServer);
        } catch (e) {
            adapter.log.debug(`The https upload server cannot be created: ${e}`);
        }
    } else {
        http = http || require('node:http');

        try {
            httpServer = http.createServer(uploadServer);
        } catch (e) {
            adapter.log.debug(`The http upload server cannot be created: ${e}`);
        }
    }

    try {
        ulServer = httpServer.listen(port);
        adapter.log.debug(`Upload ${protocol.replace(':', '')} server started on port ${ulServer.address().port}`);
    } catch (e) {
        adapter.log.debug('Upload server cannot be started');
    }
}

async function renewOnedriveToken() {
    const Onedrive = require('./lib/oneDriveLib');
    const onedrive = new Onedrive();

    let currentDay = new Date();
    let diffDays;

    if (adapter.config.onedriveLastTokenRenew != '') {
        const lastRenew = new Date(adapter.config.onedriveLastTokenRenew);


        diffDays = parseInt((currentDay - lastRenew) / (1000 * 60 * 60 * 24)); //day difference
    }


    if (diffDays >= 30 || !adapter.config.onedriveLastTokenRenew) {
        adapter.log.debug('Renew Onedrive Refresh-Token');

        onedrive.renewToken(adapter.config.onedriveAccessJson, adapter.log)
            .then(refreshToken => {
                adapter.extendForeignObject(`system.adapter.${adapter.namespace}`, {
                    native: {
                        onedriveAccessJson: refreshToken,
                        onedriveLastTokenRenew: `${(`0${currentDay.getMonth() + 1}`).slice(-2)}/${(`0${currentDay.getDate()}`).slice(-2)}/${currentDay.getFullYear()}`
                    }
                });
            })
            .catch(err => {
                adapter.log.error(err ? JSON.stringify(err) : 'An update of the Onedrive refresh token has failed. Please check your system!');
                adapter.registerNotification('backitup', 'onedriveWarn', err ? JSON.stringify(err) : 'An update of the Onedrive refresh token has failed. Please check your system!');
            });
    } else {

        adapter.log.debug(`Renew Onedrive Refresh-Token in ${30 - diffDays} days`);
    }
}

async function main(adapter) {
    createBashScripts();
    readLogFile();

    if (!fs.existsSync(path.join(tools.getIobDir(), 'backups'))) createBackupDir();
    if (fs.existsSync(`${bashDir}/.redis.info`)) deleteHideFiles();
    if (fs.existsSync(path.join(tools.getIobDir(), 'backups/tmp'))) delTmp();
    clearBashDir();

    timerMain = setTimeout(function () {
        if (fs.existsSync(`${bashDir}/.mount`)) {
            umount();
        }
        if (adapter.config.startAllRestore && !fs.existsSync(`${bashDir}/.startAll`)) {
            setStartAll();
        }
    }, 10000);

    adapter.getForeignObject('system.config', async (err, obj) => {
        if (obj?.common?.language) {
            systemLang = obj.common.language;
        }

        await initConfig(obj?.native?.secret || 'Zgfr56gFe87jJOM');

        checkStates();

        if (adapter.config.hostType !== 'Slave') {
            createBackupSchedule();
            nextBackup(true, null);

            detectLatestBackupFile(adapter);
        }
    });

    // subscribe on all variables of this adapter instance with pattern "adapterName.X.memory*"
    adapter.subscribeStates('oneClick.*');
}
// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
