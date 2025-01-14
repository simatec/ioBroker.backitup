const path = require('node:path');
const fs = require('node:fs');
const tools = require('./tools');

let timerCleanFiles;
let tmpLog = '';

function loadScripts(callback) {
    const scripts = {};
    let files;
    try {
        files = fs.readdirSync(`${__dirname}/scripts`);
        files.forEach(file => {
            if (file.endsWith('.js')) {
                scripts[file.substring(3, file.length - 3)] = require(`${__dirname}/scripts/${file}`);
            }
        });
    } catch (e) {
        callback(`error on backup: ${e} Please run "iobroker fix" and reinstall BackItUp`);
    }
    return scripts;
}

function writeIntoFile(fileName, text) {
    if (text) {
        console.log(text);
        try {
            fs.appendFileSync(fileName, `${text}\n`);
        } catch (e) {
            // ignore
        }
    }
}

function createBackupLog(config, adapter) {
    // Create Backup Logs for History
    const logFile = path.join(config.notification.bashDir, `${adapter.namespace}.log`);

    if (fs.existsSync(logFile)) {
        const data = fs.readFileSync(logFile, 'utf8');
        const backupLog = JSON.parse(data);
        const timestamp = config.timestamp;

        try {
            backupLog.unshift({ [timestamp]: tmpLog });
        } catch (err) {
            adapter.log.error(`Backup Logs could not be created: ${err}`);
        }

        if (backupLog && backupLog.length > config.notification.entriesNumber) {
            backupLog.splice(config.notification.entriesNumber, backupLog.length - config.notification.entriesNumber);
        }

        fs.writeFileSync(logFile, JSON.stringify(backupLog));
        tmpLog = '';
    }
}

function executeScripts(adapter, config, callback, scripts, code) {
    if (!scripts) {
        scripts = loadScripts(callback);
        config.backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');
        config.timestamp = new Date().getTime(),
            config.context = { fileNames: [], errors: {}, done: [], types: [] }; // common variables between scripts

        if (!fs.existsSync(config.backupDir)) {
            try {
                fs.mkdirSync(config.backupDir);
                fs.chmodSync(config.backupDir, '0775');
            } catch (e) {
                callback(`Backup directory cannot created: ${e} Please reinstall BackItUp and run "iobroker fix"!!`);
            }
        } else if ((!config.cifs.enabled) || (config.cifs.enabled && config.cifs.mountType === 'Copy')) {
            try {
                fs.chmodSync(config.backupDir, '0775');
            } catch (e) {
                callback(`chmod for Backup directory could not be completed: ${e} Please run "iobroker fix"!!`);
            }
        }
    }

    for (const name in scripts) {
        if (scripts.hasOwnProperty(name) && scripts[name] && (!config.afterBackup || scripts[name].afterBackup)) {
            let func;
            let options;
            switch (name) {
                // Mount tasks
                case 'mount':
                    if (config.cifs?.enabled && config.cifs.mount) {
                        func = scripts[name];
                        options = config.cifs;
                    }
                    break;

                case 'umount':
                    if (config.cifs?.enabled && config.cifs.mount) {
                        func = scripts[name];
                        options = config.cifs;
                    }
                    break;

                // Copy/delete tasks
                case 'clean':
                    func = scripts[name];
                    options = { name: config.name, deleteBackupAfter: config.deleteBackupAfter, ignoreErrors: config.ignoreErrors };
                    break;

                case 'cifs':
                case 'webdav':
                case 'dropbox':
                case 'onedrive':
                case 'googledrive':
                case 'ftp':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name], { name: config.name, deleteBackupAfter: config.deleteBackupAfter });
                    }
                    break;

                // Extra data sources
                case 'mysql':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                case 'sqlite':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                case 'pgsql':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                case 'redis':
                    if ((config.name === 'iobroker' && config[name] && config[name].enabled)) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                case 'historyDB':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;
                case 'javascripts':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                case 'zigbee':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;
                case 'esphome':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;
                case 'zigbee2mqtt':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;
                case 'nodered':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;
                case 'yahka':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;
                case 'grafana':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                case 'jarvis':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                case 'influxDB':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                // Main tasks
                case 'ccu':
                case 'iobroker':
                    if (config.name === name && config.enabled && config.slaveBackup !== 'Slave') {
                        func = scripts[name];
                        options = config;
                    }
                    break;

                // Messaging tasks
                case 'historyHTML':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for historyHTML!!');
                        }
                    }
                    break;

                case 'historyJSON':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for historyJSON!!');
                        }
                    }
                    break;

                case 'telegram':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'Telegram') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for telegram!!');
                        }
                    }
                    break;

                case 'whatsapp':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'WhatsApp') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for whatsapp!!');
                        }
                    }
                    break;

                case 'gotify':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'Gotify') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for gotify!!');
                        }
                    }
                    break;

                case 'signal':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'Signal') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for signal!!');
                        }
                    }
                    break;

                case 'matrix':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'Matrix') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for matrix!!');
                        }
                    }
                    break;

                case 'email':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'E-Mail') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for email!!');
                        }
                    }
                    break;

                case 'pushover':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'Pushover') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for pushover!!');
                        }
                    }
                    break;

                case 'discord':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'Discord') {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for discord!!');
                        }
                    }
                    break;

                case 'notification':
                    if (config[name]) {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config));
                            options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                        } catch (e) {
                            callback('cannot parse config for notification!!');
                        }
                    }
                    break;
            }

            scripts[name] = null;

            if (func) {
                try {
                    const _options = JSON.parse(JSON.stringify(options));

                    if (_options.ftp && !_options.ftp.enabled) delete _options.ftp;
                    if (_options.cifs && !_options.cifs.enabled) delete _options.cifs;
                    if (_options.telegram && !_options.telegram.enabled) delete _options.telegram;
                    if (_options.pushover && !_options.pushover.enabled) delete _options.pushover;
                    if (_options.email && !_options.email.enabled) delete _options.email;
                    if (_options.whatsapp && !_options.whatsapp.enabled) delete _options.whatsapp;
                    if (_options.gotify && !_options.gotify.enabled) delete _options.gotify;
                    if (_options.discord && !_options.discord.enabled) delete _options.discord;
                    if (_options.dropbox && !_options.dropbox.enabled) delete _options.dropbox;
                    if (_options.onedrive && !_options.onedrive.enabled) delete _options.onedrive;
                    if (_options.webdav && !_options.webdav.enabled) delete _options.webdav;
                    if (_options.googledrive && !_options.googledrive.enabled) delete _options.googledrive;
                    if (_options.mysql && !_options.mysql.enabled) delete _options.mysql;
                    if (_options.sqlite && !_options.sqlite.enabled) delete _options.sqlite;
                    if (_options.pgsql && !_options.pgsql.enabled) delete _options.pgsql;
                    if (_options.influxDB && !_options.influxDB.enabled) delete _options.influxDB;
                    if (_options.grafana && !_options.grafana.enabled) delete _options.grafana;
                    if (_options.javascripts && !_options.javascripts.enabled) delete _options.javascripts;
                    if (_options.jarvis && !_options.jarvis.enabled) delete _options.jarvis;
                    if (_options.zigbee && !_options.zigbee.enabled) delete _options.zigbee;
                    if (_options.esphome && !_options.esphome.enabled) delete _options.esphome;
                    if (_options.zigbee2mqtt && !_options.zigbee2mqtt.enabled) delete _options.zigbee2mqtt;
                    if (_options.nodered && !_options.nodered.enabled) delete _options.nodered;
                    if (_options.yahka && !_options.yahka.enabled) delete _options.yahka;
                    if (_options.historyDB && !_options.historyDB.enabled) delete _options.historyDB;
                    if (_options.redis && !_options.redis.enabled) delete _options.redis;

                    if (_options.ftp && _options.ftp.backupDir !== undefined) delete _options.ftp.backupDir;
                    if (_options.cifs && _options.cifs.backupDir !== undefined) delete _options.cifs.backupDir;
                    if (_options.mysql && _options.mysql.backupDir !== undefined) delete _options.mysql.backupDir;
                    if (_options.sqlite && _options.sqlite.backupDir !== undefined) delete _options.sqlite.backupDir;
                    if (_options.pgsql && _options.pgsql.backupDir !== undefined) delete _options.pgsql.backupDir;
                    if (_options.influxDB && _options.influxDB.backupDir !== undefined) delete _options.influxDB.backupDir;
                    if (_options.grafana && _options.grafana.backupDir !== undefined) delete _options.grafana.backupDir;
                    if (_options.jarvis && _options.jarvis.backupDir !== undefined) delete _options.jarvis.backupDir;
                    if (_options.zigbee && _options.zigbee.backupDir !== undefined) delete _options.zigbee.backupDir;
                    if (_options.esphome && _options.esphome.backupDir !== undefined) delete _options.esphome.backupDir;
                    if (_options.zigbee2mqtt && _options.zigbee2mqtt.backupDir !== undefined) delete _options.zigbee2mqtt.backupDir;
                    if (_options.nodered && _options.nodered.backupDir !== undefined) delete _options.nodered.backupDir;
                    if (_options.yahka && _options.yahka.backupDir !== undefined) delete _options.yahka.backupDir;
                    if (_options.javascripts && _options.javascripts.backupDir !== undefined) delete _options.javascripts.backupDir;
                    if (_options.redis && _options.redis.backupDir !== undefined) delete _options.redis.backupDir;
                    if (_options.historyDB && _options.historyDB.backupDir !== undefined) delete _options.historyDB.backupDir;
                    if (!_options.nameSuffix && _options.nameSuffix !== undefined) delete _options.nameSuffix;

                    if (_options.enabled !== undefined) delete _options.enabled;
                    if (_options.context !== undefined) delete _options.context;
                    if (_options.name !== undefined) delete _options.name;

                    if (_options.ftp && _options.ftp.pass !== undefined) _options.ftp.pass = '****';
                    if (_options.cifs && _options.cifs.pass !== undefined) _options.cifs.pass = '****';
                    if (_options.mysql && _options.mysql.pass !== undefined) _options.mysql.pass = '****';
                    if (_options.dropbox && _options.dropbox.onedriveAccessJson !== undefined) _options.dropbox.onedriveAccessJson = '****';
                    if (_options.onedrive && _options.onedrive.accessToken !== undefined) _options.onedrive.accessToken = '****';
                    if (_options.googledrive && _options.googledrive.accessJson !== undefined) _options.googledrive.accessJson = '****';
                    if (_options.webdav && _options.webdav.pass !== undefined) _options.webdav.pass = '****';
                    if (_options.grafana && _options.grafana.apiKey !== undefined) _options.grafana.apiKey = '****';
                    if (_options.grafana && _options.grafana.pass !== undefined) _options.grafana.pass = '****';

                    if (_options.accessToken !== undefined) _options.accessToken = '****';
                    if (_options.pass !== undefined) _options.pass = '****';
                    if (_options.adapter !== undefined) delete _options.adapter;
                    if (_options.accessJson !== undefined) _options.accessJson = '****';
                    if (_options.apiKey !== undefined) _options.apiKey = '****';

                    for (const i in _options) {
                        if (_options[i] !== null && _options[i].dropbox && _options[i].dropbox !== undefined) _options[i].dropbox.accessToken = '****';
                        if (_options[i] !== null && _options[i].onedrive && _options[i].onedrive !== undefined) _options[i].onedrive.onedriveAccessJson = '****';
                        if (_options[i] !== null && _options[i].cifs && _options[i].cifs !== undefined) _options[i].cifs.pass = '****';
                        if (_options[i] !== null && _options[i].ftp && _options[i].ftp !== undefined) _options[i].ftp.pass = '****';
                        if (_options[i] !== null && _options[i].googledrive && _options[i].googledrive !== undefined) _options[i].googledrive.accessJson = '****';
                        if (_options[i] !== null && _options[i].mysql && _options[i].mysql !== undefined) _options[i].mysql.pass = '****';
                        if (_options[i] !== null && _options[i].ccu && _options[i].ccu !== undefined) _options[i].ccu.pass = '****';
                        if (_options[i] !== null && _options[i].webdav && _options[i].webdav !== undefined) _options[i].webdav.pass = '****';
                        if (_options[i] !== null && _options[i].grafana && _options[i].grafana !== undefined) _options[i].grafana.pass = '****';
                        if (_options[i] !== null && _options[i].grafana && _options[i].grafana !== undefined) _options[i].grafana.apiKey = '****';

                    }
                    if (_options.debugging == true) {
                        setTimeout(function () {
                            adapter && adapter.setState('output.line', `[DEBUG] [${name}] start with ${JSON.stringify(_options)}`, true);
                        }, 200);
                    }
                } catch (e) {
                    callback(`error on backup process: Script "${name}" ${e} Please check the config of BackItUp and execute "iobroker fix"`);
                    timerCleanFiles = setTimeout(function () {
                        setImmediate(executeScripts, adapter, config, callback, scripts, code);
                    }, 150);
                    return;
                }

                if (!options) {
                    callback(`error on backup process: No valid options for "${name}" Please check the config of BackItUp and execute "iobroker fix"`);
                    timerCleanFiles = setTimeout(function () {
                        setImmediate(executeScripts, adapter, config, callback, scripts, code);
                    }, 150);

                    return;
                }

                options.context = config.context;
                options.backupDir = config.backupDir;
                options.timestamp = config.timestamp;
                options.adapter = adapter;

                // for delete on Multi-Backup
                if (config.influxDB && config.influxDB.influxDBMulti) options.influxDBMulti = config.influxDB.influxDBMulti;
                if (config.influxDB && config.influxDB.influxDBEvents) options.influxDBEvents = config.influxDB.influxDBEvents;
                if (config.mysql && config.mysql.mySqlMulti) options.mySqlMulti = config.mysql.mySqlMulti;
                if (config.mysql && config.mysql.mySqlEvents) options.mySqlEvents = config.mysql.mySqlEvents;
                if (config.pgsql && config.pgsql.pgSqlMulti) options.pgSqlMulti = config.pgsql.pgSqlMulti;
                if (config.pgsql && config.pgsql.pgSqlEvents) options.pgSqlEvents = config.pgsql.pgSqlEvents;
                if (config.ccuMulti) options.ccuMulti = config.ccuMulti;
                if (config.ccuEvents) options.ccuEvents = config.ccuEvents;


                const fileName = path.join(config.backupDir, 'logs.txt');

                const log = {
                    debug: function (text) {
                        let lines;
                        if (typeof text !== 'string') {
                            text = text.toString();
                        }
                        lines = text.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter && adapter.log.debug(`[${config.name}/${name}] ${line}`);
                            line && !adapter && writeIntoFile(fileName, `[DEBUG] [${config.name}/${name}] ${line}`);
                            adapter && adapter.setState('output.line', `[DEBUG] [${name}] - ${text}`, true);
                        });
                        tmpLog += `[DEBUG] [${name}] ${text}${text.endsWith('\n') ? '' : '\n'}`;
                        adapter && adapter.setState('output.line', `[DEBUG] [${name}] - ${text}`, true);
                    },
                    warn: function (warning) {
                        const lines = (warning || '').toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter && adapter.log.warn(`[${config.name}/${name}] ${line}`);
                            line && !adapter && writeIntoFile(fileName, `[WARN] [${config.name}/${name}] ${line}`);
                        });
                        tmpLog += `[WARN] [${name}] ${warning}${warning.endsWith('\n') ? '' : '\n'}`;
                        adapter && adapter.setState('output.line', `[WARN] [${name}] - ${warning}`, true);
                    },
                    error: function (err) {
                        const lines = (err || '').toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter && adapter.log.error(`[${config.name}/${name}] ${line}`);
                            line && !adapter && writeIntoFile(fileName, `[ERROR] [${config.name}/${name}] ${line}`);
                        });
                        tmpLog += `[ERROR] [${name}] ${err}\n`;
                        adapter && adapter.setState('output.line', `[ERROR] [${name}] - ${err}`, true);
                    }
                };

                try {
                    // generic Error handling for all synchron errors in backup scripts
                    func.command(options, log, (err, output, _code) => {
                        options.adapter = null;

                        if (_code !== undefined) {
                            code = _code
                        }
                        if (err) {
                            //if (func.ignoreErrors) {
                            if (options.ignoreErrors) {
                                log.error(`[IGNORED] ${err}`);
                                timerCleanFiles = setTimeout(function () {
                                    setImmediate(executeScripts, adapter, config, callback, scripts, code);
                                }, 150);
                            } else {
                                log.error(err);
                                callback && callback(err);
                            }
                        } else {
                            log.debug(output || 'done');
                            timerCleanFiles = setTimeout(function () {
                                setImmediate(executeScripts, adapter, config, callback, scripts, code);
                            }, 150);
                        }
                    });
                } catch (e) {
                    callback(`error on backup process: Error when executing script "${name}": ${e} Please check the config of BackItUp and execute "iobroker fix"`);
                    timerCleanFiles = setTimeout(function () {
                        setImmediate(executeScripts, adapter, config, callback, scripts, code);
                    }, 150);
                }
            } else {
                timerCleanFiles = setTimeout(function () {
                    setImmediate(executeScripts, adapter, config, callback, scripts, code);
                }, 150);
            }
            return;
        }
    }

    adapter && adapter.setState('output.line', `[EXIT] ${code || 0}`, true);
    createBackupLog(config, adapter);
    clearTimeout(timerCleanFiles);
    callback && callback();
}

if (typeof module !== 'undefined' && module.parent) {
    module.exports = executeScripts;
}
