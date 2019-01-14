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
        console.log(JSON.stringify(options.context.errors));
        console.log(JSON.stringify(options.context.done));

        if (JSON.stringify(options.context.errors) == '{}') {

            let messageText = _('New %e Backup created on %t', options.telegram.systemLang);
            messageText = messageText.replace('%t', options.telegram.time).replace('%e', options.name);
            if (options.ftp && options.ftp.enabled && options.telegram.NoticeType == 'longTelegramNotice') {
                const m = _(', and copied / moved via FTP to %h%d', options.telegram.systemLang);
                messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
            }

            if (options.cifs && options.cifs.enabled && options.telegram.NoticeType == 'longTelegramNotice') {
                const m = _(', and stored under %h%d', options.telegram.systemLang);
                messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
            }

            if (options.dropbox && options.dropbox.enabled && options.telegram.NoticeType == 'longTelegramNotice') {
                messageText +=_(', and stored in dropbox', options.telegram.systemLang);
            }

            messageText += '.';
            
            if (options.telegram.User && options.telegram.User == 'allTelegramUsers') {
                options.adapter.sendTo(options.telegram.instance, 'send', {text: 'BackItUp:\n' + messageText, disable_notification: options.telegram.SilentNotice});
            } else {
                options.adapter.sendTo(options.telegram.instance, 'send', {user:options.telegram.User, text: 'BackItUp:\n' + messageText, disable_notification: options.telegram.SilentNotice});
            }
        } else {

            let errorMessage = _('Your backup was not completely created. Please check the errors!!', options.telegram.systemLang);
            
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
            
            if (options.telegram.User && options.telegram.User == 'allTelegramUsers') {
                options.adapter.sendTo(options.telegram.instance, 'send', {text: 'BackItUp:\n' + errorMessage, disable_notification: options.telegram.SilentNotice});
            } else {
                options.adapter.sendTo(options.telegram.instance, 'send', {user:options.telegram.User, text: 'BackItUp:\n' + errorMessage, disable_notification: options.telegram.SilentNotice});
            }
        }
    }
    callback();
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};