'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {
    if (options.telegram.enabled &&
        options.adapter &&
        options.telegram.instance !== '' &&
        options.telegram.instance !== null &&
        options.telegram.instance !== undefined) {

        // Send Telegram Message
        if (options.debugging) {
            log.debug(`[${options.name}] used Telegram-Instance: ${options.telegram.instance}`);
        }

        // analyse here the info from options.context.error and  options.context.done
        console.log(JSON.stringify(options.context.error));
        console.log(JSON.stringify(options.context.done));

        let messageText = _('New %e Backup created on %t', options.telegram.systemLang);
        messageText = messageText.replace('%t', options.telegram.time).replace('%e', options.name);
        if (options.ftp && options.ftp.enabled) {
            const m = _(', and copied / moved via FTP to %h%d', options.telegram.systemLang);
            messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
        }

        if (options.cifs && options.cifs.enabled) {
            const m = _(', and stored under %h%d', options.telegram.systemLang);
            messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
        }

        if (options.dropbox && options.dropbox.enabled) {
            messageText +=_(', and stored in dropbox', options.telegram.systemLang);
        }

        messageText += '.';

        options.adapter.sendTo(options.telegram.instance, 'send', {text: 'BackItUp:\n' + messageText});
    }
    callback();
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};