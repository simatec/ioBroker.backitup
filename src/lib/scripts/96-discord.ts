import { _, delay } from '../tools';
import { buildErrorMessage, buildStorageList, type NotificationOptions } from '../notificationText';
import type { BackItUpLogger, BackItUpProps } from '../types';

interface DiscordOptions extends NotificationOptions {
    name: string;
    debugging?: boolean;
    discord: {
        enabled?: boolean;
        instance?: string | null;
        systemLang: string;
        time?: string;
        hostName?: string;
        /** either a user id, or `<serverId>/<channelId>` */
        target?: string;
        NoticeType?: 'longDiscordNotice' | 'shortDiscordNotice';
        discordWaiting?: number;
    };
}

/**
 * Sends the notification for a finished run.
 *
 * @param props the run context and this step's slice of the config
 */
export async function run(props: BackItUpProps<DiscordOptions>): Promise<void> {
    const { context: ctx, options } = props;

    await delay(options.discord.discordWaiting);

    if (
        options.discord.enabled &&
        options.discord.target &&
        ctx.adapter &&
        options.discord.instance !== '' &&
        options.discord.instance !== null &&
        options.discord.instance !== undefined
    ) {
        // Send Discord Message
        if (options.debugging) {
            ctx.log.debug(`[${options.name}] used Discord-Instance: ${options.discord.instance}`);
        }

        // analyse here the info from ctx.errors and ctx.done
        const errors = Object.keys(ctx.errors);

        if (!errors.length) {
            let messageText = `${_('New %e Backup created on %t', options.discord.systemLang)}.`;
            messageText = messageText
                .replace('%t', options.discord.time as string)
                .replace(
                    '%e',
                    `${options.name}${options.name === 'iobroker' && options.discord.hostName ? ` (${options.discord.hostName})` : ''}`,
                );

            if (options.discord?.NoticeType === 'longDiscordNotice') {
                messageText += buildStorageList(options, options.discord.systemLang, true);
            }

            // Note: unlike the other channels this one has no `onlyError` check and always sends.
            sendMessage(ctx.adapter, options, ctx.log, messageText);
        } else {
            let errorMessage = buildErrorMessage(ctx, options, options.discord.systemLang);

            // Active here, unlike in most channels.
            try {
                errorMessage = errorMessage.replaceAll('undefined', '');
            } catch {
                // ignore
            }

            sendMessage(ctx.adapter, options, ctx.log, errorMessage);
        }
    }
}

/**
 * Delivers to a single user or to a server channel, depending on how `target` is written.
 *
 * @param adapter the running adapter - the run context carries it, the options do not
 * @param options script options
 * @param log adapter logger
 * @param message text to deliver
 */
function sendMessage(adapter: ioBroker.Adapter, options: DiscordOptions, log: BackItUpLogger, message: string): void {
    const target = options.discord.target as string;

    if (target.match(/^\d+$/)) {
        // send to a single user
        adapter.sendTo(
            options.discord.instance as string,
            'sendMessage',
            {
                userId: target,
                content: `**Backitup**:\n${message}`,
            },
            (ret: any) => {
                if (ret?.err) {
                    log.warn(`Error sending Discord message: ${ret.err}`);
                }
            },
        );
    } else if (target.match(/^\d+\/\d+$/)) {
        // send to a server channel
        const [serverId, channelId] = target.split('/');
        adapter.sendTo(
            options.discord.instance as string,
            'sendMessage',
            {
                serverId,
                channelId,
                content: `**Backitup**:\n${message}`,
            },
            (ret: any) => {
                if (ret?.err) {
                    log.warn(`Error sending Discord message: ${ret.err}`);
                }
            },
        );
    }
}

export const ignoreErrors = true;
export const afterBackup = true;
