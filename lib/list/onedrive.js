'use strict';
const Onedrive = require('../oneDriveLib');

async function list(restoreSource, options, types, log, callback) {
    const db_onedriveAccessJson = options.onedriveAccessJson !== undefined ? options.onedriveAccessJson : options.onedrive && options.onedrive.onedriveAccessJson !== undefined ? options.onedrive.onedriveAccessJson : '';
    const db_dir = options.dir !== undefined ? options.dir : options.onedrive && options.onedrive.dir !== undefined ? options.onedrive.dir : '/';
    const db_ownDir = options.ownDir !== undefined ? options.ownDir : options.onedrive && options.onedrive.ownDir !== undefined ? options.onedrive.ownDir : false;
    const db_dirMinimal = options.dirMinimal !== undefined ? options.dirMinimal : options.onedrive && options.onedrive.dirMinimal !== undefined ? options.onedrive.dirMinimal : '/';

    let od_accessToken;

    // Refresh token if necessary
    if (!restoreSource || restoreSource === 'onedrive') {
        const onedrive = new Onedrive();
        try {
            od_accessToken = await onedrive.getToken(db_onedriveAccessJson, log);
        } catch (err) {
            log.warn(`Onedrive Token: ${err}`);
        }

        if (od_accessToken) {
            let dir = (db_dir || '').replace(/\\/g, '/');

            // Use minimal path if ownDir is true
            if (db_ownDir === true) {
                dir = (db_dirMinimal || '').replace(/\\/g, '/');
            }

            // Normalize directory format
            if (!dir || dir[0] !== '/') {
                dir = `/${dir || ''}`;
            }

            if (!dir) {
                dir = 'root';
            }

            if (dir.startsWith('/')) {
                dir = dir.substring(1);
            }

            try {
                // Call internal listBackups method from class
                const files = await onedrive.listBackups({ accessToken: od_accessToken, dir, types, log });

                callback && callback(null, files, 'onedrive');
            } catch (error) {
                log.error(`Onedrive listBackups error: ${error}`);
                callback && callback(error);
            }

        } else {
            callback && callback('No access token available');
        }
    } else {
        callback && callback();
    }
}

async function getFile(options, fileName, toStoreName, log, callback) {
    const db_onedriveAccessJson = options.onedriveAccessJson ?? options.onedrive?.onedriveAccessJson ?? '';
    const db_dir = options.dir ?? options.onedrive?.dir ?? '/';
    const db_ownDir = options.ownDir ?? options.onedrive?.ownDir ?? false;
    const db_dirMinimal = options.dirMinimal ?? options.onedrive?.dirMinimal ?? '/';

    const onedrive = new Onedrive();
    const od_accessToken = await onedrive.getToken(db_onedriveAccessJson, log).catch(err => log.warn(`OneDrive Token: ${err}`));

    if (!od_accessToken) {
        callback?.('Not configured');
        return;
    }

    try {
        const dir = db_ownDir ? db_dirMinimal : db_dir;
        const onlyFileName = fileName.split('/').pop();

        await onedrive.downloadFileByName({
            accessToken: od_accessToken,
            dir,
            fileName: onlyFileName,
            targetPath: toStoreName,
            log
        });

        callback?.();
    } catch (err) {
        log.error(`OneDrive: ${err.message}`);
        callback?.(err);
    }
}

module.exports = {
    list,
    getFile,
};
