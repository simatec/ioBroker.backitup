import { exec } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getIobDir, listedBackupType } from '../tools';
import type { BackItUpConfigStorageCifs, BackItUpLogger, BackItUpStorage } from '../types';
import type {
    BackItUpGetFileProps,
    BackItUpListProps,
    BackItUpStorageKey,
    BackItUpStorageEngineResult,
    BackItUpStorageEngineResultFile,
} from './types';

const backupDir = join(getIobDir(), 'backups').replace(/\\/g, '/');

/**
 * Second mount point. The backup directory holds the mount of the ioBroker backup directory, so a share
 * directory with other backups (e.g. the own CCU directory) is mounted here for a moment to list it or
 * to copy one file from it.
 */
const separateMountPoint = join(tmpdir(), 'backitup-nas').replace(/\\/g, '/');

/** `mount`/`umount` report the shell output of the successful attempt */
type MountCallback = (error?: Error | string | null, stdout?: string) => void;

type CifsOptions = BackItUpConfigStorageCifs;

/** Not the module name: the restore tab and lib/restore address a NAS source by this key. */
export const storageKey: BackItUpStorageKey = 'nas / copy';

/**
 * Lists the backups on the NAS share, mounting it first when the configuration says so.
 *
 * @param props run context, storage config, requested source and backup types
 */
export async function list(props: BackItUpListProps<CifsOptions>): Promise<BackItUpStorageEngineResult | undefined> {
    const {
        context: { log },
        options,
        restoreSource,
        types,
    } = props;

    if (!options.enabled || (restoreSource && restoreSource !== 'cifs')) {
        // Switched off, or another storage was asked for - nothing to file.
        return undefined;
    }

    if (options.separateMount && options.mountType !== 'Copy') {
        // Another directory than the one mounted onto the backup directory, e.g. the own CCU directory
        if (options.mountType !== 'CIFS' && options.mountType !== 'NFS') {
            log.debug(`NAS: a second directory cannot be listed with mount type "${options.mountType}"`);
            return undefined;
        }
        try {
            return await withSeparateMount(options, options.dir as string, log, mountPoint =>
                readBackupDir(mountPoint, types, log),
            );
        } catch (e) {
            log.warn(`NAS: ${e}`);
            return {};
        }
    }

    if (options.mountType === 'CIFS' || options.mountType === 'NFS' || options.mountType === 'Expert') {
        await new Promise<void>(resolve =>
            mount(options, log, error => {
                if (error) {
                    log.error(String(error));
                }
                resolve();
            }),
        );
    }

    return nasList(restoreSource, options, types, log);
}

/**
 * Finds the backups in a directory of the NAS, grouped by backup type.
 *
 * @param dir directory to read
 * @param types backup types to look for
 * @param log adapter logger
 */
function readBackupDir(dir: string, types: string[], log: BackItUpLogger): BackItUpStorageEngineResult {
    const files: BackItUpStorageEngineResult = {};
    if (existsSync(dir)) {
        try {
            const paths = readdirSync(dir)
                .sort()
                .map(file => join(dir, file).replace(/\\/g, '/'));

            paths
                .map((file): BackItUpStorageEngineResultFile => {
                    const stat = statSync(file);
                    return { path: file, name: file.split('/').pop() as string, size: stat.size };
                })
                .filter(file => listedBackupType(file.name, types) !== null)
                .forEach(file => {
                    const type = listedBackupType(file.name, types) as string;
                    files[type] = files[type] || [];
                    files[type].push(file);
                });
        } catch (e) {
            log.warn(`Source cannot be reached: ${e}`);
        }
    }
    return files;
}

/**
 * Reads the mounted (or plainly copied) directory.
 *
 * @param restoreSource the storage that was asked for
 * @param options resolved storage settings
 * @param types backup types to look for
 * @param log adapter logger
 */
function nasList(
    restoreSource: BackItUpStorage | '' | undefined,
    options: CifsOptions,
    types: string[],
    log: BackItUpLogger,
): BackItUpStorageEngineResult | undefined {
    if (options.enabled && (!restoreSource || restoreSource === 'cifs')) {
        let dir = backupDir.replace(/\\/g, '/');

        if (options.mountType === 'Copy') {
            if (options.ownDir === true) {
                dir = options.dirMinimal.replace(/\\/g, '/');
            } else if (options.ownDir === false) {
                dir = (options.dir as string).replace(/\\/g, '/');
            }
        }

        if (dir[0] !== '/' && !dir.match(/\w:/)) {
            dir = `/${dir || ''}`;
        }

        const files = readBackupDir(dir, types, log);
        // The caller files this under the engine's own key. Note that key is 'nas / copy', not
        // 'cifs' - that is what the restore tab and lib/restore address a NAS source by.
        return files;
    }
    return undefined;
}

/**
 * Copies one backup off the share, or does nothing when it is mounted onto the backup directory.
 *
 * @param options resolved storage settings
 * @param fileName the file as the storage names it
 * @param toStoreName where to put it locally
 * @param log adapter logger
 */
async function copyFileCifs(
    options: CifsOptions,
    fileName: string,
    toStoreName: string,
    log: BackItUpLogger,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const callback = (err?: Error | string | null): void => (err ? reject(err) : resolve());
        try {
            log.debug(`Get file ${fileName}`);
            log.debug(`Mount type: ${options.mountType != undefined ? options.mountType : 'Copy'}`);

            if (options.mountType === 'CIFS' || options.mountType === 'NFS' || options.mountType === 'Expert') {
                callback(null);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const fse = require('fs-extra');

                fse.copy(fileName, toStoreName, (err: Error) => {
                    if (err) {
                        log.error(String(err));
                    }
                    callback(null);
                });
            }
        } catch (e) {
            log.error(String(e));

            if (options.mountType === 'CIFS' || options.mountType === 'NFS' || options.mountType === 'Expert') {
                umount(options, log, error => callback(error));
            } else {
                callback(e as Error);
            }
        }
    });
}

/**
 * Fetches one backup from the NAS share.
 *
 * @param props run context, storage config, the file to fetch and where to put it
 */
export async function getFile(props: BackItUpGetFileProps<CifsOptions>): Promise<void> {
    const {
        context: { log },
        options,
        fileName,
        toStoreName,
    } = props;

    if (!options || !options.enabled) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Not configured';
    }

    if (options.mountType === 'CIFS' || options.mountType === 'NFS' || options.mountType === 'Expert') {
        if (existsSync(toStoreName)) {
            // Nothing to fetch - the share is mounted onto the backup directory itself.
            return;
        }
        if (options.mountType === 'Expert') {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw `File ${fileName.split('/').pop()} not found in the mounted backup directory`;
        }
        // The file is in another directory of the share (e.g. the own CCU directory), or the share is not
        // mounted right now: mount its directory for a moment and copy the file.
        const name = fileName.split('/').pop() as string;
        const dir = (options.ownDir === true ? options.dirMinimal : options.dir) as string;
        await withSeparateMount(options, dir, log, async mountPoint => {
            const source = join(mountPoint, name);
            if (!existsSync(source)) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw `File ${name} not found on the NAS in "${dir}"`;
            }
            log.debug(`NAS: copy ${name} from "${dir}"`);
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fse = require('fs-extra');
            await fse.copy(source, toStoreName);
        });
        return;
    }

    return copyFileCifs(options, fileName, toStoreName, log);
}

/**
 * Runs a shell command and resolves with its result - the error, if any, is part of the result.
 *
 * @param command shell command
 */
function execAsync(command: string): Promise<{ error: Error | null; stdout: string; stderr: string }> {
    return new Promise(resolve =>
        exec(command, (error, stdout, stderr) => resolve({ error, stdout: String(stdout), stderr: String(stderr) })),
    );
}

/**
 * Mount commands for one directory of the share, with the same options as the mount onto the backup
 * directory. CIFS has a second variant without the smb version, tried when the first one fails.
 *
 * @param options resolved storage settings
 * @param dir directory on the share
 * @param target local mount point
 */
function mountCommands(options: CifsOptions, dir: string, target: string): { command: string; masked: string }[] {
    const sudo = options.sudo ? 'sudo ' : '';
    const shareDir = (dir || '').startsWith('/') ? dir || '' : `/${dir || ''}`;

    if (options.mountType === 'NFS') {
        const command = `${sudo}mount ${options.mount}:${shareDir} ${target}`;
        return [{ command, masked: command }];
    }

    // CIFS
    const share = options.mount.startsWith('//') ? options.mount : `//${options.mount}`;
    let pass = options.pass || '';
    if ((!pass.startsWith(`"`) || !pass.endsWith(`"`)) && (!pass.startsWith(`'`) || !pass.endsWith(`'`))) {
        pass = `"${pass}"`;
    }
    const common =
        `${options.cifsDomain ? `,domain=${options.cifsDomain}` : ''}` +
        `${options.clientInodes ? ',noserverino' : ''}` +
        `${options.cacheLoose ? ',cache=loose' : ''}` +
        `,rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777`;
    const credentials = options.user ? `username=${options.user},password=${pass}` : '';
    const masked = options.user ? `username=${options.user},password=****` : '';
    const mountCmd = `${sudo}mount -t cifs -o `;
    const mountTarget = ` ${share}${shareDir} ${target}`;

    return [
        {
            command: `${mountCmd}${credentials}${common},${options.smb}${mountTarget}`,
            masked: `${mountCmd}${masked}${common},${options.smb}${mountTarget}`,
        },
        {
            command: `${mountCmd}${credentials}${common}${mountTarget}`,
            masked: `${mountCmd}${masked}${common}${mountTarget}`,
        },
    ];
}

/**
 * Mounts one directory of the share onto the second mount point, runs `fn` and unmounts it again,
 * also when `fn` fails. The mount onto the backup directory is not touched.
 *
 * @param options resolved storage settings (CIFS or NFS)
 * @param dir directory on the share
 * @param log adapter logger
 * @param fn work to do while the directory is mounted; gets the mount point
 */
async function withSeparateMount<T>(
    options: CifsOptions,
    dir: string,
    log: BackItUpLogger,
    fn: (mountPoint: string) => T | Promise<T>,
): Promise<T> {
    const umountCmd = `${options.sudo ? 'sudo umount' : 'umount'} ${separateMountPoint}`;

    mkdirSync(separateMountPoint, { recursive: true });
    // leftover of an interrupted run - fails as expected when nothing is mounted
    await execAsync(umountCmd);

    let mounted = false;
    let lastError = '';
    for (const { command, masked } of mountCommands(options, dir, separateMountPoint)) {
        log.debug(`NAS mount command: "${masked}"`);
        const result = await execAsync(command);
        if (!result.error) {
            mounted = true;
            break;
        }
        lastError = result.stderr || String(result.error);
    }
    if (!mounted) {
        let text = lastError;
        try {
            if (options.pass) {
                text = text.split(options.pass).join('****');
            }
        } catch {
            // ignore
        }
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw `Cannot mount "${dir}": ${text}`;
    }

    try {
        return await fn(separateMountPoint);
    } finally {
        const result = await execAsync(umountCmd);
        if (result.error) {
            // busy: detach it, the kernel finishes the unmount when the last file is closed
            await execAsync(`${options.sudo ? 'sudo umount' : 'umount'} -l ${separateMountPoint}`);
        }
        log.debug(`NAS: "${dir}" unmounted from ${separateMountPoint}`);
    }
}

/**
 * Removes the marker file that records an active mount
 *
 * @param options resolved storage settings
 * @param log adapter logger
 * @param markerPath file to unlink
 */
function dropMountMarker(options: CifsOptions, log: BackItUpLogger, markerPath: string): void {
    try {
        if (existsSync(`${options.fileDir}/.mount`)) {
            unlinkSync(markerPath);
        }
    } catch (e) {
        log.debug(`file ".mount" cannot deleted: ${e}`);
    }
}

/**
 * Writes the marker file that records an active mount
 *
 * @param options resolved storage settings
 * @param log adapter logger
 */
function writeMountMarker(options: CifsOptions, log: BackItUpLogger): void {
    try {
        writeFileSync(`${options.fileDir}/.mount`, options.mountType);
    } catch (e) {
        log.debug(`file ".mount" cannot created: ${e}`);
    }
}

function mount(options: CifsOptions, log: BackItUpLogger, callback?: MountCallback): void {
    let dir = options.dir as string;

    if (options.ownDir === true) {
        dir = options.dirMinimal;
    }

    if (existsSync(`${options.fileDir}/.mount`)) {
        exec(`mount | grep -o "${backupDir}"`, (_error, stdout) => {
            if (stdout.includes(backupDir)) {
                exec(`${options.sudo ? 'sudo umount' : 'umount'} ${backupDir}`, error => {
                    if (error) {
                        log.debug('device is busy... wait 2 Minutes!!');
                        setTimeout(() => {
                            exec(
                                `${options.sudo ? 'sudo umount' : 'umount'} -l ${backupDir}`,
                                (lazyError, _lazyStdout, lazyStderr) => {
                                    if (lazyError) {
                                        log.error(lazyStderr);
                                    } else {
                                        // Note the missing slash: this deletes `<fileDir>.mount`,
                                        // not `<fileDir>/.mount`, so the marker survives here.
                                        // Preserved - the marker drives the mount bookkeeping.
                                        dropMountMarker(options, log, `${options.fileDir}.mount`);
                                    }
                                },
                            );
                        }, 120000);
                    } else {
                        dropMountMarker(options, log, `${options.fileDir}/.mount`);
                    }
                });
            }
        });
    }

    if (options.mountType === 'CIFS') {
        if (!options.mount.startsWith('//')) {
            options.mount = `//${options.mount}`;
        }

        if (!dir.startsWith('/')) {
            dir = `/${dir}`;
        }

        if (
            (!options.pass.startsWith(`"`) || !options.pass.endsWith(`"`)) &&
            (!options.pass.startsWith(`'`) || !options.pass.endsWith(`'`))
        ) {
            options.pass = `"${options.pass}"`;
        }

        const common =
            `${options.cifsDomain ? `,domain=${options.cifsDomain}` : ''}` +
            `${options.clientInodes ? ',noserverino' : ''}` +
            `${options.cacheLoose ? ',cache=loose' : ''}` +
            `,rw,forceuid,uid=iobroker,forcegid,gid=iobroker,file_mode=0777,dir_mode=0777`;
        const credentials = options.user ? `username=${options.user},password=${options.pass}` : '';
        const masked = options.user ? `username=${options.user},password=****` : '';
        const mountCmd = `${options.sudo ? 'sudo mount' : 'mount'} -t cifs -o `;
        const target = ` ${options.mount}${dir} ${backupDir}`;

        log.debug(`cifs-mount command: "${mountCmd}${masked}${common},${options.smb}${target}"`);
        exec(`${mountCmd}${credentials}${common},${options.smb}${target}`, (error, stdout) => {
            if (error) {
                log.debug('first mount attempt with smb option failed. try next mount attempt without smb option ...');
                log.debug(`cifs-mount command: "${mountCmd}${masked}${common}${target}"`);
                exec(`${mountCmd}${credentials}${common}${target}`, (retryError, retryStdout) => {
                    if (retryError) {
                        // `ExecException` is declared as Omit<ErrnoException, 'code'>, which drops the
                        // nominal Error identity. The value really is an Error, so binding it as one
                        // keeps the formatted output identical to the previous `${error}`.
                        const failure: Error = retryError;
                        let errLog = String(failure);
                        try {
                            const formatPass = options.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                            errLog = errLog.replace(new RegExp(formatPass, 'g'), '****');
                        } catch {
                            // ignore
                        }
                        callback?.(errLog);
                    } else {
                        log.debug('mount successfully completed');
                        writeMountMarker(options, log);
                        callback?.(null, retryStdout);
                    }
                });
            } else {
                log.debug('mount successfully completed');
                writeMountMarker(options, log);
                callback?.(null, stdout);
            }
        });
    } else if (options.mountType === 'NFS') {
        if (!dir.startsWith('/')) {
            dir = `/${dir}`;
        }
        log.debug(`nfs-mount command: "${options.sudo ? 'sudo mount' : 'mount'} ${options.mount}:${dir} ${backupDir}"`);
        exec(`${options.sudo ? 'sudo mount' : 'mount'} ${options.mount}:${dir} ${backupDir}`, (error, stdout) => {
            if (error) {
                callback?.(error);
            } else {
                log.debug('mount successfully completed');
                writeMountMarker(options, log);
                callback?.(null, stdout);
            }
        });
    } else if (options.mountType === 'Expert') {
        log.debug(`expert-mount command: "${options.expertMount}"`);
        exec(options.expertMount, (error, stdout) => {
            if (error) {
                callback?.(error);
            } else {
                log.debug('expert-mount successfully completed');
                writeMountMarker(options, log);
                callback?.(null, stdout);
            }
        });
    } else {
        // Closed hang: for any other mount type none of the branches above ran and the callback
        // was never invoked, so the listing waited forever. Nothing was mounted, so this reports
        // success and the caller carries straight on to reading the directory.
        log.debug(`No mount needed for mount type "${String(options.mountType)}"`);
        callback?.(null);
    }
}

function umount(options: CifsOptions, log: BackItUpLogger, callback?: MountCallback): void {
    if (!options.mount) {
        callback?.('NO mount path specified!');
        return;
    }
    if (!existsSync(`${options.fileDir}/.mount`)) {
        // Closed hang: without the marker there is nothing mounted, and the callback used to be
        // dropped here, so the caller waited forever.
        log.debug('no mount marker present, umount not needed');
        callback?.(null);
        return;
    }

    exec(`mount | grep -o "${backupDir}"`, (_error, stdout) => {
        if (stdout.includes(backupDir)) {
            exec(`${options.sudo ? 'sudo umount' : 'umount'} ${backupDir}`, (error, umountStdout) => {
                if (error) {
                    log.debug('device is busy... wait 2 Minutes!!');
                    setTimeout(() => {
                        exec(
                            `${options.sudo ? 'sudo umount' : 'umount'} -l ${backupDir}`,
                            (lazyError, lazyStdout, lazyStderr) => {
                                if (lazyError) {
                                    log.error(lazyStderr);
                                    callback?.(lazyError);
                                } else {
                                    log.debug('umount successfully completed');
                                    dropMountMarker(options, log, `${options.fileDir}/.mount`);
                                    callback?.(null, lazyStdout);
                                }
                            },
                        );
                    }, 120000);
                } else {
                    log.debug('umount successfully completed');
                    dropMountMarker(options, log, `${options.fileDir}/.mount`);
                    callback?.(null, umountStdout);
                }
            });
        } else {
            log.debug('mount inactive, umount not started ...');
            dropMountMarker(options, log, `${options.fileDir}/.mount`);
            callback?.(null);
        }
    });
}
