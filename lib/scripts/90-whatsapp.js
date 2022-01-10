'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {

    setTimeout(function () {
        if (options.whatsapp.enabled &&
            options.adapter &&
            options.whatsapp.instance !== '' &&
            options.whatsapp.instance !== null &&
            options.whatsapp.instance !== undefined) {

            // Send Whatsapp Message
            if (options.debugging) {
                log.debug(`[${options.name}] used WhatsApp-Instance: ${options.whatsapp.instance}`);
            }

            // analyse here the info from options.context.error and  options.context.done
            console.log(JSON.stringify(options.context.errors));
            console.log(JSON.stringify(options.context.done));

            if (JSON.stringify(options.context.errors) === '{}') {

                let messageText = _('New %e Backup created on %t', options.whatsapp.systemLang);
                messageText = messageText.replace('%t', options.whatsapp.time).replace('%e', `${options.name} ${options.name === 'iobroker' && options.whatsapp.hostName ? `(${options.whatsapp.hostName})` : ''}`);
                if (options.ftp && options.ftp.enabled && options.whatsapp.NoticeType === 'longWhatsappNotice') {
                    const m = _(', and copied / moved via FTP to %h%d', options.whatsapp.systemLang);
                    messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
                }

                if (options.cifs && options.cifs.enabled && options.whatsapp.NoticeType === 'longWhatsappNotice') {
                    const m = _(', and stored under %h%d', options.whatsapp.systemLang);
                    messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
                }

                if (options.dropbox && options.dropbox.enabled && options.whatsapp.NoticeType === 'longWhatsappNotice') {
                    messageText += _(', and stored in dropbox', options.whatsapp.systemLang);
                }

                if (options.googledrive && options.googledrive.enabled && options.whatsapp.NoticeType === 'longWhatsappNotice') {
                    messageText += _(', and stored in google drive', options.whatsapp.systemLang);
                }

                if (options.webdav && options.webdav.enabled && options.whatsapp.NoticeType === 'longWhatsappNotice') {
                    messageText += _(', and stored in webdav', options.whatsapp.systemLang);
                }

                messageText += '.';

                if (options.whatsapp.onlyError === false || options.whatsapp.onlyError === 'false') {
                    options.adapter.sendTo(options.whatsapp.instance, 'send', { text: 'BackItUp:\n' + messageText });
                }
            } else {

                let errorMessage = _('Your backup was not completely created. Please check the errors!!', options.whatsapp.systemLang);

                errorMessage += '\n';

                if (options.context.errors.mount) {
                    errorMessage += '\nmount: ' + options.context.errors.mount;
                    try {
                        const formatPass = options.cifs.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.cifs ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
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
                    try {
                        const formatPass = options.mysql.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.mysql ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.grafana) {
                    errorMessage += '\ngrafana: ' + options.context.errors.grafana;
                    try {
                        const formatPass = options.grafana.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.grafana ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);

                        const formatApiKey = options.grafana.apiKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.grafana ? errorMessage.replace(new RegExp(formatApiKey, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.javascripts) {
                    errorMessage += '\njavascripts: ' + options.context.errors.javascripts;
                }
                if (options.context.errors.jarvis) {
                    errorMessage += '\njarvis: ' + options.context.errors.jarvis;
                }
                if (options.context.errors.webdav) {
                    errorMessage += '\nwebdav: ' + options.context.errors.webdav;
                    try {
                        const formatPass = options.webdav.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.webdav ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.pgsql) {
                    errorMessage += '\npgsql: ' + options.context.errors.pgsql;
                    try {
                        const formatPass = options.pgsql.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.pgsql ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.ccu) {
                    errorMessage += '\nccu: ' + options.context.errors.ccu;
                    try {
                        const formatPass = options.ccu.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.ccu ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.ftp) {
                    errorMessage += '\nftp: ' + options.context.errors.ftp;
                    try {
                        const formatPass = options.ftp.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.ftp ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.dropbox) {
                    errorMessage += '\ndropbox: ' + options.context.errors.dropbox;
                    try {
                        const formatPass = options.dropbox.accessToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.dropbox ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.googledrive) {
                    errorMessage += '\ngoogledrive: ' + options.context.errors.googledrive;
                    try {
                        const formatPass = options.googledrive.accessJson.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.googledrive ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }

                }
                if (options.context.errors.cifs) {
                    errorMessage += '\ncifs: ' + options.context.errors.cifs;
                    try {
                        const formatPass = options.cifs.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.cifs ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.clean) {
                    errorMessage += '\nclean: ' + options.context.errors.clean;
                }
                if (options.context.errors.umount) {
                    errorMessage += '\numount: ' + options.context.errors.umount;
                    try {
                        const formatPass = options.cifs.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.cifs ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }

                options.adapter.sendTo(options.whatsapp.instance, 'send', { text: 'BackItUp:\n' + errorMessage });
            }
        }
        callback && callback();
    }, options.whatsapp.whatsappWaiting);
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};