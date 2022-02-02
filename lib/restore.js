const tools = require('./tools');
const fs = require('fs');
const path = require('path');

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
        let backupType = name.split('.')[0];
        if (backupType !== 'zigbee' && backupType !== 'jarvis' && backupType !== 'yahka') {
            backupType = name.split('_')[0];
        }

        if (name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
            backupType = 'iobroker';
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
    const { spawn } = require('child_process');
    const isWin = process.platform.startsWith('win');

    const cmd = spawn(isWin ? 'stopIOB.bat' : 'bash', [isWin ? '' : 'stopIOB.sh'], { detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore'] });

    cmd.unref();
}

function startIOB() {
    const child_process = require('child_process');
    const isWin = process.platform.startsWith('win');

    child_process.exec(isWin ? 'startIOB.bat' : 'bash startIOB.sh', (error, stdout, stderr) => {
        if (error) {
            logWebIF += `[ERROR] ${error}\n`;
            logWebIF += `[ERROR] ${stderr}\n`;
        } else if (stdout) {
            logWebIF += `${stdout}\n`;
        }
        startFinish = '[Restart]';
        setTimeout(() => startFinish = '[Finish]', 10 * 1000);
        setTimeout(() => process.exit(), 30 * 1000);
    });
}

function restore(adapter, options, storageType, fileName, currentTheme, log, callback) {
    options = JSON.parse(JSON.stringify(options));

    if (storageType === 'nas / copy') {
        storageType = 'cifs';
    }
    if (adapter) {
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

                if (backupType !== 'zigbee' && backupType !== 'jarvis' && backupType !== 'yahka') {
                    backupType = name.split('_')[0];
                }

                if (backupType == 'redis') {
                    fs.writeFileSync(__dirname + '/.redis.info', 'Stop redis-server before Restore');
                    log.debug('Redis-Server stopped');
                }

                if (name.match(/^\d\d\d\d_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker\.tar\.gz$/)) {
                    backupType = 'iobroker';
                }
                let config = getConfig(options, backupType);

                config.backupDir = config.backupDir || backupDir;
                config.backupType = config.backupType || backupType;
                config.name = config.name || backupType;

                const _module = require('./restore/' + backupType);

                if (_module.isStop) {
                    config.fileName = toSaveName;
                    config.theme = currentTheme;
                    fs.writeFileSync(__dirname + '/restore.json', JSON.stringify(config, null, 2));
                    startDetachedRestore();
                    return callback && callback({ error: '' });
                } else {
                    const log = {
                        debug: function (text) {
                            const lines = text.toString().split('\n');
                            lines.forEach(line => {
                                line = line.replace(/\r/g, ' ').trim();
                                line && adapter.log.debug(`[${backupType}] ${line}`);
                            });
                            adapter && adapter.setState('output.line', '[DEBUG] [' + backupType + '] - ' + text, true);
                        },
                        error: function (textError) {
                            const lines = textError.toString().split('\n');
                            lines.forEach(line => {
                                line = line.replace(/\r/g, ' ').trim();
                                line && adapter.log.error(`[${backupType}] ${line}`);
                            });
                            adapter && adapter.setState('output.line', '[ERROR] [' + backupType + '] - ' + textError, true);
                        },
                        exit: function (exitCode) {
                            adapter && adapter.setState('output.line', '[EXIT] ' + (exitCode || 0), true);
                        }
                    };

                    _module.restore(config, toSaveName, log, adapter, (err, exitCode) => {
                        log.exit(exitCode);
                        callback({ error: err, exitCode })
                    });
                }
            } else {
                callback({ error: err || 'File ' + toSaveName + ' not found' });
            }
        });
    } else {
        try {
            const config = options;
            const _module = require('./restore/' + config.backupType);
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
function restoreIF(currentTheme) {
    const express = require('express');
    const app = express();

    app.get('/backitup-restore.html', function (req, res) {
        const darkDesign = currentTheme == 'react-blue' || currentTheme == 'react-dark' ? true : false;

        let script = '<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>';
        script += `<script>var _scroll = setInterval(function() { $(document).ready(function(){$('textarea').scrollTop( $('textarea')[0].scrollHeight); }); }, 20);`;
        script += `var _refresh = setInterval(function() { $("#logInput").load(" #logInput");var restoreState = $("input").val();if (restoreState == '[Restore]') { $("#logText").load(" #logText") }`;
        script += `$("#status").load(" #status > *");if (restoreState == '[Finish]') { clearInterval(_refresh);_refresh = null;clearInterval(_scroll);_scroll = null } }, 1000);</script>`;

        let style = '<style>';
        style += 'body { background-color: ' + (darkDesign ? '#121212;' : '#fff;') + ' }';
        style += '.box { overflow-y: auto; border-radius: 4px; ' + (darkDesign ? 'color: #fff; background: #1f1f1f;' : 'color: #1f1f1f; background: #fff;') + ' font-family: courier, monospace; font-size: 14px; resize: none; width: 100%; margin-bottom: 0; padding: 0.7rem; box-shadow: 0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%); }';
        style += '.title { background-color: #3399CC; text-align: center; margin-block-end: 1em; font-size: 1.8rem; color: #fff; padding: 1rem; font-family: system-ui; border-radius: 4px; }';
        style += '.container { background-color: ' + (darkDesign ? '#121212' : '#fff') + ' }';
        style += '.status { font-size: 1.5rem; padding-left: 10px; font-family: system-ui; margin-block-start: 0.1em; margin-block-end: 0.1em; font-weight: bold; }';
        style += '.chip { background-color: #575757; border-radius: 4px; box-shadow: 0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%); margin-left: 20px; margin-right: 20px; padding: 0.2rem; }';
        style += '::-webkit-scrollbar { width: 6px; background-color: #ccc; border-bottom-right-radius: 4px; border-top-right-radius: 4px; }';
        style += '::-webkit-scrollbar-thumb { background-color: #575757; }';
        style += '::-webkit-scrollbar-track { background-color: #ccc; border-bottom-right-radius: 4px; border-top-right-radius: 4px; }';
        style += '</style>';

        const head = `<head><title>Backitup Restore</title>${script}${style}</head>`;

        if (logWebIF == '') logWebIF = 'Restore is started ...';

        let content = (
            '<body>' +
            '   <div class="container">' +
            '       <div class="row">' +
            '           <h6 class="title">ioBroker Backitup Restore</h6>' +
            '       </div>' +
            '       <div class="row chip" id="status">' +
            '           <h6 class="status" style="color: #fff; display: ' + (startFinish == '[Finish]' ? 'initial;' : 'none;') + '">Restore and Restart completed successfully!!</h6>' +
            '           <h6 class="status" style="color: ' + (statusColor ? statusColor : '#fff') + '; display: ' + (startFinish == '[Finish]' ? 'none;' : 'initial;') + '">' + (restoreStatus ? restoreStatus : 'Restore is started ...') + '</h6>' +
            '       </div>' +
            '       <div class="row" style="padding: 20px;">' +
            '           <div class="col s12" id="logText">' +
            '               <textarea class="box" readonly cols="120" rows="30">' + logWebIF + '</textarea>' +
            '           </div>' +
            '       </div>' +
            '       <div class="row">' +
            '           <div class="col s12" id="logInput" style="display: none">' +
			'           <input type="text" value="' + startFinish + '">' +
			'           </div>' +
            '       </div>' +
            '   </div>' +
            '</body>'
        );

        res.send(`<html>${head}${content}</html>`);
    })
    app.listen(8091)
}

if (typeof module !== "undefined" && module.parent) {
    module.exports = restore;
} else {
    if (fs.existsSync(__dirname + '/restore.json')) {
        const config = require(__dirname + '/restore.json');
        const logName = path.join(config.backupDir, 'logs.txt').replace(/\\/g, '/');

		startFinish = '[Restore]';
        restoreIF(config.theme);

        const log = {
            debug: function (text) {
                const lines = text.toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    line && writeIntoFile(logName, `[DEBUG] [${config.name}] ${line}`);
                    if (!line == '') {
                        logWebIF += `[DEBUG] [${config.name}] ${line}\n`;
                    }
                });
            },
            error: function (err) {
                const lines = err.toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    line && writeIntoFile(logName, `[ERROR] [${config.name}] ${line}`);
                    if (!line == '') {
                        logWebIF += `[ERROR] [${config.name}] ${line}\n`;
                    }
                });
            },
            exit: function (exitCode) {
                writeIntoFile(logName, `[EXIT] ${exitCode}`);
                if (exitCode == 0 || exitCode == 'mysql restore done' || exitCode == 'redis restore done' || exitCode == 'historyDB restore done' || exitCode == 'zigbee database restore done' || exitCode == 'yahka database restore done' || exitCode == 'jarvis database restore done' || exitCode == 'influxDB restore done' || exitCode == 'postgresql restore done' || exitCode == 'Grafana restore done' || exitCode == 'javascript restore done') {
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

        restore(null, config, null, null, null, log, () => startIOB());
    } else {
        console.log('No config found at "' + path.normalize(path.join(__dirname, 'restore.json')) + '"');
    }
}