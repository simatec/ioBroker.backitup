'use strict';
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {

    const fileName = path.join(options.backupDir, `jarvis_${getDate()}_backupiobroker.tar.gz`);
    const tmpDir = path.join(options.backupDir, `jarvis_${getDate()}${options.nameSuffix ? '_' + options.nameSuffix : ''}_backupiobroker`).replace(/\\/g, '/');

    options.context.fileNames.push(fileName);

    log.debug('start jarvis Backup ...');

    let stat;
    if (fs.existsSync(options.backupDir)) {
        stat = fs.statSync(options.backupDir);
    }
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
        log.debug('Created jarvis tmp directory ...');
    }

    const BACKUP_STATES = [
        { 'state': 'devices' },
        { 'state': 'layout' },
        { 'state': 'settings', },
        { 'state': 'css', 'id': 'styles' }
    ];

    BACKUP_STATES.forEach((s, index) => {
        s.id = s.id || s.state;
        options.adapter.readFile('jarvis', '_BACKUP_' + s.id.toUpperCase() + '.json', (err, contents) => {
            if (err) {
                log.debug('error on jarvis backup: ' + err);
                if (fs.existsSync(tmpDir)) {
                    deltmpDir(tmpDir, log);
                }
                if (callback) {
                    callback(err);
                    callback = null;
                }
            } else if (contents) {
                let data = JSON.parse(contents);

                try {
                    fs.writeFileSync(tmpDir + '/_BACKUP_' + s.id.toUpperCase() + '.json', JSON.stringify(data));
                } catch (e) {
                    log.error('cannot write jarvis backup ' + e + ' Please run "iobroker fix"');
                }
                if (index == 3) {
                    const wait4Compress = setTimeout(function () {
                        targz.compress({
                            src: tmpDir,
                            dest: fileName,
                        }, (err, stdout, stderr) => {

                            if (err) {
                                options.context.errors.jarvis = err.toString();
                                stderr && log.error(stderr);
                                if (fs.existsSync(tmpDir)) {
                                    deltmpDir(tmpDir, log);
                                }
                                if (callback) {
                                    callback(err, stderr);
                                    callback = null;
                                }
                            } else {
                                log.debug(`Backup created: ${fileName}`)
                                options.context.done.push('jarvis');
                                options.context.types.push('jarvis');
                                if (fs.existsSync(tmpDir)) {
                                    deltmpDir(tmpDir, log);
                                }
                                if (callback) {
                                    callback(null, stdout);
                                    callback = null;
                                }
                            }
                        });
                    }, 1500);
                }
            }
        });
    });
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
    command,
    ignoreErrors: true
};