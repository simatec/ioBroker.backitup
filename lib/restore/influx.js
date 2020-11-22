const { exec } = require('child_process');
const fs = require('fs');
const targz = require('targz');
const path = require('path');

function cleanTmpDir(dirname, log) {
	if (fs.existsSync(dirname)) {
		try {
			if (fs.lstatSync(dirname).isDirectory()) {
				let files = fs.readdirSync(dirname);
				files.forEach(file => {
					fs.unlinkSync(path.join(dirname, file));
				});
				fs.rmdirSync(dirname);
			} else {
				fs.unlinkSync(dirname);
			}
			log.debug('influx tmp directory removed!');
		} catch (e) {
			log.error('influx tmp directory cannot removed: ' + e);
		}
	}
}

function doRestore(options, dirNameInflux, log, callback) {
    //Remove enclosing "" if any
    let exe = `${options.exe ? options.exe : 'influxd'}`;
    if ( exe.charAt(0) === '"')
    {
         exe = exe.substring(1);
         exe = exe.slice(0, -1);
    }

    const cmdRestore = `"${exe}" restore -portable "${dirNameInflux}"`;
    try {
        const child = exec(cmdRestore, (error, stdout, stderr) => {
            //if (error) log.error(stderr);
            return callback(error);
        });
    } catch (e) {
        callback(e);
    }
}

function restore(options, fileName, log, callback) {
    const dirNameInflux = fs.mkdtempSync('influx');
    log.debug('Start influx Restore (' + fileName + ') ...' );

    cleanTmpDir(dirNameInflux, log);

    try {
        targz.decompress({
            src: fileName,
            dest: dirNameInflux
        }, (err, stdout, stderr) => {

            if (err) {
                log.error(err);
                if (callback) {
                    log.error('Influx Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                doRestore(options, dirNameInflux, log, err => {
                    cleanTmpDir(dirNameInflux, log);
                    if (err) {
                        log.error(err);
                        if (callback) {
                            callback(err, -1);
                            callback = null;
                        }
                    } else {
                        log.debug('Influx Restore completed successfully');
                        if (callback) {
                            callback(null, 'influx restore done');
                            callback = null;
                        }
                    }
                });
            }
        });
    } catch (err) {
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