'use strict';
const fs = require('fs');
const targz = require('targz');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    const jarvisDir = path.join(options.path, 'jarvis');

    if (!fs.existsSync(jarvisDir)) {
        log.debug(`Jarvis Backup cannot created. Please install a Jarvis version >= 2.2.0`);
        callback = null;
    }

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

                    targz.compress({
                        src: instanceDir,
                        dest: fileName,
                    }, (err, stdout, stderr) => {

                        if (err) {
                            options.context.errors.jarvis = err.toString();
                            stderr && log.error(stderr);
                            if (callback) {
                                callback(err, stderr);
                                callback = null;
                            }
                        } else {
                            log.debug(`Backup created: ${fileName}`)
                            options.context.done.push('jarvis.' + file);
                            options.context.types.push('jarvis.' + file);
                            if (callback && num === parseFloat(file)) {
                                callback(null, stdout);
                                callback = null;
                            }
                        }
                    });
                });
            } else {
                log.debug(`Jarvis Backup cannot created. Please install a Jarvis version >= 2.2.0`);
                callback = null;
            }
        });
    } catch (e) {
        log.debug(`Jarvis Backup cannot created: ${e}`);
        callback(null, e);
        callback = null;
    }
}

module.exports = {
    command,
    ignoreErrors: false
};