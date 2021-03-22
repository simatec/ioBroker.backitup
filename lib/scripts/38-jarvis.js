'use strict';
const fs = require('fs');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    const jarvisDir = path.join(options.path, 'jarvis');

    if (fs.existsSync(jarvisDir)) {

        try {
            fs.readdir(jarvisDir, (err, files) => {
                if (files) {
                    const num = (files.length - 1);

                    files.forEach(file => {
                        log.debug(`found Jarvis Instance: ${file}`)
                        log.debug(`start Jarvis Backup for Instance ${file}...`);

                        const fileName = path.join(options.backupDir, `jarvis.${file}_${getDate()}_backupiobroker.tar.gz`);
                        const instanceDir = path.join(jarvisDir, file);

                        options.context.fileNames.push(fileName);

                        const tar = require('tar');

                        const f = fs.createWriteStream(fileName);

                        f.on('finish', () => {
                            log.debug(`Backup created: ${fileName}`)
                            options.context.done.push('jarvis.' + file);
                            options.context.types.push('jarvis.' + file);
                            if (callback && num === parseFloat(file)) {
                                callback(null);
                                callback = null;
                            }
                        });
                        f.on('error', err => {
                            options.context.errors.jarvis = err.toString();
                            err && log.error(err);
                            if (callback) {
                                callback(err);
                                callback = null;
                            }
                        });

                        try {
                            const data = fs.readdirSync(instanceDir);
                            log.debug('The following files were found for the backup: ' + data);
                            tar.create({ gzip: true, cwd: instanceDir }, data).pipe(f);
                        } catch (err) {
                            clearInterval(timer);
                            callback(err);
                            callback = null;
                        }
                    });
                } else {
                    log.debug(`Jarvis Backup cannot created. Please install a Jarvis version >= 2.2.0`);
                    callback(null, 'done');
                    callback = null;
                }
            });
        } catch (e) {
            log.debug(`Jarvis Backup cannot created: ${e}`);
            callback(null, e);
            callback = null;
        }
    } else {
        log.debug(`Jarvis Backup cannot created. Please install a Jarvis version >= 2.2.0`);
        callback(null, 'done');
        callback = null;
    }
}

module.exports = {
    command,
    ignoreErrors: true
};