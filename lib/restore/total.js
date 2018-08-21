const fs = require('fs');
const targz = require('targz');

function restore(options, fileName, log, callback) {
    let timer = setInterval(() => {
        if (fs.existsSync(options.dir))  {
            log.debug('Extracting...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 10000);

    try {
        targz.decompress({
            src: fileName,
            dest: options.dir,
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