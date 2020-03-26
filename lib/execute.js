const path = require('path');
const fs = require('fs');
const tools = require('./tools');

function loadScripts() {
    const scripts = {};
    const files = fs.readdirSync(__dirname + '/scripts');
    files.forEach(file => {
        scripts[file.substring(3, file.length - 3)] = require(__dirname + '/scripts/' + file);
    });
    return scripts;
}

function writeIntoFile(fileName, text) {
    if (text) {
        console.log(text);
        try {
            fs.appendFileSync(fileName, text + '\n');
        } catch (e) {

        }
    }
}

function executeScripts(adapter, config, callback, scripts, code) {
    if (!scripts) {
        scripts = loadScripts();
        config.backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');
        config.context = {fileNames: [], errors: {}, done: [], types: []}; // common variables between scripts

        if (!fs.existsSync(config.backupDir)) {
            fs.mkdirSync(config.backupDir);
        }
    }

    for (const name in scripts) {
        if (scripts.hasOwnProperty(name) && scripts[name] && (!config.afterBackup || scripts[name].afterBackup)) {
            let func;
            let options;
            switch (name) {
                // Mount tasks
                case 'mount':
                	if (config.cifs && config.cifs.enabled && config.cifs.mount) {
						func = scripts[name];
						options = config.cifs;
					}
                    break;
                case 'umount':
                	if (config.cifs && config.cifs.enabled && config.cifs.mount) {
						func = scripts[name];
                        options = config.cifs;
					}
                    break;

                // Copy/delete tasks
                case 'clean':
                    func = scripts[name];
                    options = {name: config.name, deleteBackupAfter: config.deleteBackupAfter};
                    break;

                case 'cifs':
                case 'dropbox':
                case 'googledrive':
                case 'ftp':
					if (config[name] && config[name].enabled) {
						func = scripts[name];
						options = Object.assign({}, config[name], {name: config.name, deleteBackupAfter: config.deleteBackupAfter});
					}
					break;

                // Extra data sources
                case 'mysql':
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

                case 'zigbee':
                    if (config.name === 'iobroker' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name]);
                    }
                    break;

                // Main tasks
                case 'ccu':
                case 'iobroker':
                    if (config.name === name && config.enabled) {
                        func = scripts[name];
                        options = config;
                    }
                    break;

                // Messaging tasks
                case 'history':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = JSON.parse(JSON.stringify(config));
                        options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                    }
                    break;

                case 'telegram':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'Telegram') {
                        func = scripts[name];
                        options = JSON.parse(JSON.stringify(config));
                        options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                    }
                    break;
                
                case 'email':
                    if (config[name] && config[name].enabled && config[name].notificationsType === 'E-Mail') {
                        func = scripts[name];
                        options = JSON.parse(JSON.stringify(config));
                        options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                    }
                    break;
                
                case 'pushover':
                if (config[name] && config[name].enabled && config[name].notificationsType === 'Pushover') {
                    func = scripts[name];
                    options = JSON.parse(JSON.stringify(config));
                    options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                }
                break;
            }

            scripts[name] = null;

            if (func) {
                const _options = JSON.parse(JSON.stringify(options));
                if (_options.ftp  && !_options.ftp.enabled) delete _options.ftp;
                if (_options.cifs  && !_options.cifs.enabled) delete _options.cifs;
                if (_options.telegram  && !_options.telegram.enabled) delete _options.telegram;
                if (_options.dropbox  && !_options.dropbox.enabled) delete _options.dropbox;
                if (_options.googledrive  && !_options.googledrive.enabled) delete _options.googledrive;
                if (_options.mysql  && !_options.mysql.enabled) delete _options.mysql;

                if (_options.ftp  && _options.ftp.backupDir !== undefined) delete _options.ftp.backupDir;
                if (_options.cifs  && _options.cifs.backupDir !== undefined) delete _options.cifs.backupDir;
                if (_options.mysql  && _options.mysql.backupDir !== undefined) delete _options.mysql.backupDir;
                if (_options.redis  && _options.redis.backupDir !== undefined) delete _options.redis.backupDir;
                if (!_options.nameSuffix && _options.nameSuffix !== undefined) delete _options.nameSuffix;

                if (_options.enabled !== undefined) delete _options.enabled;
                if (_options.context !== undefined) delete _options.context;
                if (_options.name !== undefined) delete _options.name;

                if (_options.ftp  && _options.ftp.pass !== undefined) _options.ftp.pass = '****';
                if (_options.cifs && _options.cifs.pass !== undefined) _options.cifs.pass = '****';
                if (_options.mysql && _options.mysql.pass !== undefined) _options.mysql.pass = '****';
                if (_options.dropbox && _options.dropbox.accessToken !== undefined) _options.dropbox.accessToken = '****';
                if (_options.googledrive && _options.googledrive.accessJson !== undefined) _options.googledrive.accessJson = '****';

                if (_options.accessToken !== undefined) _options.accessToken = '****';
                if (_options.pass !== undefined) _options.pass = '****';
                if (_options.adapter !== undefined) delete _options.adapter;
                if (_options.accessJson !== undefined) _options.accessJson = '****';

                for (const i in _options) {
                    if (_options[i] !== null && _options[i].dropbox && _options[i].dropbox !== undefined) _options[i].dropbox.accessToken = '****';
                    if (_options[i] !== null && _options[i].cifs && _options[i].cifs !== undefined) _options[i].cifs.pass = '****';
                    if (_options[i] !== null && _options[i].ftp && _options[i].ftp !== undefined) _options[i].ftp.pass = '****';
                    if (_options[i] !== null && _options[i].googledrive && _options[i].googledrive !== undefined) _options[i].googledrive.accessJson = '****';
                    if (_options[i] !== null && _options[i].mysql && _options[i].mysql !== undefined) _options[i].mysql.pass = '****';
                    if (_options[i] !== null && _options[i].ccu && _options[i].ccu !== undefined) _options[i].ccu.pass = '****';
                }
                if (_options.debugging == true) {
                    setTimeout(function() {
                        adapter && adapter.setState('output.line', `[DEBUG] [${name}] start with ${JSON.stringify(_options)}`);
                    }, 200);
                }

                options.context = config.context;
                options.backupDir = config.backupDir;
                options.adapter = adapter;

                const fileName = path.join(config.backupDir, 'logs.txt');

                const log = {
                    debug: function (text) {
                        const lines = text.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter && adapter.log.debug(`[${config.name}/${name}] ${line}`);
                            line && !adapter && writeIntoFile(fileName, `[DEBUG] [${config.name}/${name}] ${line}`);
                        });
                        adapter && adapter.setState('output.line', '[DEBUG] [' + name + '] - ' + text);
                    },
                    error: function (err) {
                        const lines = (err || '').toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter && adapter.log.debug(`[${config.name}/${name}] ${line}`);
                            line && !adapter && writeIntoFile(fileName, `[ERROR] [${config.name}/${name}] ${line}`);
                        });
                        adapter && adapter.setState('output.line', '[ERROR] [' + name + '] - ' + err);
                    }
                };

                func.command(options, log, (err, output, _code) => {
                    options.adapter = null;

                    if (_code !== undefined) {
                        code = _code
                    }
                    if (err) {
                        if (func.ignoreErrors) {
                            log.error('[IGNORED] ' + err);
                            setImmediate(executeScripts, adapter, config, callback, scripts, code);
                        } else {
                            log.error(err);
                            callback && callback(err);
                        }
                    } else {
                        log.debug(output || 'done');
                        setImmediate(executeScripts, adapter, config, callback, scripts, code);
                    }
                });
            } else {
                setImmediate(executeScripts, adapter, config, callback, scripts, code);
            }
            return;
        }
    }

    adapter && adapter.setState('output.line', '[EXIT] ' + (code || 0));
    callback && callback();
}

if (typeof module !== "undefined" && module.parent) {
    module.exports = executeScripts;
}