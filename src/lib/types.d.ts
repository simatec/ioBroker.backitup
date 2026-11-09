export type BackItUpNotificationType =
    | 'Telegram'
    | 'E-Mail'
    | 'Pushover'
    | 'WhatsApp'
    | 'Signal'
    | 'Matrix'
    | 'Gotify'
    | 'Discord';
export type BackItUpStorage = 'local' | 'cifs' | 'dropbox' | 'ftp' | 'googledrive' | 'onedrive' | 'webdav';
export type BackItUpWhatToSave =
    | 'iobroker'
    | 'mysql'
    | 'javascripts'
    | 'sqlite'
    | 'pgsql'
    | 'redis'
    | 'historyDB'
    | 'zigbee'
    | 'esphome'
    | 'zigbee2mqtt'
    | 'nodered'
    | 'yahka'
    | 'grafana'
    | 'influxDB'
    | 'ccu'
    | 'jarvis';

export type BackItUpNotificationVariant =
    | 'historyHTML'
    | 'historyJSON'
    | 'telegram'
    | 'whatsapp'
    | 'gotify'
    | 'signal'
    | 'matrix'
    | 'email'
    | 'pushover'
    | 'discord'
    | 'notification';

export type BackItUpTask =
    | BackItUpWhatToSave
    | 'mount'
    | 'umount'
    | 'clean'
    | BackItUpStorage
    | BackItUpNotificationVariant;

export interface BackItUpConfig {
    enabled: boolean;
    type: 'message' | 'storage' | 'creator';
    ignoreErrors: boolean;
}

export interface BackItUpConfigMessage extends BackItUpConfig {
    type: 'message';
    notificationsType: BackItUpNotificationType;
    instance: string;
    /** @deprecated use silentNotice */
    SilentNotice?: boolean;
    silentNotice?: boolean;
    /** @deprecated use noticeType */
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    NoticeType: string | 'long' | 'short';
    noticeType: 'long' | 'short';
    onlyError: boolean;
    waiting: number;
    hostName: string;
    systemLang: ioBroker.Languages;
}

export interface BackItUpConfigMessageTelegram extends BackItUpConfigMessage {
    notificationsType: 'Telegram';
    /** @deprecated use silentNotice */
    SilentNotice: boolean;
    silentNotice: boolean;
    /** @deprecated use noticeType */
    NoticeType: 'longTelegramNotice' | 'shortTelegramNotice';
    User: string;
    /** @deprecated use waiting */
    telegramWaiting: number;
}

export interface BackItUpConfigMessageWhatsApp extends BackItUpConfigMessage {
    notificationsType: 'WhatsApp';
    /** @deprecated use noticeType */
    NoticeType: 'longWhatsappNotice' | 'shortWhatsappNotice';
    /** @deprecated use waiting */
    whatsappWaiting: number;
}

export interface BackItUpConfigMessageGotify extends BackItUpConfigMessage {
    notificationsType: 'Gotify';
    /** @deprecated use noticeType */
    NoticeType: 'longGotifyNotice' | 'shortGotifyNotice';
    /** @deprecated use waiting */
    gotifyWaiting: number;
}

export interface BackItUpConfigMessageSignal extends BackItUpConfigMessage {
    notificationsType: 'Signal';
    /** @deprecated use noticeType */
    NoticeType: 'longSignalNotice' | 'shortSignalNotice';
    /** @deprecated use waiting */
    signalWaiting: number;
}

export interface BackItUpConfigMessageMatrix extends BackItUpConfigMessage {
    notificationsType: 'Matrix';
    /** @deprecated use noticeType */
    NoticeType: 'longMatrixNotice' | 'shortMatrixNotice';
    /** @deprecated use waiting */
    matrixWaiting: number;
}

export interface BackItUpConfigMessageDiscord extends BackItUpConfigMessage {
    notificationsType: 'Discord';
    target: string;
    /** @deprecated use noticeType */
    NoticeType: 'longDiscordNotice' | 'shortDiscordNotice';
    /** @deprecated use waiting */
    discordWaiting: number;
}

export interface BackItUpConfigMessagePushover extends BackItUpConfigMessage {
    notificationsType: 'Pushover';
    /** @deprecated use silentNotice */
    SilentNotice: boolean;
    deviceID: string;
    /** @deprecated use noticeType */
    NoticeType: 'longPushoverNotice' | 'shortPushoverNotice';
    /** @deprecated use waiting */
    pushoverWaiting: number;
}

export interface BackItUpConfigMessageEmail extends BackItUpConfigMessage {
    notificationsType: 'E-Mail';
    emailReceiver: string;
    emailSender: string;
    /** @deprecated use noticeType */
    NoticeType: 'longEmailNotice' | 'shortEmailNotice';
    /** @deprecated use waiting */
    emailWaiting: number;
}

export interface BackItUpConfigMessageSimple extends BackItUpConfig {
    type: 'message';
    enabled: true;
    entriesNumber: number;
    systemLang: ioBroker.Languages;
}

export interface BackItUpConfigMessageNotifications extends BackItUpConfigMessageSimple {
    bashDir: string;
}

export interface BackItUpConfigStorage extends BackItUpConfig {
    type: 'storage';
    source: BackItUpStorage;
    debugging: boolean;
    deleteOldBackup: boolean;
    deleteAfter: number;
    advancedDelete: boolean;
    ownDir: boolean;
    dir: string | null;
    dirMinimal: string;
}

export interface BackItUpConfigStorageFtp extends BackItUpConfigStorage {
    source: 'ftp';
    host: string;
    /** @deprecated use deleteAfter */
    ftpDeleteAfter: number;
    /** username for FTP Server */
    user: string;
    /** password for FTP Server */
    pass: string;
    /** FTP port */
    port: string | number;
    /** secure FTP connection */
    secure: boolean;
    signedCertificates: boolean;
}

export interface BackItUpConfigStorageDropbox extends BackItUpConfigStorage {
    source: 'dropbox';
    /** @deprecated use deleteAfter */
    dropboxDeleteAfter: number;
    accessToken: string;
    dropboxAccessJson: string;
    dropboxTokenType: 'default' | 'custom';
}

export interface BackItUpConfigStorageOneDrive extends BackItUpConfigStorage {
    source: 'onedrive';
    /** @deprecated use deleteAfter */
    onedriveDeleteAfter: number;
    onedriveAccessJson: string;
}

export interface BackItUpConfigStorageWebDav extends BackItUpConfigStorage {
    source: 'webdav';
    /** @deprecated use deleteAfter */
    webdavDeleteAfter: number;
    username: string;
    pass: string;
    url: string;
    signedCertificates: boolean;
}

export interface BackItUpConfigStorageGoogleDrive extends BackItUpConfigStorage {
    source: 'googledrive';
    /** @deprecated use deleteAfter */
    googledriveDeleteAfter: number;
    accessJson: string;
    newToken: boolean;
}

export interface BackItUpConfigStorageCifs extends BackItUpConfigStorage {
    source: 'cifs';
    /** @deprecated use deleteAfter */
    cifsDeleteAfter: number;
    fileDir: string;
    wakeOnLAN: boolean;
    macAd: string;
    wolTime: number;
    wolPort: number;
    wolExtra: boolean;
    smb: 'vers=1.0' | 'vers=2.0' | 'vers=3.0' | 'vers=3.02' | 'vers=3.1.1';
    sudo: boolean;
    cifsDomain: string;
    clientInodes: boolean;
    cacheLoose: boolean;
    mountType: 'CIFS' | 'NFS' | 'Copy' | 'Expert';
    mount: string;
    /**
     * Set by lib/list only: list `dir` through a second mount point instead of the backup directory,
     * because the backup directory holds the mount of another directory (the own CCU directory).
     */
    separateMount?: boolean;
    /** specify if CIFS mount should be used */
    user: string;
    /** password for NAS Server */
    pass: string;
    expertMount: string;
}

export interface BackItUpConfigSimpleCreator extends BackItUpConfig {
    type: 'creator';
    name: BackItUpWhatToSave;
    nameSuffix: string; // names addition, appended to the file name
    ignoreErrors: boolean;

    ftp: BackItUpConfigStorageFtp;
    cifs: BackItUpConfigStorageCifs;
    dropbox: BackItUpConfigStorageDropbox;
    onedrive: BackItUpConfigStorageOneDrive;
    webdav: BackItUpConfigStorageWebDav;
    googledrive: BackItUpConfigStorageGoogleDrive;
}

export interface BackItUpConfigCreatorMySQL extends BackItUpConfigSimpleCreator {
    name: 'mysql';
    slaveSuffix: string;
    mysqlSingleTransaction: boolean;
    mysqlQuick: boolean;
    dbName: string; // database name
    user: string; // database user
    pass: string; // database password
    host: string; // database host
    port: string | number; // database port
    mySqlEvents: {
        host: string;
        port: number;
        user: string;
        pass: string;
        dbName: string;
        nameSuffix: string;
        exe: string;
    }[];
    mySqlMulti: boolean;
    exe: string; // path to mysqldump
    hostType: 'Single' | 'Master' | 'Slave';
    deleteBackupAfter: number;
}

export interface BackItUpConfigCreatorSQLite extends BackItUpConfigSimpleCreator {
    name: 'sqlite';
    slaveSuffix: string;
    filePth: string;
    exe: string; // path to mysqldump
    hostType: 'Single' | 'Master' | 'Slave';
    deleteBackupAfter: number;
}

export interface BackItUpConfigCreatorInfluxDB extends BackItUpConfigSimpleCreator {
    name: 'influxDB';
    slaveSuffix: string;
    hostType: 'Slave' | 'Single' | 'Master';
    dbName: string; // database name
    host: string; // database host
    port: string | number;
    dbversion: '1.x' | '2.x'; // dbversion from Influxdb
    token: string; // Token from Influxdb
    protocol: 'http' | 'https'; // Protocol Type from Influxdb
    exe: string; // path to influxDBdump
    dbType: 'local' | 'remote'; // type of influxdb Backup
    influxDBEvents: {
        host: string;
        port: number;
        dbName: string;
        nameSuffix: string;
        token: string;
        protocol: 'http' | 'https';
        dbversion: '1.x' | '2.x';
    }[];
    influxDBMulti: boolean;
    deleteBackupAfter: number;
    deleteDataBase: boolean; // delete old database for restore
}

export interface BackItUpConfigCreatorPgSQL extends BackItUpConfigSimpleCreator {
    name: 'pgsql';
    slaveSuffix: string;
    hostType: 'Slave' | 'Single' | 'Master';
    dbName: string; // database name
    user: string; // database user
    pass: string; // database password
    host: string; // database host
    port: string | number; // database port
    pgSqlEvents: {
        host: string;
        port: number;
        user: string;
        pass: string;
        dbName: string;
        nameSuffix: string;
        exe: string;
    }[];
    pgSqlMulti: boolean;
    exe: string; // path to mysqldump
    deleteBackupAfter: number;
}

export interface BackItUpConfigCreatorRedis extends BackItUpConfigSimpleCreator {
    name: 'redis';
    slaveSuffix: string;
    hostType: 'Slave' | 'Single' | 'Master';
    /** AOF activated */
    aof: boolean;

    path: string; // specify Redis path
    redisType: 'local' | 'remote'; // local or Remote Backup
    host: string; // Host for Remote Backup
    port: string | number; // Port for Remote Backup
    user: string; // User for Remote Backup
    pass: string; // Password for Remote Backup
}

export interface BackItUpConfigCreatorGrafana extends BackItUpConfigSimpleCreator {
    name: 'grafana';
    slaveSuffix: string;
    hostType: 'Slave' | 'Single' | 'Master';

    protocol: 'https' | 'http';
    host: string; // Host for Remote Backup
    port: string | number; // Port for Remote Backup
    username: string; // User for Remote Backup
    pass: string; // Password for Remote Backup
    apiKey: string;
    signedCertificates: boolean;
}

export interface BackItUpConfigCreatorJavascript extends BackItUpConfigSimpleCreator {
    name: 'javascripts';
    slaveSuffix: string;
    hostType: 'Slave' | 'Single' | 'Master';
}
export interface BackItUpConfigCreatorClassic extends BackItUpConfigSimpleCreator {
    name: 'historyDB' | 'zigbee' | 'esphome' | 'zigbee2mqtt' | 'nodered' | 'yahka' | 'jarvis';
    slaveSuffix: string;
    hostType: 'Slave' | 'Single' | 'Master';
    path?: string; // specify Redis path
}

export interface BackItUpConfigComplexCreator extends BackItUpConfigSimpleCreator {
    name: 'iobroker' | 'ccu';
    time: string;
    cronjob: string;
    ownCron: boolean;
    debugging: boolean;
    everyXDays: number;
    deleteBackupAfter: number; // delete old backup files after x days

    historyHTML: BackItUpConfigMessageSimple;
    historyJSON: BackItUpConfigMessageSimple;
    telegram: BackItUpConfigMessageTelegram;
    email: BackItUpConfigMessageEmail;
    pushover: BackItUpConfigMessagePushover;
    whatsapp: BackItUpConfigMessageWhatsApp;
    gotify: BackItUpConfigMessageGotify;
    signal: BackItUpConfigMessageSignal;
    matrix: BackItUpConfigMessageMatrix;
    discord: BackItUpConfigMessageDiscord;
    notification: BackItUpConfigMessageNotifications;
}

export interface BackItUpConfigComplexCreatorIoBroker extends BackItUpConfigComplexCreator {
    name: 'iobroker';
    slaveBackup: 'Slave' | 'Single' | 'Master';
    workDir: string;
    dir: string;

    mysql: BackItUpConfigCreatorMySQL;
    sqlite: BackItUpConfigCreatorSQLite;
    influxDB: BackItUpConfigCreatorInfluxDB;
    pgsql: BackItUpConfigCreatorPgSQL;
    redis: BackItUpConfigCreatorRedis;
    historyDB: BackItUpConfigCreatorClassic;
    zigbee: BackItUpConfigCreatorClassic;
    esphome: BackItUpConfigCreatorClassic;
    zigbee2mqtt: BackItUpConfigCreatorClassic;
    nodered: BackItUpConfigCreatorClassic;
    yahka: BackItUpConfigCreatorClassic;
    jarvis: BackItUpConfigCreatorClassic;
    javascripts: BackItUpConfigCreatorJavascript;
    grafana: BackItUpConfigCreatorGrafana;
}

export interface BackItUpConfigComplexCreatorCCU extends BackItUpConfigComplexCreator {
    name: 'ccu';
    host: string; // IP-address CCU
    user: string; // username CCU
    usehttps: boolean; // Use https for CCU Connect
    pass: string; // password der CCU
    ccuEvents: {
        host: string;
        user: string;
        pass: string;
        nameSuffix: string;
        usehttps: boolean;
        signedCertificates: boolean;
    }[];
    ccuMulti: boolean;
    signedCertificates: boolean;
}

export interface BackItUpConfigInternal {
    iobroker: BackItUpConfigComplexCreatorIoBroker;
    ccu: BackItUpConfigComplexCreatorCCU;
}

export interface BackItUpAdapterOptions {
    advancedDelete: boolean;
    cacheLoose: boolean;

    ccuCron: boolean;
    ccuCronJob: string;
    ccuDeleteAfter: number;
    ccuEnabled: boolean;
    ccuEvents: {
        host: string;
        user: string;
        pass: string;
        nameSuffix: string;
        usehttps: boolean;
        signedCertificates: boolean;
    }[];
    ccuEveryXDays: number;
    ccuHost: string;
    ccuMulti: boolean;
    ccuNameSuffix: string;
    ccuPassword: string;
    ccuSignedCertificates: boolean;
    ccuTime: string;
    ccuUsehttps: boolean;
    ccuUser: string;

    cifsCcuDir: string;
    cifsDeleteOldBackup: boolean;
    cifsDir: string;
    cifsDomain: string;
    cifsEnabled: boolean;
    cifsMinimalDir: string;
    /** IP address or hostname */
    cifsMount: string;
    cifsOwnDir: boolean;
    cifsUser: string;
    cifsPassword: string;

    connectType: 'CIFS' | 'NFS' | 'Copy' | 'Expert'; // to be extended

    debugLevel: boolean;
    deleteOldDataBase: boolean;

    discordInstance: string;
    discordNoticeType: 'longDiscordNotice' | 'shortDiscordNotice';
    discordOnlyError: boolean;
    discordTarget: string;
    discordWaitToSend: number;

    dropboxAccessJson: string;
    dropboxAccessToken: string;
    dropboxCcuDir: string;
    dropboxCodeChallenge: string;
    dropboxDeleteAfter: number;
    dropboxDeleteOldBackup: boolean;
    dropboxDir: string;
    dropboxEnabled: boolean;
    dropboxMinimalDir: string;
    dropboxOwnDir: boolean;
    dropboxTokenType: 'default' | 'custom';

    emailInstance: string;
    emailNoticeType: 'longEmailNotice' | 'shortEmailNotice';
    emailOnlyError: boolean;
    emailReceiver: string;
    emailSender: string;
    emailWaitToSend: number;

    esphomeEnabled: boolean;
    expertMount: string;
    fileSizeError: number;
    fileSizeWarning: number;

    ftpCcuDir: string;
    ftpDeleteAfter: number;
    ftpDeleteOldBackup: boolean;
    ftpDir: string;
    ftpEnabled: boolean;
    ftpHost: string;
    ftpMinimalDir: string;
    ftpOwnDir: boolean;
    ftpPassword: string;
    ftpPort: number;
    ftpSecure: boolean;
    ftpSignedCertificates: boolean;
    ftpUser: string;

    googledriveAccessTokens: string;
    /**
     * @deprecated use googledriveAccessTokens - no longer written by the UI, but still read in
     * main.js so configurations saved by older versions keep working.
     */
    googledriveAccessJson?: string;
    googledriveCcuDir: string;
    googledriveDeleteAfter: number;
    googledriveDeleteOldBackup: boolean;
    googledriveDir: string;
    googledriveEnabled: boolean;
    googledriveMinimalDir: string;
    googledriveOwnDir: boolean;

    gotifyInstance: string;
    gotifyNoticeType: 'longGotifyNotice' | 'shortGotifyNotice';
    gotifyOnlyError: boolean;
    gotifyWaitToSend: number;

    grafanaApiKey: string;
    grafanaEnabled: boolean;
    grafanaHost: string;
    grafanaPort: string;
    grafanaProtocol: 'http' | 'https';
    grafanaSignedCertificates: boolean;

    historyEnabled: boolean;
    historyEntriesNumber: number;
    historyPath: string;

    hostType: 'Single' | 'Master' | 'Slave';

    ignoreErrors: boolean;

    influxDBDeleteAfter: number;
    influxDBDumpExe: string;
    influxDBEnabled: boolean;
    influxDBEvents: {
        host: string;
        port: number;
        dbName: string;
        nameSuffix: string;
        token: string;
        protocol: 'http' | 'https';
        dbversion: '1.x' | '2.x';
    }[];
    influxDBHost: string;
    influxDBMulti: boolean;
    influxDBName: string;
    influxDBPort: string;
    influxDBProtocol: 'http' | 'https';
    influxDBToken: string;
    influxDBType: 'local' | 'remote';
    influxDBVersion: '1.x' | '2.x';

    iobrokerCron: boolean;
    iobrokerCronJob: string;

    jarvisEnabled: boolean;

    javascriptsEnabled: boolean;

    macAd: string;

    matrixInstance: string;
    matrixNoticeType: 'longMatrixNotice' | 'shortMatrixNotice';
    matrixOnlyError: boolean;
    matrixWaitToSend: number;

    minimalDeleteAfter: number;
    minimalEnabled: boolean;
    minimalEveryXDays: number;
    minimalNameSuffix: string;
    minimalTime: string;

    mySqlDeleteAfter: number;
    mySqlDumpExe: string;
    mySqlEnabled: boolean;
    mySqlEvents: {
        host: string;
        port: number;
        user: string;
        pass: string;
        dbName: string;
        nameSuffix: string;
        exe: string;
    }[];
    mySqlHost: string;
    mysqlMinimalEnabled: boolean;
    mySqlMulti: boolean;
    mySqlName: string;
    mySqlPassword: string;
    mySqlPort: string;
    mysqlQuick: boolean;
    mysqlSingleTransaction: boolean;
    /** Pass --skip-ssl to mysqldump */
    mysqlSkipSSL: boolean;
    mySqlUser: string;

    noderedEnabled: boolean;

    noserverino: boolean;

    notificationEnabled: boolean;
    notificationsType: BackItUpNotificationType;

    onedriveAccessJson: string;
    onedriveCcuDir: string;
    onedriveDeleteAfter: number;
    onedriveDeleteOldBackup: boolean;
    onedriveDir: string;
    onedriveEnabled: boolean;
    onedriveLastTokenRenew: string;
    onedriveMinimalDir: string;
    onedriveOwnDir: boolean;

    pgSqlDeleteAfter: number;
    pgSqlDumpExe: string;
    pgSqlEnabled: boolean;
    pgSqlEvents: {
        host: string;
        port: number;
        user: string;
        pass: string;
        dbName: string;
        nameSuffix: string;
        exe: string;
    }[];
    pgSqlHost: string;
    pgSqlMulti: boolean;
    pgSqlName: string;
    pgSqlPassword: string;
    pgSqlPort: string;
    pgSqlUser: string;

    pushoverDeviceID: string;
    pushoverInstance: string;
    pushoverNoticeType: 'longPushoverNotice' | 'shortPushoverNotice';
    pushoverOnlyError: boolean;
    pushoverSilentNotice: boolean;
    pushoverWaitToSend: number;

    redisAOFactive: boolean;
    redisEnabled: boolean;
    /** @deprecated use redisEnabled - still read in main.js to migrate older configurations */
    backupRedis?: boolean;
    redisHost: string;
    redisMinimalEnabled: boolean;
    redisPassword: string;
    redisPath: string;
    redisPort: number;
    redisType: 'local' | 'remote';
    redisUser: string;

    /**
     * @deprecated Read by main.js into every storage slice as `bkpType`, but nothing writes it and
     * nothing reads `bkpType` again - it is always undefined. Kept so the emitted config matches.
     */
    restoreType?: unknown;
    restoreSource: BackItUpStorage;
    restoreTab: boolean;

    signalInstance: string;
    signalNoticeType: 'longSignalNotice' | 'shortSignalNotice';
    signalOnlyError: boolean;
    signalWaitToSend: number;

    slaveInstance: string;
    slaveNameSuffix: string;
    smbType: 'vers=1.0' | 'vers=2.0' | 'vers=3.0' | 'vers=3.02' | 'vers=3.1.1';

    sqliteDumpExe: string;
    sqliteEnabled: boolean;
    sqlitePath: string;
    /**
     * @deprecated no longer part of the io-package defaults, but still read in main.js, so a value
     * left over in an existing instance configuration is still honoured.
     */
    sqliteDeleteAfter?: number;

    startAllRestore: boolean;
    stopSlaveAfter: boolean;

    sudoMount: boolean;

    telegramInstance: string;
    telegramNoticeType: 'longTelegramNotice' | 'shortTelegramNotice';
    telegramOnlyError: boolean;
    telegramSilentNotice: boolean;
    telegramUser: string;
    telegramWaitToSend: number;

    wakeOnLAN: boolean;

    webdavCcuDir: string;
    webdavDeleteAfter: number;
    webdavDeleteOldBackup: boolean;
    webdavDir: string;
    webdavEnabled: boolean;
    webdavMinimalDir: string;
    webdavOwnDir: boolean;
    webdavPassword: string;
    webdavSignedCertificates: boolean;
    webdavURL: string;
    webdavUsername: string;

    whatsappInstance: string;
    whatsappNoticeType: 'shortWhatsappNotice' | 'longWhatsappNotice';
    whatsappOnlyError: boolean;
    whatsappWaitToSend: number;

    wolExtra: boolean;
    wolPort: number;
    wolWait: number;

    yahkaEnabled: boolean;

    zigbee2mqttEnabled: boolean;
    /** Back up the Zigbee2MQTT data directory, or pull it over MQTT from a remote instance */
    zigbee2mqttType: 'local' | 'remote';
    zigbee2mqttPath: string;
    zigbee2mqttHost: string;
    zigbee2mqttPort: number;
    zigbee2mqttBaseTopic: string;
    zigbee2mqttAuth: boolean;
    zigbee2mqttUser: string;
    zigbee2mqttPassword: string;
    zigbeeEnabled: boolean;
}

/** Shared scratch pad that lib/execute hands to every backup script in turn */
export type BackItUpExecuteContext = {
    /** absolute paths of the files produced so far */
    fileNames: string[];
    /**
     * Keyed by task name, e.g. `errors.mysql`. Some steps store `err.toString()`, others the Error
     * itself - every consumer only interpolates the value into a message, so both occur.
     */
    errors: Record<string, string | Error>;
    /** names of the finished tasks - `'ccu'`, `'dropbox'`, `` `zigbee.${i}` `` and the like */
    done: string[];
    /** backup types that produced a file, used to build the notifications */
    types: string[];
};

/**
 * The logger a step gets.
 *
 * Deliberately narrower than `ioBroker.Logger`: the steps only ever call these three, and the
 * detached restore has no adapter to log through, so it supplies a file-backed implementation.
 * Every message is already prefixed with the step name by whoever builds the context.
 */
export interface BackItUpLogger {
    debug(text: unknown): void;
    warn(text: unknown): void;
    error(text: unknown): void;
}

/**
 * The handle every backup step, restore step and storage engine receives.
 *
 * One instance per step, but the four scratch-pad members are the *same objects* for every step of
 * a run - that is how the steps hand results to the notification steps that run last.
 *
 * This replaces the four values lib/execute used to graft onto the options object
 * (`context`, `backupDir`, `timestamp`, `adapter`). It deliberately stays a plain interface with no
 * runtime module behind it: lib/restore is copied to the bash directory and started as its own
 * process, where nothing else from lib/ is available, so it has to be able to build one inline.
 *
 * It must never be merged into the options object - lib/execute JSON-serialises that for the masked
 * debug line, and lib/restore writes it to restore.json for the detached run.
 */
export interface BackItUpContext extends BackItUpExecuteContext {
    /** null in the detached restore process, which runs without an adapter */
    readonly adapter: ioBroker.Adapter | null;
    /** already scoped to the running step */
    readonly log: BackItUpLogger;
    /** ioBroker backup directory */
    readonly backupDir: string;
    /** start of the run */
    readonly timestamp: number;
}

/**
 * The single argument every module under lib/scripts, lib/restore and lib/list is called with.
 *
 * One object instead of a positional list, so a new field reaches all three families without
 * touching every call site. The restore and storage contracts extend it with what they need on top.
 *
 * `TOptions` is `never` in the contracts on purpose: the config slice differs per module, and
 * parameter contravariance then lets each one declare the slice it actually reads.
 */
export interface BackItUpProps<TOptions = never> {
    /** run-scoped handle: adapter, logger and the shared scratch pad */
    readonly context: BackItUpContext;
    /** the config slice this module was picked for */
    readonly options: TOptions;
}

/**
 * The config main.js assembles for one backup run and hands to lib/execute.
 *
 * main.js is still plain JavaScript, so the per-task slices cannot be narrowed yet - lib/execute
 * addresses them dynamically (`config[name]`). Tighten once main.ts exists.
 */
export type BackItUpExecuteConfig = Record<string, any> & {
    /** the backup type this run belongs to - `'iobroker'` or `'ccu'` */
    name: string;
    /** "Ignore backup errors" from the instance settings; decides whether a failed step ends the run */
    ignoreErrors: boolean;
    /** only run the steps marked `afterBackup` */
    afterBackup?: boolean;
    /** shared scratch pad, created on the first pass */
    context: BackItUpExecuteContext;
    /** ioBroker backup directory, filled in on the first pass */
    backupDir: string;
    /** start of the run, filled in on the first pass */
    timestamp: number;
};

/** Reports the outcome of a whole backup run; a truthy argument aborts it. */
export type BackItUpExecuteCallback = (error?: Error | string | null) => void;
