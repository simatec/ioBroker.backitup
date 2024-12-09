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
    deleteBackupAfter: number; // delete old backupfiles after x days

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
    iobroker: BackItUpConfigComplexCreator;
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
    // @deprectaed use googledriveAccessTokens
    googledriveAccessJson: string;
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
    grafanaPassword: string;
    grafanaPort: string;
    grafanaProtocol: 'http' | 'https';
    grafanaSignedCertificates: boolean;
    grafanaUsername: string;

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
    /** @deprecated use redisEnabled */
    backupRedis: boolean;
    redisHost: string;
    redisMinimalEnabled: boolean;
    redisPassword: string;
    redisPath: string;
    redisPort: number;
    redisType: 'local' | 'remote';
    redisUser: string;

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
    sqliteDeleteAfter: number;

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
    zigbee2mqttPath: string;
    zigbeeEnabled: boolean;
}
