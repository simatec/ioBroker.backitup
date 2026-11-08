/**
 * Backups that BackItUp can only download, not restore: they come from another system and have to be
 * restored there. The same rule as `isDownloadOnlyBackup` in src/lib/tools.ts.
 *
 * - `homematic_..._backupiobroker.tar.sbk`: Homematic CCU / RaspberryMatic
 * - `redis-remote_..._backupiobroker.tar.gz`: remote Redis server
 * - `zigbee2mqtt_..._backup.zip`: remote Zigbee2MQTT instance
 */
const DOWNLOAD_ONLY_BACKUP = /^(homematic_.*\.sbk|redis-remote_.*_backupiobroker\.tar\.gz|zigbee2mqtt_.*_backup\.zip)$/;

/**
 * Tells whether a backup can only be downloaded, because BackItUp cannot restore it.
 *
 * @param name file name, with or without the directory
 */
export function isDownloadOnlyBackup(name: string | undefined | null): boolean {
    return !!name && DOWNLOAD_ONLY_BACKUP.test(name.split(/[\\/]/).pop() || '');
}
