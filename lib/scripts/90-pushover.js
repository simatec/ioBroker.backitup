'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {

    setTimeout(function() {
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

            if (JSON.stringify(options.context.errors) == '{}') {

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
                
                if (options.pushover.onlyError === false || options.pushover.onlyError === 'false') {
                    if (options.pushover.SilentNotice === 'true' || options.pushover.SilentNotice === true){
                        options.adapter.sendTo(options.pushover.instance, 'send', {message: 'BackItUp:\n' + messageText, sound: '', priority: -1, title: 'Backitup', device: options.pushover.deviceID});
                    } else {
                        options.adapter.sendTo(options.pushover.instance, 'send', {message: 'BackItUp:\n' + messageText, sound: '', title: 'Backitup', device: options.pushover.deviceID});
                    }
                }
            } else {

                let errorMessage = _('Your backup was not completely created. Please check the errors!!', options.pushover.systemLang);
                
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
                
                if (options.pushover.SilentNotice === 'true' || options.pushover.SilentNotice === true){
                    options.adapter.sendTo(options.pushover.instance, 'send', {message: 'BackItUp:\n' + errorMessage, sound: '', priority: -1, title: 'Backitup', device: options.pushover.deviceID});
                } else {
                    options.adapter.sendTo(options.pushover.instance, 'send', {message: 'BackItUp:\n' + errorMessage, sound: '', title: 'Backitup', device: options.pushover.deviceID});
                }
            }
        }
        callback();
    }, options.pushover.pushoverWaiting);
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};