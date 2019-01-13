'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {
    if (options.email.enabled &&
        options.adapter &&
        options.email.instance !== '' &&
        options.email.instance !== null &&
        options.email.instance !== undefined) {

        // Send E-Mail Message
        if (options.debugging) {
            log.debug(`[${options.name}] used E-Mail-Instance: ${options.email.instance}`);
        }

        // analyse here the info from options.context.error and  options.context.done
        console.log(JSON.stringify(options.context.errors));
        console.log(JSON.stringify(options.context.done));

        if (JSON.stringify(options.context.errors) == '{}') {

            let messageText = _('New %e Backup created on %t', options.email.systemLang);
            messageText = messageText.replace('%t', options.email.time).replace('%e', options.name);
            if (options.ftp && options.ftp.enabled && options.email.NoticeType == 'longEmailNotice') {
                const m = _(', and copied / moved via FTP to %h%d', options.email.systemLang);
                messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
            }

            if (options.cifs && options.cifs.enabled && options.email.NoticeType == 'longEmailNotice') {
                const m = _(', and stored under %h%d', options.email.systemLang);
                messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
            }

            if (options.dropbox && options.dropbox.enabled && options.email.NoticeType == 'longEmailNotice') {
                messageText +=_(', and stored in dropbox', options.email.systemLang);
            }

            messageText += '.';
            
            options.adapter.sendTo(options.email.instance, 'send', {text: 'BackItUp:\n' + messageText, to: options.email.emailReceiver, subject: 'Backitup', from: options.email.emailSender});
        } else {
            let errorMessage = JSON.stringify(options.context.errors);
            let errorType = errorMessage.split('"');
            log.debug(errorType[1]);
            let messageText = _('You have ' + errorType[1] + ' errors.\nPlease check your Log-File!!', options.email.systemLang);
            options.adapter.sendTo(options.email.instance, 'send', {text: 'BackItUp:\n' + messageText, to: options.email.emailReceiver, subject: 'Backitup', from: options.email.emailSender});
        }
    }
    callback();
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};