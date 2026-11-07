import { join } from 'node:path';

import { createClient, downloadToFile, dropboxErrorText, listFolder } from '../dropboxLib';
import type { BackItUpConfigStorageDropbox } from '../types';
import type {
    BackItUpGetFileProps,
    BackItUpListProps,
    BackItUpStorageEngineResult,
    BackItUpStorageEngineResultFile,
} from './types';

/**
 * The engines are handed either the storage node itself or the enclosing creator node, which
 * carries the storage under its own key - hence the two-step lookup on every setting.
 */
type DropboxOptions = Partial<BackItUpConfigStorageDropbox> & {
    dropbox?: Partial<BackItUpConfigStorageDropbox>;
};

/** Kept at module scope, as before */
let db_accessToken: string | undefined;

function settings(options: DropboxOptions): { dir: string; ownDir: boolean; dirMinimal: string } {
    return {
        dir:
            options.dir !== undefined
                ? (options.dir as string)
                : options.dropbox && options.dropbox.dir !== undefined
                  ? (options.dropbox.dir as string)
                  : '/',
        ownDir:
            options.ownDir !== undefined
                ? options.ownDir
                : options.dropbox && options.dropbox.ownDir !== undefined
                  ? options.dropbox.ownDir
                  : false,
        dirMinimal:
            options.dirMinimal !== undefined
                ? options.dirMinimal
                : options.dropbox && options.dropbox.dirMinimal !== undefined
                  ? options.dropbox.dirMinimal
                  : '/',
    };
}

/**
 * Applies the "own directory" switch and makes sure the path is absolute
 *
 * @param dir configured target directory
 * @param ownDir whether the minimal backup uses its own directory
 * @param dirMinimal directory used when `ownDir` is set
 */
function targetDir(dir: string, ownDir: boolean, dirMinimal: string): string {
    let result = (dir || '').replace(/\\/g, '/');

    if (ownDir === true) {
        result = (dirMinimal || '').replace(/\\/g, '/');
    }

    if (!result || result[0] !== '/') {
        result = `/${result || ''}`;
    }

    return result;
}

/**
 * Lists the backups stored on Dropbox.
 *
 * @param props run context, storage config, requested source and backup types
 */
export async function list(
    props: BackItUpListProps<DropboxOptions>,
): Promise<BackItUpStorageEngineResult | undefined> {
    const {
        context: { log },
        options,
        restoreSource,
        types,
    } = props;

    const { dir: dbDir, ownDir, dirMinimal } = settings(options);

    // Token refresh
    if (!restoreSource || restoreSource === 'dropbox') {
        db_accessToken = options.accessToken || '';
    }

    if (!db_accessToken || (restoreSource && restoreSource !== 'dropbox')) {
        // Not configured, or another storage was asked for - nothing to file.
        return undefined;
    }

    const dbx = createClient(db_accessToken);
    const dir = targetDir(dbDir, ownDir, dirMinimal);

    let result: Awaited<ReturnType<typeof listFolder>>;
    try {
        result = await listFolder(dbx, dir);
    } catch (e) {
        const text = JSON.stringify(dropboxErrorText(e));
        log.error(`Dropbox: ${text}`);
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw `Dropbox: ${text}`;
    }

    const entries: BackItUpStorageEngineResultFile[] = result
        .filter(file => file['.tag'] === 'file')
        .map(file => ({
            path: file.path_display as string,
            name: (file.path_display as string).replace(/\\/g, '/').split('/').pop() as string,
            size: (file as { size?: number }).size as number,
        }))
        .filter(
            file =>
                (types.indexOf(file.name.split('_')[0]) !== -1 || types.indexOf(file.name.split('.')[0]) !== -1) &&
                file.name.split('.').pop() == 'gz',
        );

    const files: BackItUpStorageEngineResult = {};
    entries.forEach(file => {
        const type = file.name.split('_')[0];
        files[type] = files[type] || [];
        files[type].push(file);
    });

    return files;
}

/**
 * Downloads one backup from Dropbox.
 *
 * @param props run context, storage config, the file to fetch and where to put it
 */
export async function getFile(props: BackItUpGetFileProps<DropboxOptions>): Promise<void> {
    const {
        context: { log },
        options,
        fileName,
        toStoreName,
    } = props;

    const { dir: dbDir, ownDir, dirMinimal } = settings(options);

    // Token refresh
    const accessToken = options.accessToken || '';

    if (!accessToken) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Not configured';
    }

    // copy file to backupDir
    const dbx = createClient(accessToken);
    const onlyFileName = fileName.split('/').pop() as string;
    const dir = targetDir(dbDir, ownDir, dirMinimal);

    log.debug(`Dropbox: Download of "${fileName}" started`);
    try {
        await downloadToFile(
            dbx,
            join(dir.replace(/^\/$/, ''), onlyFileName).replace(/\\/g, '/'),
            toStoreName,
        );
    } catch (e) {
        const text = dropboxErrorText(e);
        log.error(`Dropbox: ${text}`);
        throw new Error(`Dropbox: ${text}`);
    }
    log.debug(`Dropbox: Download of "${fileName}" done`);
}
