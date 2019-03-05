'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {

    let waitToSend = 500;

    if (options.email.stopIoB === true && options.name == 'total') {
        waitToSend = 5000;
    }

    setTimeout(function() {
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

                if (options.email.onlyError === false || options.email.onlyError === 'false') {
                    options.adapter.sendTo(options.email.instance, 'send', {text: 'BackItUp:\n' + messageText, to: options.email.emailReceiver, subject: 'Backitup', from: options.email.emailSender});
                }
            } else {

                let errorMessage = _('Your backup was not completely created. Please check the errors!!', options.email.systemLang);
                
                errorMessage += '\n';

                if (options.context.errors.mount) {
                    errorMessage += '\nmount: ' + options.context.errors.mount;
                }
                if (options.context.errors.minimal) {
                    errorMessage += '\nminimal: ' + options.context.errors.minimal;
                }
                if (options.context.errors.total) {
                    errorMessage += '\ntotal: ' + options.context.errors.total;
                }
                if (options.context.errors.redis) {
                    errorMessage += '\nredis: ' + options.context.errors.redis;
                }
                if (options.context.errors.mysql) {
                    errorMessage += '\nmysql: ' + options.context.errors.mysql;
                }
                if (options.context.errors.ccu) {
                    errorMessage += '\nccu: ' + options.context.errors.ccu;
                }
                if (options.context.errors.ftp) {
                    errorMessage += '\nftp: ' + options.context.errors.ftp;
                }
                if (options.context.errors.dropbox) {
                    errorMessage += '\ndropbox: ' + options.context.errors.dropbox;
                }
                if (options.context.errors.cifs) {
                    errorMessage += '\ncifs: ' + options.context.errors.cifs;
                }
                if (options.context.errors.clean) {
                    errorMessage += '\nclean: ' + options.context.errors.clean;
                }
                if (options.context.errors.umount) {
                    errorMessage += '\numount: ' + options.context.errors.umount;
                }

                options.adapter.sendTo(options.email.instance, 'send', {text: 'BackItUp:\n' + errorMessage, to: options.email.emailReceiver, subject: 'Backitup', from: options.email.emailSender});
            }
            
        }
        callback();
    }, waitToSend);
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};