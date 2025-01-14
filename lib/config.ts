import type {
    BackItUpAdapterOptions,
    BackItUpConfigComplexCreatorCCU,
    BackItUpConfigComplexCreatorIoBroker,
    BackItUpConfigCreatorClassic,
    BackItUpConfigCreatorGrafana,
    BackItUpConfigCreatorInfluxDB,
    BackItUpConfigCreatorJavascript,
    BackItUpConfigCreatorMySQL,
    BackItUpConfigCreatorPgSQL,
    BackItUpConfigCreatorRedis,
    BackItUpConfigCreatorSQLite,
    BackItUpConfigInternal,
    BackItUpConfigMessageDiscord,
    BackItUpConfigMessageEmail,
    BackItUpConfigMessageGotify,
    BackItUpConfigMessageMatrix,
    BackItUpConfigMessageNotifications,
    BackItUpConfigMessagePushover,
    BackItUpConfigMessageSignal,
    BackItUpConfigMessageSimple,
    BackItUpConfigMessageTelegram,
    BackItUpConfigMessageWhatsApp,
    BackItUpConfigStorageCifs,
    BackItUpConfigStorageDropbox,
    BackItUpConfigStorageFtp,
    BackItUpConfigStorageGoogleDrive,
    BackItUpConfigStorageOneDrive,
    BackItUpConfigStorageWebDav,
} from './types';
import { getIobDir } from './tools';
import { resolve, join } from 'node:path';

/**
 * Decrypt the password/value with given key
 *
 * @param secret - Secret key
 * @param value - value to decrypt
 */
export function decrypt(secret: string, value: string): string {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function takeBoolean(value: boolean | string): boolean {
    if (value === 'true') {
        return true;
    }
    return value === true;
}

/**
 * Decode passwords in complex structures
 *
 * @param config
 * @param secret
 */
export function decryptEvents(config: BackItUpAdapterOptions, secret: string): void {
    if (config.ccuEvents && config.ccuMulti) {
        for (let i = 0; i < config.ccuEvents.length; i++) {
            if (config.ccuEvents[i].pass) {
                const val = config.ccuEvents[i].pass;
                config.ccuEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
    if (config.mySqlEvents && config.mySqlMulti) {
        for (let i = 0; i < config.mySqlEvents.length; i++) {
            if (config.mySqlEvents[i].pass) {
                const val = config.mySqlEvents[i].pass;
                config.mySqlEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
    if (config.pgSqlEvents && config.pgSqlMulti) {
        for (let i = 0; i < config.pgSqlEvents.length; i++) {
            if (config.pgSqlEvents[i].pass) {
                const val = config.pgSqlEvents[i].pass;
                config.pgSqlEvents[i].pass = val ? decrypt(secret, val) : '';
            }
        }
    }
}

/**
 * Create internal setting structure for all plugins
 *
 * @param options
 */
export function initConfig(options: {
    config: BackItUpAdapterOptions;
    systemLang: ioBroker.Languages;
    bashDir: string;
    secret: string;
    log: ioBroker.Log;
}): BackItUpConfigInternal {
    const backupConfig: BackItUpConfigInternal = {} as BackItUpConfigInternal;

    decryptEvents(options.config, options.secret);

    // compatibility
    if (options.config.cifsMount === 'CIFS') {
        options.config.cifsMount = '';
    }
    if (options.config.redisEnabled === undefined) {
        options.config.redisEnabled = options.config.backupRedis;
    }

    let ioPath: string;

    try {
        // ioPath = `${ioCommon.tools.getControllerDir()}/iobroker.js`; Todo: Error by iob Backup (no such file or directory, uv_cwd)
        // ioPath = require.resolve('iobroker.js-controller/iobroker.js');
        ioPath = resolve(__dirname, '../../iobroker.js-controller/iobroker.js');
    } catch (e) {
        options.log.error(`Unable to read iobroker path: +${e}`);
        throw new Error(`Unable to read iobroker path: +${e}`);
    }

    const telegram: BackItUpConfigMessageTelegram = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'Telegram',
        notificationsType: 'Telegram',
        type: 'message',
        instance: options.config.telegramInstance,
        SilentNotice: options.config.telegramSilentNotice,
        silentNotice: options.config.telegramSilentNotice,
        NoticeType: options.config.telegramNoticeType,
        noticeType: options.config.telegramNoticeType === 'longTelegramNotice' ? 'long' : 'short',
        User: options.config.telegramUser,
        onlyError: options.config.telegramOnlyError,
        telegramWaiting: options.config.telegramWaitToSend * 1000,
        waiting: options.config.telegramWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const whatsapp: BackItUpConfigMessageWhatsApp = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'WhatsApp',
        notificationsType: 'WhatsApp',
        type: 'message',
        instance: options.config.whatsappInstance,
        NoticeType: options.config.whatsappNoticeType,
        noticeType: options.config.whatsappNoticeType === 'shortWhatsappNotice' ? 'short' : 'long',
        onlyError: options.config.whatsappOnlyError,
        whatsappWaiting: options.config.whatsappWaitToSend * 1000,
        waiting: options.config.whatsappWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const gotify: BackItUpConfigMessageGotify = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'Gotify',
        notificationsType: 'Gotify',
        type: 'message',
        instance: options.config.gotifyInstance,
        NoticeType: options.config.gotifyNoticeType,
        noticeType: options.config.gotifyNoticeType === 'shortGotifyNotice' ? 'short' : 'long',
        onlyError: options.config.gotifyOnlyError,
        gotifyWaiting: options.config.gotifyWaitToSend * 1000,
        waiting: options.config.gotifyWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const signal: BackItUpConfigMessageSignal = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'Signal',
        notificationsType: 'Signal',
        type: 'message',
        instance: options.config.signalInstance,
        NoticeType: options.config.signalNoticeType,
        noticeType: options.config.signalNoticeType === 'shortSignalNotice' ? 'short' : 'long',
        onlyError: options.config.signalOnlyError,
        signalWaiting: options.config.signalWaitToSend * 1000,
        waiting: options.config.signalWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const matrix: BackItUpConfigMessageMatrix = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'Matrix',
        notificationsType: 'Matrix',
        type: 'message',
        instance: options.config.matrixInstance,
        NoticeType: options.config.matrixNoticeType,
        noticeType: options.config.matrixNoticeType === 'shortMatrixNotice' ? 'short' : 'long',
        onlyError: options.config.matrixOnlyError,
        matrixWaiting: options.config.matrixWaitToSend * 1000,
        waiting: options.config.matrixWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const discord: BackItUpConfigMessageDiscord = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'Discord',
        notificationsType: 'Discord',
        type: 'message',
        instance: options.config.discordInstance,
        NoticeType: options.config.discordNoticeType,
        noticeType: options.config.discordNoticeType === 'shortDiscordNotice' ? 'short' : 'long',
        target: options.config.discordTarget,
        onlyError: options.config.discordOnlyError,
        discordWaiting: options.config.discordWaitToSend * 1000,
        waiting: options.config.discordWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const pushover: BackItUpConfigMessagePushover = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'Pushover',
        notificationsType: 'Pushover',
        type: 'message',
        instance: options.config.pushoverInstance,
        SilentNotice: options.config.pushoverSilentNotice,
        silentNotice: options.config.pushoverSilentNotice,
        NoticeType: options.config.pushoverNoticeType,
        noticeType: options.config.pushoverNoticeType === 'shortPushoverNotice' ? 'short' : 'long',
        deviceID: options.config.pushoverDeviceID,
        onlyError: options.config.pushoverOnlyError,
        pushoverWaiting: options.config.pushoverWaitToSend * 1000,
        waiting: options.config.pushoverWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const email: BackItUpConfigMessageEmail = {
        enabled: options.config.notificationEnabled && options.config.notificationsType === 'E-Mail',
        notificationsType: 'E-Mail',
        type: 'message',
        instance: options.config.emailInstance,
        NoticeType: options.config.emailNoticeType,
        noticeType: options.config.emailNoticeType === 'shortEmailNotice' ? 'short' : 'long',
        emailReceiver: options.config.emailReceiver,
        emailSender: options.config.emailSender,
        onlyError: options.config.emailOnlyError,
        emailWaiting: options.config.emailWaitToSend * 1000,
        waiting: options.config.emailWaitToSend * 1000,
        hostName: options.config.minimalNameSuffix ? options.config.minimalNameSuffix.replace(/[.;, ]/g, '_') : '',
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const notification: BackItUpConfigMessageNotifications = {
        enabled: true,
        type: 'message',
        ignoreErrors: options.config.ignoreErrors,
        bashDir: options.bashDir,
        entriesNumber: options.config.historyEntriesNumber,
        systemLang: options.systemLang,
    };

    const historyHTML: BackItUpConfigMessageSimple = {
        enabled: true,
        type: 'message',
        entriesNumber: options.config.historyEntriesNumber,
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const historyJSON: BackItUpConfigMessageSimple = {
        enabled: true,
        type: 'message',
        entriesNumber: options.config.historyEntriesNumber,
        ignoreErrors: options.config.ignoreErrors,
        systemLang: options.systemLang,
    };

    const ftp: BackItUpConfigStorageFtp = {
        enabled: options.config.ftpEnabled,
        type: 'storage',
        source: 'ftp',
        host: options.config.ftpHost, // ftp-host
        debugging: options.config.debugLevel,
        deleteOldBackup: options.config.ftpDeleteOldBackup, // Delete old Backups from FTP
        ftpDeleteAfter: options.config.ftpDeleteAfter,
        deleteAfter: options.config.ftpDeleteAfter,
        advancedDelete: options.config.advancedDelete,
        ownDir: options.config.ftpOwnDir,
        // bkpType: options.config.restoreType,
        dir: options.config.ftpOwnDir === true ? null : options.config.ftpDir, // directory on FTP server
        dirMinimal: options.config.ftpMinimalDir,
        user: options.config.ftpUser, // username for FTP Server
        pass: options.config.ftpPassword || '', // password for FTP Server
        port: options.config.ftpPort || 21, // FTP port
        secure: options.config.ftpSecure || false, // secure FTP connection
        signedCertificates: options.config.ftpSignedCertificates || true,
        ignoreErrors: options.config.ignoreErrors,
    };

    const dropbox: BackItUpConfigStorageDropbox = {
        enabled: options.config.dropboxEnabled,
        type: 'storage',
        source: 'dropbox',
        debugging: options.config.debugLevel,
        deleteOldBackup: options.config.dropboxDeleteOldBackup, // Delete old Backups from Dropbox
        dropboxDeleteAfter: options.config.dropboxDeleteAfter,
        deleteAfter: options.config.dropboxDeleteAfter,
        advancedDelete: options.config.advancedDelete,
        accessToken: options.config.dropboxAccessToken ? options.config.dropboxAccessToken : '',
        dropboxAccessJson: options.config.dropboxAccessJson,
        dropboxTokenType: options.config.dropboxTokenType,
        ownDir: options.config.dropboxOwnDir,
        dir: options.config.dropboxOwnDir === true ? null : options.config.dropboxDir,
        dirMinimal: options.config.dropboxMinimalDir,
        ignoreErrors: options.config.ignoreErrors,
    };

    const onedrive: BackItUpConfigStorageOneDrive = {
        enabled: options.config.onedriveEnabled,
        type: 'storage',
        source: 'onedrive',
        debugging: options.config.debugLevel,
        deleteOldBackup: options.config.onedriveDeleteOldBackup, // Delete old Backups from Onedrive
        onedriveDeleteAfter: options.config.onedriveDeleteAfter,
        deleteAfter: options.config.onedriveDeleteAfter,
        advancedDelete: options.config.advancedDelete,
        onedriveAccessJson: options.config.onedriveAccessJson,
        ownDir: options.config.onedriveOwnDir,
        dir: options.config.onedriveOwnDir === true ? null : options.config.onedriveDir,
        dirMinimal: options.config.onedriveMinimalDir,
        ignoreErrors: options.config.ignoreErrors,
    };

    const webdav: BackItUpConfigStorageWebDav = {
        enabled: options.config.webdavEnabled,
        type: 'storage',
        source: 'webdav',
        debugging: options.config.debugLevel,
        deleteOldBackup: options.config.webdavDeleteOldBackup, // Delete old Backups from webdav
        webdavDeleteAfter: options.config.webdavDeleteAfter,
        deleteAfter: options.config.webdavDeleteAfter,
        advancedDelete: options.config.advancedDelete,
        username: options.config.webdavUsername,
        pass: options.config.webdavPassword || '', // webdav password
        url: options.config.webdavURL,
        ownDir: options.config.webdavOwnDir,
        dir: options.config.webdavOwnDir === true ? null : options.config.webdavDir,
        dirMinimal: options.config.webdavMinimalDir,
        signedCertificates: options.config.webdavSignedCertificates,
        ignoreErrors: options.config.ignoreErrors,
    };

    const googledrive: BackItUpConfigStorageGoogleDrive = {
        enabled: options.config.googledriveEnabled,
        type: 'storage',
        source: 'googledrive',
        debugging: options.config.debugLevel,
        deleteOldBackup: options.config.googledriveDeleteOldBackup, // Delete old Backups from google drive
        googledriveDeleteAfter: options.config.googledriveDeleteAfter,
        deleteAfter: options.config.googledriveDeleteAfter,
        advancedDelete: options.config.advancedDelete,
        accessJson: options.config.googledriveAccessTokens || options.config.googledriveAccessJson,
        newToken: !!options.config.googledriveAccessTokens,
        ownDir: options.config.googledriveOwnDir,
        dir: options.config.googledriveOwnDir === true ? null : options.config.googledriveDir,
        dirMinimal: options.config.googledriveMinimalDir,
        ignoreErrors: options.config.ignoreErrors,
    };

    const cifs: BackItUpConfigStorageCifs = {
        enabled: options.config.cifsEnabled,
        mountType: options.config.connectType,
        type: 'storage',
        source: 'cifs',
        mount: options.config.cifsMount,
        advancedDelete: options.config.advancedDelete,
        debugging: takeBoolean(options.config.debugLevel),
        fileDir: options.bashDir,
        wakeOnLAN: takeBoolean(options.config.wakeOnLAN),
        macAd: options.config.macAd,
        wolTime: options.config.wolWait,
        wolPort: options.config.wolPort || 9,
        wolExtra: takeBoolean(options.config.wolExtra),
        smb: options.config.smbType,
        sudo: options.config.sudoMount,
        cifsDomain: options.config.cifsDomain,
        clientInodes: options.config.noserverino,
        cacheLoose: options.config.cacheLoose,
        deleteOldBackup: options.config.cifsDeleteOldBackup, //Delete old Backups from Network Disk
        cifsDeleteAfter: 1000, // TODO?
        deleteAfter: 1000, // TODO?
        ownDir: options.config.cifsOwnDir,
        dir: options.config.cifsOwnDir === true ? null : options.config.cifsDir, // specify if CIFS mount should be used
        dirMinimal: options.config.cifsMinimalDir,
        user: options.config.cifsUser, // specify if CIFS mount should be used
        pass: options.config.cifsPassword || '', // password for NAS Server
        expertMount: options.config.expertMount,
        ignoreErrors: options.config.ignoreErrors,
    };

    const mysql: BackItUpConfigCreatorMySQL = {
        name: 'mysql',
        enabled: options.config.mySqlEnabled === undefined ? true : options.config.mySqlEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        mysqlQuick: options.config.mysqlQuick,
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        mysqlSingleTransaction: options.config.mysqlSingleTransaction,
        dbName: options.config.mySqlName, // database name
        user: options.config.mySqlUser, // database user
        pass: options.config.mySqlPassword || '', // database password
        deleteBackupAfter: options.config.mySqlDeleteAfter, // delete old backupfiles after x days
        host: options.config.mySqlHost, // database host
        port: options.config.mySqlPort, // database port
        mySqlEvents: options.config.mySqlEvents,
        mySqlMulti: options.config.mySqlMulti,
        ignoreErrors: options.config.ignoreErrors,
        exe: options.config.mySqlDumpExe, // path to mysqldump
    };

    const sqlite: BackItUpConfigCreatorSQLite = {
        name: 'sqlite',
        enabled: options.config.sqliteEnabled === undefined ? true : options.config.sqliteEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        deleteBackupAfter: options.config.sqliteDeleteAfter, // delete old backupfiles after x days
        ignoreErrors: options.config.ignoreErrors,
        filePth: options.config.sqlitePath,
        exe: options.config.sqliteDumpExe, // path to sqlitedump
    };

    const influxDB: BackItUpConfigCreatorInfluxDB = {
        name: 'influxDB',
        enabled: options.config.influxDBEnabled === undefined ? true : options.config.influxDBEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        deleteBackupAfter: options.config.influxDBDeleteAfter, // delete old backupfiles after x days
        dbName: options.config.influxDBName, // database name
        host: options.config.influxDBHost, // database host
        port: options.config.influxDBPort
            ? options.config.influxDBPort
            : options.config.influxDBVersion == '1.x'
              ? 8088
              : 8086,
        dbversion: options.config.influxDBVersion, // dbversion from Influxdb
        token: options.config.influxDBToken, // Token from Influxdb
        protocol: options.config.influxDBProtocol, // Protocol Type from Influxdb
        exe: options.config.influxDBDumpExe, // path to influxDBdump
        dbType: options.config.influxDBType, // type of influxdb Backup
        influxDBEvents: options.config.influxDBEvents,
        influxDBMulti: options.config.influxDBMulti,
        ignoreErrors: options.config.ignoreErrors,
        deleteDataBase: options.config.deleteOldDataBase, // delete old database for restore
    };

    const pgsql: BackItUpConfigCreatorPgSQL = {
        name: 'pgsql',
        enabled: options.config.pgSqlEnabled === undefined ? true : options.config.pgSqlEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        dbName: options.config.pgSqlName, // database name
        user: options.config.pgSqlUser, // database user
        pass: options.config.pgSqlPassword || '', // database password
        deleteBackupAfter: options.config.pgSqlDeleteAfter, // delete old backupfiles after x days
        host: options.config.pgSqlHost, // database host
        port: options.config.pgSqlPort, // database port
        pgSqlEvents: options.config.pgSqlEvents,
        pgSqlMulti: options.config.pgSqlMulti,
        ignoreErrors: options.config.ignoreErrors,
        exe: options.config.pgSqlDumpExe, // path to mysqldump
    };

    const redis: BackItUpConfigCreatorRedis = {
        enabled: options.config.redisEnabled,
        name: 'redis',
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        aof: options.config.redisAOFactive,
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        path: options.config.redisPath || '/var/lib/redis', // specify Redis path
        redisType: options.config.redisType, // local or Remote Backup
        host: options.config.redisHost, // Host for Remote Backup
        port: options.config.redisPort, // Port for Remote Backup
        user: options.config.redisUser, // User for Remote Backup
        pass: options.config.redisPassword || '', // Password for Remote Backup
        ignoreErrors: options.config.ignoreErrors,
    };

    const historyDB: BackItUpConfigCreatorClassic = {
        enabled: options.config.historyEnabled,
        name: 'historyDB',
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        path: options.config.historyPath,
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
    };

    const zigbee: BackItUpConfigCreatorClassic = {
        enabled: options.config.zigbeeEnabled,
        name: 'zigbee',
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        path: join(getIobDir(), 'iobroker-data'), // specify zigbee path
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
    };
    const esphome: BackItUpConfigCreatorClassic = {
        name: 'esphome',
        enabled: options.config.esphomeEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        path: join(getIobDir(), 'iobroker-data'), // specify esphome path
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
    };
    const zigbee2mqtt: BackItUpConfigCreatorClassic = {
        name: 'zigbee2mqtt',
        enabled: options.config.zigbee2mqttEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        path: options.config.zigbee2mqttPath, // specify zigbee2mqtt path
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
    };
    const nodered: BackItUpConfigCreatorClassic = {
        name: 'nodered',
        enabled: options.config.noderedEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        path: join(getIobDir(), 'iobroker-data'), // specify Node-Red path
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
    };
    const yahka: BackItUpConfigCreatorClassic = {
        name: 'yahka',
        enabled: options.config.yahkaEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        path: join(getIobDir(), 'iobroker-data'), // specify yahka path
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
    };
    const jarvis: BackItUpConfigCreatorClassic = {
        name: 'jarvis',
        enabled: options.config.jarvisEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        path: join(getIobDir(), 'iobroker-data'), // specify jarvis backup path
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
    };

    const javascripts: BackItUpConfigCreatorJavascript = {
        name: 'javascripts',
        enabled: options.config.javascriptsEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        ignoreErrors: options.config.ignoreErrors,
    };

    const grafana: BackItUpConfigCreatorGrafana = {
        name: 'grafana',
        enabled: options.config.grafanaEnabled,
        type: 'creator',
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        host: options.config.grafanaHost, // database host
        port: options.config.grafanaPort, // database port
        protocol: options.config.grafanaProtocol, // database protocol
        username: options.config.grafanaUsername,
        pass: options.config.grafanaPassword || '', // database password
        apiKey: options.config.grafanaApiKey,
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        slaveSuffix: options.config.hostType === 'Slave' ? options.config.slaveNameSuffix : '',
        hostType: options.config.hostType,
        ignoreErrors: options.config.ignoreErrors,
        signedCertificates:
            options.config.grafanaProtocol === 'https' ? options.config.grafanaSignedCertificates : true,
    };

    // Configurations for standard-IoBroker backup
    const iobroker: BackItUpConfigComplexCreatorIoBroker = {
        name: 'iobroker',
        type: 'creator',
        workDir: ioPath,
        enabled: options.config.minimalEnabled,
        time: options.config.minimalTime,
        cronjob: options.config.iobrokerCronJob,
        ownCron: options.config.iobrokerCron,
        debugging: options.config.debugLevel,
        slaveBackup: options.config.hostType,
        everyXDays: options.config.minimalEveryXDays,
        nameSuffix: options.config.minimalNameSuffix.replace(/[.;, ]/g, '_'), // names addition, appended to the file name
        deleteBackupAfter: options.config.minimalDeleteAfter, // delete old backup files after x days
        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpMinimalDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsMinimalDir } : {}),
        dir: getIobDir(),

        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxMinimalDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveMinimalDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavMinimalDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveMinimalDir } : {},
        ),
        ignoreErrors: options.config.ignoreErrors,

        mysql,
        sqlite,
        influxDB,
        pgsql,
        redis,
        historyDB,
        zigbee,
        esphome,
        zigbee2mqtt,
        nodered,
        yahka,
        jarvis,
        javascripts,
        grafana,

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

    backupConfig.iobroker = iobroker;

    // Configurations for CCU / pivCCU / RaspberryMatic backup
    const ccu: BackItUpConfigComplexCreatorCCU = {
        name: 'ccu',
        type: 'creator',
        enabled: options.config.ccuEnabled,
        time: options.config.ccuTime,
        cronjob: options.config.ccuCronJob,
        ownCron: options.config.ccuCron,
        debugging: options.config.debugLevel,
        everyXDays: options.config.ccuEveryXDays,
        nameSuffix: options.config.ccuNameSuffix, // names addition, appended to the file name
        deleteBackupAfter: options.config.ccuDeleteAfter, // delete old backupfiles after x days
        signedCertificates: options.config.ccuSignedCertificates,
        ignoreErrors: options.config.ignoreErrors,

        ftp: Object.assign({}, ftp, options.config.ftpOwnDir === true ? { dir: options.config.ftpCcuDir } : {}),
        cifs: Object.assign({}, cifs, options.config.cifsOwnDir === true ? { dir: options.config.cifsCcuDir } : {}),
        dropbox: Object.assign(
            {},
            dropbox,
            options.config.dropboxOwnDir === true ? { dir: options.config.dropboxCcuDir } : {},
        ),
        onedrive: Object.assign(
            {},
            onedrive,
            options.config.onedriveOwnDir === true ? { dir: options.config.onedriveCcuDir } : {},
        ),
        webdav: Object.assign(
            {},
            webdav,
            options.config.webdavOwnDir === true ? { dir: options.config.webdavCcuDir } : {},
        ),
        googledrive: Object.assign(
            {},
            googledrive,
            options.config.googledriveOwnDir === true ? { dir: options.config.googledriveCcuDir } : {},
        ),

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

        host: options.config.ccuHost, // IP-address CCU
        user: options.config.ccuUser, // username CCU
        usehttps: options.config.ccuUsehttps, // Use https for CCU Connect
        pass: options.config.ccuPassword || '', // password der CCU
        ccuEvents: options.config.ccuEvents,
        ccuMulti: options.config.ccuMulti,
    };

    backupConfig.ccu = ccu;

    return backupConfig;
}
