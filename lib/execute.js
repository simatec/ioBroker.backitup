const path = require('path');
const fs = require('fs');
const tools = require('./tools');
const getTimeString = require(__dirname + '/tools').getTimeString;

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
        if (adapter && config.stopIoB && !config.afterBackup) {
            if (fs.existsSync(__dirname + '/total.json')) {
                const text = fs.readFileSync(__dirname + '/total.json');
                if (text !== JSON.stringify(config, null, 2)) {
                    fs.writeFileSync(__dirname + '/total.json', JSON.stringify(config, null, 2));
                }
            } else {
                fs.writeFileSync(__dirname + '/total.json', JSON.stringify(config, null, 2));
            }

            startDetachedBackup();
            return callback && callback();
        }

        scripts = loadScripts();
        config.backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');
        config.context = {}; // common variables between scripts

        if (!fs.existsSync(config.backupDir)) {
            fs.mkdirSync(config.backupDir);
        }
    }

    for (const name in scripts) {
        if (scripts.hasOwnProperty(name) && scripts[name] && (!config.afterBackup || scripts[name].afterBackup)) {
            let func;
            let options;
            switch (name) {
                case 'mount':
                case 'umount':
                    if (config.cifs && config.cifs.enabled && config.cifs.mount) {
                        func = scripts[name];
                        options = config.cifs;
                    }
                    break;

                case 'cifs':
                case 'dropbox':
                case 'ftp':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name], {name: config.name, deleteBackupAfter: config.deleteBackupAfter});
                    }
                    break;

                case 'mysql':
                case 'redis':
                    if (config.name === 'total' && config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = config[name];
                    }
                    break;

                case 'ccu':
                case 'total':
                case 'minimal':
                    if (config.name === name && config.enabled) {
                        func = scripts[name];
                        options = config;
                    }
                    break;

                case 'history':
                case 'telegram':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = JSON.parse(JSON.stringify(config));
                        options[name].time = tools.getTimeString(options[name].systemLang); // provide date
                    }
                    break;
            }

            scripts[name] = null;

            if (func) {
                const _options = JSON.parse(JSON.stringify(options));
                if (_options.pass) _options.pass = '****';
                if (_options.ftp  && !_options.ftp.enabled) delete _options.ftp;
                if (_options.cifs  && !_options.cifs.enabled) delete _options.cifs;
                if (_options.telegram  && !_options.telegram.enabled) delete _options.telegram;
                if (_options.dropbox  && !_options.dropbox.enabled) delete _options.dropbox;
                if (_options.mySql  && !_options.mySql.enabled) delete _options.mySql;

                if (_options.ftp  && _options.ftp.backupDir !== undefined) delete _options.ftp.backupDir;
                if (_options.cifs  && _options.cifs.backupDir !== undefined) delete _options.cifs.backupDir;
                if (_options.mySql  && _options.mySql.backupDir !== undefined) delete _options.mySql.backupDir;
                if (_options.redis  && _options.redis.backupDir !== undefined) delete _options.redis.backupDir;
                if (!_options.nameSuffix && _options.nameSuffix !== undefined) delete _options.nameSuffix;

                if (_options.enabled !== undefined) delete _options.enabled;
                if (_options.context !== undefined) delete _options.context;
                if (_options.name !== undefined) delete _options.name;

                if (_options.ftp  && _options.ftp.pass) _options.ftp.pass = '****';
                if (_options.cifs && _options.cifs.pass) _options.cifs.pass = '****';
                if (_options.mySql && _options.mySql.pass) _options.mySql.pass = '****';
                if (_options.dropbox && _options.dropbox.accessToken) _options.dropbox.accessToken = '****';

                adapter && adapter.setState('output.line', `[DEBUG] [${name}] start with ${JSON.stringify(_options)}`);

                options.context = config.context;
                options.backupDir = config.backupDir;

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
                        const lines = err.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter && adapter.log.debug(`[${config.name}/${name}] ${line}`);
                            line && !adapter && writeIntoFile(fileName, `[ERROR] [${config.name}/${name}] ${line}`);
                        });
                        adapter && adapter.setState('output.line', '[ERROR] [' + name + '] - ' + err);
                    }
                };

                func.command(options, log, (err, output, _code) => {
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

    // todo
    // delete all local files if required from config.context.fileNames
    // or delete all files from past backups

    adapter && adapter.setState('output.line', '[EXIT] ' + (code || 0));
    callback && callback();
}

function startDetachedBackup() {
    const {spawn} = require('child_process');
    const isWin = process.platform.startsWith('win');

    const cmd = spawn(isWin ? 'stopIOB.bat' : 'bash', [isWin ? '' : 'stopIOB.sh'], {detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore']});

    cmd.unref();
}

function startIOB() {
    const {spawn} = require('child_process');
    const isWin = process.platform.startsWith('win');

    const cmd = spawn(isWin ? 'startIOB.bat' : 'bash', [isWin ? '' : 'startIOB.sh'], {detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore']});

    cmd.unref();
    setTimeout(() => process.exit(), 1000);
}

if (typeof module !== 'undefined' && module.parent) {
    module.exports = executeScripts;
} else {
    if (fs.existsSync(__dirname + '/total.json')) {
        const config = require(__dirname + '/total.json');
        executeScripts(null, config, () => startIOB());
    } else {
        console.log('No config found at "' + path.normalize(path.join(__dirname, '../total.json')) + '"');
    }
}
