'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {

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

            if (JSON.stringify(options.context.errors) === '{}') {

                let messageText = _('New %e Backup created on %t', options.email.systemLang);
                messageText = messageText.replace('%t', options.email.time).replace('%e', options.name);
                if (options.ftp && options.ftp.enabled && options.email.NoticeType === 'longEmailNotice') {
                    const m = _(', and copied / moved via FTP to %h%d', options.email.systemLang);
                    messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
                }

                if (options.cifs && options.cifs.enabled && options.email.NoticeType === 'longEmailNotice') {
                    const m = _(', and stored under %h%d', options.email.systemLang);
                    messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
                }

                if (options.dropbox && options.dropbox.enabled && options.email.NoticeType === 'longEmailNotice') {
                    messageText +=_(', and stored in dropbox', options.email.systemLang);
                }

                if (options.googledrive && options.googledrive.enabled && options.email.NoticeType === 'longEmailNotice') {
                    messageText +=_(', and stored in google drive', options.email.systemLang);
                }

                messageText += '.';

                if (options.email.onlyError === false || options.email.onlyError === 'false') {
                    options.adapter.sendTo(options.email.instance, 'send', {text: 'BackItUp:\n' + messageText, to: options.email.emailReceiver, subject: 'Backitup', from: options.email.emailSender});
                }
            } else {

                let errorMessage = _('Your backup was not completely created. Please check the errors!!', options.email.systemLang);
                
                errorMessage += '\n';

                if (options.context.errors.mount && options.cifs.pass) {
                    errorMessage += '\nmount: ' + options.context.errors.mount;
                    errorMessage = errorMessage.replace(new RegExp(options.cifs.pass, 'g'), "****");
                }
                if (options.context.errors.iobroker) {
                    errorMessage += '\niobroker: ' + options.context.errors.iobroker;
                }
                if (options.context.errors.redis) {
                    errorMessage += '\nredis: ' + options.context.errors.redis;
                }
                if (options.context.errors.historyDB) {
                    errorMessage += '\nhistoryDB: ' + options.context.errors.historyDB;
                }
                if (options.context.errors.mysql && options.mysql.pass) {
                    errorMessage += '\nmysql: ' + options.context.errors.mysql;
                    errorMessage = errorMessage.replace(new RegExp(options.mysql.pass, 'g'), "****");
                }
                if (options.context.errors.ccu && options.ccu.pass) {
                    errorMessage += '\nccu: ' + options.context.errors.ccu;
                    errorMessage = errorMessage.replace(new RegExp(options.ccu.pass, 'g'), "****");
                }
                if (options.context.errors.ftp && options.ftp.pass) {
                    errorMessage += '\nftp: ' + options.context.errors.ftp;
                    errorMessage = errorMessage.replace(new RegExp(options.ftp.pass, 'g'), "****");
                }
                if (options.context.errors.dropbox && options.dropbox.accessToken) {
                    errorMessage += '\ndropbox: ' + options.context.errors.dropbox;
                    errorMessage = errorMessage.replace(new RegExp(options.dropbox.accessToken, 'g'), "****");
                }
                if (options.context.errors.googledrive && options.googledrive.accessJson) {
                    errorMessage += '\ngoogledrive: ' + options.context.errors.googledrive;
                    errorMessage = errorMessage.replace(new RegExp(options.googledrive.accessJson, 'g'), "****");
                }
                if (options.context.errors.cifs && options.cifs.pass) {
                    errorMessage += '\ncifs: ' + options.context.errors.cifs;
                    errorMessage = errorMessage.replace(new RegExp(options.cifs.pass, 'g'), "****");
                }
                if (options.context.errors.clean) {
                    errorMessage += '\nclean: ' + options.context.errors.clean;
                }
                if (options.context.errors.umount && options.cifs.pass) {
                    errorMessage += '\numount: ' + options.context.errors.umount;
                    errorMessage = errorMessage.replace(new RegExp(options.cifs.pass, 'g'), "****");
                }

                options.adapter.sendTo(options.email.instance, 'send', {text: 'BackItUp:\n' + errorMessage, to: options.email.emailReceiver, subject: 'Backitup', from: options.email.emailSender});
            }
            
        }
        callback();
    }, options.email.emailWaiting);
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};