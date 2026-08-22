import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getIobDir, getTimeString } from './tools';
import type {
    BackItUpContext,
    BackItUpExecuteCallback,
    BackItUpExecuteConfig,
    BackItUpLogger,
    BackItUpProps,
} from './types';
import type { BackItUpScript, BackItUpStepFailure } from './scripts/types';

/** The `notificationsType` value each messaging step requires */
const NOTIFIER: Record<string, string> = {
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    gotify: 'Gotify',
    signal: 'Signal',
    matrix: 'Matrix',
    email: 'E-Mail',
    pushover: 'Pushover',
    discord: 'Discord',
};

/** Slices dropped from the debug output when they are switched off */
const DISABLED_SLICES = [
    'ftp',
    'cifs',
    'telegram',
    'pushover',
    'email',
    'whatsapp',
    'gotify',
    'discord',
    'dropbox',
    'onedrive',
    'webdav',
    'googledrive',
    'mysql',
    'sqlite',
    'pgsql',
    'influxDB',
    'grafana',
    'javascripts',
    'jarvis',
    'zigbee',
    'esphome',
    'zigbee2mqtt',
    'nodered',
    'yahka',
    'historyDB',
    'redis',
];

/** Slices whose `backupDir` is dropped from the debug output */
const BACKUP_DIR_SLICES = [
    'ftp',
    'cifs',
    'mysql',
    'sqlite',
    'pgsql',
    'influxDB',
    'grafana',
    'jarvis',
    'zigbee',
    'esphome',
    'zigbee2mqtt',
    'nodered',
    'yahka',
    'javascripts',
    'redis',
    'historyDB',
];

/** Secrets masked one level down, e.g. `_options.cifs.pass` */
const NESTED_SECRETS: Record<string, string[]> = {
    ftp: ['pass'],
    cifs: ['pass'],
    mysql: ['pass'],
    // Note: the dropbox slice is checked for the *onedrive* key here. Kept as found.
    dropbox: ['onedriveAccessJson'],
    onedrive: ['accessToken'],
    googledrive: ['accessJson'],
    webdav: ['pass'],
    grafana: ['apiKey', 'pass'],
    zigbee2mqtt: ['z2mPassword'],
};

/** Secrets masked directly on the options object */
const TOP_LEVEL_SECRETS = ['accessToken', 'pass', 'accessJson', 'apiKey', 'z2mPassword'];

/** Secrets masked two levels down, e.g. `_options.iobroker.cifs.pass` */
const DEEP_SECRETS: Record<string, string[]> = {
    dropbox: ['accessToken'],
    onedrive: ['onedriveAccessJson'],
    cifs: ['pass'],
    ftp: ['pass'],
    googledrive: ['accessJson'],
    mysql: ['pass'],
    ccu: ['pass'],
    webdav: ['pass'],
    grafana: ['pass', 'apiKey'],
    zigbee2mqtt: ['z2mPassword'],
};

/**
 * How the dispatcher sees a loaded step.
 *
 * The authoring contract is {@link BackItUpScript}, which declares `options: never` so each step
 * can narrow it to its own config slice. That is deliberately unusable from here, so the loader
 * widens it once.
 */
interface LoadedScript {
    run: (props: BackItUpProps<unknown>) => Promise<number | void>;
    ignoreErrors: boolean;
    afterBackup?: boolean;
}

let timerCleanFiles: ioBroker.Timeout | undefined;
let tmpLog = '';

/**
 * Loads every step in lib/scripts, keyed by its name without the numeric prefix.
 *
 * Only `.js` files are picked up, so the TypeScript sources next to the compiled output are
 * ignored.
 *
 * @param callback reports a directory that cannot be read
 */
function loadScripts(callback: BackItUpExecuteCallback): Record<string, LoadedScript | null> {
    const scripts: Record<string, LoadedScript | null> = {};
    let files;
    try {
        files = readdirSync(`${__dirname}/scripts`);
        files.forEach(file => {
            if (file.endsWith('.js')) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                scripts[file.substring(3, file.length - 3)] = require(`${__dirname}/scripts/${file}`);
            }
        });
    } catch (e) {
        callback(`error on backup: ${e} Please run "iobroker fix" and reinstall BackItUp`);
    }
    return scripts;
}

/**
 * Appends one line to the run log, ignoring write failures.
 *
 * @param fileName log file to append to
 * @param text the line; empty values are skipped
 */
function writeIntoFile(fileName: string, text: string): void {
    if (text) {
        console.log(text);
        try {
            appendFileSync(fileName, `${text}\n`);
        } catch {
            // ignore
        }
    }
}

/**
 * Prepends this run's collected output to the history log and trims it to the configured length.
 *
 * @param config the run config
 * @param adapter adapter instance, used only for the error log
 */
function createBackupLog(config: BackItUpExecuteConfig, adapter: ioBroker.Adapter): void {
    // Create Backup Logs for History
    const logFile = join(config.notification.bashDir, `${adapter.namespace}.log`);

    if (existsSync(logFile)) {
        const data = readFileSync(logFile, 'utf8');
        const backupLog = JSON.parse(data);
        const timestamp = config.timestamp;

        try {
            backupLog.unshift({ [timestamp]: tmpLog });
        } catch (err) {
            adapter.log.error(`Backup Logs could not be created: ${err}`);
        }

        if (backupLog && backupLog.length > config.notification.entriesNumber) {
            backupLog.splice(
                config.notification.entriesNumber,
                backupLog.length - config.notification.entriesNumber,
            );
        }

        writeFileSync(logFile, JSON.stringify(backupLog));
        tmpLog = '';
    }
}

/**
 * Runs the backup steps one after another.
 *
 * Each invocation handles exactly one step and then re-schedules itself, so `scripts` and `code`
 * carry the state between the passes; the first call creates them.
 *
 * @param adapter adapter instance, or null for the detached run
 * @param config the run config
 * @param callback reports the outcome of the whole run
 * @param scripts remaining steps; a step is set to null once it has been taken
 * @param code exit code reported by the last step that supplied one
 */
function executeScripts(
    adapter: ioBroker.Adapter,
    config: BackItUpExecuteConfig,
    callback: BackItUpExecuteCallback,
    scripts?: Record<string, LoadedScript | null>,
    code?: number | null,
): void {
    if (!scripts) {
        scripts = loadScripts(callback);
        config.backupDir = join(getIobDir(), 'backups').replace(/\\/g, '/');
        config.timestamp = new Date().getTime();
        config.context = { fileNames: [], errors: {}, done: [], types: [] }; // common variables between scripts

        if (!existsSync(config.backupDir)) {
            try {
                mkdirSync(config.backupDir);
                chmodSync(config.backupDir, '0775');
            } catch (e) {
                callback(
                    `Backup directory cannot created: ${e} Please reinstall BackItUp and run "iobroker fix"!!`,
                );
            }
        } else if (!config.cifs.enabled || (config.cifs.enabled && config.cifs.mountType === 'Copy')) {
            try {
                chmodSync(config.backupDir, '0775');
            } catch (e) {
                callback(`chmod for Backup directory could not be completed: ${e} Please run "iobroker fix"!!`);
            }
        }
    }

    for (const name in scripts) {
        if (
            Object.prototype.hasOwnProperty.call(scripts, name) &&
            scripts[name] &&
            (!config.afterBackup || scripts[name].afterBackup)
        ) {
            let func: LoadedScript | null | undefined;
            // Open on purpose: the slice differs per step and main.js is still JS.
            let options: Record<string, any> | undefined;
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
                    options = {
                        name: config.name,
                        deleteBackupAfter: config.deleteBackupAfter,
                    };
                    break;

                case 'cifs':
                case 'webdav':
                case 'dropbox':
                case 'onedrive':
                case 'googledrive':
                case 'ftp':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        options = Object.assign({}, config[name], {
                            name: config.name,
                            deleteBackupAfter: config.deleteBackupAfter,
                        });
                    }
                    break;

                // Extra data sources
                case 'mysql':
                case 'sqlite':
                case 'pgsql':
                case 'redis':
                case 'historyDB':
                case 'javascripts':
                case 'zigbee':
                case 'esphome':
                case 'zigbee2mqtt':
                case 'nodered':
                case 'yahka':
                case 'grafana':
                case 'jarvis':
                case 'influxDB':
                    // The original spelled these out one by one with identical bodies.
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
                case 'historyJSON':
                    if (config[name] && config[name].enabled) {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config)) as Record<string, any>;
                            options[name].time = getTimeString(options[name].systemLang); // provide date
                        } catch {
                            callback(`cannot parse config for ${name}!!`);
                        }
                    }
                    break;

                case 'telegram':
                case 'whatsapp':
                case 'gotify':
                case 'signal':
                case 'matrix':
                case 'email':
                case 'pushover':
                case 'discord':
                    // Each channel only runs when it is the selected notification type.
                    if (config[name] && config[name].enabled && config[name].notificationsType === NOTIFIER[name]) {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config)) as Record<string, any>;
                            options[name].time = getTimeString(options[name].systemLang); // provide date
                        } catch {
                            callback(`cannot parse config for ${name}!!`);
                        }
                    }
                    break;

                case 'notification':
                    if (config[name]) {
                        func = scripts[name];
                        try {
                            options = JSON.parse(JSON.stringify(config)) as Record<string, any>;
                            options[name].time = getTimeString(options[name].systemLang); // provide date
                        } catch {
                            callback('cannot parse config for notification!!');
                        }
                    }
                    break;
            }

            scripts[name] = null;

            if (func) {
                try {
                    // A masked copy, only ever used for the debug line below.
                    const _options = JSON.parse(JSON.stringify(options));

                    for (const key of DISABLED_SLICES) {
                        if (_options[key] && !_options[key].enabled) {
                            delete _options[key];
                        }
                    }

                    for (const key of BACKUP_DIR_SLICES) {
                        if (_options[key] && _options[key].backupDir !== undefined) {
                            delete _options[key].backupDir;
                        }
                    }
                    if (!_options.nameSuffix && _options.nameSuffix !== undefined) {
                        delete _options.nameSuffix;
                    }

                    if (_options.enabled !== undefined) {
                        delete _options.enabled;
                    }
                    // The notification steps get a deep copy of the whole config, and that carries
                    // the scratch pad along - the steps themselves read it from the run context.
                    if (_options.context !== undefined) {
                        delete _options.context;
                    }
                    if (_options.name !== undefined) {
                        delete _options.name;
                    }

                    for (const [slice, secrets] of Object.entries(NESTED_SECRETS)) {
                        if (_options[slice]) {
                            for (const secret of secrets) {
                                if (_options[slice][secret] !== undefined) {
                                    _options[slice][secret] = '****';
                                }
                            }
                        }
                    }

                    for (const secret of TOP_LEVEL_SECRETS) {
                        if (_options[secret] !== undefined) {
                            _options[secret] = '****';
                        }
                    }

                    // One more level down: the notification steps get the whole config, so the
                    // storage credentials sit under `_options.<backupType>.<storage>`.
                    for (const i in _options) {
                        if (_options[i] !== null) {
                            for (const [slice, secrets] of Object.entries(DEEP_SECRETS)) {
                                if (_options[i][slice] !== undefined && _options[i][slice]) {
                                    for (const secret of secrets) {
                                        _options[i][slice][secret] = '****';
                                    }
                                }
                            }
                        }
                    }
                    if (_options.debugging == true) {
                        adapter?.setTimeout(function () {
                            void adapter?.setState(
                                'output.line',
                                `[DEBUG] [${name}] start with ${JSON.stringify(_options)}`,
                                true,
                            );
                        }, 200);
                    }
                } catch (e) {
                    callback(
                        `error on backup process: Script "${name}" ${e} Please check the config of BackItUp and execute "iobroker fix"`,
                    );
                    timerCleanFiles = adapter?.setTimeout(function () {
                        setImmediate(executeScripts, adapter, config, callback, scripts, code);
                    }, 150);
                    return;
                }

                if (!options) {
                    callback(
                        `error on backup process: No valid options for "${name}" Please check the config of BackItUp and execute "iobroker fix"`,
                    );
                    timerCleanFiles = adapter?.setTimeout(function () {
                        setImmediate(executeScripts, adapter, config, callback, scripts, code);
                    }, 150);

                    return;
                }

                // for delete on Multi-Backup
                if (config.influxDB && config.influxDB.influxDBMulti) {
                    options.influxDBMulti = config.influxDB.influxDBMulti;
                }
                if (config.influxDB && config.influxDB.influxDBEvents) {
                    options.influxDBEvents = config.influxDB.influxDBEvents;
                }
                if (config.mysql && config.mysql.mySqlMulti) {
                    options.mySqlMulti = config.mysql.mySqlMulti;
                }
                if (config.mysql && config.mysql.mySqlEvents) {
                    options.mySqlEvents = config.mysql.mySqlEvents;
                }
                if (config.pgsql && config.pgsql.pgSqlMulti) {
                    options.pgSqlMulti = config.pgsql.pgSqlMulti;
                }
                if (config.pgsql && config.pgsql.pgSqlEvents) {
                    options.pgSqlEvents = config.pgsql.pgSqlEvents;
                }
                if (config.ccuMulti) {
                    options.ccuMulti = config.ccuMulti;
                }
                if (config.ccuEvents) {
                    options.ccuEvents = config.ccuEvents;
                }

                const fileName = join(config.backupDir, 'logs.txt');

                const log = {
                    debug: function (input: unknown): void {
                        // Steps also pass Errors and Buffers here; this is the coercion the
                        // original did in place.
                        const text: string =
                            typeof input === 'string' ? input : (input as { toString(): string }).toString();
                        const lines = text.toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            if (line && adapter) {
                                adapter.log.debug(`[${config.name}/${name}] ${line}`);
                            }
                            if (line && !adapter) {
                                writeIntoFile(fileName, `[DEBUG] [${config.name}/${name}] ${line}`);
                            }
                            void adapter?.setState('output.line', `[DEBUG] [${name}] - ${text}`, true);
                        });
                        tmpLog += `[DEBUG] [${name}] ${text}${text.endsWith('\n') ? '' : '\n'}`;
                        void adapter?.setState('output.line', `[DEBUG] [${name}] - ${text}`, true);
                    },
                    warn: function (warning: string): void {
                        const lines = (warning || '').toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            if (line && adapter) {
                                adapter.log.warn(`[${config.name}/${name}] ${line}`);
                            }
                            if (line && !adapter) {
                                writeIntoFile(fileName, `[WARN] [${config.name}/${name}] ${line}`);
                            }
                        });
                        // Unlike debug this does not coerce first, so a non-string warning throws.
                        tmpLog += `[WARN] [${name}] ${warning}${warning.endsWith('\n') ? '' : '\n'}`;
                        void adapter?.setState('output.line', `[WARN] [${name}] - ${warning}`, true);
                    },
                    error: function (err: string): void {
                        const lines = (err || '').toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            if (line && adapter) {
                                adapter.log.error(`[${config.name}/${name}] ${line}`);
                            }
                            if (line && !adapter) {
                                writeIntoFile(fileName, `[ERROR] [${config.name}/${name}] ${line}`);
                            }
                        });
                        tmpLog += `[ERROR] [${name}] ${err}\n`;
                        void adapter?.setState('output.line', `[ERROR] [${name}] - ${err}`, true);
                    },
                } satisfies BackItUpLogger;

                // The four run-scoped values that used to be grafted onto `options`. The scratch
                // pad is spread in by reference, so every step of a run shares the same arrays.
                const context: BackItUpContext = {
                    ...config.context,
                    adapter,
                    log,
                    backupDir: config.backupDir,
                    timestamp: config.timestamp,
                };

                try {
                    // generic Error handling for all synchron errors in backup scripts
                    /**
                     * Reports what the step produced.
                     *
                     * @param err the failure, if the step reported one
                     * @param output what to write to the debug log on success
                     * @param _code the process exit code the step supplied, if any
                     */
                    const finish = (err?: Error | string | null, output?: unknown, _code?: number | null): void => {
                        if (_code !== undefined) {
                            code = _code;
                        }
                        if (err) {
                            // "Ignore backup errors" from the instance settings, read from the run
                            // config rather than from the step's slice.
                            //
                            // main.js only copies the flag into the storage, notification and
                            // history slices, not into the ones that produce the backup data - so
                            // reading `options.ignoreErrors` made the setting silently ineffective
                            // for mysql, redis, influxDB, grafana, iobroker and the rest, which is
                            // exactly what it is named after. Those steps used to report a failure
                            // and a success right after, and only that second report kept the run
                            // going far enough for 96-* to send the "backup incomplete" message.
                            // The step's own `ignoreErrors` export is still not consulted; every
                            // script sets it to true, which would make the setting meaningless in
                            // the other direction.
                            if (config.ignoreErrors) {
                                log.error(`[IGNORED] ${err}`);
                                timerCleanFiles = adapter?.setTimeout(function () {
                                    setImmediate(executeScripts, adapter, config, callback, scripts, code);
                                }, 150);
                            } else {
                                log.error(err as string);
                                callback?.(err);
                            }
                        } else {
                            log.debug(output || 'done');
                            timerCleanFiles = adapter?.setTimeout(function () {
                                setImmediate(executeScripts, adapter, config, callback, scripts, code);
                            }, 150);
                        }
                    };

                    func.run({ context, options }).then(
                        result => finish(null, undefined, typeof result === 'number' ? result : undefined),
                        (e: BackItUpStepFailure) => finish(e, undefined, e?.exitCode),
                    );
                } catch (e) {
                    callback(
                        `error on backup process: Error when executing script "${name}": ${e} Please check the config of BackItUp and execute "iobroker fix"`,
                    );
                    timerCleanFiles = adapter?.setTimeout(function () {
                        setImmediate(executeScripts, adapter, config, callback, scripts, code);
                    }, 150);
                }
            } else {
                timerCleanFiles = adapter?.setTimeout(function () {
                    setImmediate(executeScripts, adapter, config, callback, scripts, code);
                }, 150);
            }
            return;
        }
    }

    void adapter?.setState('output.line', `[EXIT] ${code || 0}`, true);
    createBackupLog(config, adapter);
    adapter?.clearTimeout(timerCleanFiles);
    callback?.();
}

// The original guarded this with `module.parent`; nothing runs when the file is loaded directly,
// so exporting unconditionally is equivalent.
export default executeScripts;
