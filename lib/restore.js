const tools = require('./tools');
const fs = require('fs');
const path = require('path');

function writeIntoFile(fileName, text) {
    if (text) {
        console.log(text);
        try {
            fs.appendFileSync(fileName, text + '\n');
        } catch (e) {

        }
    }
}

function getConfig(options, backupType, storageType) {
    let config = options[backupType];
    if (!config) {
        for (const attr in options) {
            if (options.hasOwnProperty(attr) &&
                typeof options[attr] === 'object' &&
                options[attr][backupType]) {
                config = options[attr][backupType];
                break;
            }
        }
        if (!config) {
            for (const attr in options) {
                if (options.hasOwnProperty(attr) &&
                    typeof options[attr] === 'object' &&
                    options[attr][storageType]) {
                    config = options[attr][storageType];
                    break;
                }
            }
        }
    } else if (storageType) {
        return config[storageType];
    }
    return config;
}

function getFile(options, storageType, fileName, toSaveName, log, callback) {
    if (fs.existsSync(toSaveName)) {
        callback(null, toSaveName);
    } else {
        const name = fileName.split('/').pop();
        let backupType = name.split('_')[0];
        if (name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
            backupType = 'minimal';
        }
        let config = getConfig(options, backupType, storageType);
        if (storageType !== 'local') {
            const _getFile = require('./list/' + storageType).getFile;
            _getFile(config, fileName, toSaveName, log, callback);
        } else {
            tools.copyFile(fileName, toSaveName, callback);
        }
    }
}
function startDetachedRestore() {
    const {spawn} = require('child_process');
    const isWin = process.platform.startsWith('win');

    const cmd = spawn(isWin ? 'stop_r_IOB.bat' : 'bash', [isWin ? '' : 'stop_r_IOB.sh'], {detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore']});

    cmd.unref();
}

function startIOB() {
    const {spawn} = require('child_process');
    const isWin = process.platform.startsWith('win');

    const cmd = spawn(isWin ? 'startIOB.bat' : 'bash', [isWin ? '' : 'startIOB.sh'], {detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore']});

    cmd.unref();
    setTimeout(() => process.exit(), 1000);
}

function restore(adapter, options, storageType, fileName, log, callback) {
    options = JSON.parse(JSON.stringify(options));

    if (storageType === 'nas / copy') {
        storageType = 'cifs';
    }

    if (adapter) {
        const backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');
        const name = fileName.split('/').pop();
        const toSaveName = path.join(backupDir, name);
        getFile(options, storageType, fileName, toSaveName, log, err => {
            if (!err && fs.existsSync(toSaveName)) {
                let backupType = name.split('_')[0];
                if (name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
                    backupType = 'minimal';
                }
                let config = getConfig(options, backupType);

                config.backupDir  = config.backupDir  || backupDir;
                config.backupType = config.backupType || backupType;
                config.name       = config.name       || backupType;

                const _module = require('./restore/' + backupType);
                if (_module.isStop) {
                    config.fileName = toSaveName;
                    fs.writeFileSync(__dirname + '/restore.json', JSON.stringify(config, null, 2));
                    startDetachedRestore();
                    return callback && callback({error: ''});
                } else {
                    const log = {
                        debug: function (text) {
                            const lines = text.toString().split('\n');
                            lines.forEach(line => {
                                line = line.replace(/\r/g, ' ').trim();
                                line && log.debug(`[${backupType}] ${line}`);
                            });
                            adapter && adapter.setState('output.line', '[DEBUG] [' + backupType + '] - ' + text);
                        },
                        error: function (err) {
                            const lines = err.toString().split('\n');
                            lines.forEach(line => {
                                line = line.replace(/\r/g, ' ').trim();
                                line && log.error(`[${backupType}] ${line}`);
                            });
                            adapter && adapter.setState('output.line', '[ERROR] [' + backupType + '] - ' + err);
                        },
                        exit: function (exitCode) {
                            adapter && adapter.setState('output.line', '[EXIT] ' + (exitCode || 0));
                        }
                    };

                    _module.restore(config, toSaveName, log, (err, exitCode) => callback({error: err, exitCode}));
                }
            } else {
                callback({error: err || 'File ' + toSaveName + ' not found'});
            }
        });
    } else {
        try {
            const config = options;
            const _module = require('./restore/' + config.backupType);
            _module.restore(config, config.fileName, log, (err, exitCode) => {
                log.exit(exitCode);
                callback({error: err, exitCode})
            });
        } catch (e) {
            log.error(e);
            log.exit(-1);
        }
    }
}

if (typeof module !== 'undefined' && module.parent) {
    module.exports = restore;
} else {
    if (fs.existsSync(__dirname + '/restore.json')) {
        const config = require(__dirname + '/restore.json');
        const logName = path.join(config.backupDir, 'logs.txt').replace(/\\/g, '/');
        const log = {
            debug: function (text) {
                const lines = text.toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    line && writeIntoFile(logName, `[DEBUG] [${config.name}] ${line}`);
                });
            },
            error: function (err) {
                const lines = err.toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    line && writeIntoFile(logName, `[ERROR] [${config.name}] ${line}`);
                });
            },
            exit: function (exitCode) {
                writeIntoFile(logName, `[EXIT] ${exitCode}`);
            }
        };

        restore(null, config, null, null, log, () => startIOB());
    } else {
        console.log('No config found at "' + path.normalize(path.join(__dirname, 'restore.json')) + '"');
    }
}