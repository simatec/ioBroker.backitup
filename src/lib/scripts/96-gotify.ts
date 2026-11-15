import { _, delay } from '../tools';
import { buildErrorMessage, nasHost, type NotificationOptions } from '../notificationText';
import type { BackItUpProps } from '../types';

interface GotifyOptions extends NotificationOptions {
    name: string;
    debugging?: boolean;
    adapter: ioBroker.Adapter;
    gotify: {
        enabled?: boolean;
        instance?: string | null;
        systemLang: string;
        time?: string;
        hostName?: string;
        onlyError?: boolean;
        NoticeType?: 'longGotifyNotice' | 'shortGotifyNotice';
        gotifyWaiting?: number;
    };
}

/**
 * Sends the notification for a finished run.
 *
 * @param props the run context and this step's slice of the config
 */
export async function run(props: BackItUpProps<GotifyOptions>): Promise<void> {
    const { context: ctx, options } = props;

    await delay(options.gotify.gotifyWaiting);

    if (
        options.gotify.enabled &&
        ctx.adapter &&
        options.gotify.instance !== '' &&
        options.gotify.instance !== null &&
        options.gotify.instance !== undefined
    ) {
        // Send Gotify Message
        if (options.debugging) {
            ctx.log.debug(`[${options.name}] used Gotify-Instance: ${options.gotify.instance}`);
        }

        // analyse here the info from ctx.errors and ctx.done
        const errors = Object.keys(ctx.errors);

        if (!errors.length) {
            let messageText = `${_('New %e Backup created on %t', options.gotify.systemLang)}.`;
            messageText = messageText
                .replace('%t', options.gotify.time as string)
                .replace(
                    '%e',
                    `${options.name}${options.name === 'iobroker' && options.gotify.hostName ? ` (${options.gotify.hostName})` : ''}`,
                );
            let storageOptions = '';

            // Deliberately not the shared buildStorageList: this variant guards its entries
            // differently - `options.onedrive` is dereferenced without a check, and the "Local"
            // line only appears when a CIFS block exists. Both are kept as found.
            if (options.gotify?.NoticeType === 'longGotifyNotice') {
                storageOptions = `\n\n${_('Storage location', options.gotify.systemLang)}:\n`;
                let storageNum = 1;
                if (options.ftp && options.ftp.enabled) {
                    const m = `${storageNum++}. ${_('FTP', options.gotify.systemLang)} (%h%d)%k`;
                    storageOptions += m
                        .replace('%h', options.ftp.host as string)
                        .replace('%d', options.ftp.dir as string)
                        .replace('%k', '\n');
                }

                if (options.cifs && options.cifs.enabled) {
                    const m = `${storageNum++}. ${_(`NAS (${options.cifs.mountType})`, options.gotify.systemLang)} (%h%d)%k`;
                    storageOptions += m
                        .replace('%h', nasHost(options.cifs))
                        .replace('%d', options.cifs.dir as string)
                        .replace('%k', '\n');
                }

                if (options.dropbox && options.dropbox.enabled) {
                    const m = `${storageNum++}. ${_('Dropbox', options.gotify.systemLang)} (%d)%k`;
                    storageOptions += m.replace('%d', options.dropbox.dir as string).replace('%k', '\n');
                }

                // No optional chaining here - throws when onedrive is missing entirely, as before.
                if (options.onedrive!.enabled) {
                    const m = `${storageNum++}. ${_('OneDrive', options.gotify.systemLang)} (%d)%k`;
                    storageOptions += m.replace('%d', options.onedrive!.dir as string).replace('%k', '\n');
                }

                if (options.googledrive && options.googledrive.enabled) {
                    const m = `${storageNum++}. ${_('Google Drive', options.gotify.systemLang)} (%d)%k`;
                    storageOptions += m.replace('%d', options.googledrive.dir as string).replace('%k', '\n');
                }

                if (options.webdav && options.webdav.enabled) {
                    const m = `${storageNum++}. ${_('WebDAV', options.gotify.systemLang)} (%d)%k`;
                    storageOptions += m.replace('%d', options.webdav.dir as string).replace('%k', '\n');
                }

                if (options.cifs && !options.cifs.enabled) {
                    const m = `${storageNum++}. ${_('Local', options.gotify.systemLang)} (%d)%k`;
                    storageOptions += m.replace('%d', options.backupDir).replace('%k', '\n');
                }
            }

            messageText += storageOptions;

            // The `=== 'false'` arm covers instance configurations that stored the flag as a string.
            if (options.gotify.onlyError === false || (options.gotify.onlyError as unknown) === 'false') {
                ctx.adapter.sendTo(options.gotify.instance, 'send', {
                    priority: 4,
                    title: 'Backitup:',
                    contentType: 'text/markdown',
                    message: messageText,
                });
            }
        } else {
            let errorMessage = buildErrorMessage(ctx, options, options.gotify.systemLang);

            // Active here, unlike in most channels.
            try {
                errorMessage = errorMessage.replaceAll('undefined', '');
            } catch {
                // ignore
            }

            ctx.adapter.sendTo(options.gotify.instance, 'send', {
                priority: 4,
                title: 'Backitup:',
                contentType: 'text/markdown',
                message: errorMessage,
            });
        }
    }
}

export const ignoreErrors = true;
export const afterBackup = true;
