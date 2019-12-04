const tools = require('./tools');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

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
        if (backupType !== 'zigbee') {
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
    const {spawn} = require('child_process');
    //const child_process = require('child_process');
    const isWin = process.platform.startsWith('win');

    // BF: What is that?
    /*
    if (isWin == '') {
        fs.writeFileSync(__dirname + '/.restore.info', 'restore');
    }
    */
    /*child_process.exec(`systemctl status iobroker | grep -o "active (running)"`, (error, stdout, stderr) => {
        if(stdout.indexOf('active (running)') != -1){
            log.debug('systemctl status stdout: ' + stdout);
        }
    });*/

    const cmd = spawn(isWin ? 'stopIOB.bat' : 'bash', [isWin ? '' : 'stopIOB.sh'], {detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore']});

    cmd.unref();
}

function startIOB() {
    //const {spawn} = require('child_process');
    const child_process = require('child_process');
    const isWin = process.platform.startsWith('win');

    child_process.exec(isWin ? 'startIOB.bat' : 'bash startIOB.sh', (error, stdout, stderr) => {
		setTimeout(function() {
			process.exit();
		}, 1500);
    });

    /*
    const cmd = spawn(isWin ? 'startIOB.bat' : 'bash', [isWin ? '' : 'startIOB.sh'], {detached: true, cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore']});

    cmd.unref();

    setTimeout(function() {
		adapter.terminate ? adapter.terminate() : process.exit();
    }, 1000);
    */
}

function restore(adapter, options, storageType, fileName, log, callback) {
    options = JSON.parse(JSON.stringify(options));
    
    if (storageType === 'nas / copy') {
        storageType = 'cifs';
    }

    if (adapter) {
        const backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');
        const name = fileName.split('/').pop();
        log.debug('Test: ' + name);
        const toSaveName = path.join(backupDir, name);
        getFile(options, storageType, fileName, toSaveName, log, err => {
            if (!err && fs.existsSync(toSaveName)) {
                let backupType = name.split('.')[0];
                if (backupType !== 'zigbee') {
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

// format Log for Restore Interface
function replaceAll(string, token, newtoken) {
    if (token != newtoken)
        while (string.indexOf(token) > -1) {
            string = string.replace(token, newtoken);
        }
    return string;
}

// Restore Interface
function restoreIF() {
    app.get('/backitup-restore', function (req, res) {
		let data = '';
		let htmlData = '';
        const backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');
        if (fs.existsSync(backupDir + '/logs.txt')) {
			data = fs.readFileSync(backupDir + '/logs.txt').toString('utf8');
			let barExit = data.indexOf('[EXIT]');
			data = replaceAll(data, '\n', '<br>');

			if (barExit === -1){
				htmlData = ('<html><head>' +
							'<title>Backitup Restore</title>' +
							'<meta http-equiv="refresh" content="2"/>' +
							'</head><body>' +
							'<body bgcolor=2E2E2E>' +
							'<font color="58ACFA">' +
							'*******************<br>' +
							'Log Backitup Restore:<br>' +
							'*******************<br><br>' +
							'</font>' +
							'<font color="white">' + data + '</font>' +
							'<script type="text/javascript">' +
							'window.scrollTo({ top: 999999999999, left: 0});' +
							'</script>' +
							'</body></html>');
			} else {
				htmlData = ('<html><head>' +
							'<title>Backitup Restore</title>' +
							'</head><body>' +
							'<body bgcolor=2E2E2E>' +
							'<font color="58ACFA">' +
							'*******************<br>' +
							'Log Backitup Restore:<br>' +
							'*******************<br><br>' +
							'</font>' +
							'<font color="white">' + data + '</font>' +
							'<font color="2EFE2E">' +
							'<br>**************************' +
							'<br>Restore completed!!<br><br>' +
							'This Tab can be closed ...<br>' +
							'**************************<br><br>' +
							'</font>' +
							'<script type="text/javascript">' +
							'window.scrollTo({ top: 999999999999, left: 0});' +
							'</script>' +
							'</body></html>');
			}
		} else {
			data = 'Restore is started ...';
			htmlData = ('<html><head>' +
						'<title>Backitup Restore</title>' +
						'<meta http-equiv="refresh" content="2"/>' +
						'</head><body>' +
						'<body bgcolor=2E2E2E>' +
						'<font color="58ACFA">' +
						'*******************<br>' +
						'Log Backitup Restore:<br>' +
						'*******************<br><br>' +
						'</font>' +
						'<font color="white">' + data + '</font>' +
						'<script type="text/javascript">' +
						'window.scrollTo({ top: 999999999999, left: 0});' +
						'</script>' +
						'</body></html>');
		}
        	res.send(htmlData);
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