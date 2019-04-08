const fs = require('fs');
const targz = require('targz');

function restore(options, fileName, log, callback) {

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
            log.debug('Extracting...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 10000);

    let pth = options.path + '/zigbee_' + num[0];

    try {
        targz.decompress({
            src: fileName,
            dest: pth,
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    callback(null, stdout);
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