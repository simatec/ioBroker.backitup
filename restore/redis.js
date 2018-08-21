const fs = require('fs');
const targz = require('targz');

function restore(options, fileName, log, callback) {
    if (fs.existsSync(options.path)) {
        fs.unlinkSync(options.path);
    }

    let timer = setInterval(() => {
        if (fs.existsSync(options.path))  {
            const stats = fs.statSync(options.path);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Extract ' + fileSize + 'MB so far...');
        }
    }, 10000);

    try {
        targz.decompress({
            src: fileName,
            dest: options.path,
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