const tools = require('./tools');
const fs = require('fs');
const path = require('path');

let logWebIF = '';
statusColor = '';
restoreStatus = '';


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
        setTimeout(function () {
            process.exit();
        }, 5000);
    });
}

function restore(adapter, options, storageType, fileName, log, callback) {
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
                    fs.writeFileSync(__dirname + '.redis.info', 'Stop redis-server before Restore');
                    log.debug('Redis-Server stopped');
                }
                //let backupType = name.split('_')[0];
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

// Restore WebInterface
function restoreIF() {
    const express = require('express');
    const app = express();

    app.get('/backitup-restore.html', function (req, res) {
        let refresh = true;
        let barExit = logWebIF.indexOf('[EXIT]');

        if (barExit === -1 || barExit == undefined || barExit == 'undefined') {
            refresh = true;
        } else {
            refresh = false;
        }

        let script = '<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>';
        script += `<script type="text/javascript">$(document).ready(function(){$('.box').scrollTop( $('.box')[0].scrollHeight );});</script>`;

        let style = '<style>';
        style += 'body {  background-color: #3b3b3b }';
        style += '.box { overflow-y: auto; border-radius: 4px; color: #fff; background: #1f1f1f; font-family: courier, monospace; font-size: 14px; resize: none; width: 100%; margin-bottom: 0;padding: 0.7rem; }';
        style += '.title { background-color: #3399CC; text-align: center; margin-block-end: 1em; font-size: 1.8rem; color: #fff; padding: 1rem; font-family: system-ui; border-radius: 4px; }';
        style += '.container { background-color: #3b3b3b }';
        style += '.status { font-size: 1.5rem; padding-left: 20px; font-family: system-ui; margin-block-start: 0.1em; margin-block-end: 0.1em;}';
        style += '</style>';

        const meta = '<meta http-equiv="refresh" content="2">';
        let head = `<head><title>Backitup Restore</title>${refresh ? meta : ''}${script}${style}</head>`;

        if (logWebIF == '') logWebIF = 'Restore is started ...';

        let content = (
            '<body>' +
            '   <div class="container">' +
            '       <div class="row">' +
            '           <h6 class="title">Log Backitup Restore</h6>' +
            '       </div>' +
            '       <div class="row">' +
            '           <h6 class="status" style="color: ' + (statusColor ? statusColor : '#fff') + '">' + (restoreStatus ? restoreStatus : 'Restore is started ...') + '</h6>' +
            '       </div>' +
            '       <div class="row" style="padding: 20px;">' +
            '           <div class="col s12">' +
            '               <textarea class="box" readonly rows="35">' + logWebIF +
            '               </textarea>' +
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

        restoreIF();

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
                    logWebIF += `[EXIT] ${exitCode} **** Restore completed successfully!! ****\n\nThe log can be closed ...\n`;
                    statusColor = 'green';
                    restoreStatus = 'Restore completed successfully!!';
                } else {
                    logWebIF += `[EXIT] ${exitCode} **** Restore was canceled!! ****\n\n The log can be closed ...\n`;
                    statusColor = 'red';
                    restoreStatus = 'Restore was canceled!!';
                }
            }
        };

        restore(null, config, null, null, log, () => startIOB());
    } else {
        console.log('No config found at "' + path.normalize(path.join(__dirname, 'restore.json')) + '"');
    }
}