import GoogleDrive from '../googleDriveLib';
import type { BackItUpConfigStorageGoogleDrive } from '../types';
import type {
    BackItUpGetFileProps,
    BackItUpListProps,
    BackItUpStorageEngineResult,
    BackItUpStorageEngineResultFile,
} from './types';
import { listedBackupType } from '../tools';

/**
 * The engines are handed either the storage node itself or the enclosing creator node, which
 * carries the storage under its own key - hence the two-step lookup on every setting.
 */
type GoogleDriveOptions = Partial<BackItUpConfigStorageGoogleDrive> & {
    googledrive?: Partial<BackItUpConfigStorageGoogleDrive>;
};

function settings(options: GoogleDriveOptions): {
    accessJson: string;
    dir: string;
    ownDir: boolean;
    dirMinimal: string;
    newToken: boolean | string;
} {
    return {
        accessJson:
            options.accessJson !== undefined
                ? options.accessJson
                : options.googledrive && options.googledrive.accessJson !== undefined
                  ? options.googledrive.accessJson
                  : '',
        dir:
            options.dir !== undefined
                ? (options.dir as string)
                : options.googledrive && options.googledrive.dir !== undefined
                  ? (options.googledrive.dir as string)
                  : '/',
        ownDir:
            options.ownDir !== undefined
                ? options.ownDir
                : options.googledrive && options.googledrive.ownDir !== undefined
                  ? options.googledrive.ownDir
                  : false,
        dirMinimal:
            options.dirMinimal !== undefined
                ? options.dirMinimal
                : options.googledrive && options.googledrive.dirMinimal !== undefined
                  ? options.googledrive.dirMinimal
                  : '/',
        newToken:
            options.newToken !== undefined
                ? options.newToken
                : options.googledrive && options.googledrive.newToken !== undefined
                  ? options.googledrive.newToken
                  : '',
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
 * Lists the backups stored on Google Drive.
 *
 * @param props run context, storage config, requested source and backup types
 */
export async function list(
    props: BackItUpListProps<GoogleDriveOptions>,
): Promise<BackItUpStorageEngineResult | undefined> {
    const { options, restoreSource, types } = props;
    const { accessJson, dir: gdDir, ownDir, dirMinimal, newToken } = settings(options);

    if (!accessJson || (restoreSource && restoreSource !== 'googledrive')) {
        // Not configured, or another storage was asked for - nothing to file.
        return undefined;
    }

    let gDrive: GoogleDrive;
    try {
        gDrive = new GoogleDrive(accessJson, newToken);

        if (!gDrive) {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw 'No or invalid access key';
        }
    } catch {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'No or invalid access key';
    }

    const dir = targetDir(gdDir, ownDir, dirMinimal);

    const id = await gDrive.getFileOrFolderId(dir);
    if (!id) {
        // Reported an empty array here before; an empty object is what every other engine returns
        // and what the result type describes. Both are read with `Object.keys()` / property access
        // downstream, so this reads the same.
        return {};
    }

    const entries = await gDrive.listFilesInFolder(id);
    const result = entries
        .map(
            (file): BackItUpStorageEngineResultFile => ({
                path: file.name as string,
                name: file.name as string,
                size: file.size as string,
                id,
            }),
        )
        .filter(file => listedBackupType(file.name, types) !== null);

    const files: BackItUpStorageEngineResult = {};
    result.forEach(file => {
        const type = listedBackupType(file.name, types) as string;
        files[type] = files[type] || [];
        files[type].push(file);
    });
    return files;
}

/**
 * Downloads one backup from Google Drive.
 *
 * NOTE: the promise chain this replaces did not stop at the first miss. A missing folder reported
 * 'Folder not found', then handed `undefined` on so the next link reported 'File not found', and
 * the last link reported success on top - three callbacks for one failure. Awaiting stops at the
 * first one, which is the only report the caller ever wanted.
 *
 * @param props run context, storage config, the file to fetch and where to put it
 */
export async function getFile(props: BackItUpGetFileProps<GoogleDriveOptions>): Promise<void> {
    const {
        context: { log },
        options,
        fileName,
        toStoreName,
    } = props;

    const { accessJson, dir: gdDir, ownDir, dirMinimal, newToken } = settings(options);

    if (!accessJson) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Not configured';
    }

    const gDrive = new GoogleDrive(accessJson, newToken);

    if (!gDrive) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'No or invalid access key';
    }

    const dir = targetDir(gdDir, ownDir, dirMinimal);

    /**
     * Logs a genuine API failure the way the old `.catch()` on the chain did, then re-throws.
     *
     * The two "not found" markers below deliberately do not go through here: they were handed
     * straight to the callback before and never produced a log line.
     *
     * @param err whatever the Drive client rejected with
     */
    const reportApiFailure = (err: unknown): never => {
        if (err) {
            log.error(err);
        }
        throw err;
    };

    log.debug(`Download of "${fileName}" started`);

    const folderId = await gDrive.getFileOrFolderId(dir).catch(reportApiFailure);
    if (!folderId) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Folder not found';
    }

    const fileId = await gDrive.getFileOrFolderId(fileName, folderId).catch(reportApiFailure);
    if (!fileId) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'File not found';
    }

    await gDrive.readFile(fileId, toStoreName).catch(reportApiFailure);
    log.debug(`Download of "${fileName}" done`);
}
