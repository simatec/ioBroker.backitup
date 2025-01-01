import type { BackItUpStorageEngineOptions, BackItUpStorageEngineResult } from './types';
import type { BackItUpConfigStorage, BackItUpConfigStorageGoogleDrive, BackItUpWhatToSave } from '../types';
import GoogleDrive from '../googleDriveLib';

export async function list(options: BackItUpStorageEngineOptions): Promise<BackItUpStorageEngineResult | null> {
    const config: BackItUpConfigStorageGoogleDrive = options.config as BackItUpConfigStorageGoogleDrive;

    if (config.accessJson && (!options.restoreSource || options.restoreSource === 'googledrive')) {
        const gDrive = new GoogleDrive(config.accessJson, config.newToken);
        if (!gDrive) {
            throw new Error('No or invalid access key');
        }

        let dir = (config.dir || '/').replace(/\\/g, '/');

        if (config.ownDir === true) {
            dir = (config.dirMinimal || '/').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }
        const id = await gDrive.getFileOrFolderId(dir);
        if (!id) {
            return {};
        }
        const list = await gDrive.listFilesInFolder(id);
        const _files: {
            path: string;
            name: string;
            size: number;
        }[] =
            list
                ?.map(file => ({ path: file.name, name: file.name, size: file.size, id }))
                .filter(
                    file =>
                        (options.creators.includes(file.name.split('_')[0] as BackItUpWhatToSave) ||
                            options.creators.includes(file.name.split('.')[0] as BackItUpWhatToSave)) &&
                        file.name.endsWith('.gz'),
                ) || [];

        const files: BackItUpStorageEngineResult = {};
        try {
            _files.forEach(file => {
                const type: BackItUpWhatToSave = file.name.split('_')[0] as BackItUpWhatToSave;
                files[type] = files[type] || [];
                files[type].push(file);
            });
        } catch (e) {
            options.log.error(`[FTP] Files error: ${e} please check the ftp config and try again!!`);
        }

        return files;
    }

    return Promise.resolve(null);
}

export async function getFile(
    commonConfig: BackItUpConfigStorage,
    fileName: string,
    toStoreName: string,
    log: ioBroker.Log,
): Promise<void> {
    const config: BackItUpConfigStorageGoogleDrive = commonConfig as BackItUpConfigStorageGoogleDrive;

    if (config.accessJson) {
        const gDrive = new GoogleDrive(config.accessJson, config.newToken);

        if (!gDrive) {
            throw new Error('No or invalid access key');
        }

        let dir = (config.dir || '/').replace(/\\/g, '/');

        if (config.ownDir === true) {
            dir = (config.dirMinimal || '/').replace(/\\/g, '/');
        }

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }

        log.debug(`[GoogleDrive] Download of "${fileName}" started`);
        const folderId = await gDrive.getFileOrFolderId(dir);
        if (!folderId) {
            throw new Error('Folder not found');
        }
        const fileId = await gDrive.getFileOrFolderId(fileName, folderId);
        if (!fileId) {
            throw new Error('File not found');
        }
        return gDrive
            .readFile(fileId, toStoreName)
            .then(() => log.debug(`[GoogleDrive] Download of "${fileName}" done`));
    }

    throw new Error('Not configured');
}
