'use strict';
const fs = require('node:fs');
const getDate = require('../tools').getDate;
const path = require('node:path');

function command(options, log, callback) {
    let esphomeInst = [];

    const compress = require('../targz').compress;

    for (let i = 0; i <= 5; i++) {

        let pth = path.join(options.path, `esphome.${i}`);

        if (fs.existsSync(pth)) {
            let nameSuffix;
            if (options.hostType === 'Slave') {
                nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
            } else {
                nameSuffix = options.nameSuffix ? options.nameSuffix : '';
            }

            const fileName = path.join(options.backupDir, `esphome.${i}_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`);

            compress({
                src: pth,
                dest: fileName,
                tar: {
                    ignore: name => {
                        return path.basename(name) === '.esphome' || path.basename(name) === '.gitignore' // ignore all was not .yaml files when packing basename
                    },
                },
            }, (err, stderr) => {
                if (err) {
                    options.context.errors.esphome = err.toString();
                    stderr && log.error(stderr);
                    if (callback) {
                        callback(err, stderr);
                        callback = null;
                    }
                } else {
                    log.debug(`Backup created: ${fileName}`);
                    options.context.fileNames.push(fileName);
                    options.context.types.push(`esphome.${i}`);
                    options.context.done.push(`esphome.${i}`);
                }
            });
            esphomeInst.push(`esphome.${i}`);
            if (i === 5) {
                esphomeInst.length ? log.debug(`found esphome data: ${esphomeInst}`) : log.warn('no esphome data found!!');
            }
        } else if (!fs.existsSync(pth) && i === 5) {
            esphomeInst.length ? log.debug(`found esphome data: ${esphomeInst}`) : log.warn('no esphome data found!!');
            callback && callback(null, 'done');
        }
    }
}

module.exports = {
    command,
    ignoreErrors: true
};
