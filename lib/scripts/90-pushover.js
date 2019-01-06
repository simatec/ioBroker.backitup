'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {
    if (options.pushover.enabled &&
        options.adapter &&
        options.pushover.instance !== '' &&
        options.pushover.instance !== null &&
        options.pushover.instance !== undefined) {

        // Send pushover Message
        if (options.debugging) {
            log.debug(`[${options.name}] used pushover-Instance: ${options.pushover.instance}`);
        }
        
        // analyse here the info from options.context.error and  options.context.done
        console.log(JSON.stringify(options.context.errors));
        console.log(JSON.stringify(options.context.done));

        let messageText = _('New %e Backup created on %t', options.pushover.systemLang);
        messageText = messageText.replace('%t', options.pushover.time).replace('%e', options.name);
        if (options.ftp && options.ftp.enabled && options.pushover.NoticeType == 'longPushoverNotice') {
            const m = _(', and copied / moved via FTP to %h%d', options.pushover.systemLang);
            messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
        }

        if (options.cifs && options.cifs.enabled && options.pushover.NoticeType == 'longPushoverNotice') {
            const m = _(', and stored under %h%d', options.pushover.systemLang);
            messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
        }

        if (options.dropbox && options.dropbox.enabled && options.pushover.NoticeType == 'longPushoverNotice') {
            messageText +=_(', and stored in dropbox', options.pushover.systemLang);
        }

        messageText += '.';
        if(options.pushover.SilentNotice === 'true' || options.pushover.SilentNotice === true){
            options.adapter.sendTo(options.pushover.instance, 'send', {message: 'BackItUp:\n' + messageText, sound: '', priority: -1, title: 'Backitup', device: options.pushover.deviceID});
        }else{
            options.adapter.sendTo(options.pushover.instance, 'send', {message: 'BackItUp:\n' + messageText, sound: '', title: 'Backitup', device: options.pushover.deviceID});
        }
    }
    callback();
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};