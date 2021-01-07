const fs = require('fs');
const targz = require('targz');
const path = require('path');
const fse = require('fs-extra');

function restore(options, fileName, log, callback) {
    log.debug('Start jarvis Restore ...');

    const tmpDir = path.join(options.backupDir, `jarvis_tmp`);
    log.debug('Filename for Restore: ' + fileName);
    try {
        fs.mkdirSync(tmpDir);
        log.debug('jarvis tmp directory created: ' + tmpDir)
    } catch (e) {
        log.debug('jarvis tmp directory cannot created');
    }

    const BACKUP_STATES = [
        { 'state': 'devices' },
        { 'state': 'layout' },
        { 'state': 'settings', },
        { 'state': 'css', 'id': 'styles' }
    ];

    try {
        targz.decompress({
            src: fileName,
            dest: tmpDir,
        }, (err, stdout, stderr) => {
            if (err) {
                log.error('jarvis Restore not completed');
                log.error(stderr);
                if (fs.existsSync(tmpDir)) {
                    deltmpDir(tmpDir, log);
                }
                if (callback) {
                    callback(err, stderr);
                    callback = null;
                }
            } else {
                if (callback) {
                    const wait4read = setTimeout(function () {
                        try {
                            BACKUP_STATES.forEach((s, index) => {
                                s.id = s.id || s.state;
                                //let rawdata = fs.readFileSync(tmpDir + '/_BACKUP_' + s.id.toUpperCase() + '.json');

                                //let data = JSON.parse(rawdata);
                                try {
                                    this.objects.writeFile('jarvis', '_BACKUP_' + s.id.toUpperCase() + '.json', fs.readFileSync(tmpDir + '/_BACKUP_' + s.id.toUpperCase() + '.json'), null, err => {
                                        if (err) {
                                            log.debug('Error: ' + err);
                                        }
                                    });
                                    //options.adapter.writeFileSync('jarvis', '_BACKUP_' + s.id.toUpperCase() + '.json', JSON.stringify(data, null, 3));
                                } catch (e) {
                                    log.error('cannot write jarvis backup ' + e + ' Please run "iobroker fix"');
                                }
                                if (index == 3) {
                                    const wait4delete = setTimeout(function () {
                                        log.debug('Try deleting the jarvis tmp directory');
                                        fse.removeSync(tmpDir);
                                        if (!fs.existsSync(tmpDir)) {
                                            log.debug('jarvis tmp directory was successfully deleted');
                                        }
                                    }, 1500);
                                }
                            });
                        } catch (err) {
                            if (fs.existsSync(tmpDir)) {
                                deltmpDir(tmpDir, log);
                            }
                            callback(err);
                            callback = null;
                        }
                        log.debug('jarvis Restore completed successfully');
                        callback(null, 'jarvis database restore done');
                        callback = null;
                    }, 1500);
                }
            }
        });
    } catch (e) {
        if (callback) {
            callback(e);
            callback(err);
            callback = null;
        }
    }
}

function deltmpDir(tmpDir, log) {
    if (fs.existsSync(tmpDir)) {
        try {
            log.debug('Try deleting the jarvis tmp directory');
            fse.removeSync(tmpDir);
            if (!fs.existsSync(tmpDir)) {
                log.debug('jarvis tmp directory was successfully deleted');
            }
        } catch (e) {
            log.debug('jarvis tmp directory could not be deleted: ' + e);
        }
    }
}

module.exports = {
    restore,
    isStop: true
};