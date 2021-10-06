'use strict';

const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

function cleanFiles(dir, options, names, num, log, errors) {
    if (!num) return;
    try {
        if (dir[dir.length - 1] !== '/') {
            dir += '/';
        }
        names.forEach(name => {

            let result = fs.readdirSync(dir);

            if (result && result.length && num) {

                result = result.filter(a => a.startsWith(name));
                let numDel = num;

                if (name == 'influxDB' && options.influxDBMulti) numDel = num * options.influxDBEvents.length;
                if (name == 'mysql' && options.mySqlMulti) numDel = num * options.mySqlEvents.length;
                if (name == 'pgsql' && options.pgSqlMulti) numDel = num * options.pgSqlEvents.length;
                if (name == 'homematic' && options.ccuMulti) numDel = num * options.ccuEvents.length;

                const files = [];

                if (result.length > numDel) {
                    // delete oldies files
                    result.sort((a, b) => {
                        const at = fs.statSync(dir + a).ctime;
                        const bt = fs.statSync(dir + b).ctime;
                        if (at > bt) return -1;
                        if (at < bt) return 1;
                        return 0;
                    });

                    for (let i = numDel; i < result.length; i++) {
                        files.push(path.join(dir, result[i]));
                    }
                }
                deleteFiles(files, log, errors);
            }
        });
    } catch (e) {
        errors.cifs = errors.cifs || e;
    }
}

function deleteFiles(files, log, errors) {
    try {
        for (let f = 0; f < files.length; f++) {
            log.debug('delete ' + files[f]);

            const stat = fs.lstatSync(files[f]);
            if (stat.isDirectory()) {
                fse.removeSync(files[f]);
            } else {
                fs.unlinkSync(files[f]);
            }
        }
        return true;
    } catch (e) {
        errors.clean = errors.clean || e;
        log.error(e);
    }
}

function command(options, log, callback) {
    if (options.backupDir && options.context && options.context.fileNames && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        // delete files only if no errors
        const errors = Object.keys(options.context.errors);

        if (!errors.length) {
            // may be do it configurable
            let dir = options.backupDir.replace(/\\/g, '/');

            if (dir[0] !== '/' && !dir.match(/\w:/)) {
                dir = '/' + (dir || '');
            }
            cleanFiles(dir, options, options.context.types, options.deleteBackupAfter, log, options.context.errors, err => {
                if (err) {
                    log.error(err);
                    options.context.errors.cifs = options.context.errors.cifs || err;
                }
                if (callback) {
                    callback(err);
                    callback = null;
                }
            });
        } else {
            log.error('Backup files not deleted from ' + options.backupDir + ' because some errors.');
        }
    }

    callback && callback();
}

module.exports = {
    command,
    ignoreErrors: true
};