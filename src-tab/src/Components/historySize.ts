/** Size fields of an entry of the state history.json */
export interface HistorySize {
    /** "<n> MB" - whole megabytes, below 1 MB as a fraction (older versions wrote "0 MB") */
    filesize?: string | number | null;
    /** exact size in bytes; missing in entries of older versions */
    filesizeBytes?: number | null;
}

const MB = 1024 * 1024;

/**
 * Readable size of a history entry: KB below 1 MB, MB below 1 GB, otherwise GB.
 * Entries of older versions only know whole megabytes; "0 MB" there means "less than 1 MB".
 *
 * @param entry the history entry
 * @param isFloatComma use a comma as decimal separator
 */
export function formatHistorySize(entry: HistorySize, isFloatComma: boolean): string {
    let bytes: number;
    if (typeof entry.filesizeBytes === 'number' && entry.filesizeBytes >= 0) {
        bytes = entry.filesizeBytes;
    } else {
        if (entry.filesize === null || entry.filesize === undefined || entry.filesize === '') {
            return '--';
        }
        const mb = parseFloat(String(entry.filesize));
        if (Number.isNaN(mb)) {
            return String(entry.filesize);
        }
        if (mb === 0) {
            return '< 1 MB';
        }
        bytes = mb * MB;
    }

    let text: string;
    if (bytes >= 1024 * MB) {
        text = `${(bytes / (1024 * MB)).toFixed(2)} GB`;
    } else if (bytes >= MB) {
        const mb = bytes / MB;
        text = `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
    } else {
        text = `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return isFloatComma ? text.replace('.', ',') : text;
}
