'use strict';

async function storageSizeCheck(options, adapterName, log) {
    return new Promise(async (resolve) => {
        const storageSizeErr = options.config.fileSizeError || 512;
        const storageSizeWarn = options.config.fileSizeWarning || 1024;

        const adapterConf = await options.getForeignObjectAsync(`system.adapter.${adapterName}.${options.instance}`, 'state')
            .catch(err => log.error(err));

        if (adapterConf && adapterConf.common && adapterConf.common.host) {
            const _diskFree = await options.getForeignStateAsync(`system.host.${adapterConf.common.host}.diskFree`, 'state')
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
                if (options.telegramUser && options.telegramUser === 'allTelegramUsers') {
                    sendTo(options.telegramInstance, 'send', { text: 'BackItUp:\n' + sysMessage, disable_notification: options.telegramSilentNotice });
                } else {
                    sendTo(options.telegramInstance, 'send', { user: options.telegramUser, text: 'BackItUp:\n' + sysMessage, disable_notification: options.telegramSilentNotice });
                }
                break;
            case 'E-Mail':
                sendTo(options.emailInstance, 'send', { text: 'BackItUp:\n' + sysMessage, to: options.emailReceiver, subject: 'Backitup', from: options.emailSender });
                break;
            case 'Pushover':
                if (options.pushoverSilentNotice === 'true' || options.pushoverSilentNotice === true) {
                    sendTo(options.pushoverInstance, 'send', { message: 'BackItUp:\n' + sysMessage, sound: '', priority: -1, title: 'Backitup', device: options.pushoverDeviceID });
                } else {
                    sendTo(options.pushoverInstance, 'send', { message: 'BackItUp:\n' + sysMessage, sound: '', title: 'Backitup', device: options.pushoverDeviceID });
                }
                break;
            case 'WhatsApp':
                sendTo(options.whatsappInstance, 'send', { text: 'BackItUp:\n' + sysMessage });
                break;
            case 'Signal':
                sendTo(options.signalInstance, 'send', { text: 'BackItUp:\n' + sysMessage });
                break;
            case 'Matrix':
                sendTo(options.matrixInstance, 'send', { text: 'BackItUp:\n' + sysMessage });
                break;
        }
    }
}

module.exports = {
    storageSizeCheck,
    systemMessage
};