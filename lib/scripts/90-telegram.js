'use strict';

function command(options, log, callback) {
    if (options.telegram.enabled &&
        options.telegram.instance !== '' &&
        options.telegram.instance !== null &&
        options.telegram.instance !== undefined) {

        const _ = options.telegram._;

        // Send Telegram Message
        if (options.telegram.debugging) {
            log.debug(`[${options.name}] used Telegram-Instance: ${options.telegram.instance}`);
        }
        let messageText = options.telegram._('New %e Backup created on %t');
        messageText = messageText.replace('%t', options.telegram.time).replace('%e', options.name);
        if (options.ftp && options.ftp.enabled === 'FTP') {
            const m = _(', and copied / moved via FTP to %h%d');
            messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
        }

        if (options.cifs && options.cifs.enabled === 'CIFS') {
            const m = _(', and stored under %h%d');
            messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
        }
        messageText += '!';

        options.telegram.sendTo(options.telegram.instance, 'send', {text: 'BackItUp:\n' + messageText});
    }
    callback();
}

module.exports = {
    command,
    ignoreErrors: true
};