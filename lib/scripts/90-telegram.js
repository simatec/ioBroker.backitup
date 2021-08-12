'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {

    setTimeout(function () {
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

            if (JSON.stringify(options.context.errors) === '{}') {

                let messageText = _('New %e Backup created on %t', options.telegram.systemLang);
                messageText = messageText.replace('%t', options.telegram.time).replace('%e', `${options.name} ${options.name === 'iobroker' && options.telegram.hostName ? `(${options.telegram.hostName})` : ''}`);
                if (options.ftp && options.ftp.enabled && options.telegram.NoticeType === 'longTelegramNotice') {
                    const m = _(', and copied / moved via FTP to %h%d', options.telegram.systemLang);
                    messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
                }

                if (options.cifs && options.cifs.enabled && options.telegram.NoticeType === 'longTelegramNotice') {
                    const m = _(', and stored under %h%d', options.telegram.systemLang);
                    messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
                }

                if (options.dropbox && options.dropbox.enabled && options.telegram.NoticeType === 'longTelegramNotice') {
                    messageText += _(', and stored in dropbox', options.telegram.systemLang);
                }

                if (options.googledrive && options.googledrive.enabled && options.telegram.NoticeType === 'longTelegramNotice') {
                    messageText += _(', and stored in google drive', options.telegram.systemLang);
                }
                if (options.webdav && options.webdav.enabled && options.telegram.NoticeType === 'longTelegramNotice') {
                    messageText += _(', and stored in webdav', options.telegram.systemLang);
                }

                messageText += '.';

                if (options.telegram.onlyError === false || options.telegram.onlyError === 'false') {
                    if (options.telegram.User && options.telegram.User === 'allTelegramUsers') {
                        options.adapter.sendTo(options.telegram.instance, 'send', { text: 'BackItUp:\n' + messageText, disable_notification: options.telegram.SilentNotice });
                    } else {
                        options.adapter.sendTo(options.telegram.instance, 'send', { user: options.telegram.User, text: 'BackItUp:\n' + messageText, disable_notification: options.telegram.SilentNotice });
                    }
                }
            } else {

                let errorMessage = _('Your backup was not completely created. Please check the errors!!', options.telegram.systemLang);

                errorMessage += '\n';

                if (options.context.errors.mount) {
                    errorMessage += '\nmount: ' + options.context.errors.mount;
                    errorMessage = (options.cifs ? errorMessage.replace(new RegExp(options.cifs.pass, 'g'), "****") : errorMessage);
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
                if (options.context.errors.influxDB) {
                    errorMessage += '\ninfluxDB: ' + options.context.errors.influxDB;
                }
                if (options.context.errors.mysql) {
                    errorMessage += '\nmysql: ' + options.context.errors.mysql;
                    errorMessage = (options.mysql ? errorMessage.replace(new RegExp(options.mysql.pass, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.grafana) {
                    errorMessage += '\ngrafana: ' + options.context.errors.grafana;
                    errorMessage = (options.grafana ? errorMessage.replace(new RegExp(options.grafana.pass, 'g'), "****") : errorMessage);
                    errorMessage = (options.grafana ? errorMessage.replace(new RegExp(options.grafana.apiKey, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.javascripts) {
                    errorMessage += '\njavascripts: ' + options.context.errors.javascripts;
                }
                if (options.context.errors.jarvis) {
                    errorMessage += '\njarvis: ' + options.context.errors.jarvis;
                }
                if (options.context.errors.webdav) {
                    errorMessage += '\nwebdav: ' + options.context.errors.webdav;
                    errorMessage = (options.webdav ? errorMessage.replace(new RegExp(options.webdav.pass, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.pgsql) {
                    errorMessage += '\npgsql: ' + options.context.errors.pgsql;
                    errorMessage = (options.pgsql ? errorMessage.replace(new RegExp(options.pgsql.pass, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.ccu) {
                    errorMessage += '\nccu: ' + options.context.errors.ccu;
                    errorMessage = (options.ccu ? errorMessage.replace(new RegExp(options.ccu.pass, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.ftp) {
                    errorMessage += '\nftp: ' + options.context.errors.ftp;
                    errorMessage = (options.ftp ? errorMessage.replace(new RegExp(options.ftp.pass, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.dropbox) {
                    errorMessage += '\ndropbox: ' + options.context.errors.dropbox;
                    errorMessage = (options.dropbox ? errorMessage.replace(new RegExp(options.dropbox.accessToken, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.googledrive) {
                    errorMessage += '\ngoogledrive: ' + options.context.errors.googledrive;
                    errorMessage = (options.googledrive ? errorMessage.replace(new RegExp(options.googledrive.accessJson, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.cifs) {
                    errorMessage += '\ncifs: ' + options.context.errors.cifs;
                    errorMessage = (options.cifs ? errorMessage.replace(new RegExp(options.cifs.pass, 'g'), "****") : errorMessage);
                }
                if (options.context.errors.clean) {
                    errorMessage += '\nclean: ' + options.context.errors.clean;
                }
                if (options.context.errors.umount) {
                    errorMessage += '\numount: ' + options.context.errors.umount;
                    errorMessage = (options.cifs ? errorMessage.replace(new RegExp(options.cifs.pass, 'g'), "****") : errorMessage);
                }

                if (options.telegram.User && options.telegram.User === 'allTelegramUsers') {
                    options.adapter.sendTo(options.telegram.instance, 'send', { text: 'BackItUp:\n' + errorMessage, disable_notification: options.telegram.SilentNotice });
                } else {
                    options.adapter.sendTo(options.telegram.instance, 'send', { user: options.telegram.User, text: 'BackItUp:\n' + errorMessage, disable_notification: options.telegram.SilentNotice });
                }
            }
        }
        callback && callback();
    }, options.telegram.telegramWaiting);
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};