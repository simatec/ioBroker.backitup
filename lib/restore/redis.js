const fs = require('fs');
const targz = require('targz');

function restore(options, fileName, log, callback) {
    let stat;
    if (fs.existsSync(options.path)) {
        stat = fs.statSync(options.path);
        if (!stat.isDirectory()) {
            fs.unlinkSync(options.path);
        }
    }

    let timer = setInterval(() => {
        if (fs.existsSync(options.path))  {
            const stats = fs.statSync(options.path);
            const fileSize = Math.floor(stats.size / (1024 * 1024));
            log.debug('Extract ' + fileSize + 'MB so far...');
        } else {
            log.debug('Something is wrong. No file found.');
        }
    }, 10000);

    let name;
    let pth;
    if (!fs.existsSync(options.path)) {
        const parts = options.path.replace(/\\/g, '/').split('/');
        name = parts.pop();
        if (name.indexOf('.')) {
            pth = parts.join('/');
        }
    } else {
        pth = options.path;
    }

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