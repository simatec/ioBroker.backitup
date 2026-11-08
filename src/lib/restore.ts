/**
 * Restore dispatcher.
 *
 * IMPORTANT: for an ioBroker restore this file is copied to the bash directory together with
 * `restore/iobroker.js` and started there as a detached process (see `restore()` below). Nothing
 * else from lib/ travels with it, so every `require` of a sibling module - and of express/cors,
 * which are only needed by the detached web interface - has to stay inside a function. Hoisting
 * any of them to the top would break the standalone run with "Cannot find module".
 *
 * Only `node:fs` and `node:path` are imported eagerly; both are builtins and always resolvable.
 */
import {
    appendFileSync,
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { join, normalize } from 'node:path';

/**
 * Plain ioBroker backup written by `iobroker backup`, e.g. `2025_03_15-20_25_03_backupiobroker-migration.tar.gz`.
 * The same rule as `isPureIobrokerBackup` in tools - repeated here, because this file has to run standalone (see above).
 */
const PURE_IOBROKER_BACKUP = /^\d{4}_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker.*\.tar\.gz$/;

/**
 * Backup of a Homematic CCU (`homematic_..._backupiobroker.tar.sbk`). It can be downloaded, but only the CCU
 * itself can restore it. The same rule as `isCcuBackup` in tools - repeated here for the same reason.
 */
const CCU_BACKUP = /^homematic_.*\.sbk$/;

import type { Express, RequestHandler } from 'express';
import type * as ChildProcessModule from 'node:child_process';
import type * as HttpModule from 'node:http';
import type * as HttpsModule from 'node:https';
import type * as ToolsModule from './tools';
import type { BackItUpStorageEngine } from './list/types';
import type { BackItUpContext } from './types';
import type {
    BackItUpRestoreFailure,
    BackItUpRestoreLogger,
    BackItUpRestoreModule,
    BackItUpRestoreOptions,
    BackItUpRestoreResultCode,
} from './restore/types';

/** What `restore()` reports back to its caller */
export interface BackItUpRestoreResult {
    error?: Error | string | null;
    exitCode?: number | string | null;
}

type LooseOptions = Record<string, any>;

/** Exit codes the detached run counts as a success, alongside a numeric 0 */
const DONE_MARKERS = [
    'mysql restore done',
    'sqlite restore done',
    'redis restore done',
    'historyDB restore done',
    'zigbee database restore done',
    'ESPHome data restore done',
    'node-red restore done',
    'yahka database restore done',
    'jarvis database restore done',
    'influxDB restore done',
    'postgresql restore done',
    'Grafana restore done',
    'javascript restore done',
];

let logWebIF = '';
let statusColor = '';
let restoreStatus = '';
let startFinish = '';
let httpServer: HttpModule.Server | HttpsModule.Server | null | undefined;

/**
 * Appends one line to the detached run's log file, ignoring write failures.
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
 * Digs the config slice for one backup type out of the options.
 *
 * Looks at the top level first, then one level down for the backup type and finally one level down
 * for the storage type.
 *
 * @param options the whole restore config
 * @param backupType e.g. `'mysql'`
 * @param storageType e.g. `'cifs'`; when given and the top-level hit matched, its sub-slice is used
 */
function getConfig(options: LooseOptions, backupType: string, storageType?: string | null): LooseOptions {
    let config = options[backupType];
    if (!config) {
        for (const attr in options) {
            if (
                Object.prototype.hasOwnProperty.call(options, attr) &&
                typeof options[attr] === 'object' &&
                options[attr][backupType]
            ) {
                config = options[attr][backupType];
                break;
            }
        }
        if (!config) {
            for (const attr in options) {
                if (
                    Object.prototype.hasOwnProperty.call(options, attr) &&
                    typeof options[attr] === 'object' &&
                    options[attr][storageType as string]
                ) {
                    config = options[attr][storageType as string];
                    break;
                }
            }
        }
    } else if (storageType) {
        return config[storageType];
    }
    return config;
}

/**
 * Fetches the archive from the selected storage into the local backup directory.
 *
 * @param options the whole restore config
 * @param storageType where the file comes from; `'local'` copies instead of downloading
 * @param fileName the file as the storage names it
 * @param toSaveName the local target path
 * @param log restore logger
 * @param callback reports the download result
 */
export function getFile(
    options: LooseOptions,
    storageType: string,
    fileName: string,
    toSaveName: string,
    log: ioBroker.Logger,
    callback: (error?: Error | string | null, toSaveName?: string) => void,
): void {
    if (existsSync(toSaveName)) {
        callback(null, toSaveName);
    } else {
        const name = fileName.split('/').pop()!;
        let backupType = name.split('.')[0];
        if (
            backupType !== 'nodered' &&
            backupType !== 'zigbee' &&
            backupType !== 'jarvis' &&
            backupType !== 'yahka' &&
            backupType !== 'esphome'
        ) {
            backupType = name.split('_')[0];
        }

        if (PURE_IOBROKER_BACKUP.test(name)) {
            backupType = 'iobroker';
        }
        let config = getConfig(options, backupType === 'homematic' ? 'ccu' : backupType, storageType);
        if (CCU_BACKUP.test(name) && config && typeof config === 'object') {
            // with "own directory" the CCU backup lies in the CCU directory (`dir`), not in the one of the ioBroker backup
            config = { ...config, ownDir: false };
        }
        if (storageType !== 'local') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const engine = require(`./list/${storageType}`) as BackItUpStorageEngine;
            // Downloading only needs the logger; the scratch pad belongs to a backup run.
            const context: BackItUpContext = {
                adapter: null,
                log,
                backupDir: toSaveName.substring(0, toSaveName.lastIndexOf('/') + 1),
                timestamp: 0,
                fileNames: [],
                errors: {},
                done: [],
                types: [],
            };
            engine
                .getFile({
                    context,
                    options: config as never,
                    fileName,
                    toStoreName: toSaveName,
                })
                .then(
                    () => callback(),
                    (e: Error) => callback(e),
                );
        } else {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const tools = require('./tools') as typeof ToolsModule;
            tools.copyFile(fileName, toSaveName, callback);
        }
    }
}

/**
 * Launches the stop script that in turn re-runs this file as a detached process.
 *
 * @param bashDir directory holding stopIOB.sh / stopIOB.bat
 */
function startDetachedRestore(bashDir: string): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawn } = require('node:child_process') as typeof ChildProcessModule;
    const isWin = process.platform.startsWith('win');

    const spawnOptions: ChildProcessModule.SpawnOptions = {
        detached: true,
        cwd: __dirname,
        stdio: ['ignore', 'ignore', 'ignore'],
    };

    if (isWin) {
        spawnOptions.shell = true;
    }

    const cmd = spawn(
        isWin ? `${bashDir}/stopIOB.bat` : 'bash',
        [isWin ? '' : `${bashDir}/stopIOB.sh`],
        spawnOptions,
    );

    cmd.unref();
}

/**
 * Starts ioBroker again after a detached restore and then shuts this process down.
 *
 * @param bashDir directory holding startIOB.sh / startIOB.bat
 */
function startIOB(bashDir: string): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const child_process = require('node:child_process') as typeof ChildProcessModule;
    const isWin = process.platform.startsWith('win');
    startFinish = '[Restart]';
    let timeFinish = 10000;

    if (existsSync('/opt/scripts/.docker_config/.thisisdocker')) {
        timeFinish = 3000;
        logWebIF += '[EXIT] **** Docker Container restart now... ****\n';
    }

    setTimeout(() => (startFinish = '[Finish]'), timeFinish);

    child_process.exec(
        isWin ? `${bashDir}/startIOB.bat` : `bash ${bashDir}/startIOB.sh`,
        (error, stdout, stderr) => {
            if (error) {
                logWebIF += `[ERROR] ${error}\n`;
                logWebIF += `[ERROR] ${stderr}\n`;
            } else if (stdout) {
                logWebIF += `${stdout}\n`;
            }
            setTimeout(() => {
                try {
                    httpServer?.close();
                    httpServer = null;
                } catch (e) {
                    console.error(e);
                }
                process.exit();
            }, 30 * 1000);
        },
    );
}

/**
 * Builds the run context a restore step gets.
 *
 * A restore has no scratch pad to share - the four arrays exist only because the steps and the
 * backup steps use the same {@link BackItUpContext}. `warn` maps onto the restore logger's debug
 * level; that logger has no warn of its own, and no step uses it.
 *
 * @param log the restore logger for this step
 * @param adapter adapter instance, or null in the detached run
 * @param config the step's config slice, for the backup directory
 */
function makeContext(
    log: BackItUpRestoreLogger,
    adapter: ioBroker.Adapter | null,
    config: BackItUpRestoreOptions,
): BackItUpContext {
    return {
        fileNames: [],
        errors: {},
        done: [],
        types: [],
        adapter,
        log: { debug: text => log.debug(text), warn: text => log.debug(text), error: text => log.error(text) },
        backupDir: config.backupDir,
        timestamp: new Date().getTime(),
    };
}

/**
 * Restores one backup.
 *
 * Steps that stop ioBroker first (`isStop`) are not run here: their config is written to
 * restore.json and a detached copy of this file picks it up.
 *
 * @param adapter adapter instance, or null when this is the detached run
 * @param options the whole restore config
 * @param storageType where the archive comes from
 * @param fileName the archive as the storage names it
 * @param currentTheme admin theme, handed to the detached web interface
 * @param currentProtocol admin protocol, handed to the detached web interface
 * @param bashDir directory holding the start/stop scripts
 * @param log restore logger, used for the detached run
 * @param callback reports the result
 */
export function restore(
    adapter: ioBroker.Adapter | null,
    options: LooseOptions,
    storageType: string | null,
    fileName: string | null,
    currentTheme: string | null,
    currentProtocol: string | null,
    bashDir: string | null,
    log: BackItUpRestoreLogger,
    callback: (result: BackItUpRestoreResult) => void,
): void {
    options = JSON.parse(JSON.stringify(options));

    if (storageType === 'nas / copy') {
        storageType = 'cifs';
    }
    if (adapter) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const tools = require('./tools') as typeof ToolsModule;
        const backupDir = join(tools.getIobDir(), 'backups').replace(/\\/g, '/');

        if (storageType === 'local') {
            try {
                chmodSync(backupDir, '0775');
                log.debug(`set chmod for "${backupDir}" successfully`);
            } catch (err) {
                log.debug(`cannot set chmod for "${backupDir}": ${err}`);
            }
        }

        const name = fileName!.split('/').pop()!;
        const toSaveName = join(backupDir, name);

        if (CCU_BACKUP.test(name)) {
            log.error('Homematic CCU backups cannot be restored by BackItUp. Please restore them in the CCU.');
            callback({ error: 'Homematic CCU backups cannot be restored by BackItUp' });
            return;
        }

        getFile(options, storageType!, fileName!, toSaveName, log as unknown as ioBroker.Logger, err => {
            if (!err && existsSync(toSaveName)) {
                let backupType = name.split('.')[0];

                if (
                    backupType !== 'nodered' &&
                    backupType !== 'zigbee' &&
                    backupType !== 'jarvis' &&
                    backupType !== 'yahka' &&
                    backupType !== 'esphome'
                ) {
                    backupType = name.split('_')[0];
                }

                // Shadows the outer `log` for the whole block: inside the adapter process everything
                // goes to the adapter log and the output.line state instead of a file.
                //
                // NOTE: the original declared this further down, after the redis branch below
                // already called `log.debug`. Because `const` shadows for the entire block that
                // call hit the temporal dead zone, so restoring a redis backup from the admin UI
                // always threw "ReferenceError: Cannot access 'log' before initialization".
                // Moving the declaration up is the smallest repair; a TypeScript build refuses to
                // emit the original form at all.
                const log: BackItUpRestoreLogger = {
                    debug: text => {
                        const lines = (text as string).toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            if (line) {
                                adapter.log.debug(`[${backupType}] ${line}`);
                            }
                        });
                        void adapter?.setState('output.line', `[DEBUG] [${backupType}] - ${text as string}`, true);
                    },
                    error: textError => {
                        const lines = (textError as string).toString().split('\n');
                        lines.forEach(line => {
                            line = line.replace(/\r/g, ' ').trim();
                            if (line) {
                                adapter.log.error(`[${backupType}] ${line}`);
                            }
                        });
                        void adapter?.setState('output.line', `[ERROR] [${backupType}] - ${textError as string}`, true);
                    },
                    exit: exitCode => {
                        void adapter?.setState('output.line', `[EXIT] ${exitCode || 0}`, true);
                    },
                };

                if (backupType === 'redis') {
                    writeFileSync(`${bashDir}/.redis.info`, 'Stop redis-server before Restore');
                    log.debug('Redis-Server stopped');
                }

                if (PURE_IOBROKER_BACKUP.test(name)) {
                    backupType = 'iobroker';
                }
                const config = getConfig(options, backupType) as BackItUpRestoreOptions;

                config.backupDir = config.backupDir || backupDir;
                config.backupType = config.backupType || backupType;
                config.name = config.name || backupType;

                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const _module = require(`./restore/${backupType}`) as BackItUpRestoreModule;

                if (_module.isStop) {
                    if (backupType === 'iobroker' && existsSync(bashDir!)) {
                        // copy restore files
                        const restoreDir = join(bashDir!, 'restore');
                        const restoreSource = join(__dirname, 'restore');

                        tools.copyFile(join(__dirname, 'restore.js'), join(bashDir!, 'restore.js'));

                        if (!existsSync(restoreDir)) {
                            mkdirSync(restoreDir);
                        }

                        tools.copyFile(
                            join(restoreSource, `${backupType}.js`),
                            join(restoreDir, `${backupType}.js`),
                        );
                    }
                    config.fileName = toSaveName;
                    config.theme = currentTheme as string;
                    config.currentProtocol = currentProtocol as string;
                    config.bashDir = bashDir as string;
                    writeFileSync(
                        `${backupType === 'iobroker' ? bashDir : __dirname}/restore.json`,
                        JSON.stringify(config, null, 2),
                    );
                    startDetachedRestore(bashDir!);
                    callback?.({ error: '' });
                    return;
                }
                _module
                    .restore({ context: makeContext(log, adapter, config), options: config as never, fileName: toSaveName })
                    .then(
                        (exitCode: BackItUpRestoreResultCode) => {
                            log.exit(exitCode);
                            callback({ error: undefined, exitCode });
                        },
                        (e: BackItUpRestoreFailure) => {
                            log.exit(e?.exitCode);
                            callback({ error: e, exitCode: e?.exitCode });
                        },
                    );
            } else {
                callback({ error: err || `File ${toSaveName} not found` });
            }
        });
    } else {
        try {
            const config = options as BackItUpRestoreOptions;
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const _module = require(`./restore/${config.backupType}`) as BackItUpRestoreModule;
            _module
                .restore({ context: makeContext(log, null, config), options: config as never, fileName: config.fileName! })
                .then(
                    (exitCode: BackItUpRestoreResultCode) => {
                        log.exit(exitCode);
                        callback({ error: undefined, exitCode });
                    },
                    (e: BackItUpRestoreFailure) => {
                        log.error(e);
                        log.exit(e?.exitCode ?? -1);
                    },
                );
        } catch (e) {
            log.error(e);
            log.exit(-1);
        }
    }
}

/**
 * Serves the progress page the admin tab polls while ioBroker is down.
 *
 * @param currentTheme admin theme, decides the dark flag
 * @param currentProtocol `'https:'` serves over TLS when certificates are present
 * @param bashDir directory the certificates are read from
 */
// WebInterface Restore
function restoreIF(currentTheme: string, currentProtocol: string, bashDir: string): void {
    // Both are CJS `export =` factories; only the call signature is needed here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const express = require('express') as () => Express;
    const app = express();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cors = require('cors') as () => RequestHandler;
    app.use(cors());

    app.get('/status.json', (req, res) => {
        res.setHeader('content-type', 'application/json');

        res.json({
            logWebIF: logWebIF || 'Restore is started ...',
            startFinish,
            statusColor,
            restoreStatus,
            dark: currentTheme === 'dark' || currentTheme === 'react-blue' || currentTheme === 'react-dark',
        });
    });

    if (currentProtocol === 'https:') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const https = require('node:https') as typeof HttpsModule;

        let privateKey = '';
        let certificate = '';

        if (existsSync(join(bashDir, 'iob.key')) && existsSync(join(bashDir, 'iob.crt'))) {
            try {
                privateKey = readFileSync(join(bashDir, 'iob.key'), 'utf8');
                certificate = readFileSync(join(bashDir, 'iob.crt'), 'utf8');
            } catch {
                console.log('no certificates found');
            }
        }
        const credentials = { key: privateKey, cert: certificate };

        httpServer = https.createServer(credentials, app);
    } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const http = require('node:http') as typeof HttpModule;
        httpServer = http.createServer(app);
    }

    httpServer.listen(8091);
}

// The original only assigned module.exports in the `module.parent` branch. Exporting
// unconditionally is equivalent: in the detached run below nothing reads the exports.
if (!(typeof module !== 'undefined' && module.parent)) {
    if (existsSync(`${__dirname}/restore.json`)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const config = require(`${__dirname}/restore.json`) as BackItUpRestoreOptions;
        const logName = join(config.backupDir, 'logs.txt').replace(/\\/g, '/');

        startFinish = '[Restore]';
        restoreStatus = 'The ioBroker is currently being restored';
        restoreIF(config.theme!, config.currentProtocol!, config.bashDir!);

        const log: BackItUpRestoreLogger = {
            debug: text => {
                const lines = (text as string).toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    if (line) {
                        writeIntoFile(logName, `[DEBUG] [${config.name}] ${line}`);
                        logWebIF += `[DEBUG] [${config.name}] ${line}\n`;
                    }
                });
            },
            error: err => {
                const lines = (err as string).toString().split('\n');
                lines.forEach(line => {
                    line = line.replace(/\r/g, ' ').trim();
                    if (line) {
                        writeIntoFile(logName, `[ERROR] [${config.name}] ${line}`);
                        logWebIF += `[ERROR] [${config.name}] ${line}\n`;
                    }
                });
            },
            exit: exitCode => {
                writeIntoFile(logName, `[EXIT] ${exitCode}`);
                if (exitCode == 0 || DONE_MARKERS.includes(exitCode as string)) {
                    logWebIF += `[EXIT] ${exitCode} **** Restore completed successfully!! ****\n`;
                    statusColor = '#00b204';
                    restoreStatus = 'Restore completed successfully!! Starting iobroker... Please wait!';
                } else {
                    logWebIF += `[EXIT] ${exitCode} **** Restore was canceled!! ****\n`;
                    statusColor = '#c62828';
                    restoreStatus =
                        'Restore was canceled!! If ioBroker does not start automatically, please start it manually';
                }
            },
        };

        restore(null, config, null, null, null, null, null, log, () => startIOB(config.bashDir!));
    } else {
        console.log(`No config found at "${normalize(join(__dirname, 'restore.json'))}"`);
    }
}
