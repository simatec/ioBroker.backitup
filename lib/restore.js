const fs = require('node:fs');
const path = require('node:path');

let logWebIF = '';
let statusColor = '';
let restoreStatus = '';
let startFinish = '';

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
                options[attr][backupType]
            ) {
                config = options[attr][backupType];
                break;
            }
        }
        if (!config) {
            for (const attr in options) {
                if (options.hasOwnProperty(attr) &&
                    typeof options[attr] === 'object' &&
                    options[attr][storageType]
                ) {
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
        let backupType = name.split('.')[0];
        if (backupType !== 'nodered' && backupType !== 'zigbee' && backupType !== 'jarvis' && backupType !== 'yahka' && backupType !== 'esphome') {
            backupType = name.split('_')[0];
        }

        if (name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
            backupType = 'iobroker';
        }
        let config = getConfig(options, backupType, storageType);
        if (storageType !== 'local') {
            const _getFile = require(`./list/${storageType}`).getFile;
            _getFile(config, fileName, toSaveName, log, callback);
        } else {
            const tools = require('./tools');
            tools.copyFile(fileName, toSaveName, callback);
        }
    }
}
function startDetachedRestore(bashDir) {
    const { spawn } = require('node:child_process');
    const isWin = process.platform.startsWith('win');

    const cmd = spawn(isWin ? `${bashDir}/stopIOB.bat` : 'bash', [isWin ? '' : `${bashDir}/stopIOB.sh`], { detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore'] });

    cmd.unref();
}

function startIOB(bashDir) {
    const child_process = require('node:child_process');
    const isWin = process.platform.startsWith('win');
    startFinish = '[Restart]';
    let timeFinish = 10000;

    if (fs.existsSync('/opt/scripts/.docker_config/.thisisdocker')) {
        timeFinish = 3000;
        logWebIF += '[EXIT] **** Docker Container restart now... ****\n';
    }

    setTimeout(() => startFinish = '[Finish]', timeFinish);

    child_process.exec(isWin ? `${bashDir}/startIOB.bat` : `bash ${bashDir}/startIOB.sh`, (error, stdout, stderr) => {
        if (error) {
            logWebIF += `[ERROR] ${error}\n`;
            logWebIF += `[ERROR] ${stderr}\n`;
        } else if (stdout) {
            logWebIF += `${stdout}\n`;
        }
        setTimeout(() => process.exit(), 30 * 1000);
    });
}

function restore(adapter, options, storageType, fileName, currentTheme, currentProtocol, bashDir, log, callback) {
    options = JSON.parse(JSON.stringify(options));

    if (storageType === 'nas / copy') {
        storageType = 'cifs';
    }
    if (adapter) {
        const tools = require('./tools');
        const backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');

        if (storageType === 'local') {
            try {
                fs.chmodSync(backupDir, '0775');
                log.debug(`set chmod for "${backupDir}" successfully`);
            } catch (err) {
                log.debug(`cannot set chmod for "${backupDir}": ${err}`);
            }
        }

        const name = fileName.split('/').pop();
        const toSaveName = path.join(backupDir, name);

        getFile(options, storageType, fileName, toSaveName, log, err => {
            if (!err && fs.existsSync(toSaveName)) {
                let backupType = name.split('.')[0];

                if (backupType !== 'nodered' &&
                    backupType !== 'zigbee' &&
                    backupType !== 'jarvis' &&
                    backupType !== 'yahka' &&
                    backupType !== 'esphome'
                ) {
                    backupType = name.split('_')[0];
                }

                if (backupType === 'redis') {
                    fs.writeFileSync(`${bashDir}/.redis.info`, 'Stop redis-server before Restore');
                    log.debug('Redis-Server stopped');
                }

                if (name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
                    backupType = 'iobroker';
                }
                let config = getConfig(options, backupType);

                config.backupDir = config.backupDir || backupDir;
                config.backupType = config.backupType || backupType;
                config.name = config.name || backupType;

                const _module = require(`./restore/${backupType}`);

                if (_module.isStop) {
                    if (backupType === 'iobroker' && fs.existsSync(bashDir)) {
                        // copy restore files
                        const restoreDir = path.join(bashDir, 'restore');
                        const restoreSource = path.join(__dirname, 'restore');

                        tools.copyFile(path.join(__dirname, 'restore.js'), path.join(bashDir, 'restore.js'));
                        tools.copyFile(path.join(__dirname, 'backitup-restore.html'), path.join(bashDir, 'backitup-restore.html'));
                        tools.copyFile(path.join(__dirname, '..', 'admin', 'favicon.ico'), path.join(bashDir, 'favicon.ico'));
                        tools.copyFile(path.join(__dirname, '..', 'admin', 'backitup.png'), path.join(bashDir, 'backitup.png'));

                        if (!fs.existsSync(restoreDir)) {
                            fs.mkdirSync(restoreDir);
                        }

                        tools.copyFile(path.join(restoreSource, `${backupType}.js`), path.join(restoreDir, `${backupType}.js`));
                    }
                    config.fileName = toSaveName;
                    config.theme = currentTheme;
                    config.currentProtocol = currentProtocol;
                    config.bashDir = bashDir;
                    fs.writeFileSync(`${backupType === 'iobroker' ? bashDir : __dirname}/restore.json`, JSON.stringify(config, null, 2));
                    startDetachedRestore(bashDir);
                    return callback && callback({ error: '' });
                }
                const log = {
                    debug: function (text) {
                        const lines = text.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter.log.debug(`[${backupType}] ${line}`);
                        });
                        adapter && adapter.setState('output.line', `[DEBUG] [${backupType}] - ${text}`, true);
                    },
                    error: function (textError) {
                        const lines = textError.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            line && adapter.log.error(`[${backupType}] ${line}`);
                        });
                        adapter && adapter.setState('output.line', `[ERROR] [${backupType}] - ${textError}`, true);
                    },
                    exit: function (exitCode) {
                        adapter && adapter.setState('output.line', `[EXIT] ${exitCode || 0}`, true);
                    }
                };

                _module.restore(config, toSaveName, log, adapter, (err, exitCode) => {
                    log.exit(exitCode);
                    callback({ error: err, exitCode });
                });
            } else {
                callback({ error: err || `File ${toSaveName} not found` });
            }
        });
    } else {
        try {
            const config = options;
            const _module = require(`./restore/${config.backupType}`);
            _module.restore(config, config.fileName, log, (err, exitCode) => {
                log.exit(exitCode);
                callback({ error: err, exitCode })
            });
        } catch (e) {
            log.error(e);
            log.exit(-1);
        }
    }
}

// WebInterface Restore
function restoreIF(currentTheme, currentProtocol, bashDir) {
    const express = require('express');
    const app = express();

    app.get('/status.json', function (req, res) {
        res.json({
            logWebIF: logWebIF || 'Restore is started ...',
            startFinish,
            statusColor,
            restoreStatus,
            dark: currentTheme === 'dark' || currentTheme === 'react-blue' || currentTheme === 'react-dark',
        });
    });
    app.get('/favicon.ico', function (req, res) {
        res.send(fs.readFileSync(path.join(bashDir, 'favicon.ico')));
    });
    app.get('/backitup.png', function (req, res) {
        res.send(fs.readFileSync(path.join(bashDir, 'backitup.png')));
    });
    app.get('/backitup-restore.html', function (req, res) {
        res.set('Content-Type', 'text/html');
        res.send(fs.readFileSync(path.join(bashDir, 'backitup-restore.html'), 'utf8'));
    });

    if (currentProtocol === 'https:') {
        const https = require('node:https');

        let privateKey = '';
        let certificate = '';

        if (fs.existsSync(path.join(bashDir, 'iob.key')) && fs.existsSync(path.join(bashDir, 'iob.crt'))) {
            try {
                privateKey = fs.readFileSync(path.join(bashDir, 'iob.key'), 'utf8');
                certificate = fs.readFileSync(path.join(bashDir, 'iob.crt'), 'utf8');
            } catch (e) {
                console.log('no certificates found');
            }
        }
        const credentials = { key: privateKey, cert: certificate };

        const httpsServer = https.createServer(credentials, app);

        httpsServer.listen(8091);
    } else {
        const http = require('node:http');

        const httpServer = http.createServer(app);
        httpServer.listen(8091);
    }
}

if (typeof module !== 'undefined' && module.parent) {
    module.exports = {
        restore,
        getFile,
    };
} else {
    if (fs.existsSync(`${__dirname}/restore.json`)) {
        const config = require(`${__dirname}/restore.json`);
        const logName = path.join(config.backupDir, 'logs.txt').replace(/\\/g, '/');

        startFinish = '[Restore]';
        restoreIF(config.theme, config.currentProtocol, config.bashDir);

        const log = {
            debug: function (text) {
                const lines = text.toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    line && writeIntoFile(logName, `[DEBUG] [${config.name}] ${line}`);
                    if (line) {
                        logWebIF += `[DEBUG] [${config.name}] ${line}\n`;
                    }
                });
            },
            error: function (err) {
                const lines = err.toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    line && writeIntoFile(logName, `[ERROR] [${config.name}] ${line}`);
                    if (line) {
                        logWebIF += `[ERROR] [${config.name}] ${line}\n`;
                    }
                });
            },
            exit: function (exitCode) {
                writeIntoFile(logName, `[EXIT] ${exitCode}`);
                if (exitCode == 0 ||
                    exitCode === 'mysql restore done' ||
                    exitCode === 'sqlite restore done' ||
                    exitCode === 'redis restore done' ||
                    exitCode === 'historyDB restore done' ||
                    exitCode === 'zigbee database restore done' ||
                    exitCode === 'ESPHome data restore done' ||
                    exitCode === 'node-red restore done' ||
                    exitCode === 'yahka database restore done' ||
                    exitCode === 'jarvis database restore done' ||
                    exitCode === 'influxDB restore done' ||
                    exitCode === 'postgresql restore done' ||
                    exitCode === 'Grafana restore done' ||
                    exitCode === 'javascript restore done'
                ) {
                    logWebIF += `[EXIT] ${exitCode} **** Restore completed successfully!! ****\n`;
                    statusColor = '#7fff00';
                    restoreStatus = 'Restore completed successfully!! Starting iobroker... Please wait!';
                } else {
                    logWebIF += `[EXIT] ${exitCode} **** Restore was canceled!! ****\n`;
                    statusColor = 'red';
                    restoreStatus = 'Restore was canceled!! If ioBroker does not start automatically, please start it manually';
                }
            }
        };

        restore(null, config, null, null, null, null, null, log, () => startIOB(config.bashDir));
    } else {
        console.log(`No config found at "${path.normalize(path.join(__dirname, 'restore.json'))}"`);
    }
}
