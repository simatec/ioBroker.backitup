'use strict';
const _ = require('../tools')._;

function command(options, log, callback) {
    setTimeout(() => {
        if (options.discord.enabled &&
            options.discord.target &&
            options.adapter &&
            options.discord.instance !== '' &&
            options.discord.instance !== null &&
            options.discord.instance !== undefined
        ) {
            // Send Discord Message
            if (options.debugging) {
                log.debug(`[${options.name}] used Discord-Instance: ${options.discord.instance}`);
            }

            // analyse here the info from options.context.error and  options.context.done
            const errors = Object.keys(options.context.errors);

            if (!errors.length) {
                let messageText = _('New %e Backup created on %t', options.discord.systemLang);
                messageText = messageText.replace('%t', options.discord.time).replace('%e', `${options.name}${options.name === 'iobroker' && options.discord.hostName ? ` (${options.discord.hostName})` : ''}`);
                if (options.ftp && options.ftp.enabled && options.discord.NoticeType === 'longDiscordNotice') {
                    const m = _(', and copied / moved via FTP to %h%d', options.discord.systemLang);
                    messageText += m.replace('%h', options.ftp.host).replace('%d', options.ftp.dir);
                }

                if (options.cifs && options.cifs.enabled && options.discord.NoticeType === 'longDiscordNotice') {
                    const m = _(', and stored under %h%d', options.discord.systemLang);
                    messageText += m.replace('%h', options.cifs.mount).replace('%d', options.cifs.dir);
                }

                if (options.dropbox && options.dropbox.enabled && options.discord.NoticeType === 'longDisocrdNotice') {
                    messageText += _(', and stored in dropbox', options.discord.systemLang);
                }

                if (options.onedrive && options.onedrive.enabled && options.discord.NoticeType === 'longDisocrdNotice') {
                    messageText += _(', and stored in onedrive', options.discord.systemLang);
                }

                if (options.googledrive && options.googledrive.enabled && options.discord.NoticeType === 'longDisocrdNotice') {
                    messageText += _(', and stored in google drive', options.discord.systemLang);
                }

                if (options.webdav && options.webdav.enabled && options.discord.NoticeType === 'longDisocrdNotice') {
                    messageText += _(', and stored in webdav', options.discord.systemLang);
                }

                messageText += '.';

                sendMessage(options, log, messageText);

            } else {
                let errorMessage = _('Your backup was not completely created. Please check the errors!!', options.discord.systemLang);

                errorMessage += '\n';

                if (options.context.errors.iobroker) errorMessage += '\niobroker: ' + options.context.errors.iobroker;
                if (options.context.errors.redis) errorMessage += '\nredis: ' + options.context.errors.redis;
                if (options.context.errors.historyDB) errorMessage += '\nhistoryDB: ' + options.context.errors.historyDB;
                if (options.context.errors.influxDB) errorMessage += '\ninfluxDB: ' + options.context.errors.influxDB;
                if (options.context.errors.sqlite) errorMessage += '\nsqlite: ' + options.context.errors.sqlite;
                if (options.context.errors.nodered) errorMessage += '\nnodered: ' + options.context.errors.nodered;
                if (options.context.errors.yahka) errorMessage += '\nyahka: ' + options.context.errors.yahka;
                if (options.context.errors.zigbee) errorMessage += '\nzigbee: ' + options.context.errors.zigbee;
                if (options.context.errors.zigbee2mqtt) errorMessage += '\nzigbee2mqtt: ' + options.context.errors.zigbee2mqtt;
                if (options.context.errors.javascripts) errorMessage += '\njavascripts: ' + options.context.errors.javascripts;
                if (options.context.errors.jarvis) errorMessage += '\njarvis: ' + options.context.errors.jarvis;
                if (options.context.errors.clean) errorMessage += '\nclean: ' + options.context.errors.clean;

                if (options.context.errors.mount) {
                    errorMessage += '\nmount: ' + options.context.errors.mount;
                    try {
                        const formatPass = options.cifs.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.cifs && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.mysql) {
                    errorMessage += '\nmysql: ' + options.context.errors.mysql;
                    try {
                        const formatPass = options.mysql.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.mysql && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.grafana) {
                    errorMessage += '\ngrafana: ' + options.context.errors.grafana;
                    try {
                        const formatPass = options.grafana.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.grafana && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);

                        const formatApiKey = options.grafana.apiKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.grafana && formatApiKey ? errorMessage.replace(new RegExp(formatApiKey, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }

                if (options.context.errors.webdav) {
                    errorMessage += '\nwebdav: ' + options.context.errors.webdav;
                    try {
                        const formatPass = options.webdav.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.webdav && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.pgsql) {
                    errorMessage += '\npgsql: ' + options.context.errors.pgsql;
                    try {
                        const formatPass = options.pgsql.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.pgsql && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.ccu) {
                    errorMessage += '\nccu: ' + options.context.errors.ccu;
                    try {
                        const formatPass = options.ccu.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.ccu && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.ftp) {
                    errorMessage += '\nftp: ' + options.context.errors.ftp;
                    try {
                        const formatPass = options.ftp.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.ftp && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.dropbox) {
                    errorMessage += '\ndropbox: ' + options.context.errors.dropbox;
                    try {
                        const formatPass = options.dropbox.accessToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.dropbox && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.onedrive) {
                    errorMessage += '\nonedrive: ' + options.context.errors.onedrive;
                    try {
                        const formatPass = options.onedrive.onedriveAccessJson.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.onedrive && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.googledrive) {
                    errorMessage += '\ngoogledrive: ' + options.context.errors.googledrive;
                    try {
                        const formatPass = options.googledrive.accessJson.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.googledrive && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }

                }
                if (options.context.errors.cifs) {
                    errorMessage += '\ncifs: ' + options.context.errors.cifs;
                    try {
                        const formatPass = options.cifs.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.cifs && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                if (options.context.errors.umount) {
                    errorMessage += '\numount: ' + options.context.errors.umount;
                    try {
                        const formatPass = options.cifs.pass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        errorMessage = (options.cifs && formatPass ? errorMessage.replace(new RegExp(formatPass, 'g'), "****") : errorMessage);
                    } catch (e) {
                        // ignore
                    }
                }
                try {
                    errorMessage = errorMessage.replaceAll('undefined', '');
                } catch (e) {
                    // ignore
                }

                sendMessage(options, log, errorMessage);
            }
        }
        callback && callback();
    }, options.discord.discordWaiting);
}

function sendMessage(options, log, message) {
    if (options.discord.target.match(/^\d+$/)) {
        // send to a single user
        options.adapter.sendTo(options.discord.instance, 'sendMessage', {
            userId: options.discord.target,
            content: `**BackItUp**:\n${message}`,
        }, (ret) => {
            if (ret.err) {
                log.warn(`Error sending Discord message: ${ret.err}`);
            }
        });
    } else if (options.discord.target.match(/^\d+\/\d+$/)) {
        // send to a server channel
        const [serverId, channelId] = options.discord.target.split('/');
        options.adapter.sendTo(options.discord.instance, 'sendMessage', {
            serverId,
            channelId,
            content: `**BackItUp**:\n${message}`,
        }, (ret) => {
            if (ret.err) {
                log.warn(`Error sending Discord message: ${ret.err}`);
            }
        });
    }
}

module.exports = {
    command,
    ignoreErrors: true,
    afterBackup: true
};
