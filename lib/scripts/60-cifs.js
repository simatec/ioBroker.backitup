'use strict';

const copyFile = require('../tools').copyFile;
const path = require('path');
const fs = require('fs');

function copyFiles(dir, fileNames, log, errors, callback) {
    if (!fileNames || !fileNames.length) {
        callback && callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();
        try {
            log.debug('Copy ' + onlyFileName + '...');
            copyFile(fileName, path.join(dir, onlyFileName), err => {
                if (err) {
                    errors.cifs = err;
                    log.error(err);
                }
                setImmediate(copyFiles, dir, fileNames, log, errors, callback);
            });
        } catch (e) {
            log.error(e);
            errors.cifs = e;
            setImmediate(copyFiles, dir, fileNames, log, errors, callback);
        }
    }
}

function deleteFiles(files, log, errors) {
    try {
        for (let f = 0; f < files.length; f++) {
            log.debug('delete ' + files[f]);
            fs.unlinkSync(files[f]);
        }
        return true;
    } catch (e) {
        errors.cifs = errors.cifs || e;
        log.error(e);
    }
}

function cleanFiles(dir, options, names, num, log, errors) {
    if (!num) return;

    try {
        if (dir[dir.length - 1] !== '/') {
            dir += '/';
        }

        let result = fs.readdirSync(dir);

        if (result && result.length) {
            const files = [];
            names.forEach(name => {
                const subResult = result.filter(a => a.startsWith(name));
                let numDel = num;

                if (name == 'influxDB' && options.influxDBMulti) numDel = num * options.influxDBEvents.length;
                if (name == 'mysql' && options.mySqlMulti) numDel = num * options.mySqlEvents.length;
                if (name == 'pgsql' && options.pgSqlMulti) numDel = num * options.pgSqlEvents.length;
                if (name == 'homematic' && options.ccuMulti) numDel = num * options.ccuEvents.length;

                if (subResult.length > numDel) {
                    // delete oldest files
                    subResult.sort((a, b) => {
                        const at = fs.statSync(dir + a).ctime;
                        const bt = fs.statSync(dir + b).ctime;
                        if (at > bt) return -1;
                        if (at < bt) return 1;
                        return 0;
                    });

                    for (let i = numDel; i < subResult.length; i++) {
                        files.push(path.join(dir, subResult[i]));
                    }
                }
            });
            deleteFiles(files, log, errors);
        }
    } catch (e) {
        errors.cifs = errors.cifs || e;
    }
}

function command(options, log, callback) {
    if (options.dir && options.context && options.context.fileNames && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));

        let dir = options.dir.replace(/\\/g, '/');

        if (dir[0] !== '/' && !dir.match(/\w:/)) {
            dir = '/' + (dir || '');
        }

        //if (fs.existsSync(options.dir)) {
        //copyFiles(options.dir, fileNames, log, options.context.errors, err => {
        if (fs.existsSync(dir)) {
            copyFiles(dir, fileNames, log, options.context.errors, err => {
                if (err) {
                    log.error(err);
                    options.context.errors.cifs = options.context.errors.cifs || err;
                }
                if (options.deleteOldBackup === true) {
                    if (cleanFiles(dir, options, options.context.types, options.deleteBackupAfter, log, options.context.errors)) {
                        !options.context.errors.cifs && options.context.done.push('cifs');
                    }
                } else {
                    !options.context.errors.cifs && options.context.done.push('cifs');
                }
                if (callback) {
                    callback(err);
                    callback = null;
                }
            });
        } else if (options.mountType === 'Copy') {
            //callback(`Path "${options.dir}" not found`);
            callback && callback(`Path "${dir}" not found`);
        } else {
            callback && callback();
        }
    } else {
        callback && callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true
};