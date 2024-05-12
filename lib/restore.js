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
        res.send(fs.readFileSync(path.join(__dirname, '..', 'admin', 'favicon.ico')));
    });
    app.get('/backitup-restore.html', function (req, res) {
        res.send(fs.readFileSync(path.join(__dirname, 'backitup-restore.html')));
    });

    // app.get('/backitup-restore.html', function (req, res) {
    //     const darkDesign = currentTheme == 'react-blue' || currentTheme == 'react-dark' ? true : false;
    //
    //     let script = '<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>';
    //     script += `<script>var _scroll = setInterval(function() { $(document).ready(function(){$('textarea').scrollTop( $('textarea')[0].scrollHeight); }); }, 20);`;
    //     script += `var _refresh = setInterval(function() { $("#logInput").load(" #logInput");var restoreState = $("input").val();if (restoreState == '[Restore]') { $("#logText").load(" #logText") }`;
    //     script += `$("#backButton").load(" #backButton > *");$("#status").load(" #status > *");if (restoreState == '[Finish]') { clearInterval(_refresh);_refresh = null;clearInterval(_scroll);_scroll = null } }, 1000);</script>`;
    //
    //     let style = '<style>';
    //     style += `body { background-color: ${darkDesign ? '#121212;' : '#fff;'} }`;
    //     style += `.box { overflow-y: auto; border-radius: 4px; ${darkDesign ? 'color: #fff; background: #1f1f1f;' : 'color: #1f1f1f; background: #fff;'} font-family: courier, monospace; font-size: 14px; resize: none; width: 100%; margin-bottom: 0; padding: 0.7rem; box-shadow: 0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%); }`;
    //     style += '.title { background-color: #3399CC; text-align: center; margin-block-end: 1em; font-size: 1.8rem; color: #fff; padding: 1rem; font-family: system-ui; border-radius: 4px; box-shadow: 0 3px 3px 0 rgb(0 0 0 / 14%), 0 1px 5px 0 rgb(0 0 0 / 12%), 0 3px 1px -2px rgb(0 0 0 / 20%); }';
    //     style += `.container { background-color: ${darkDesign ? '#121212' : '#fff'} }`;
    //     style += '.status { font-size: 1.5rem; padding-left: 10px; font-family: system-ui; margin-block-start: 0.1em; margin-block-end: 0.1em; font-weight: bold; }';
    //     style += '.chip { background-color: #2a3135; border-radius: 4px; box-shadow: 0 3px 3px 0 rgb(0 0 0 / 14%), 0 1px 5px 0 rgb(0 0 0 / 12%), 0 3px 1px -2px rgb(0 0 0 / 20%); margin-left: 20px; margin-right: 20px; padding: 0.2rem; }';
    //     style += '.button { background-color: #3399CC; border-radius: 4px; color: #fff; width: 100%; position: relative; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: all 0.3s ease-out 0s; padding: 0px 2rem; text-align: center; letter-spacing: 0.5px; font-size: 14px; outline: 0px; box-shadow: rgb(0 0 0 / 14%) 0px 2px 2px 0px, rgb(0 0 0 / 12%) 0px 3px 1px -2px, rgb(0 0 0 / 20%) 0px 1px 5px 0px;border: none;line-height: 36px; text-transform: uppercase; }';
    //     style += '.button:hover { background-color: rgb(35, 107, 142); filter: brightness(105%); box-shadow: 0 6px 6px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2); }';
    //     style += '::-webkit-scrollbar { width: 6px; background-color: #ccc; border-bottom-right-radius: 4px; border-top-right-radius: 4px; }';
    //     style += '::-webkit-scrollbar-thumb { background-color: #575757; }';
    //     style += '::-webkit-scrollbar-track { background-color: #ccc; border-bottom-right-radius: 4px; border-top-right-radius: 4px; }';
    //     style += '</style>';
    //
    //     const head = `<head><title>Backitup Restore</title>${script}${style}</head>`;
    //
    //     logWebIF = logWebIF || 'Restore is started ...';
    //
    //     let content = (
    //         '<body>' +
    //         '   <div class="container">' +
    //         '       <div class="row">' +
    //         '           <h6 class="title">ioBroker Backitup Restore</h6>' +
    //         '       </div>' +
    //         '       <div class="row chip" id="status">' +
    //         '           <h6 class="status" style="color: #fff; display: ' + (startFinish == '[Finish]' ? 'initial;' : 'none;') + '">Restore and Restart completed successfully!!</h6>' +
    //         '           <h6 class="status" style="color: ' + (statusColor ? statusColor : '#fff') + '; display: ' + (startFinish == '[Finish]' ? 'none;' : 'initial;') + '">' + (restoreStatus ? restoreStatus : 'Restore is started ...') + '</h6>' +
    //         '       </div>' +
    //         '       <div class="row" style="padding: 20px;">' +
    //         '           <div class="col s12" id="logText">' +
    //         '               <textarea class="box" readonly cols="120" rows="30">' + logWebIF + '</textarea>' +
    //         '           </div>' +
    //         '       </div>' +
    //         '       <div class="row">' +
    //         '           <div class="col s12" id="logInput" style="display: none">' +
    //         '               <input type="text" value="' + startFinish + '">' +
    //         '           </div>' +
    //         '       </div>' +
    //         '       <div class="row">' +
    //         '           <div class="col s12" id="backButton" style="text-align: center; margin-left: 20px; margin-right: 20px;">' +
    //         '               <input class="button" style="display: ' + (startFinish !== '[Restore]' ? 'initial;' : 'none;') + '" type="button" value="Backup Menu" onClick="javascript:history.back()">' +
    //         '           </div>' +
    //         '       </div>' +
    //         '   </div>' +
    //         '</body>'
    //     );
    //
    //     res.send(`<html>${head}${content}</html>`);
    // });

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
