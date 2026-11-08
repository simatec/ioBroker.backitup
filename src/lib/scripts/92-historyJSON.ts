import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';

import { _, getTimeString } from '../tools';
import { buildHistoryErrorLine } from '../notificationText';
import type { BackItUpLogger, BackItUpProps } from '../types';

interface HistoryTarget {
    enabled?: boolean;
}

interface HistoryJsonOptions {
    name: string;
    ftp?: HistoryTarget;
    cifs?: HistoryTarget;
    dropbox?: HistoryTarget;
    webdav?: HistoryTarget;
    googledrive?: HistoryTarget;
    onedrive?: HistoryTarget;
    historyJSON: {
        enabled?: boolean;
        systemLang: string;
        entriesNumber: number;
    };
}

interface HistoryJsonEntry {
    date: string;
    name: string | undefined;
    type: string;
    storage: string | string[];
    filesize: string | null;
    /** exact size in bytes */
    filesizeBytes: number | null;
    error: string;
    timestamp: number | undefined;
}

/**
 * Size of the produced archive.
 *
 * `filesize` keeps its old format "<n> MB" in whole megabytes, but an archive below 1 MB (e.g. a
 * Homematic CCU backup) is written as a fraction ("0.75 MB") instead of "0 MB".
 * `filesizeBytes` is the exact size for the GUI.
 *
 * @param fileName archive to measure, if it exists
 * @param log logger of the running step
 */
async function fileSizeCheck(
    fileName: string | undefined,
    log: BackItUpLogger,
): Promise<{ filesize: string | null; filesizeBytes: number | null }> {
    if (fileName && existsSync(fileName)) {
        const stats = await stat(fileName).catch(err => log.warn(`Filesize error: ${err}`));
        if (stats) {
            const mb = stats.size / (1024 * 1024);
            return {
                filesize: `${mb >= 1 || !stats.size ? Math.floor(mb) : Number(mb.toPrecision(2))} MB`,
                filesizeBytes: stats.size,
            };
        }
    }
    return { filesize: null, filesizeBytes: null };
}

/**
 * Adds this run to the JSON history state.
 *
 * The callback version left the whole run hanging when the state was missing or empty, and it
 * reported twice when the stored JSON could not be parsed or the state could not be written - the
 * error went out first and the success right behind it. Both are settled here.
 *
 * @param props the run context and the historyJSON slice of the config
 */
export async function run(props: BackItUpProps<HistoryJsonOptions>): Promise<void> {
    const { context: ctx, options } = props;

    // Build DP JSON
    if (options.historyJSON.enabled && ctx.adapter) {
        let fileName: string | undefined;

        try {
            const fileNames: string[] = JSON.parse(JSON.stringify(ctx.fileNames));
            fileName = fileNames.shift();

            if (fileName && existsSync(fileName)) {
                fileName = fileName ? fileName.replace(/\\/g, '/') : undefined;
            }
        } catch (err) {
            ctx.log.error(`FileName error: ${err}`);
        }

        try {
            const state = await ctx.adapter.getStateAsync('history.json');

            if (!state || !state.val) {
                ctx.log.debug('no history json state yet, nothing to add');
                return;
            }
            const historyListJSON = state.val as string;
            let historyArrayJSON: HistoryJsonEntry[] | undefined;

            if (historyListJSON !== undefined) {
                try {
                    historyArrayJSON = JSON.parse(historyListJSON);
                } catch (err) {
                    ctx.log.error(`history error: ${err} Please reinstall BackItUp and run "iobroker fix"!!`);
                }
            }

            const errors = Object.keys(ctx.errors);
            let errorMessage = '';

            if (errors.length) {
                errorMessage = buildHistoryErrorLine(ctx.errors, options.historyJSON.systemLang);
            } else {
                errorMessage = 'none';
            }

            const storage: string[] = [];

            const targets: [HistoryTarget | undefined, string][] = [
                [options.ftp, 'FTP'],
                [options.cifs, 'NAS / Copy'],
                [options.dropbox, 'Dropbox'],
                [options.webdav, 'WebDAV'],
                [options.googledrive, 'Google Drive'],
                [options.onedrive, 'OneDrive'],
            ];
            for (const [target, label] of targets) {
                if (target && target.enabled) {
                    storage.push(_(label, options.historyJSON.systemLang));
                }
            }
            if (!storage.length) {
                storage.push(_('Only stored locally', options.historyJSON.systemLang));
            }

            // push history to json
            try {
            // Throws when the state did not hold parsable JSON.
                historyArrayJSON!.unshift({
                    date: getTimeString(options.historyJSON.systemLang),
                    name: fileName ? fileName.split('/').pop() : undefined,
                    type: options.name,
                    storage: storage.length > 1 ? storage : storage[0],
                    ...(await fileSizeCheck(fileName, ctx.log)),
                    error: errorMessage,
                    timestamp: ctx.timestamp,
                });
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw `history json could not be created: ${err}`;
            }

            if (historyArrayJSON && historyArrayJSON.length > options.historyJSON.entriesNumber) {
                historyArrayJSON.splice(
                    options.historyJSON.entriesNumber,
                    historyArrayJSON.length - options.historyJSON.entriesNumber,
                );
            }

            try {
                await ctx.adapter.setStateAsync('history.json', {
                    val: JSON.stringify(historyArrayJSON),
                    ack: true,
                });
                ctx.log.debug('new history json values created');
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw `history json could not be created: ${err}`;
            }
        } catch (err) {
            // A plain string, as before: wrapping it in an Error would prefix the reported text.
            // The two inner failures above already carry this wording and are rethrown unchanged.
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw typeof err === 'string' ? err : `history json could not be created: ${err}`;
        }
    }
}

export const ignoreErrors = true;
export const afterBackup = true;
