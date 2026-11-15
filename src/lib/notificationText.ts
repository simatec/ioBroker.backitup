import { _ } from './tools';
import type { BackItUpContext, BackItUpExecuteContext } from './types';

/**
 * Shared message building for the `96-*` notification steps.
 *
 * It lives outside lib/scripts on purpose: lib/execute loads that directory by file name and would
 * otherwise pick this helper up as if it were a backup step.
 *
 * Both builders below used to be duplicated verbatim in the notification scripts - byte for byte,
 * only the channel name in the `systemLang` lookup differed. The error text is kept in one place
 * because it also does the credential masking: every secret that could show up inside an error
 * message is replaced with `****` before the text leaves the adapter. A fix there has to reach all
 * channels at once.
 *
 * The wording, the order of the entries and the per-secret try/catch are unchanged.
 */

/** A configured backup target, as the notification steps see it */
interface StorageEntry {
    enabled?: boolean;
    dir?: string;
    host?: string;
    mount?: string;
    mountType?: string;
}

/**
 * Server shown in front of the NAS directory. Only CIFS and NFS mount a server; for "Copy" and
 * "Expert" the admin hides the server field but keeps its old value, which then showed up as a
 * stale IP in the notification (#1471).
 *
 * @param cifs the NAS target
 */
export function nasHost(cifs: StorageEntry): string {
    return cifs.mountType === 'CIFS' || cifs.mountType === 'NFS' ? cifs.mount || '' : '';
}

/**
 * The parts of a notification step's options both builders read: the shared context, the configured
 * targets and every credential that has to be masked.
 */
export interface NotificationOptions {
    backupDir: string;
    ftp?: StorageEntry & { pass?: string };
    cifs?: StorageEntry & { pass?: string };
    dropbox?: StorageEntry & { accessToken?: string };
    onedrive?: StorageEntry & { onedriveAccessJson?: string };
    googledrive?: StorageEntry & { accessJson?: string };
    webdav?: StorageEntry & { pass?: string };
    mysql?: { pass?: string };
    grafana?: { pass?: string; apiKey?: string };
    pgsql?: { pass?: string };
    ccu?: { pass?: string };
}

/**
 * Replaces every occurrence of `secret` in `text` with `****`.
 *
 * Mirrors the original inline form: the secret is escaped for use in a RegExp, and any failure -
 * including the secret being undefined - leaves the text untouched.
 *
 * Each secret gets its own call, and therefore its own try/catch. That matters: while the Grafana
 * password and API key shared one block, the password - which the config no longer has - threw
 * first and the API key was never masked.
 *
 * @param text message built so far
 * @param secret credential to hide
 */
function mask(text: string, secret: string | undefined): string {
    try {
        const formatted = (secret as string).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        return formatted ? text.replace(new RegExp(formatted, 'g'), '****') : text;
    } catch {
        // ignore
        return text;
    }
}

/**
 * Builds the "backup incomplete" text that every notification channel sends.
 *
 * @param context the run context, for the errors the steps collected
 * @param options the script options, for the credentials that need masking
 * @param systemLang language of the notification
 */
export function buildErrorMessage(
    context: BackItUpContext,
    options: NotificationOptions,
    systemLang: string,
): string {
    const errors = context.errors;

    let errorMessage = _('Your backup was not completely created. Please check the errors!!', systemLang);

    errorMessage += '\n';

    if (errors.iobroker) {
        errorMessage += `\niobroker: ${errors.iobroker}`;
    }
    if (errors.redis) {
        errorMessage += `\nredis: ${errors.redis}`;
    }
    if (errors.historyDB) {
        errorMessage += `\nhistoryDB: ${errors.historyDB}`;
    }
    if (errors.influxDB) {
        errorMessage += `\ninfluxDB: ${errors.influxDB}`;
    }
    if (errors.sqlite) {
        errorMessage += `\nsqlite: ${errors.sqlite}`;
    }
    if (errors.nodered) {
        errorMessage += `\nnodered: ${errors.nodered}`;
    }
    if (errors.yahka) {
        errorMessage += `\nyahka: ${errors.yahka}`;
    }
    if (errors.zigbee) {
        errorMessage += `\nzigbee: ${errors.zigbee}`;
    }
    if (errors.zigbee2mqtt) {
        errorMessage += `\nzigbee2mqtt: ${errors.zigbee2mqtt}`;
    }
    if (errors.javascripts) {
        errorMessage += `\njavascripts: ${errors.javascripts}`;
    }
    if (errors.jarvis) {
        errorMessage += `\njarvis: ${errors.jarvis}`;
    }
    if (errors.clean) {
        errorMessage += `\nclean: ${errors.clean}`;
    }

    if (errors.mount) {
        errorMessage += `\nmount: ${errors.mount}`;
        errorMessage = mask(errorMessage, options.cifs?.pass);
    }
    if (errors.mysql) {
        errorMessage += `\nmysql: ${errors.mysql}`;
        errorMessage = mask(errorMessage, options.mysql?.pass);
    }
    if (errors.grafana) {
        errorMessage += `\ngrafana: ${errors.grafana}`;
        errorMessage = mask(errorMessage, options.grafana?.pass);
        errorMessage = mask(errorMessage, options.grafana?.apiKey);
    }
    if (errors.webdav) {
        errorMessage += `\nwebdav: ${errors.webdav}`;
        errorMessage = mask(errorMessage, options.webdav?.pass);
    }
    if (errors.pgsql) {
        errorMessage += `\npgsql: ${errors.pgsql}`;
        errorMessage = mask(errorMessage, options.pgsql?.pass);
    }
    if (errors.ccu) {
        errorMessage += `\nccu: ${errors.ccu}`;
        errorMessage = mask(errorMessage, options.ccu?.pass);
    }
    if (errors.ftp) {
        errorMessage += `\nftp: ${errors.ftp}`;
        errorMessage = mask(errorMessage, options.ftp?.pass);
    }
    if (errors.dropbox) {
        errorMessage += `\ndropbox: ${errors.dropbox}`;
        errorMessage = mask(errorMessage, options.dropbox?.accessToken);
    }
    if (errors.onedrive) {
        errorMessage += `\nonedrive: ${errors.onedrive}`;
        errorMessage = mask(errorMessage, options.onedrive?.onedriveAccessJson);
    }
    if (errors.googledrive) {
        errorMessage += `\ngoogledrive: ${errors.googledrive}`;
        errorMessage = mask(errorMessage, options.googledrive?.accessJson);
    }
    if (errors.cifs) {
        errorMessage += `\ncifs: ${errors.cifs}`;
        errorMessage = mask(errorMessage, options.cifs?.pass);
    }
    if (errors.umount) {
        errorMessage += `\numount: ${errors.umount}`;
        errorMessage = mask(errorMessage, options.cifs?.pass);
    }

    return errorMessage;
}

/**
 * Builds the numbered "Storage location" list appended to a success notification.
 *
 * Byte-identical in seven of the eight channels - discord only underlines the heading, hence the
 * flag. gotify guards its entries differently (it dereferences `options.onedrive` unguarded and
 * omits the "Local" line when no CIFS block exists at all) and keeps its own copy.
 *
 * @param options the script options, for the configured targets
 * @param systemLang language of the notification
 * @param underlineHeading wrap the heading in markdown underscores, as discord does
 */
export function buildStorageList(options: NotificationOptions, systemLang: string, underlineHeading = false): string {
    const heading = _('Storage location', systemLang);
    let storageOptions = underlineHeading ? `\n\n__${heading}:__\n` : `\n\n${heading}:\n`;
    let storageNum = 1;

    if (options.ftp?.enabled) {
        const m = `${storageNum++}. ${_('FTP', systemLang)} (%h%d)%k`;
        storageOptions += m
            .replace('%h', options.ftp.host as string)
            .replace('%d', options.ftp.dir as string)
            .replace('%k', '\n');
    }

    if (options.cifs?.enabled) {
        const m = `${storageNum++}. ${_(`NAS (${options.cifs.mountType})`, systemLang)} (%h%d)%k`;
        storageOptions += m
            .replace('%h', nasHost(options.cifs))
            .replace('%d', options.cifs.dir as string)
            .replace('%k', '\n');
    }

    if (options.dropbox?.enabled) {
        const m = `${storageNum++}. ${_('Dropbox', systemLang)} (%d)%k`;
        storageOptions += m.replace('%d', options.dropbox.dir as string).replace('%k', '\n');
    }

    if (options.onedrive?.enabled) {
        const m = `${storageNum++}. ${_('OneDrive', systemLang)} (%d)%k`;
        storageOptions += m.replace('%d', options.onedrive.dir as string).replace('%k', '\n');
    }

    if (options.googledrive?.enabled) {
        const m = `${storageNum++}. ${_('Google Drive', systemLang)} (%d)%k`;
        storageOptions += m.replace('%d', options.googledrive.dir as string).replace('%k', '\n');
    }

    if (options.webdav?.enabled) {
        const m = `${storageNum++}. ${_('WebDAV', systemLang)} (%d)%k`;
        storageOptions += m.replace('%d', options.webdav.dir as string).replace('%k', '\n');
    }

    if (!options.cifs?.enabled) {
        const m = `${storageNum++}. ${_('Local', systemLang)} (%d)%k`;
        storageOptions += m.replace('%d', options.backupDir).replace('%k', '\n');
    }

    return storageOptions;
}

/**
 * Task names for the short error list, in the order the history steps emit them.
 *
 * Note this is a different set and order from `buildErrorMessage` above - kept as found.
 */
const HISTORY_ERROR_ORDER = [
    'mount',
    'iobroker',
    'redis',
    'historyDB',
    'influxDB',
    'mysql',
    'pgsql',
    'sqlite',
    'nodered',
    'ccu',
    'ftp',
    'dropbox',
    'onedrive',
    'googledrive',
    'cifs',
    'clean',
    'grafana',
    'zigbee',
    'zigbee2mqtt',
    'yahka',
    'javascripts',
    'webdav',
    'jarvis',
    'umount',
];

/**
 * Builds the one-line "Backup error on: a b c " summary used by the two history steps.
 *
 * Byte-identical in 90-historyHTML and 92-historyJSON, including the trailing space after the last
 * task name.
 *
 * @param errors the shared error store
 * @param systemLang language of the history entry
 */
export function buildHistoryErrorLine(errors: BackItUpExecuteContext['errors'], systemLang: string): string {
    let errorMessage = _('Backup error on: ', systemLang);

    for (const task of HISTORY_ERROR_ORDER) {
        if (errors[task]) {
            errorMessage += `${task} `;
        }
    }

    return errorMessage;
}
