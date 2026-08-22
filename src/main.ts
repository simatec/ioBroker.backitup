/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */

import { existsSync, chmodSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { getAbsoluteDefaultDataDir, Adapter, type AdapterOptions } from '@iobroker/adapter-core'; // Get common adapter utils
import * as schedule from 'node-schedule';

import * as tools from './lib/tools';
import executeScripts from './lib/execute';
import * as systemCheck from './lib/systemCheck';
import TokenRefresher from './lib/tokenRefresher';

// Loaded on demand further down, so the adapter start stays cheap - only the types come in here.
import type * as ChildProcessModule from 'node:child_process';
import type * as HttpModule from 'node:http';
import type * as HttpsModule from 'node:https';
import type * as FsExtraModule from 'fs-extra';
import type { Express, RequestHandler } from 'express';

/** Call signature of lib/list, which is a CJS `export =` of a single function. */
type ListBackups = (
    restoreSource: BackItUpStorage | '' | undefined,
    config: Record<string, unknown>,
    log: ioBroker.Logger,
    callback?: (result: BackItUpListResult) => void,
) => void;

/** The slice of multer used below; the package is a CJS `export =` factory. */
type MulterFactory = ((options: { storage: unknown }) => {
    single(field: string): RequestHandler;
}) & {
    diskStorage(options: {
        destination: (req: unknown, file: { originalname: string }, cb: (e: null, dir: string) => void) => void;
        filename: (req: unknown, file: { originalname: string }, cb: (e: null, name: string) => void) => void;
    }): unknown;
};
import type GoogleDriveType from './lib/googleDriveLib';
import type OnedriveType from './lib/oneDriveLib';
import type * as RestoreModule from './lib/restore';
import type { BackItUpRestoreLogger } from './lib/restore/types';
import type { BackItUpExecuteConfig, BackItUpStorage } from './lib/types';
import type { BackItUpListResult, BackItUpStorageEngineResultFile } from './lib/list/types';

const bashDir = join(getAbsoluteDefaultDataDir(), 'backitup').replace(/\\/g, '/');

// Lazily required node builtins, cached across calls - not per-instance state.
let http: typeof HttpModule | undefined;
let https: typeof HttpsModule | undefined;

/**
 * Decrypt the password/value with given key
 *
 * @param key - Secret key
 * @param value - value to decrypt
 */
function decrypt(key: string, value: string): string {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

/**
 * Reads the listen port of a running server; both are bound to a TCP address.
 *
 * @param server the listening http/https server
 */
function serverPort(server: HttpModule.Server): number {
    return (server.address() as { port: number }).port;
}

/** A listed backup file, plus the two fields the detection below stamps onto it */
type DetectedFile = BackItUpStorageEngineResultFile & { date?: Date | string; storage?: string };

class BackItUp extends Adapter {
    private timerOutput: NodeJS.Timeout | undefined;
    private timerOutput2: NodeJS.Timeout | undefined;
    private timerUmount1: NodeJS.Timeout | undefined;
    private timerUmount2: NodeJS.Timeout | undefined;
    private timerMain: NodeJS.Timeout | undefined;
    private slaveTimeOut: NodeJS.Timeout | undefined;
    private waitToSlaveBackup: NodeJS.Timeout | undefined;
    private dlServer: (HttpModule.Server & { _connectionKey?: string }) | undefined;
    private ulServer: (HttpModule.Server & { _connectionKey?: string }) | undefined;

    /** system language */
    private systemLang = 'de';
    private readonly backupConfig: Record<string, any> = {};
    /**
     * Keyed by backup type, not by index - the original initialised this as an array and only
     * ever addressed it with string keys. Kept as found.
     */
    private readonly backupTimeSchedules = [] as unknown as Record<string, schedule.Job | null>;
    private taskRunning = false;
    private dropBoxTokenRefresher: TokenRefresher | null = null;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({ ...options, name: 'backitup' });

        this.on('stateChange', this.onStateChange.bind(this));
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        this.dropBoxTokenRefresher?.onStateChange(id, state);

        if (id === `${this.namespace}.info.dropboxTokens`) {
            await this.updateAccessTokens(this.backupConfig);
            this.log.debug('Config Update for Dropbox Token');
        }

        if (state && (state.val === true || state.val === 'true') && !state.ack) {
            if (id === `${this.namespace}.oneClick.iobroker` || id === `${this.namespace}.oneClick.ccu`) {
                const sysCheck = await systemCheck.storageSizeCheck(this, 'backitup', this.log);

                const type = id.split('.').pop()!;

                if (sysCheck?.ready === true || this.config.cifsEnabled === true) {
                    let config;
                    try {
                        config = JSON.parse(JSON.stringify(this.backupConfig[type]));
                        config.enabled = true;
                        config.deleteBackupAfter = 0; // do not delete files by custom backup
                    } catch (e) {
                        this.log.warn(`backup error: ${(e as Error).stack}`);
                        this.log.warn(`backup error: ${e} ... please check your config and try again!!`);
                    }

                    void this.startBackup(config, err => {
                        if (err) {
                            this.log.error(`[${type}] ${err}`);
                        } else {
                            this.log.debug(`[${type}] exec: done`);
                        }
                        this.timerOutput = setTimeout(() => {
                            this.readRunResult(type, () => {
                                if (this.config.onedriveEnabled && this.config.hostType === 'Single') {
                                    void this.renewOnedriveToken();
                                }
                            });
                        }, 500);
                        void this.setState(`oneClick.${type}`, false, true);

                        if (this.config.slaveInstance && type === 'iobroker' && this.config.hostType === 'Master') {
                            this.log.debug('Slave backup from BackItUp-Master is started ...');
                            void this.startSlaveBackup(this.config.slaveInstance[0], null);
                        }
                    });
                } else {
                    this.log.error(
                        `A local backup is currently not possible. The storage space is currently only ${sysCheck && sysCheck.diskFree ? sysCheck.diskFree : null} MB`,
                    );
                    systemCheck.systemMessage(
                        this,
                        tools._('A local backup is currently not possible. Please check your System!', this.systemLang),
                    );
                    void this.setState(`oneClick.${type}`, false, true);
                    void this.setState(
                        'output.line',
                        `[EXIT] ${tools._('A local backup is currently not possible. Please check your System!', this.systemLang)}`,
                        true,
                    );
                }
            }
        }
    }

    private async onReady(): Promise<void> {
        try {
            await this.main();
        } catch {
            //ignore errors
        }
    }

    // is called when adapter shuts down - callback has to be called under any circumstances!
    private onUnload(callback: () => void): void {
        try {
            this.dropBoxTokenRefresher?.destroy();
            this.log.info('cleaned everything up...');
            clearTimeout(this.timerOutput2);
            clearTimeout(this.timerOutput);
            clearTimeout(this.timerUmount1);
            clearTimeout(this.timerUmount2);
            clearTimeout(this.timerMain);
            clearTimeout(this.slaveTimeOut);
            clearTimeout(this.waitToSlaveBackup);
            if (this.dlServer) {
                try {
                    this.dlServer.closeAllConnections();
                } catch (e) {
                    this.log.debug(`Download server Connections could not be closed: ${e}`);
                }
                try {
                    this.dlServer.close();
                } catch (e) {
                    this.log.debug(`Download server Connections could not be closed: ${e}`);
                }
            }
            if (this.ulServer) {
                try {
                    this.ulServer.closeAllConnections();
                } catch (e) {
                    this.log.debug(`Upload server connections could not be closed: ${e}`);
                }
                try {
                    this.ulServer.close();
                } catch (e) {
                    this.log.debug(`Upload server connections could not be closed: ${e}`);
                }
            }
        } catch (e) {
            console.log(`Cannot unload: ${e}`);
        }
        callback();
    }

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (obj) {
            switch (obj.command) {
                case 'list':
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                        const list = (require('./lib/list') as { default: ListBackups }).default;
                        this.log.debug(`Reading backup list...`);
                        await this.updateAccessTokens(this.backupConfig);
                        list(obj.message, this.backupConfig, this.log, res => {
                            this.log.debug(`Backup list was read: ${JSON.stringify(res)}`);
                            if (obj.callback) {
                                this.sendTo(obj.from, obj.command, res, obj.callback);
                            }
                        });
                    } catch {
                        this.log.debug('Backup list cannot be read ...');
                    }
                    break;

                case 'authGoogleDrive': {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const GoogleDrive = (require('./lib/googleDriveLib') as { default: typeof GoogleDriveType }).default;

                    if (obj.callback) {
                        const google = new GoogleDrive();
                        void google
                            .getAuthorizeUrl()
                            .then(url => this.sendTo(obj.from, obj.command, { url }, obj.callback));
                    }
                    break;
                }

                case 'authDropbox':
                    if (obj.callback) {
                        void TokenRefresher.getAuthUrl('https://oauth2.iobroker.in/dropbox').then(url =>
                            this.sendTo(obj.from, obj.command, { url }, obj.callback),
                        );
                    }
                    break;

                case 'authOnedrive': {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const Onedrive = (require('./lib/oneDriveLib') as { default: typeof OnedriveType }).default;

                    if (obj.message && obj.message.code) {
                        const onedrive = new Onedrive();

                        void onedrive
                            .getRefreshToken(obj.message.code, this.log)
                            .then(json => this.sendTo(obj.from, obj.command, { done: true, json }, obj.callback))
                            .catch(err => this.sendTo(obj.from, obj.command, { error: err }, obj.callback));
                    } else if (obj.callback) {
                        const onedrive = new Onedrive();

                        void onedrive
                            .getAuthorizeUrl(this.log)
                            .then(url => this.sendTo(obj.from, obj.command, { url: url }, obj.callback))
                            .catch(err => this.sendTo(obj.from, obj.command, { error: err }, obj.callback));
                    }
                    break;
                }

                case 'restore':
                    if (obj.message) {
                        if (obj.message.stopIOB) {
                            await this.getCerts(obj.from);
                        }
                        this.log.info(`DATA: ${JSON.stringify(obj.message)}`);
                        await this.updateAccessTokens(this.backupConfig);

                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                        const _restore = require('./lib/restore') as typeof RestoreModule;
                        _restore.restore(
                            this,
                            this.backupConfig,
                            obj.message.type,
                            obj.message.fileName,
                            obj.message.currentTheme,
                            obj.message.currentProtocol,
                            bashDir,
                            this.log as unknown as BackItUpRestoreLogger,
                            res => obj.callback && this.sendTo(obj.from, obj.command, res, obj.callback),
                        );
                    } else if (obj.callback) {
                        this.invalidParameters(obj);
                    }
                    break;

                case 'uploadFile':
                    if (obj.message && obj.message.protocol) {
                        if (this.ulServer && this.ulServer._connectionKey && this.ulServer.listening) {
                            this.log.debug(`Upload server is running on Port ${serverPort(this.ulServer)}...`);
                        } else {
                            if (obj.message.protocol === 'https:') {
                                await this.getCerts(obj.from);
                            }

                            try {
                                this.ulFileServer(obj.message.protocol);
                            } catch {
                                this.log.debug('Upload server cannot started');
                            }
                        }

                        try {
                            this.sendTo(
                                obj.from,
                                obj.command,
                                { listenPort: serverPort(this.ulServer!) },
                                obj.callback,
                            );
                        } catch (e) {
                            this.sendTo(obj.from, obj.command, { e }, obj.callback);
                        }
                    } else if (obj.callback) {
                        this.invalidParameters(obj);
                    }
                    break;

                case 'getFile':
                    if (obj.message && obj.message.type && obj.message.fileName && obj.message.protocol) {
                        if (this.dlServer && this.dlServer._connectionKey && this.dlServer.listening) {
                            this.log.debug(`Download server is running on port ${serverPort(this.dlServer)}...`);
                        } else {
                            if (obj.message.protocol === 'https:') {
                                await this.getCerts(obj.from);
                            }

                            try {
                                this.dlFileServer(obj.message.protocol);
                            } catch {
                                this.log.debug('Downloadserver cannot started');
                            }
                        }

                        const fileName = obj.message.fileName.split('/').pop();
                        if (obj.message.type !== 'local') {
                            const backupDir = join(tools.getIobDir(), 'backups');
                            const toSaveName = join(backupDir, fileName);

                            // eslint-disable-next-line @typescript-eslint/no-require-imports
                            const _getFile = require('./lib/restore') as typeof RestoreModule;
                            await this.updateAccessTokens(this.backupConfig);

                            _getFile.getFile(
                                this.backupConfig,
                                obj.message.type,
                                obj.message.fileName,
                                toSaveName,
                                this.log,
                                err => {
                                    if (!err && existsSync(toSaveName)) {
                                        try {
                                            this.sendTo(
                                                obj.from,
                                                obj.command,
                                                { fileName: fileName, listenPort: serverPort(this.dlServer!) },
                                                obj.callback,
                                            );
                                        } catch (error) {
                                            this.sendTo(obj.from, obj.command, { error }, obj.callback);
                                        }
                                    } else {
                                        this.log.warn(`File ${toSaveName} not found`);
                                    }
                                },
                            );
                        } else if (existsSync(obj.message.fileName)) {
                            try {
                                this.sendTo(
                                    obj.from,
                                    obj.command,
                                    { fileName: fileName, listenPort: serverPort(this.dlServer!) },
                                    obj.callback,
                                );
                            } catch (error) {
                                this.sendTo(obj.from, obj.command, { error }, obj.callback);
                            }
                        }
                    } else if (obj.callback) {
                        this.invalidParameters(obj);
                    }
                    break;

                case 'serverClose':
                    if (obj.message && obj.message.downloadFinish && !obj.message.uploadFinish) {
                        this.log.debug('Download finished...');
                        this.sendTo(obj.from, obj.command, { serverClose: true }, obj.callback);
                    } else if (obj.message && obj.message.uploadFinish && !obj.message.downloadFinish) {
                        this.log.debug('Upload finished...');
                        this.sendTo(obj.from, obj.command, { serverClose: true }, obj.callback);
                    } else if (obj.callback) {
                        this.invalidParameters(obj);
                    }
                    break;

                case 'getTelegramUser':
                    if (obj && obj.message) {
                        const inst = obj.message.config.instance
                            ? obj.message.config.instance
                            : this.config.telegramInstance;
                        void this.getForeignState(`${inst}.communicate.users`, (err, state) => {
                            if (err) {
                                this.log.error(err as unknown as string);
                            }
                            if (state && state.val) {
                                try {
                                    this.sendTo(obj.from, obj.command, state.val, obj.callback);
                                } catch (err) {
                                    if (err) {
                                        this.log.error(err as string);
                                    }
                                    this.log.error('Cannot parse stored user IDs from Telegram!');
                                }
                            }
                        });
                    }
                    break;

                case 'getSystemInfo':
                    if (obj) {
                        let systemInfo: string = process.platform;
                        let dbInfo = false;

                        if (existsSync('/opt/scripts/.docker_config/.thisisdocker')) {
                            // Docker Image Support >= 5.2.0

                            systemInfo = 'docker';

                            if (existsSync('/opt/scripts/.docker_config/.backitup')) {
                                dbInfo = true;
                            }
                        } else {
                            const isWin = process.platform.startsWith('win');

                            if (isWin) {
                                systemInfo = 'win';
                            }
                        }

                        try {
                            this.sendTo(
                                obj.from,
                                obj.command,
                                {
                                    systemOS: systemInfo,
                                    dockerDB: dbInfo,
                                    backupDir: join(tools.getIobDir(), 'backups'),
                                },
                                obj.callback,
                            );
                        } catch (err) {
                            if (err) {
                                this.log.error(err as string);
                            }
                        }
                    }
                    break;

                case 'getFileSystemInfo':
                    if (obj) {
                        const sysCheck = await systemCheck.storageSizeCheck(this, 'backitup', this.log);

                        if (sysCheck) {
                            try {
                                this.sendTo(obj.from, obj.command, sysCheck, obj.callback);
                            } catch (err) {
                                if (err) {
                                    this.log.error(err as string);
                                }
                            }
                        }
                    }
                    break;

                case 'testWebDAV':
                    if (obj.message) {
                        // webdav is ESM only, so it has to be pulled in with a dynamic import
                        const { createClient } = await import('webdav');
                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                        const agent = new (require('node:https') as typeof HttpsModule).Agent({
                            rejectUnauthorized: Boolean(obj.message.config.signedCertificates),
                        });

                        const client = createClient(obj.message.config.host, {
                            username: obj.message.config.username,
                            password: obj.message.config.password,
                            maxBodyLength: Infinity,
                            httpsAgent: agent,
                        });

                        void client
                            .getDirectoryContents('')
                            .then(
                                contents => obj.callback && this.sendTo(obj.from, obj.command, contents, obj.callback),
                            )
                            .catch(err =>
                                this.sendTo(
                                    obj.from,
                                    obj.command,
                                    { error: JSON.stringify(err.message) },
                                    obj.callback,
                                ),
                            );
                    }
                    break;
                case 'slaveBackup':
                    if (obj?.message) {
                        if (this.config.hostType === 'Slave') {
                            this.log.debug('Slave Backup started ...');
                            const type = 'iobroker';
                            let config;
                            try {
                                config = JSON.parse(JSON.stringify(this.backupConfig[type]));
                                config.enabled = true;
                                // do delete files with specification from Master
                                config.deleteBackupAfter = obj.message.config.deleteAfter
                                    ? obj.message.config.deleteAfter
                                    : 0;
                            } catch (e) {
                                this.log.warn(`backup error: ${e} ... please check your config and try again!!`);
                            }
                            void this.startBackup(config, err => {
                                if (err) {
                                    this.log.error(`[${type}] ${err}`);
                                } else {
                                    this.log.debug(`[${type}] exec: done`);
                                }
                                const reply = (value: string | null): void => {
                                    if (value === null) {
                                        return;
                                    }
                                    try {
                                        this.sendTo(obj.from, obj.command, value, obj.callback);
                                    } catch (err) {
                                        if (err) {
                                            this.log.error(err as string);
                                        }
                                        this.log.error('slave Backup not finish!');
                                    }
                                };
                                this.timerOutput = setTimeout(
                                    () =>
                                        this.readRunResult(
                                            type,
                                            value => {
                                                reply(value);
                                                if (this.config.onedriveEnabled) {
                                                    void this.renewOnedriveToken();
                                                }
                                            },
                                            reply,
                                        ),
                                    500,
                                );
                                void this.setState(`oneClick.${type}`, false, true);
                            });
                        } else {
                            this.log.warn('Your BackItUp Instance is not configured as a slave');
                            this.sendTo(obj.from, obj.command, 'not configured as a slave', obj.callback);
                        }
                    }
                    break;
                case 'slaveInstance':
                    if (obj && obj.command === 'slaveInstance' && obj.message && obj.message.instance) {
                        const resultInstances: { label: string; value: string }[] = [];

                        const instances = await this.getObjectViewAsync('system', 'instance', {
                            startkey: `system.adapter.${obj.message.instance}.`,
                            endkey: `system.adapter.${obj.message.instance}.\u9999`,
                        }).catch(err => this.log.error(err));

                        if (instances && instances.rows && instances.rows.length != 0) {
                            instances.rows.forEach(row => {
                                if (row.id.replace('system.adapter.', '') != this.namespace) {
                                    resultInstances.push({
                                        label: row.id.replace('system.adapter.', ''),
                                        value: row.id.replace('system.adapter.', ''),
                                    });
                                }
                            });
                        }

                        this.sendTo(obj.from, obj.command, resultInstances, obj.callback);
                    }
                    break;
                case 'getLog': {
                    const logName = join(bashDir, `${this.namespace}.log`).replace(/\\/g, '/');

                    if (existsSync(logName) && (obj?.message.backupName || obj?.message.timestamp)) {
                        const data = readFileSync(logName, 'utf8');
                        const backupLog = JSON.parse(data);
                        const backupName = obj?.message.backupName ? obj.message.backupName : null;
                        const timestamp = obj?.message.timestamp;
                        let found = false;

                        backupLog.forEach((item: Record<string, string>, index: number) => {
                            if (Object.prototype.hasOwnProperty.call(item, timestamp)) {
                                found = true;
                                this.log.debug(`Printing logs of previous backup`);
                                this.sendTo(obj.from, obj.command, item[timestamp], obj.callback);
                            } else if (backupName !== null && Object.prototype.hasOwnProperty.call(item, backupName)) {
                                found = true;
                                this.log.debug(`Printing logs of previous backup`);
                                this.sendTo(obj.from, obj.command, item[backupName], obj.callback);
                            } else if (backupLog.length - 1 == index && !found) {
                                this.log.debug(`No Backuplogs found`);
                                this.sendTo(
                                    obj.from,
                                    obj.command,
                                    tools._('No log is available for this backup', this.systemLang),
                                    obj.callback,
                                );
                            }
                        });
                    }
                    break;
                }
            }
        }
    }

    /**
     * Writes the current DropBox access token into every storage slice of the config.
     *
     * @param config the assembled backup config, mutated in place
     */
    private async updateAccessTokens(config: Record<string, any>): Promise<void> {
        if (this.dropBoxTokenRefresher) {
            try {
                const accessToken = await this.dropBoxTokenRefresher.getAccessToken();

                Object.keys(config).forEach(key => {
                    if (config[key] && typeof config[key] === 'object') {
                        if (config[key].dropbox) {
                            config[key].dropbox.accessToken = accessToken;
                        } else {
                            Object.keys(config[key]).forEach(subKey => {
                                if (config[key][subKey]?.dropbox) {
                                    config[key][subKey].dropbox.accessToken = accessToken;
                                }
                            });
                        }
                    }
                });
            } catch (e) {
                this.log.error(`Cannot get access tokens for DropBox: ${e}`);
            }
        }
    }

    /**
     * Runs one backup, queueing behind a run that is still in progress.
     *
     * @param config the backup type's slice of the assembled config
     * @param cb reports the outcome
     */
    private async startBackup(
        config: BackItUpExecuteConfig,
        cb?: (error?: Error | string | null) => void,
    ): Promise<void> {
        if (this.taskRunning) {
            setTimeout(() => void this.startBackup(config, cb), 10000);
            return;
        }
        // await this.updateAccessTokens(config);

        this.taskRunning = true;
        try {
            executeScripts(this, config, err => {
                this.taskRunning = false;
                cb?.(err);
            });
            this.log.debug('Backup has started ...');
        } catch (e) {
            this.log.warn(`Backup error: ${(e as Error).stack}`);
            this.log.warn(`Backup error: ${e} ... please check your config and and try again!!`);
        }
    }

    /**
     * Writes the history states after a finished run and, for a master, kicks off the slave backups.
     *
     * @param type `'iobroker'` or `'ccu'`
     * @param onSuccess extra work once the run is confirmed successful
     * @param onFailure extra work once the run is confirmed failed
     */
    private readRunResult(
        type: string,
        onSuccess?: (value: string) => void,
        onFailure?: (value: string | null) => void,
    ): void {
        void this.getState('output.line', (err, state) => {
            if (state && state.val === '[EXIT] 0') {
                void this.setState(`history.${type}Success`, true, true);
                void this.setState(`history.${type}LastTime`, tools.getTimeString(this.systemLang), true);
                onSuccess?.(state.val);
            } else {
                void this.setState(`history.${type}LastTime`, `error: ${tools.getTimeString(this.systemLang)}`, true);
                void this.setState(`history.${type}Success`, false, true);
                onFailure?.(state?.val ? (state.val as string) : null);
            }
        });
    }

    /**
     * Rejects a message that arrived without the parameters its command needs.
     *
     * Up to and including 4.x these branches called `obj.callback({ error: 'Invalid parameters' })`.
     * `obj.callback` is the `{ message, id, ack, time }` descriptor js-controller attaches, not a
     * function, so the call threw "obj.callback is not a function" out of the async message handler
     * and the sender never got an answer. The reply now goes out the same way as in every other
     * branch of this handler.
     *
     * @param obj the incoming message
     */
    private invalidParameters(obj: ioBroker.Message): void {
        this.sendTo(obj.from, obj.command, { error: 'Invalid parameters' }, obj.callback);
    }

    private async checkStates(): Promise<void> {
        // Fill empty data points with default values
        const historyState = await this.getStateAsync('history.html');
        if (!historyState || historyState.val === null) {
            await this.setStateAsync('history.html', {
                val: `<span class="backup-type-total">${tools._('No backups yet', this.systemLang)}</span>`,
                ack: true,
            });
        }

        const iobrokerLastTime = await this.getStateAsync('history.iobrokerLastTime');
        if (!iobrokerLastTime || iobrokerLastTime.val === null) {
            await this.setStateAsync('history.iobrokerLastTime', {
                val: tools._('No backups yet', this.systemLang),
                ack: true,
            });
        }

        const ccuLastTime = await this.getStateAsync('history.ccuLastTime');
        if (!ccuLastTime || ccuLastTime.val === null) {
            await this.setStateAsync('history.ccuLastTime', {
                val: tools._('No backups yet', this.systemLang),
                ack: true,
            });
        }

        const iobrokerState = await this.getStateAsync('oneClick.iobroker');
        if (!iobrokerState || iobrokerState.val === null || iobrokerState.val === true) {
            await this.setStateAsync('oneClick.iobroker', { val: false, ack: true });
        }

        const ccuState = await this.getStateAsync('oneClick.ccu');
        if (!ccuState || ccuState.val === null || ccuState.val === true) {
            await this.setStateAsync('oneClick.ccu', { val: false, ack: true });
        }

        const ccuSuccess = await this.getStateAsync('history.ccuSuccess');
        if (!ccuSuccess || ccuSuccess.val === null) {
            await this.setStateAsync('history.ccuSuccess', { val: false, ack: true });
        }

        const iobrokerSuccess = await this.getStateAsync('history.iobrokerSuccess');
        if (!iobrokerSuccess || iobrokerSuccess.val === null) {
            await this.setStateAsync('history.iobrokerSuccess', { val: false, ack: true });
        }

        const jsonState = await this.getStateAsync('history.json');
        if (!jsonState || jsonState.val === null) {
            await this.setStateAsync('history.json', { val: '[]', ack: true });
        }
    }

    // function to create Backup schedules (Backup time)
    private createBackupSchedule(): void {
        for (const type in this.backupConfig) {
            if (!Object.prototype.hasOwnProperty.call(this.backupConfig, type)) {
                continue;
            }

            const config = this.backupConfig[type];
            if (config.enabled === true || config.enabled === 'true') {
                const time = config.ownCron ? config.cronjob : config.time.split(':');

                const backupInfo = config.ownCron
                    ? `with Cronjob "${config.cronjob}"`
                    : `at ${config.time} every ${config.everyXDays} day(s)`;
                this.log.info(`[${type}] backup will be activated ${backupInfo}`);

                if (this.backupTimeSchedules[type]) {
                    this.backupTimeSchedules[type].cancel();
                }
                const cron = config.ownCron ? time : `10 ${time[1]} ${time[0]} */${config.everyXDays} * * `;
                this.backupTimeSchedules[type] = schedule.scheduleJob(cron, async () => {
                    const sysCheck = await systemCheck.storageSizeCheck(this, 'backitup', this.log);

                    if ((sysCheck && sysCheck.ready && sysCheck.ready === true) || this.config.cifsEnabled === true) {
                        void this.setState(`oneClick.${type}`, true, true);

                        void this.startBackup(this.backupConfig[type], err => {
                            if (err) {
                                this.log.error(`[${type}] ${err}`);
                            } else {
                                this.log.debug(`[${type}] exec: done`);
                            }
                            this.timerOutput2 = setTimeout(
                                () =>
                                    this.readRunResult(type, () => {
                                        if (this.config.onedriveEnabled && this.config.hostType === 'Single') {
                                            void this.renewOnedriveToken();
                                        }
                                    }),
                                500,
                            );
                            void this.nextBackup(false, type);
                            void this.setState(`oneClick.${type}`, false, true);

                            if (this.config.slaveInstance && type === 'iobroker' && this.config.hostType === 'Master') {
                                this.log.debug('Slave backup from BackItUp-Master is started ...');
                                void this.startSlaveBackup(this.config.slaveInstance[0], null);
                            }
                        });
                    } else {
                        this.log.error(
                            `A local backup is currently not possible. The storage space is currently only ${sysCheck && sysCheck.diskFree ? sysCheck.diskFree : null} MB`,
                        );
                        systemCheck.systemMessage(
                            this,
                            tools._(
                                'A local backup is currently not possible. Please check your System!',
                                this.systemLang,
                            ),
                        );
                    }
                });

                if (config.debugging) {
                    this.log.debug(`[${type}] ${cron}`);
                }
            } else if (this.backupTimeSchedules[type]) {
                this.log.info(`[${type}] backup deactivated`);
                this.backupTimeSchedules[type].cancel();
                this.backupTimeSchedules[type] = null;
            }
        }
    }

    /**
     * Builds `this.backupConfig` from the instance configuration.
     *
     * @param secret the system secret the stored passwords were encrypted with
     */
    private async initConfig(secret: string): Promise<void> {
        // Snapshotted: the notification slices below use it as a property shorthand.
        const systemLang = this.systemLang;
        // compatibility
        if (this.config.cifsMount === 'CIFS') {
            this.config.cifsMount = '';
        }
        if (this.config.redisEnabled === undefined) {
            this.config.redisEnabled = this.config.backupRedis!;
        }
        let ioPath;

        try {
            // ioPath = `${ioCommon.tools.getControllerDir()}/iobroker.js`; Todo: Error by iob Backup (no such file or directory, uv_cwd)
            // ioPath = require.resolve('iobroker.js-controller/iobroker.js');
            // Two levels up: this file compiles to build/main.js, so `__dirname` is
            // <adapter>/build and the sibling adapters live one directory above that.
            ioPath = resolvePath(__dirname, '../../iobroker.js-controller/iobroker.js');
        } catch (e) {
            this.log.error(`Unable to read iobroker path: +${e}`);
        }

        this.decryptEvents(secret);

        const hostName = this.config.minimalNameSuffix ? this.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '';
        const ignoreErrors = this.config.ignoreErrors;
        const notificationsType = this.config.notificationsType;
        const notificationEnabled = this.config.notificationEnabled;

        const telegram = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.telegramInstance,
            SilentNotice: this.config.telegramSilentNotice,
            NoticeType: this.config.telegramNoticeType,
            User: this.config.telegramUser,
            onlyError: this.config.telegramOnlyError,
            telegramWaiting: this.config.telegramWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const whatsapp = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.whatsappInstance,
            NoticeType: this.config.whatsappNoticeType,
            onlyError: this.config.whatsappOnlyError,
            whatsappWaiting: this.config.whatsappWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const gotify = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.gotifyInstance,
            NoticeType: this.config.gotifyNoticeType,
            onlyError: this.config.gotifyOnlyError,
            gotifyWaiting: this.config.gotifyWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const signal = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.signalInstance,
            NoticeType: this.config.signalNoticeType,
            onlyError: this.config.signalOnlyError,
            signalWaiting: this.config.signalWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const matrix = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.matrixInstance,
            NoticeType: this.config.matrixNoticeType,
            onlyError: this.config.matrixOnlyError,
            matrixWaiting: this.config.matrixWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const discord = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.discordInstance,
            NoticeType: this.config.discordNoticeType,
            target: this.config.discordTarget,
            onlyError: this.config.discordOnlyError,
            discordWaiting: this.config.discordWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const pushover = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.pushoverInstance,
            SilentNotice: this.config.pushoverSilentNotice,
            NoticeType: this.config.pushoverNoticeType,
            deviceID: this.config.pushoverDeviceID,
            onlyError: this.config.pushoverOnlyError,
            pushoverWaiting: this.config.pushoverWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const email = {
            enabled: notificationEnabled,
            notificationsType,
            type: 'message',
            instance: this.config.emailInstance,
            NoticeType: this.config.emailNoticeType,
            emailReceiver: this.config.emailReceiver,
            emailSender: this.config.emailSender,
            onlyError: this.config.emailOnlyError,
            emailWaiting: this.config.emailWaitToSend * 1000,
            hostName,
            ignoreErrors,
            systemLang,
        };

        const notification = {
            type: 'message',
            ignoreErrors,
            bashDir: bashDir,
            entriesNumber: this.config.historyEntriesNumber,
            systemLang,
        };

        const historyHTML = {
            enabled: true,
            type: 'message',
            entriesNumber: this.config.historyEntriesNumber,
            ignoreErrors,
            systemLang,
        };

        const historyJSON = {
            enabled: true,
            type: 'message',
            entriesNumber: this.config.historyEntriesNumber,
            ignoreErrors,
            systemLang,
        };

        const ftp = {
            enabled: this.config.ftpEnabled,
            type: 'storage',
            source: this.config.restoreSource,
            host: this.config.ftpHost, // ftp-host
            debugging: this.config.debugLevel,
            deleteOldBackup: this.config.ftpDeleteOldBackup, // Delete old Backups from FTP
            ftpDeleteAfter: this.config.ftpDeleteAfter,
            advancedDelete: this.config.advancedDelete,
            ownDir: this.config.ftpOwnDir,
            bkpType: this.config.restoreType,
            dir: this.config.ftpOwnDir === true ? null : this.config.ftpDir, // directory on FTP server
            dirMinimal: this.config.ftpMinimalDir,
            user: this.config.ftpUser, // username for FTP Server
            pass: this.config.ftpPassword || '', // password for FTP Server
            port: this.config.ftpPort || 21, // FTP port
            secure: this.config.ftpSecure || false, // secure FTP connection
            signedCertificates: this.config.ftpSignedCertificates !== false,
            ignoreErrors,
        };

        let accessToken: string | undefined = '';
        if (this.config.dropboxEnabled) {
            this.dropBoxTokenRefresher = new TokenRefresher(
                this,
                'info.dropboxTokens',
                'https://oauth2.iobroker.in/dropbox',
            );
            try {
                accessToken = await this.dropBoxTokenRefresher.getAccessToken();
            } catch (e) {
                this.log.error(`No DropBox token found: ${e}`);
            }
        }

        const dropbox = {
            enabled: this.config.dropboxEnabled,
            type: 'storage',
            source: this.config.restoreSource,
            debugging: this.config.debugLevel,
            deleteOldBackup: this.config.dropboxDeleteOldBackup, // Delete old Backups from Dropbox
            dropboxDeleteAfter: this.config.dropboxDeleteAfter,
            advancedDelete: this.config.advancedDelete,
            accessToken: this.config.dropboxTokenType === 'custom' ? this.config.dropboxAccessToken : accessToken,
            dropboxAccessJson: this.config.dropboxAccessJson,
            dropboxTokenType: this.config.dropboxTokenType,
            ownDir: this.config.dropboxOwnDir,
            bkpType: this.config.restoreType,
            dir: this.config.dropboxOwnDir === true ? null : this.config.dropboxDir,
            dirMinimal: this.config.dropboxMinimalDir,
            ignoreErrors,
        };

        const onedrive = {
            enabled: this.config.onedriveEnabled,
            type: 'storage',
            source: this.config.restoreSource,
            debugging: this.config.debugLevel,
            deleteOldBackup: this.config.onedriveDeleteOldBackup, // Delete old Backups from Onedrive
            onedriveDeleteAfter: this.config.onedriveDeleteAfter,
            advancedDelete: this.config.advancedDelete,
            onedriveAccessJson: this.config.onedriveAccessJson,
            ownDir: this.config.onedriveOwnDir,
            bkpType: this.config.restoreType,
            dir: this.config.onedriveOwnDir === true ? null : this.config.onedriveDir,
            dirMinimal: this.config.onedriveMinimalDir,
            ignoreErrors,
        };

        const webdav = {
            enabled: this.config.webdavEnabled,
            type: 'storage',
            source: this.config.restoreSource,
            debugging: this.config.debugLevel,
            deleteOldBackup: this.config.webdavDeleteOldBackup, // Delete old Backups from webdav
            webdavDeleteAfter: this.config.webdavDeleteAfter,
            advancedDelete: this.config.advancedDelete,
            username: this.config.webdavUsername,
            pass: this.config.webdavPassword || '', // webdav password
            url: this.config.webdavURL,
            ownDir: this.config.webdavOwnDir,
            bkpType: this.config.restoreType,
            dir: this.config.webdavOwnDir === true ? null : this.config.webdavDir,
            dirMinimal: this.config.webdavMinimalDir,
            signedCertificates: this.config.webdavSignedCertificates,
            ignoreErrors,
        };

        const googledrive = {
            enabled: this.config.googledriveEnabled,
            type: 'storage',
            source: this.config.restoreSource,
            debugging: this.config.debugLevel,
            deleteOldBackup: this.config.googledriveDeleteOldBackup, // Delete old Backups from google drive
            googledriveDeleteAfter: this.config.googledriveDeleteAfter,
            advancedDelete: this.config.advancedDelete,
            accessJson: this.config.googledriveAccessTokens || this.config.googledriveAccessJson,
            newToken: !!this.config.googledriveAccessTokens,
            ownDir: this.config.googledriveOwnDir,
            bkpType: this.config.restoreType,
            dir: this.config.googledriveOwnDir === true ? null : this.config.googledriveDir,
            dirMinimal: this.config.googledriveMinimalDir,
            ignoreErrors,
        };

        const cifs = {
            enabled: this.config.cifsEnabled,
            mountType: this.config.connectType,
            type: 'storage',
            source: this.config.restoreSource,
            mount: this.config.cifsMount,
            debugging: this.config.debugLevel,
            fileDir: bashDir,
            wakeOnLAN: this.config.wakeOnLAN,
            macAd: this.config.macAd,
            wolTime: this.config.wolWait,
            wolPort: this.config.wolPort || 9,
            wolExtra: this.config.wolExtra,
            smb: this.config.smbType,
            sudo: this.config.sudoMount,
            cifsDomain: this.config.cifsDomain,
            clientInodes: this.config.noserverino,
            cacheLoose: this.config.cacheLoose,
            deleteOldBackup: this.config.cifsDeleteOldBackup, //Delete old Backups from Network Disk
            ownDir: this.config.cifsOwnDir,
            bkpType: this.config.restoreType,
            dir: this.config.cifsOwnDir === true ? null : this.config.cifsDir, // specify if CIFS mount should be used
            dirMinimal: this.config.cifsMinimalDir,
            user: this.config.cifsUser, // specify if CIFS mount should be used
            pass: this.config.cifsPassword || '', // password for NAS Server
            expertMount: this.config.expertMount,
            ignoreErrors,
        };

        /**
         * Every backup slice carries its own copy of the six storage configs, with the target directory
         * swapped for the per-backup-type one when "own directory" is on. The original spelled these six
         * `Object.assign` lines out at each of the sixteen slices.
         *
         * Must be called per slice - each slice needs its own copies.
         *
         * @param variant which set of per-type directories to use
         */
        const storagesFor = (variant: 'Minimal' | 'Ccu'): Record<string, any> => ({
            ftp: Object.assign({}, ftp, this.config.ftpOwnDir === true ? { dir: this.config[`ftp${variant}Dir`] } : {}),
            cifs: Object.assign(
                {},
                cifs,
                this.config.cifsOwnDir === true ? { dir: this.config[`cifs${variant}Dir`] } : {},
            ),
            dropbox: Object.assign(
                {},
                dropbox,
                this.config.dropboxOwnDir === true ? { dir: this.config[`dropbox${variant}Dir`] } : {},
            ),
            onedrive: Object.assign(
                {},
                onedrive,
                this.config.onedriveOwnDir === true ? { dir: this.config[`onedrive${variant}Dir`] } : {},
            ),
            webdav: Object.assign(
                {},
                webdav,
                this.config.webdavOwnDir === true ? { dir: this.config[`webdav${variant}Dir`] } : {},
            ),
            googledrive: Object.assign(
                {},
                googledrive,
                this.config.googledriveOwnDir === true ? { dir: this.config[`googledrive${variant}Dir`] } : {},
            ),
        });

        // names addition, appended to the file name
        const nameSuffix = this.config.minimalNameSuffix.replace(/[.;, ]/g, '_');
        const slaveSuffix = this.config.hostType === 'Slave' ? this.config.slaveNameSuffix : '';
        const hostType = this.config.hostType;
        const iobDataDir = join(tools.getIobDir(), 'iobroker-data');

        // Configurations for standard-IoBroker backup
        this.backupConfig.iobroker = {
            name: 'iobroker',
            type: 'creator',
            workDir: ioPath,
            enabled: this.config.minimalEnabled,
            time: this.config.minimalTime,
            cronjob: this.config.iobrokerCronJob,
            ownCron: this.config.iobrokerCron,
            debugging: this.config.debugLevel,
            slaveBackup: this.config.hostType,
            everyXDays: this.config.minimalEveryXDays,
            nameSuffix,
            deleteBackupAfter: this.config.minimalDeleteAfter, // delete old backup files after x days
            ...storagesFor('Minimal'),
            ignoreErrors,
            mysql: {
                enabled: this.config.mySqlEnabled === undefined ? true : this.config.mySqlEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                nameSuffix,
                mysqlQuick: this.config.mysqlQuick,
                slaveSuffix,
                hostType,
                mysqlSingleTransaction: this.config.mysqlSingleTransaction,
                dbName: this.config.mySqlName, // database name
                user: this.config.mySqlUser, // database user
                pass: this.config.mySqlPassword || '', // database password
                deleteBackupAfter: this.config.mySqlDeleteAfter, // delete old backupfiles after x days
                host: this.config.mySqlHost, // database host
                port: this.config.mySqlPort, // database port
                mySqlEvents: this.config.mySqlEvents,
                mySqlMulti: this.config.mySqlMulti,
                ignoreErrors,
                skipSSL: this.config.mysqlSkipSSL,
                exe: this.config.mySqlDumpExe, // path to mysqldump
            },
            sqlite: {
                enabled: this.config.sqliteEnabled === undefined ? true : this.config.sqliteEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                nameSuffix,
                slaveSuffix,
                hostType,
                deleteBackupAfter: this.config.sqliteDeleteAfter, // delete old backupfiles after x days
                ignoreErrors,
                filePth: this.config.sqlitePath,
                exe: this.config.sqliteDumpExe, // path to sqlitedump
            },
            dir: tools.getIobDir(),
            influxDB: {
                enabled: this.config.influxDBEnabled === undefined ? true : this.config.influxDBEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                nameSuffix,
                slaveSuffix,
                hostType,
                deleteBackupAfter: this.config.influxDBDeleteAfter, // delete old backupfiles after x days
                dbName: this.config.influxDBName, // database name
                host: this.config.influxDBHost, // database host
                port: this.config.influxDBPort
                    ? this.config.influxDBPort
                    : this.config.influxDBVersion == '1.x'
                      ? 8088
                      : 8086,
                dbversion: this.config.influxDBVersion, // dbversion from Influxdb
                token: this.config.influxDBToken, // Token from Influxdb
                protocol: this.config.influxDBProtocol, // Protocol Type from Influxdb
                exe: this.config.influxDBDumpExe, // path to influxDBdump
                dbType: this.config.influxDBType, // type of influxdb Backup
                influxDBEvents: this.config.influxDBEvents,
                influxDBMulti: this.config.influxDBMulti,
                ignoreErrors,
                deleteDataBase: this.config.deleteOldDataBase, // delete old database for restore
            },
            pgsql: {
                enabled: this.config.pgSqlEnabled === undefined ? true : this.config.pgSqlEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                nameSuffix,
                slaveSuffix,
                hostType,
                dbName: this.config.pgSqlName, // database name
                user: this.config.pgSqlUser, // database user
                pass: this.config.pgSqlPassword || '', // database password
                deleteBackupAfter: this.config.pgSqlDeleteAfter, // delete old backupfiles after x days
                host: this.config.pgSqlHost, // database host
                port: this.config.pgSqlPort, // database port
                pgSqlEvents: this.config.pgSqlEvents,
                pgSqlMulti: this.config.pgSqlMulti,
                ignoreErrors,
                exe: this.config.pgSqlDumpExe, // path to mysqldump
            },
            redis: {
                enabled: this.config.redisEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                aof: this.config.redisAOFactive,
                nameSuffix,
                slaveSuffix,
                hostType,
                path: this.config.redisPath || '/var/lib/redis', // specify Redis path
                redisType: this.config.redisType, // local or Remote Backup
                host: this.config.redisHost, // Host for Remote Backup
                port: this.config.redisPort, // Port for Remote Backup
                user: this.config.redisUser, // User for Remote Backup
                pass: this.config.redisPassword || '', // Password for Remote Backup
                ignoreErrors,
            },
            historyDB: {
                enabled: this.config.historyEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                path: this.config.historyPath,
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
            },
            zigbee: {
                enabled: this.config.zigbeeEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                path: iobDataDir, // specify zigbee path
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
            },
            esphome: {
                enabled: this.config.esphomeEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                path: iobDataDir, // specify esphome path
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
            },
            zigbee2mqtt: {
                enabled: this.config.zigbee2mqttEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                path: this.config.zigbee2mqttPath, // specify zigbee2mqtt path
                z2mType: this.config.zigbee2mqttType,
                z2mUsername: this.config.zigbee2mqttUser,
                z2mPassword: this.config.zigbee2mqttPassword,
                z2mUrl: this.config.zigbee2mqttHost,
                z2mPort: this.config.zigbee2mqttPort,
                z2mBaseTopic: this.config.zigbee2mqttBaseTopic,
                z2mAuth: this.config.zigbee2mqttAuth,
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
            },
            nodered: {
                enabled: this.config.noderedEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                path: iobDataDir, // specify Node-Red path
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
            },
            yahka: {
                enabled: this.config.yahkaEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                path: iobDataDir, // specify yahka path
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
            },
            jarvis: {
                enabled: this.config.jarvisEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                path: iobDataDir, // specify jarvis backup path
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
            },
            javascripts: {
                enabled: this.config.javascriptsEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                slaveSuffix,
                hostType,
                nameSuffix,
                ignoreErrors,
            },
            grafana: {
                enabled: this.config.grafanaEnabled,
                type: 'creator',
                ...storagesFor('Minimal'),
                host: this.config.grafanaHost, // database host
                port: this.config.grafanaPort, // database port
                protocol: this.config.grafanaProtocol, // database protocol
                apiKey: this.config.grafanaApiKey,
                nameSuffix,
                slaveSuffix,
                hostType,
                ignoreErrors,
                signedCertificates:
                    this.config.grafanaProtocol == 'https' ? this.config.grafanaSignedCertificates : true,
            },
            historyHTML,
            historyJSON,
            telegram,
            email,
            pushover,
            whatsapp,
            gotify,
            signal,
            matrix,
            discord,
            notification,
        };

        // Configurations for CCU / pivCCU / RaspberryMatic backup
        this.backupConfig.ccu = {
            name: 'ccu',
            type: 'creator',
            enabled: this.config.ccuEnabled,
            time: this.config.ccuTime,
            cronjob: this.config.ccuCronJob,
            ownCron: this.config.ccuCron,
            debugging: this.config.debugLevel,
            everyXDays: this.config.ccuEveryXDays,
            nameSuffix: this.config.ccuNameSuffix, // names addition, appended to the file name
            deleteBackupAfter: this.config.ccuDeleteAfter, // delete old backupfiles after x days
            signedCertificates: this.config.ccuSignedCertificates,
            ignoreErrors,

            ...storagesFor('Ccu'),
            historyHTML,
            historyJSON,
            telegram,
            email,
            pushover,
            whatsapp,
            gotify,
            signal,
            matrix,
            discord,
            notification,

            host: this.config.ccuHost, // IP-address CCU
            user: this.config.ccuUser, // username CCU
            usehttps: this.config.ccuUsehttps, // Use https for CCU Connect
            pass: this.config.ccuPassword || '', // password der CCU
            ccuEvents: this.config.ccuEvents,
            ccuMulti: this.config.ccuMulti,
        };
    }

    private readLogFile(): void {
        try {
            const logName = join(tools.getIobDir(), 'backups', 'logs.txt').replace(/\\/g, '/');
            if (existsSync(logName)) {
                this.log.debug(`Printing logs of previous backup`);
                const text = readFileSync(logName).toString();
                const lines = text.split('\n');
                lines.forEach((line, i) => (lines[i] = line.replace(/\r$|^\r/, '')));
                lines.forEach(line => {
                    line = line.trim();

                    if (line) {
                        if (line.startsWith('[ERROR]')) {
                            this.log.error(line);
                        } else {
                            this.log.debug(line);
                        }
                        void this.setState('output.line', line, true);
                    }
                });
                void this.setState('output.line', '[EXIT] 0', true);
                unlinkSync(logName);
            }
        } catch (e) {
            this.log.warn(`Cannot read log file: ${e}`);
        }
    }

    private createBashScripts(): void {
        const isWin = process.platform.startsWith('win');
        if (!existsSync(bashDir)) {
            mkdirSync(bashDir);
            this.log.debug('BackItUp data-directory created');
        }
        const logFile = join(bashDir, `${this.namespace}.log`);
        if (!existsSync(logFile)) {
            writeFileSync(logFile, '[]');
        }
        if (isWin) {
            this.log.debug(`BackItUp has recognized a ${process.platform} system`);

            try {
                writeFileSync(`${bashDir}/stopIOB.bat`, `start "" "${join(bashDir, 'external.bat')}"`);
            } catch (e) {
                this.log.error(`cannot create stopIOB.bat: ${e}Please run "iobroker fix"`);
            }

            try {
                writeFileSync(
                    `${bashDir}/external.bat`,
                    `cd "${join(tools.getIobDir())}"\ncall iobroker stop\ntimeout /T 15\nif exist "${join(bashDir, '.redis.info')}" (\nredis-server --service-stop\n)\nif exist "${join(bashDir, '.redis.info')}" (\ncd "${join(__dirname, 'lib')}"\n) else (\ncd "${join(bashDir)}"\n)\nnode restore.js`,
                );
                chmodSync(`${bashDir}/external.bat`, 508);
            } catch (e) {
                this.log.error(`cannot create external.sh: ${e}Please run "iobroker fix"`);
            }

            try {
                writeFileSync(
                    `${bashDir}/startIOB.bat`,
                    `if exist "${join(bashDir, '.redis.info')}" (\nredis-server --service-start\n)\ncd "${join(tools.getIobDir())}"\ncall iobroker host this\ncall iobroker start\nif exist "${join(bashDir, '.startAll')}" (\ncd "${join(tools.getIobDir(), 'node_modules/iobroker.js-controller')}"\nnode iobroker.js start all\n)`,
                );
            } catch (e) {
                this.log.error(`cannot create startIOB.bat: ${e}Please run "iobroker fix"`);
            }
        } else if (existsSync('/opt/scripts/.docker_config/.thisisdocker')) {
            // Docker Image Support >= 5.2.0
            this.log.debug(`BackItUp has recognized a Docker system`);

            try {
                writeFileSync(
                    `${bashDir}/stopIOB.sh`,
                    `#!/bin/bash\n# iobroker stop for restore\nbash ${bashDir}/external.sh`,
                );
                chmodSync(`${bashDir}/stopIOB.sh`, 508);
            } catch (e) {
                this.log.error(`cannot create stopIOB.sh: ${e}Please run "iobroker fix"`);
            }

            try {
                writeFileSync(
                    `${bashDir}/startIOB.sh`,
                    `#!/bin/bash\n# iobroker start after restore\nif [ -f ${bashDir}/.startAll ]; then\ncd "${join(tools.getIobDir())}"\niobroker start all;\nfi\nsleep 6\nbash /opt/scripts/maintenance.sh off -y`,
                );
                chmodSync(`${bashDir}/startIOB.sh`, 508);
            } catch (e) {
                this.log.error(`cannot create startIOB.sh: ${e}Please run "iobroker fix"`);
            }

            try {
                writeFileSync(
                    `${bashDir}/external.sh`,
                    `#!/bin/bash\n# restore\nbash /opt/scripts/maintenance.sh on -y -kbn\nsleep 3\nif [ -f ${bashDir}/.redis.info ]; then\ncd "${join(__dirname, 'lib')}"\nelse\ncd "${bashDir}"\nfi\nnode restore.js`,
                );
                chmodSync(`${bashDir}/external.sh`, 508);
            } catch (e) {
                this.log.error(`cannot create external.sh: ${e}Please run "iobroker fix"`);
            }
        } else {
            this.log.debug(`BackItUp has recognized a ${process.platform} system`);

            try {
                writeFileSync(
                    `${bashDir}/stopIOB.sh`,
                    `# iobroker stop for restore\nsudo systemd-run --uid=iobroker bash ${bashDir}/external.sh`,
                );
                chmodSync(`${bashDir}/stopIOB.sh`, 508);
            } catch (e) {
                this.log.error(`cannot create stopIOB.sh: ${e}Please run "iobroker fix"`);
            }

            try {
                writeFileSync(
                    `${bashDir}/startIOB.sh`,
                    `# iobroker start after restore\nif [ -f ${bashDir}/.redis.info ]; then\nredis-cli shutdown nosave && echo "[DEBUG] [redis] Redis restart successfully"\nfi\nif [ -f ${bashDir}/.startAll ]; then\ncd "${join(tools.getIobDir())}"\nbash iobroker start all && echo "[EXIT] **** iobroker start upload all now... ****"\nfi\ncd "${join(tools.getIobDir())}"\nbash iobroker host this && echo "[DEBUG] [iobroker] Host this successfully"\nbash iobroker start && echo "[EXIT] **** iobroker restart now... ****"`,
                );
                chmodSync(`${bashDir}/startIOB.sh`, 508);
            } catch (e) {
                this.log.error(`cannot create startIOB.sh: ${e}Please run "iobroker fix"`);
            }

            try {
                writeFileSync(
                    `${bashDir}/external.sh`,
                    `# restore\ncd "${join(tools.getIobDir())}"\nbash iobroker stop && echo "[DEBUG] [iobroker] iobroker stop successfully"\nif [ -f ${bashDir}/.redis.info ]; then\ncd "${join(__dirname, 'lib')}"\nelse\ncd "${bashDir}"\nfi\nnode restore.js`,
                );
                chmodSync(`${bashDir}/external.sh`, 508);
            } catch (e) {
                this.log.error(`cannot create external.sh: ${e}Please run "iobroker fix"`);
            }
        }
    }

    // umount after restore
    private umount(): void {
        const backupDir = join(tools.getIobDir(), 'backups');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const child_process = require('node:child_process') as typeof ChildProcessModule;

        if (existsSync(`${bashDir}/.mount`)) {
            child_process.exec(`mount | grep -o "${backupDir}"`, (error, stdout) => {
                if (stdout.includes(backupDir)) {
                    this.log.debug('mount activ... umount in 2 Seconds!!');
                    this.timerUmount1 = setTimeout(
                        () =>
                            child_process.exec(
                                `${this.config.sudoMount ? 'sudo umount' : 'umount'} ${backupDir}`,
                                error => {
                                    if (error) {
                                        this.log.debug('umount: device is busy... wait 5 Minutes!!');
                                        this.timerUmount2 = setTimeout(
                                            () =>
                                                child_process.exec(
                                                    `${this.config.sudoMount ? 'sudo umount' : 'umount'} -l ${backupDir}`,
                                                    error => {
                                                        if (error) {
                                                            this.log.error(error as unknown as string);
                                                        } else {
                                                            this.log.debug('umount successfully completed');
                                                            this.removeMountMarker();
                                                        }
                                                    },
                                                ),
                                            300000,
                                        );
                                    } else {
                                        this.log.debug('umount successfully completed');
                                        this.removeMountMarker();
                                    }
                                },
                            ),
                        2000,
                    );
                } else {
                    this.log.debug('mount inactiv!!');
                }
            });
        }
    }

    /** Deletes the ".mount" marker, ignoring failures. */
    private removeMountMarker(): void {
        try {
            if (existsSync(`${bashDir}/.mount`)) {
                unlinkSync(`${bashDir}/.mount`);
            }
        } catch {
            this.log.debug('file ".mount" not deleted ...');
        }
    }

    // Create Backupdir on first start
    private createBackupDir(): void {
        if (!existsSync(join(tools.getIobDir(), 'backups'))) {
            try {
                mkdirSync(join(tools.getIobDir(), 'backups'));
                this.log.debug('Created BackupDir');
            } catch (e) {
                this.log.warn(
                    `Backup folder not created: ${e}! Please run "iobroker fix" and try again or create the backup folder manually!!`,
                );
            }
        }
    }

    // delete Hide Files after restore
    private deleteHideFiles(): void {
        if (existsSync(`${bashDir}/.redis.info`)) {
            unlinkSync(`${bashDir}/.redis.info`);
        }
    }

    // delete temp dir after restore
    private delTmp(): void {
        if (existsSync(join(tools.getIobDir(), 'backups/tmp'))) {
            try {
                rmdirSync(join(tools.getIobDir(), 'backups/tmp'));
                this.log.debug('delete tmp files');
            } catch (e) {
                this.log.warn(
                    `can not delete tmp files: ${e}Please run "iobroker fix" and try again or delete the tmp folder manually!!`,
                );
            }
        }
    }

    // set start Options after restore
    private setStartAll(): void {
        if (this.config.startAllRestore && !existsSync(`${bashDir}/.startAll`)) {
            try {
                writeFileSync(`${bashDir}/.startAll`, 'Start all Adapter after Restore');
                this.log.debug('Start all Adapter after Restore enabled');
            } catch (e) {
                this.log.warn(`can not create startAll files: ${e}Please run "iobroker fix" and try again`);
            }
        } else if (!this.config.startAllRestore && existsSync(`${bashDir}/.startAll`)) {
            try {
                unlinkSync(`${bashDir}/.startAll`);
                this.log.debug('Start all Adapter after Restore disabled');
            } catch (e) {
                this.log.warn(`can not delete startAll file: ${e}Please run "iobroker fix" and try again`);
            }
        }
    }

    /**
     * Reads the backup timestamp out of a file name.
     *
     * @param name the backup file name
     * @param filenumbers running number, only used for the log line
     * @param storage the storage the file came from
     */
    private getName(name: string, filenumbers: number, storage: string): Date | undefined {
        try {
            const parts = name.split('_');
            if (parseInt(parts[0], 10).toString() !== parts[0]) {
                parts.shift();
            }
            const storageType = storage === 'cifs' ? 'NAS' : storage;
            this.log.debug(
                name ? `detect backup file ${filenumbers} from ${storageType}: ${name}` : 'No backup name was found',
            );
            return new Date(
                parts[0] as unknown as number,
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2].split('-')[0], 10),
                parseInt(parts[2].split('-')[1], 10),
                parseInt(parts[3], 10),
            );
        } catch (err) {
            if (err) {
                this.log.warn('No backup name was found');
            }
        }
    }

    /**
     * Finds the newest iobroker backup across all enabled storages and publishes it as info.latestBackup.
     *
     */
    private async detectLatestBackupFile(): Promise<void> {
        // get all 'storage' types that enabled
        try {
            let stores: BackItUpStorage[] | null = (
                Object.keys(this.backupConfig.iobroker) as BackItUpStorage[]
            ).filter(
                attr =>
                    typeof this.backupConfig.iobroker[attr] === 'object' &&
                    this.backupConfig.iobroker[attr].type === 'storage' &&
                    this.backupConfig.iobroker[attr].enabled === true,
            );

            await this.updateAccessTokens(this.backupConfig);
            // read one time all stores to detect if some backups detected
            let promises: Promise<DetectedFile | null>[] | null = null;
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const list = (require('./lib/list') as { default: ListBackups }).default;
            try {
                promises = stores.map(
                    storage =>
                        new Promise(resolve =>
                            list(storage, this.backupConfig, this.log, result => {
                                // find the newest file
                                let file: DetectedFile | null = null;

                                if (result && result.data && (result.data as unknown) !== 'undefined') {
                                    let filenumbers = 0;
                                    let data = result.data;
                                    Object.keys(data).forEach(type => {
                                        const entry = data[type as keyof typeof data];
                                        if (entry?.iobroker) {
                                            entry.iobroker
                                                .filter(f => f.size)
                                                .forEach(f => {
                                                    filenumbers++;
                                                    const date = this.getName(f.name, filenumbers, storage);

                                                    if (!file || (file.date as Date) < date!) {
                                                        file = f;
                                                        file.date = date;
                                                        file.storage = storage;
                                                    }
                                                });
                                        }
                                    });
                                    result = null as never;
                                    data = null as never;
                                }
                                resolve(file);
                            }),
                        ),
                );
            } catch (e) {
                this.log.warn(`No backup file was found: ${e}`);
            }

            // find the newest file between storages

            void Promise.all(promises!).then(all => {
                let results: DetectedFile[] | null = all.filter(f => f) as DetectedFile[];
                let file;
                if (results.length) {
                    results.sort((a, b) => {
                        if (a.date! > b.date!) {
                            return 1;
                        } else if (a.date! < b.date!) {
                            return -1;
                        }
                        return 0;
                    });
                    file = results[0];

                    if (file.date !== undefined) {
                        try {
                            file.date = (file.date as Date).toISOString();
                        } catch (e) {
                            this.log.warn(`No backup file date was found: ${e}`);
                        }
                    }
                } else {
                    file = null;
                }
                // this information will be used by admin at the first start if some backup was detected and we can restore from it instead of new configuration
                void this.setState('info.latestBackup', file ? JSON.stringify(file) : '', true);

                this.log.debug(file ? `detect last backup file: ${file.name}` : 'No backup file was found');

                results = null;
            });
            promises = null;

            stores = null;
        } catch (e) {
            this.log.warn(`No backup file was found: ${e}`);
        }
    }

    /**
     * Publishes the next scheduled run time for both backup types.
     *
     * @param setMain also refresh the type that is not `type`
     * @param type the type whose schedule just changed
     */
    private async nextBackup(setMain: boolean, type: string | null): Promise<void> {
        const { CronExpressionParser } = await import('cron-parser');

        if ((this.config.ccuEnabled && setMain) || type === 'ccu') {
            const time = this.config.ccuCron ? this.config.ccuCronJob : this.config.ccuTime.split(':');
            const cron = this.config.ccuCron
                ? (time as string)
                : `00 ${time[1]} ${time[0]} */${this.config.ccuEveryXDays} * *`;

            try {
                const cronOptions = {
                    currentDate: new Date(),
                };

                const interval = CronExpressionParser.parse(cron, cronOptions);
                const nextScheduledDate = interval.next();

                await this.setStateAsync(
                    `info.ccuNextTime`,
                    tools.getNextTimeString(this.systemLang, nextScheduledDate as unknown as Date),
                    true,
                );
            } catch (e) {
                this.log.warn(`Your configured CCU cronjob is not correct: ${e}`);
            }
        } else if (!this.config.ccuEnabled) {
            await this.setStateAsync(`info.ccuNextTime`, 'none', true);
        }

        if ((this.config.minimalEnabled && setMain) || type === 'iobroker') {
            const time = this.config.iobrokerCron ? this.config.iobrokerCronJob : this.config.minimalTime.split(':');
            const cron = this.config.iobrokerCron
                ? (time as string)
                : `00 ${time[1]} ${time[0]} */${this.config.minimalEveryXDays} * *`;

            try {
                const cronOptions = {
                    currentDate: new Date(),
                };

                const interval = CronExpressionParser.parse(cron, cronOptions);
                const nextScheduledDate = interval.next();

                await this.setStateAsync(
                    `info.iobrokerNextTime`,
                    tools.getNextTimeString(this.systemLang, nextScheduledDate as unknown as Date),
                    true,
                );
            } catch (e) {
                this.log.warn(`Your configured iobroker cronjob is not correct: ${e}`);
            }
        } else if (!this.config.minimalEnabled) {
            await this.setStateAsync(`info.iobrokerNextTime`, 'none', true);
        }
    }

    /**
     * Triggers the backup on one slave instance and then walks on to the next.
     *
     * @param slaveInstance the instance to back up, e.g. `backitup.1`
     * @param num index into `this.config.slaveInstance`
     */
    private async startSlaveBackup(slaveInstance: string, num: number | null): Promise<void> {
        let waitForInstance = 1000;

        if (num === null || num === undefined) {
            num = 0;
        }

        try {
            const currentState = await this.getForeignStateAsync(`system.adapter.${slaveInstance}.alive`);

            if (currentState && currentState.val === false) {
                waitForInstance = 10000;
                this.log.debug(`Try to start ${slaveInstance}`);
                await this.setForeignStateAsync(`system.adapter.${slaveInstance}.alive`, true);
            }
        } catch (err) {
            this.log.error(`error on slave State: ${err}`);
        }

        this.waitToSlaveBackup = setTimeout(async () => {
            try {
                const currentStateAfter = await this.getForeignStateAsync(`system.adapter.${slaveInstance}.alive`);

                /** Moves on to the next slave, or finishes the round. */
                const advance = (): void => {
                    num!++;

                    if (this.config.slaveInstance.length > 1 && num != this.config.slaveInstance.length) {
                        const next = num!;
                        this.slaveTimeOut = setTimeout(
                            () => void this.startSlaveBackup(this.config.slaveInstance[next], next),
                            3000,
                        );
                    } else {
                        this.log.debug('slave backups are completed');

                        if (this.config.onedriveEnabled) {
                            void this.renewOnedriveToken();
                        }
                    }
                };

                if (currentStateAfter && currentStateAfter.val && currentStateAfter.val === true) {
                    const sendToSlave = await this.sendToAsync(slaveInstance, 'slaveBackup', {
                        config: { deleteAfter: this.config.minimalDeleteAfter },
                    });

                    if (sendToSlave) {
                        this.log.debug(
                            `Slave Backup from ${slaveInstance} is finish with result: ${sendToSlave as unknown as string}`,
                        );
                    } else {
                        this.log.debug(`Slave Backup error from ${slaveInstance}`);
                    }

                    if (this.config.stopSlaveAfter) {
                        await this.setForeignStateAsync(`system.adapter.${slaveInstance}.alive`, false);
                        this.log.debug(`${slaveInstance} is stopped after backup`);
                    }

                    advance();
                } else {
                    this.log.warn(
                        `${slaveInstance} is not running. The slave backup for this instance is not possible`,
                    );
                    advance();
                }
            } catch (err) {
                this.log.error(`error on slave Backup: ${err}`);
            }
        }, waitForInstance);
    }

    /**
     * Decrypts the passwords in the multi-target event lists in place.
     *
     * @param secret the system secret
     */
    private decryptEvents(secret: string): void {
        if (this.config.ccuEvents && this.config.ccuMulti) {
            for (let i = 0; i < this.config.ccuEvents.length; i++) {
                if (this.config.ccuEvents[i].pass) {
                    const val = this.config.ccuEvents[i].pass;
                    this.config.ccuEvents[i].pass = val ? decrypt(secret, val) : '';
                }
            }
        }
        if (this.config.mySqlEvents && this.config.mySqlMulti) {
            for (let i = 0; i < this.config.mySqlEvents.length; i++) {
                if (this.config.mySqlEvents[i].pass) {
                    const val = this.config.mySqlEvents[i].pass;
                    this.config.mySqlEvents[i].pass = val ? decrypt(secret, val) : '';
                }
            }
        }
        if (this.config.pgSqlEvents && this.config.pgSqlMulti) {
            for (let i = 0; i < this.config.pgSqlEvents.length; i++) {
                if (this.config.pgSqlEvents[i].pass) {
                    const val = this.config.pgSqlEvents[i].pass;
                    this.config.pgSqlEvents[i].pass = val ? decrypt(secret, val) : '';
                }
            }
        }
    }

    private clearBashDir(): void {
        // delete restore files
        if (existsSync(bashDir)) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fse = require('fs-extra') as typeof FsExtraModule;
            const restoreDir = join(bashDir, 'restore');

            try {
                if (existsSync(join(bashDir, 'restore.js'))) {
                    unlinkSync(join(bashDir, 'restore.js'));
                }
                if (existsSync(join(bashDir, 'restore.json'))) {
                    unlinkSync(join(bashDir, 'restore.json'));
                }
                if (existsSync(restoreDir)) {
                    fse.removeSync(restoreDir);
                }

                if (existsSync(join(bashDir, 'iob.key'))) {
                    unlinkSync(join(bashDir, 'iob.key'));
                }
                if (existsSync(join(bashDir, 'iob.crt'))) {
                    unlinkSync(join(bashDir, 'iob.crt'));
                }
            } catch (e) {
                this.log.debug(`old restore files could not be deleted: ${e}`);
            }
        }
    }

    /**
     * Copies the admin instance's certificates into the bash directory for the restore web interface.
     *
     * @param instance the admin instance object id the request came from
     */
    private async getCerts(instance: string): Promise<void> {
        const _adminCert = await this.getForeignObjectAsync(instance);

        if (_adminCert && _adminCert.native && _adminCert.native.certPrivate && _adminCert.native.certPublic) {
            const _cert = await this.getForeignObjectAsync('system.certificates');

            if (_cert && _cert.native && _cert.native.certificates) {
                try {
                    const certs = _cert.native.certificates;
                    const privateValue: string = certs[`${_adminCert.native.certPrivate}`];
                    const publicValue: string = certs[`${_adminCert.native.certPublic}`];

                    if (privateValue.startsWith('/') && existsSync(join(privateValue))) {
                        writeFileSync(join(bashDir, 'iob.key'), readFileSync(join(privateValue), 'utf8'));
                    } else {
                        writeFileSync(join(bashDir, 'iob.key'), privateValue);
                    }
                    if (publicValue.startsWith('/') && existsSync(join(publicValue))) {
                        writeFileSync(join(bashDir, 'iob.crt'), readFileSync(join(publicValue), 'utf8'));
                    } else {
                        writeFileSync(join(bashDir, 'iob.crt'), publicValue);
                    }
                } catch {
                    this.log.debug('no certificates found');
                }
            }
        }
    }

    /** Reads the certificate pair the two file servers use, if it was written before. */
    private readServerCerts(): { key: string; cert: string } {
        let key = '';
        let cert = '';

        if (existsSync(join(bashDir, 'iob.key')) && existsSync(join(bashDir, 'iob.crt'))) {
            try {
                key = readFileSync(join(bashDir, 'iob.key'), 'utf8');
                cert = readFileSync(join(bashDir, 'iob.crt'), 'utf8');
            } catch {
                this.log.debug('no certificates found');
            }
        }
        return { key, cert };
    }

    /**
     * Starts the static file server the admin tab downloads backups from.
     *
     * @param protocol `'https:'` serves over TLS
     */
    private dlFileServer(protocol: string): void {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const express = require('express') as (() => Express) & { static: (root: string) => RequestHandler };
        const downloadServer = express();

        // Close all connections from Downloadserver
        if (this.dlServer && this.dlServer._connectionKey) {
            try {
                this.dlServer.closeAllConnections();
            } catch (e) {
                this.log.debug(`Download server Connections could not be closed: ${e}`);
            }
            try {
                this.dlServer.close();
            } catch (e) {
                this.log.debug(`Download server Connections could not be closed: ${e}`);
            }
        }
        const port = existsSync('/opt/scripts/.docker_config/.thisisdocker') ? 9081 : 0;

        downloadServer.use(express.static(join(tools.getIobDir(), 'backups')));

        let httpServer: HttpModule.Server | undefined;
        if (protocol === 'https:') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            https = https || (require('node:https') as typeof HttpsModule);

            const { key: privateKey, cert: certificate } = this.readServerCerts();

            try {
                httpServer = https.createServer({ key: privateKey, cert: certificate }, downloadServer);
            } catch (e) {
                this.log.debug(`The https server cannot be created: ${e}`);
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            http = http || (require('node:http') as typeof HttpModule);

            try {
                httpServer = http.createServer(downloadServer);
            } catch (e) {
                this.log.debug(`The http server cannot be created: ${e}`);
            }
        }

        try {
            this.dlServer = httpServer!.listen(port);
            this.log.debug(`Download ${protocol.replace(':', '')} server started on port ${serverPort(this.dlServer)}`);
        } catch {
            this.log.debug('Download server cannot be started');
        }
    }

    /**
     * Starts the server the admin tab uploads backups to.
     *
     * @param protocol `'https:'` serves over TLS
     */
    private ulFileServer(protocol: string): void {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const express = require('express') as () => Express;
        const multer = require('multer') as MulterFactory;
        const cors = require('cors') as () => RequestHandler;
        /* eslint-enable @typescript-eslint/no-require-imports */

        // Close all Connections from upload server
        try {
            this.ulServer!.closeAllConnections();
        } catch {
            this.log.debug('Upload server connections could not be closed');
        }
        try {
            this.ulServer!.close();
        } catch {
            this.log.debug('Upload server connections could not be closed');
        }

        const port = existsSync('/opt/scripts/.docker_config/.thisisdocker') ? 9082 : 0;

        const backupDir = join(tools.getIobDir(), 'backups');

        const uploadServer = express();
        uploadServer.use(cors());

        const storage = multer.diskStorage({
            destination: (req, file, callback) => callback(null, backupDir),
            filename: (req, file, callback) => {
                this.log.debug(`Upload from ${file.originalname} started...`);
                callback(null, file.originalname);
            },
        });

        const upload = multer({ storage });

        uploadServer.post('/', upload.single('files'), (req, res) => {
            this.log.debug((req as { file?: unknown }).file as string);
            res.json({ message: 'File(s) uploaded successfully' });
        });

        let httpServer: HttpModule.Server | undefined;
        if (protocol === 'https:') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            https = https || (require('node:https') as typeof HttpsModule);

            const { key, cert } = this.readServerCerts();

            try {
                httpServer = https.createServer({ key, cert }, uploadServer);
            } catch (e) {
                this.log.debug(`The https upload server cannot be created: ${e}`);
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            http = http || (require('node:http') as typeof HttpModule);

            try {
                httpServer = http.createServer(uploadServer);
            } catch (e) {
                this.log.debug(`The http upload server cannot be created: ${e}`);
            }
        }

        try {
            this.ulServer = httpServer!.listen(port);
            this.log.debug(`Upload ${protocol.replace(':', '')} server started on port ${serverPort(this.ulServer)}`);
        } catch {
            this.log.debug('Upload server cannot be started');
        }
    }

    private async renewOnedriveToken(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Onedrive = (require('./lib/oneDriveLib') as { default: typeof OnedriveType }).default;
        const onedrive = new Onedrive();

        const currentDay = new Date();
        // NaN rather than the original `undefined`: both compare false against 30, and the branch that
        // subtracts it is only reachable once it has been assigned. Keeps the reads assertion-free.
        let diffDays = NaN;

        if (this.config.onedriveLastTokenRenew != '') {
            const lastRenew = new Date(this.config.onedriveLastTokenRenew);

            diffDays = parseInt(String((currentDay.getTime() - lastRenew.getTime()) / (1000 * 60 * 60 * 24))); //day difference
        }

        if (diffDays >= 30 || !this.config.onedriveLastTokenRenew) {
            this.log.debug('Renew Onedrive Refresh-Token');

            void onedrive
                .renewToken(this.config.onedriveAccessJson, this.log)
                .then(refreshToken => {
                    void this.extendForeignObject(`system.adapter.${this.namespace}`, {
                        native: {
                            onedriveAccessJson: refreshToken,
                            onedriveLastTokenRenew: `${`0${currentDay.getMonth() + 1}`.slice(-2)}/${`0${currentDay.getDate()}`.slice(-2)}/${currentDay.getFullYear()}`,
                        },
                    } as unknown as ioBroker.PartialInstanceObject);
                })
                .catch(err => {
                    this.log.error(
                        err
                            ? JSON.stringify(err)
                            : 'An update of the Onedrive refresh token has failed. Please check your system!',
                    );
                    void this.registerNotification(
                        'backitup',
                        'onedriveWarn',
                        err
                            ? JSON.stringify(err)
                            : 'An update of the Onedrive refresh token has failed. Please check your system!',
                    );
                });
        } else {
            this.log.debug(`Renew Onedrive Refresh-Token in ${30 - diffDays} days`);
        }
    }

    /**
     * Adapter start-up.
     *
     */
    private async main(): Promise<void> {
        this.createBashScripts();
        this.readLogFile();

        if (!existsSync(join(tools.getIobDir(), 'backups'))) {
            this.createBackupDir();
        }
        if (existsSync(`${bashDir}/.redis.info`)) {
            this.deleteHideFiles();
        }
        if (existsSync(join(tools.getIobDir(), 'backups/tmp'))) {
            this.delTmp();
        }
        this.clearBashDir();

        this.timerMain = setTimeout(() => {
            if (existsSync(`${bashDir}/.mount`)) {
                this.umount();
            }
            if (this.config.startAllRestore && !existsSync(`${bashDir}/.startAll`)) {
                this.setStartAll();
            }
        }, 10000);

        void this.getForeignObject('system.config', async (err, obj) => {
            if (obj?.common?.language) {
                this.systemLang = obj.common.language;
            }

            await this.initConfig(obj?.native?.secret || 'Zgfr56gFe87jJOM');

            void this.checkStates();

            if (this.config.hostType !== 'Slave') {
                this.createBackupSchedule();
                void this.nextBackup(true, null);

                void this.detectLatestBackupFile();
            }
        });

        // subscribe on all variables of this adapter instance with pattern "adapterName.X.memory*"
        this.subscribeStates('oneClick.*');
        this.subscribeStates('info.dropboxTokens');
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new BackItUp(options);
} else {
    // otherwise start the instance directly
    (() => new BackItUp())();
}
