import type { BackItUpStorage, BackItUpConfigStorage, BackItUpWhatToSave } from '../types';

export type BackItUpStorageEngineResultFile = { path: string; name: string; size: number };

export type BackItUpStorageEngineResult = {
    iobroker?: BackItUpStorageEngineResultFile[];
    mysql?: BackItUpStorageEngineResultFile[];
    javascripts?: BackItUpStorageEngineResultFile[];
    sqlite?: BackItUpStorageEngineResultFile[];
    pgsql?: BackItUpStorageEngineResultFile[];
    redis?: BackItUpStorageEngineResultFile[];
    historyDB?: BackItUpStorageEngineResultFile[];
    zigbee?: BackItUpStorageEngineResultFile[];
    esphome?: BackItUpStorageEngineResultFile[];
    zigbee2mqtt?: BackItUpStorageEngineResultFile[];
    nodered?: BackItUpStorageEngineResultFile[];
    yahka?: BackItUpStorageEngineResultFile[];
    grafana?: BackItUpStorageEngineResultFile[];
    influxDB?: BackItUpStorageEngineResultFile[];
    ccu?: BackItUpStorageEngineResultFile[];
    jarvis?: BackItUpStorageEngineResultFile[];
}

export type BackItUpStorageFiles = {
    local?: BackItUpStorageEngineResult;
    cifs?: BackItUpStorageEngineResult;
    dropbox?: BackItUpStorageEngineResult;
    ftp?: BackItUpStorageEngineResult;
    googledrive?: BackItUpStorageEngineResult;
    onedrive?: BackItUpStorageEngineResult;
    webdav?: BackItUpStorageEngineResult;
};

export type BackItUpStorageEngineOptions = {
    storage: BackItUpStorage;
    config: BackItUpConfigStorage;
    restoreSource: BackItUpStorage | '';
    creators: BackItUpWhatToSave[];
    log: ioBroker.Log;
};

export interface BackItUpStorageEngine {
    list: (options: BackItUpStorageEngineOptions) => Promise<BackItUpStorageEngineResult | null>;
    getFile(config: BackItUpConfigStorage, fileName: string, toStoreName: string, log: ioBroker.Log): Promise<void>;
}
