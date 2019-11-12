const fs = require('fs');
const targz = require('targz');
const copyFile = require('../tools').copyFile;
const path = require('path');

function restore(options, fileName, log, callback) {
    let stat;
    if (fs.existsSync(options.path)) {
        stat = fs.statSync(options.path);
        /*
        if (!stat.isDirectory()) {
            fs.unlinkSync(options.path);
        }
        */
    }
    const tmpDir = options.backupDir + '/tmp';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
        log.debug('Created redis tmp');
    }

    let timer = setInterval(() => {
        if (fs.existsSync(options.path))  {
            log.debug('Extracting...');
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
            dest: tmpDir,
        }, (err, stdout, stderr) => {

            clearInterval(timer);

            if (err) {
                log.error(err);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                try {
                    let files = [];
                    if( fs.existsSync(tmpDir) ) {
                        files = fs.readdirSync(tmpDir);
                        files.forEach(function(file,index) {
                            let curPath = tmpDir + "/" + file;
                            log.debug('restore redis backup');
                            copyFile((tmpDir + "/" + file), path.join(pth + "/" + file), err => {
                                if (err) {
                                    log.error(err);
                                } else {
                                    log.debug('delete tmp files:' + tmpDir + "/" + file);
                                    fs.unlinkSync(tmpDir + "/" + file);
                                }
                            });
                            setTimeout(function() {
                                fs.rmdirSync(tmpDir);
                                log.debug('delete:' + tmpDir);
                            }, 1000);
                            
                        });
                        
                    }
                } catch (e) {
                    log.error(e);
                }
                if (callback) {
                    //callback(null, stdout);
                    callback(null, 'redis restore done');
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