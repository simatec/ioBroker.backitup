'use strict';
const fs = require('node:fs');
const getDate = require('../tools').getDate;
const path = require('node:path');
const compress = require('../targz').compress;

async function command(options, log, callback) {
    const zigbeeInst = [];

    try {
        for (let i = 0; i <= 10; i++) {
            // Check if zigbee adapter instance exists
            const obj = await options.adapter.getForeignObjectAsync(`system.adapter.zigbee.${i}`);
            if (!obj) continue;

            // Check if corresponding folder exists
            const pth = path.join(options.path, `zigbee_${i}`);
            if (!fs.existsSync(pth)) continue;

            // Determine suffix for the filename
            let nameSuffix = '';
            if (options.hostType === 'Slave') {
                nameSuffix = options.slaveSuffix || '';
            } else {
                nameSuffix = options.nameSuffix || '';
            }

            // Construct backup filename
            const fileName = path.join(
                options.backupDir,
                `zigbee.${i}_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`
            );

            options.context.fileNames.push(fileName);

            // Run compression and wait for it to finish
            await new Promise((resolve) => {
                compress({
                    src: pth,
                    dest: fileName,
                    tar: {
                        ignore: (name) => path.extname(name) === '.gz'
                    }
                }, (err, stdout, stderr) => {
                    if (err) {
                        options.context.errors.zigbee = err.toString();
                        if (stderr) log.error(stderr);
                        if (callback) {
                            callback(err, stderr);
                            callback = null;
                        }
                    } else {
                        options.context.types.push(`zigbee.${i}`);
                        options.context.done.push(`zigbee.${i}`);
                    }
                    resolve();
                });
            });

            zigbeeInst.push(`zigbee.${i}`);
        }

        // Log summary
        if (zigbeeInst.length) {
            log.debug(`Found zigbee databases: ${zigbeeInst.join(', ')}`);
        } else {
            log.warn('No zigbee databases found!');
        }

        // Final callback
        if (callback) callback(null, 'done');
    } catch (err) {
        log.error(`Error during zigbee backup: ${err.message}`);
        if (callback) callback(err);
    }
}

module.exports = {
    command,
    ignoreErrors: true
};
