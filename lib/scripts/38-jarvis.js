'use strict';
const fs = require('node:fs');
const getDate = require('../tools').getDate;
const path = require('node:path');
const fse = require('fs-extra');
const fs_async = require('node:fs').promises;

async function command(options, log, callback) {
    const jarvisDir = path.join(options.path, 'jarvis');
    let num = 0;

    if (fs.existsSync(jarvisDir)) {
        try {
            fs.readdir(jarvisDir, async (err, files) => {
                if (files) {
                    const compress = require('../targz').compress;

                    files.forEach(async file => {
                        const tmpDir = path.join(options.backupDir, `tmpJavis${file}`).replace(/\\/g, '/');

                        if (!fs.existsSync(tmpDir)) {
                            try {
                                await fse.ensureDir(tmpDir);
                                log.debug(`Created jarvis_tmp directory: "${tmpDir}"`);
                            } catch (err) {
                                log.debug(`Jarvis tmp directory "${tmpDir}" cannot created ... ${err}`);
                            }
                        } else {
                            try {
                                log.debug(`Try deleting the old jarvis_tmp directory: "${tmpDir}"`);
                                await fse.remove(tmpDir);
                            } catch (err) {
                                log.debug(`Jarvis tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                            }
                            if (!fs.existsSync(tmpDir)) {
                                try {
                                    log.debug(`old jarvis_tmp directory "${tmpDir}" successfully deleted`);
                                    await fse.ensureDir(tmpDir);
                                    log.debug('Created jarvis_tmp directory');
                                } catch (err) {
                                    log.debug(`Jarvis tmp directory "${tmpDir}" cannot created ... ${err}`);
                                }
                            }
                        }
                        log.debug(`found Jarvis Instance: ${file}`)
                        log.debug(`start Jarvis Backup for Instance ${file}...`);

                        let nameSuffix;
                        if (options.hostType === 'Slave') {
                            nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
                        } else {
                            nameSuffix = options.nameSuffix ? options.nameSuffix : '';
                        }

                        const fileName = path.join(options.backupDir, `jarvis.${file}_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`);
                        const instanceDir = path.join(jarvisDir, file);

                        try {
                            await fse.copy(instanceDir, tmpDir);
                            log.debug(`${instanceDir} copy success!`);
                        } catch (err) {
                            log.error(`${instanceDir} copy error: ${err}`);
                        }

                        await saveState(options, file, tmpDir, log);

                        options.context.fileNames.push(fileName);

                        compress({
                            src: tmpDir,
                            dest: fileName,
                        }, async (err, stdout, stderr) => {
                            try {
                                log.debug(`Try deleting the Jarvis tmp directory: "${tmpDir}"`);
                                await fse.remove(tmpDir);
                                if (!fs.existsSync(tmpDir)) {
                                    log.debug(`Jarvis tmp directory "${tmpDir}" successfully deleted`);
                                }
                            } catch (err) {
                                log.debug(`Jarvis tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                            }
                            num++;
                            if (err) {
                                options.context.errors.jarvis = err.toString();
                                stderr && log.error(stderr);
                                if (callback) {
                                    callback(err, stderr);
                                    callback = null;
                                }
                            } else {
                                log.debug(`Backup created: ${fileName}`)
                                options.context.done.push('jarvis.' + file);
                                options.context.types.push('jarvis.' + file);
                                if (callback && num === files.length) {
                                    callback(null, stdout);
                                    callback = null;
                                }
                            }
                        });
                    });
                } else {
                    log.debug(`Jarvis Backup cannot created. Please install a Jarvis version >= 2.2.0`);
                    callback && callback(null, 'done');
                    callback = null;
                }
            });
        } catch (e) {
            log.debug(`Jarvis Backup cannot created: ${e}`);
            callback && callback(null, e);
            callback = null;
        }
    } else {
        log.debug(`Jarvis Backup cannot created. Please install a Jarvis version >= 2.2.0`);
        callback && callback(null, 'done');
        callback = null;
    }
}

async function saveState(options, file, tmpDir, log) {
    return new Promise(async (resolve) => {
        const stateDir = path.join(tmpDir, 'states').replace(/\\/g, '/');

        if (!fs.existsSync(stateDir)) {
            try {
                await fse.ensureDir(stateDir);
                log.debug(`Created states_tmp directory: "${stateDir}"`);
            } catch (err) {
                log.debug(`states tmp directory "${stateDir}" cannot created ... ${err}`);
            }
        }

        const _settings = await options.adapter.getForeignObjectsAsync(`jarvis.${file}.settings.*`, 'state');

        let jarvisStates = [];

        if (_settings) {
            for (const i in _settings) {
                try {
                    const obj = await options.adapter.getForeignStateAsync(`${_settings[i]._id}`);

                    if (obj) {
                        const states = ({
                            id: _settings[i]._id,
                            value: obj.val ? obj.val : null
                        });
                        jarvisStates.push(states);
                    } else {
                        log.debug(`settings "${_settings[i]._id}" not found`);
                    }
                } catch (err) {
                    log.debug(`No State found for "${_settings[i]._id}": ${err}`);
                }
            }
        } else {
            log.debug('settings not found');
        }

        const _states = ['css', 'devices', 'layout', 'notifications', 'widgets', 'scripts', 'theme'];

        for (const i in _states) {
            try {
                const obj = await options.adapter.getForeignStateAsync(`jarvis.${file}.${_states[i]}`);

                if (obj) {
                    const states = ({
                        id: `jarvis.${file}.${_states[i]}`,
                        value: obj.val ? obj.val : null
                    });
                    jarvisStates.push(states);
                } else {
                    log.debug(`settings "${_states[i]}" not found`);
                }
            } catch (err) {
                log.debug(`No State found for "jarvis.${file}.${_states[i]}": ${err}`);
            }
        }

        try {
            const _pro = await options.adapter.getForeignStateAsync(`jarvis.${file}.info.pro`);

            if (_pro) {
                const states = ({
                    id: `jarvis.${file}.info.pro`,
                    value: _pro.val ? _pro.val : null
                });
                jarvisStates.push(states);
            } else {
                log.debug('settings "pro" not found');
            }
        } catch (err) {
            log.debug(`No State found for "jarvis.${file}.info.pro": ${err}`);
        }

        jarvisStates && await fs_async.writeFile(path.join(stateDir, `states.json`), JSON.stringify(jarvisStates, null, 2)).catch(err => log.debug(`states.json cannot be written: ${err}`));
        resolve();
    });
}

module.exports = {
    command,
    ignoreErrors: true
};
