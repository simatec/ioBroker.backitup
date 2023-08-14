'use strict';

async function storageSizeCheck(options, adapterName, log) {
    return new Promise(async (resolve) => {
        const storageSizeErr = options.config.fileSizeError || 512;
        const storageSizeWarn = options.config.fileSizeWarning || 1024;

        const adapterConf = await options.getForeignObjectAsync(`system.adapter.${adapterName}.${options.instance}`)
            .catch(err => log.error(err));

        if (adapterConf && adapterConf.common && adapterConf.common.host) {
            const _diskFree = await options.getForeignStateAsync(`system.host.${adapterConf.common.host}.diskFree`)
                .catch(err => log.error(err));

            if (_diskFree && _diskFree.val) {

                const sysCheck = {
                    diskState: _diskFree.val > storageSizeWarn ? 'ok' : _diskFree.val > storageSizeErr ? 'warn' : 'error',
                    diskFree: _diskFree.val,
                    storage: options.config.cifsEnabled ? 'nas' : 'local',
                    ready: options.config.cifsEnabled || _diskFree.val > storageSizeErr ? true : false
                };

                switch (sysCheck.diskState) {
                    case 'ok':
                        log.debug(`The local storage check was completed successfully. On the host "${adapterConf.common.host}" are currently ${_diskFree.val} MB free space available!`);
                        break;
                    case 'warn':
                        log.warn(`On the host "${adapterConf.common.host}" only ${_diskFree.val} MB free space is available! Please check your system!`);
                        break;
                    case 'error':
                        log.error(`On the host "${adapterConf.common.host}" only ${_diskFree.val} MB free space is available! Local backups are currently not possible. Please check your system!`);
                        break;
                }

                resolve(sysCheck);
            }
        }
    });
}

function systemMessage(options, sendTo, sysMessage) {
    if (options.notificationEnabled) {
        switch (options.notificationsType) {
            case 'Telegram':
                if (options.telegramUser && options.telegramUser === 'allTelegramUsers' && options.telegramInstance) {
                    sendTo(options.telegramInstance, 'send', { text: 'BackItUp:\n' + sysMessage, disable_notification: options.telegramSilentNotice });
                } else if (options.telegramInstance) {
                    sendTo(options.telegramInstance, 'send', { user: options.telegramUser, text: 'BackItUp:\n' + sysMessage, disable_notification: options.telegramSilentNotice });
                }
                break;
            case 'E-Mail':
                if (options.emailInstance && options.emailReceiver && options.emailSender) {
                    sendTo(options.emailInstance, 'send', { text: 'BackItUp:\n' + sysMessage, to: options.emailReceiver, subject: 'Backitup', from: options.emailSender });
                }
                break;
            case 'Pushover':
                if ((options.pushoverSilentNotice === 'true' || options.pushoverSilentNotice === true) && options.pushoverInstance && options.pushoverDeviceID) {
                    sendTo(options.pushoverInstance, 'send', { message: 'BackItUp:\n' + sysMessage, sound: '', priority: -1, title: 'Backitup', device: options.pushoverDeviceID });
                } else if (options.pushoverInstance && options.pushoverDeviceID) {
                    sendTo(options.pushoverInstance, 'send', { message: 'BackItUp:\n' + sysMessage, sound: '', title: 'Backitup', device: options.pushoverDeviceID });
                }
                break;
            case 'WhatsApp':
                if (options.whatsappInstance) {
                    sendTo(options.whatsappInstance, 'send', { text: 'BackItUp:\n' + sysMessage });
                }
                break;
            case 'Signal':
                if (options.signalInstance) {
                    sendTo(options.signalInstance, 'send', { text: 'BackItUp:\n' + sysMessage });
                }
                break;
            case 'Matrix':
                if (options.matrixInstance) {
                    sendTo(options.matrixInstance, 'BackItUp:\n' + sysMessage);
                }
                break;
            case 'Discord':
                if (options.discordInstance && options.discordTarget) {
                    if (options.discordTarget.match(/^\d+$/)) {
                        // send to a single user
                        sendTo(options.discordInstance, 'sendMessage', {
                            userId: options.discordTarget,
                            content: '**BackItUp**:\n' + sysMessage,
                        }, (ret) => {
                            if (ret.err) {
                                log.warn(`Error sending Discord message: ${ret.err}`);
                            }
                        });
                    } else if (options.discordTarget.match(/^\d+\/\d+$/)) {
                        // send to a server channel
                        const [ serverId, channelId ] = options.discordTarget.split('/');
                        sendTo(options.discordInstance, 'sendMessage', {
                            serverId,
                            channelId,
                            content: '**BackItUp**:\n' + sysMessage,
                        }, (ret) => {
                            if (ret.err) {
                                log.warn(`Error sending Discord message: ${ret.err}`);
                            }
                        });
                    }
                }
                break;
        }
    }
}

module.exports = {
    storageSizeCheck,
    systemMessage
};