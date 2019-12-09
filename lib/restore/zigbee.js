const fs = require('fs');
const targz = require('targz');

function restore(options, fileName, log, callback) {
    log.debug('Start Zigbee Restore ...');

    let instance = fileName.split('.');
    let num = instance[1].split('_');

    let stat;
    if (fs.existsSync(options.path + '/zigbee_' + num[0])) {
        stat = fs.statSync(options.path + '/zigbee_' + num[0]);
        if (!stat.isDirectory()) {
            fs.unlinkSync(options.path + '/zigbee_' + num[0]);
        }
    } else {
        fs.mkdirSync(options.path + '/zigbee_' + num[0]);
    }

    let timer = setInterval(() => {
        if (fs.existsSync(options.path + '/zigbee_' + num[0]))  {
            log.debug('Extracting Zigbee Backupfile...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 5000);

    let pth = options.path + '/zigbee_' + num[0];

    try {
        targz.decompress({
            src: fileName,
            dest: pth,
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error('Zigbee Restore not completed');
                log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    log.debug('Zigbee Restore completed successfully');
                    callback(null, 'zigbee database restore done');
                    callback = null;
                }
            }
        });
    } catch (e) {
        if (callback) {
            callback(err);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: true
};