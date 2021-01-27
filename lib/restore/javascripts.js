const fs = require('fs');
const targz = require('targz');

function restore(options, fileName, log, callback) {

    log.debug('Start Javascript Restore ...');
    let timer = setInterval(() => {
        if (fs.existsSync(options.filePath))  {
            log.debug('Extracting Javascript Backupfile...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 5000);

    try {
        targz.decompress({
            src: fileName,
            dest: options.filePath,
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('Javascript Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    log.debug('Javascript Restore completed successfully');
                    callback(null, 'javascript restore done');
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
    isStop: false
};