import { execFileSync } from 'node:child_process';
import { accessSync, constants, createReadStream, createWriteStream, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A plain ioBroker backup as `iobroker backup` (js-controller) writes it, e.g.
 * `2024_12_27-21_08_42_backupiobroker.tar.gz` or `2025_03_15-20_25_03_backupiobroker-migration.tar.gz`.
 * Copies renamed by a browser (`... (1).tar.gz`) match as well.
 */
const PURE_IOBROKER_BACKUP = /^\d{4}_\d\d_\d\d-\d\d_\d\d_\d\d_backupiobroker.*\.tar\.gz$/;

/**
 * Tells whether a file name is a plain ioBroker backup made without BackItUp.
 *
 * @param name file name without the directory
 */
export function isPureIobrokerBackup(name: string): boolean {
    return PURE_IOBROKER_BACKUP.test(name);
}

/**
 * Backups that BackItUp can list and download, but not restore: they are made by another system
 * and have to be restored there.
 *
 * - `homematic_..._backupiobroker.tar.sbk`: made by the Homematic CCU / RaspberryMatic
 * - `redis-remote_..._backupiobroker.tar.gz`: dump of a remote Redis server
 * - `zigbee2mqtt_..._backup.zip`: backup of a remote Zigbee2MQTT instance (its own zip format)
 */
const DOWNLOAD_ONLY_BACKUPS: { pattern: RegExp; type: string; creator: string }[] = [
    { pattern: /^homematic_.*\.sbk$/, type: 'ccu', creator: 'ccu' },
    { pattern: /^redis-remote_.*_backupiobroker\.tar\.gz$/, type: 'redis-remote', creator: 'redis' },
    { pattern: /^zigbee2mqtt_.*_backup\.zip$/, type: 'zigbee2mqtt', creator: 'zigbee2mqtt' },
];

/**
 * Tells whether a backup can only be downloaded, because BackItUp cannot restore it.
 *
 * @param name file name without the directory
 */
export function isDownloadOnlyBackup(name: string): boolean {
    return DOWNLOAD_ONLY_BACKUPS.some(entry => entry.pattern.test(name));
}

/**
 * Decides under which type a file found on a storage is listed.
 * BackItUp archives (`<type>_..._backupiobroker.tar.gz`) are listed under their type, the download-only backups
 * under `ccu`, `redis-remote` and `zigbee2mqtt`.
 *
 * @param name file name without the directory
 * @param types names of the configured creators (iobroker, ccu, mysql, ...)
 * @returns the type or null, if the file is no backup of BackItUp
 */
export function listedBackupType(name: string, types: string[]): string | null {
    const downloadOnly = DOWNLOAD_ONLY_BACKUPS.find(entry => entry.pattern.test(name));
    if (downloadOnly) {
        return types.includes(downloadOnly.creator) ? downloadOnly.type : null;
    }
    if (name.split('.').pop() !== 'gz') {
        return null;
    }
    if (types.includes(name.split('_')[0]) || types.includes(name.split('.')[0])) {
        return name.split('_')[0];
    }
    return null;
}

export function getDate(d?: Date): string {
    d = d || new Date();

    return `${d.getFullYear()}_${(d.getMonth() + 1).toString().padStart(2, '0')}_${d.getDate().toString().padStart(2, '0')}-${d.getHours().toString().padStart(2, '0')}_${d.getMinutes().toString().padStart(2, '0')}_${d.getSeconds().toString().padStart(2, '0')}`;
}

export function copyFile(source: string, target: string, cb?: (err?: Error) => void): void {
    // The callback must fire at most once, whichever of the two streams fails first.
    let callback = cb;
    const done = (err?: Error): void => {
        if (callback) {
            const fire = callback;
            callback = undefined;
            fire(err);
        }
    };

    const rd = createReadStream(source);
    rd.on('error', err => done(err));

    const wr = createWriteStream(target);
    wr.on('error', err => done(err));

    wr.on('close', () => done());

    rd.pipe(wr);
}

/**
 * looks for iobroker home folder
 */
export function getIobDir(): string {
    // Deliberately required lazily rather than imported at the top: adapter-core resolves the
    // controller installation when it loads, and lib/tools is pulled in by every backup script.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const utils = require('@iobroker/adapter-core');

    const backupDir = join(utils.getAbsoluteDefaultDataDir(), 'iobroker.json').replace(/\\/g, '/');
    const parts = backupDir.split('/');
    parts.pop(); // iobroker.json
    parts.pop(); // iobroker-data.json
    return parts.join('/');
}

// function to create a date string
const MONTHS: Record<string, string[]> = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    pl: ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'],
    uk: ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'],
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    'zh-cn': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
};

const timePattern: Record<string, string> = {
    en: '%d at %t Hours',
    de: '%d um %t Uhr',
    ru: '%d в %t',
    es: '%d a las %t horas',
    it: '%d alle ore %t',
    pt: '%d às %t horas',
    pl: '%d o godzinie %t',
    uk: '%d о %t годині',
    fr: '%d à %t heures',
    'zh-cn': '%d %t',
};

function padding0(number: number): string {
    return number < 10 ? `0${number}` : `${number}`;
}

function formatDate(systemLang: string, date: Date): string {
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    return (timePattern[systemLang] || timePattern.en)
        .replace('%d', `${padding0(day)}. ${(MONTHS[systemLang] || MONTHS.en)[monthIndex]} ${year}`)
        .replace('%t', `${padding0(hours)}:${padding0(minutes)}`);
}

export function getTimeString(systemLang: string, date?: Date): string {
    return formatDate(systemLang, date || new Date());
}

/**
 * Next Backup Time
 *
 * @param systemLang language to format in, falling back to English for unknown ones
 * @param nextDate point in time to render
 */
export function getNextTimeString(systemLang: string, nextDate: Date): string {
    return formatDate(systemLang, nextDate);
}

export function _(word: string, systemLang?: string): string {
    // A computed path, so this has to stay a require - and it keeps the behaviour of reading only
    // the language actually in use instead of bundling all eleven translation files.
    // Two levels up: this compiles to build/lib/tools.js, and admin/ stays at the adapter root.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const translations: Record<string, string> = require(
        `../../admin/i18n/${systemLang ? systemLang : 'en'}/translations.json`,
    );

    if (translations[word]) {
        return translations[word];
    }

    console.warn(`Please translate in translations.json: ${word}`);
    return word;
}

/**
 * Resolves after the given number of milliseconds.
 *
 * The notification steps all wait before they report, so that wait is expressed once here instead
 * of wrapping every step body in a `setTimeout` callback.
 *
 * @param ms how long to wait
 */
export async function delay(ms?: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Replaces every occurrence of a secret in a text with `****`.
 *
 * The influx CLI takes its access token as a command line argument, so anything derived from that
 * command line has to pass through here first - `error.message` of a failed `exec` starts with
 * "Command failed: <command>" and would otherwise carry the token into `context.errors` and from
 * there into every notification channel.
 *
 * An empty or missing secret leaves the text untouched: `replaceAll('')` matches the gap between
 * every pair of characters and would otherwise pepper the whole string with the mask.
 *
 * @param text the text to scrub
 * @param secret the value to hide
 */
export function maskSecret(text: string, secret?: string | null): string {
    return secret ? text.replaceAll(secret, '****') : text;
}

/**
 * Looks a program up the way the shell does, so a step can report "not installed" in plain words
 * instead of the shell's "influx: not found".
 *
 * @param name program name, searched in PATH, or a full path
 * @returns the full path, or null if there is no such program
 */
export function findExecutable(name: string): string | null {
    const isWin = process.platform === 'win32';
    const usable = (file: string): boolean => {
        try {
            if (!statSync(file).isFile()) {
                return false;
            }
            if (!isWin) {
                accessSync(file, constants.X_OK);
            }
            return true;
        } catch {
            return false;
        }
    };

    if (name.includes('/') || name.includes('\\')) {
        return usable(name) ? name : null;
    }
    // The search is left to the shell (`command -v`) or to Windows (`where`), so it follows the
    // same PATH the program is started with later. The name is passed as an argument, never as
    // part of the command line.
    try {
        const output = isWin
            ? execFileSync('where', [name], {
                  encoding: 'utf8',
                  stdio: ['ignore', 'pipe', 'ignore'],
                  windowsHide: true,
              })
            : execFileSync('sh', ['-c', 'command -v -- "$1"', 'sh', name], {
                  encoding: 'utf8',
                  stdio: ['ignore', 'pipe', 'ignore'],
              });
        for (const line of output.split(/\r?\n/)) {
            const file = line.trim();
            // `command -v` also names shell builtins and aliases without a path - those are no program
            if (file && (file.includes('/') || file.includes('\\')) && usable(file)) {
                return file;
            }
        }
    } catch {
        // not found: `command -v` and `where` exit with a non-zero status
    }
    return null;
}

export function getSize(bytes: number): string {
    if (bytes > 1024 * 1024 * 512) {
        return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10} GiB`;
    }

    if (bytes > 1024 * 1024) {
        return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;
    }

    if (bytes > 1024) {
        return `${Math.round((bytes / 1024) * 10) / 10} KiB`;
    }

    return `${bytes} bytes`;
}
