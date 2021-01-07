const { exec } = require('child_process');
const child_process = require('child_process');
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');
const path = require('path');

function replayInfuxDB(options, tmpDir, log, callback) {
    const cmd = `${options.exe ? `"${options.exe}"` : 'influxd'} restore -portable -db ${options.dbName}${options.dbType == 'remote' ? ` -host ${options.host}:${options.port}` : ''} "${tmpDir}"`;
    try {
        const child = exec(cmd, (error, stdout, stderr) => {
            if (error) log.error(stderr);
            return callback(error);
        });
    } catch (e) {
        callback(e);
    }
}

function restore(options, fileName, log, callback) {
    const tmpDir = path.join(options.backupDir, 'influxDBtmp').replace(/\\/g, '/');
    log.debug('tmpDir: ' + tmpDir);

    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
        log.debug('Created tmp directory');
    } else {
        try {
            log.debug('Try deleting the old InfluxDB tmp directory');
            fse.removeSync(tmpDir);
            if (!fs.existsSync(tmpDir)) {
                log.debug('InfluxDB old tmp directory was successfully deleted');
            }
            fs.mkdirSync(tmpDir);
            log.debug('Created tmp directory');
        } catch (e) {
            log.debug('InfluxDB old tmp directory could not be deleted: ' + e);
        }
    }
    log.debug('Start infuxDB Restore ...');

    try {
        targz.decompress({
            src: fileName,
            dest: tmpDir,
        }, (err, stdout, stderr) => {
            if (err) {
                log.error(err);
                if (callback) {
                    log.error('infuxDB Restore not completed');
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    replayInfuxDB(options, tmpDir, log, err => {
                        // delete infuxDB tmpDir
                        if (fs.existsSync(tmpDir)) {
                            try {
                                log.debug('Try deleting the InfluxDB tmp directory');
                                fse.removeSync(tmpDir);
                                if (!fs.existsSync(tmpDir)) {
                                    log.debug('InfluxDB tmp directory was successfully deleted');
                                }
                            } catch (e) {
                                log.debug('InfluxDB tmp directory could not be deleted: ' + e);
                            }
                        }
                        log.debug('infuxDB Restore completed successfully');
                        callback(null, 'influxDB restore done');
                        callback = null;
                    });
                }
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