'use strict';

const copyFile = require('../tools').copyFile;
const path = require('path');
const fs = require('fs');

function list(options, types, log, callback) {
    if (options.enabled) {
        let dir = (options.dir || '').replace(/\\/g, '/');
        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        if (fs.existsSync(dir)) {
            let result = fs.readdirSync(dir).sort().map(file => path.join(dir, file).replace(/\\/g, '/'));

            if (result && result.length) {

                result = result.map(file => {
                const stat = fs.statSync(file);
                return {path: file, name: file.split('/').pop(), size: stat.size};
                }).filter(file => types.indexOf(file.name.split('_')[0]) !== -1);

                const files = {};
                
                result.forEach(file => {
                    const type = file.name.split('_')[0];
                    files[type] = files[type] || [];
                    files[type].push(file);
            });
                callback(null, files, 'cifs');
            } else {
                callback && callback()
            }
        }
    } else {
        setImmediate(callback);
    }
}

function getFile(options, fileName, toStoreName, log, callback) {
    if (options.enabled) {
        // copy file to options.backupDir
        let dir = (options.dir || '').replace(/\\/g, '/');
        if (!dir || dir[0] !== '/') {
            dir = '/' + (dir || '');
        }
        try {
            log.debug('Get file ' + fileName);
            copyFile(fileName, path.join(options.backupDir, toStoreName), err => {
                if (err) {
                    log.error(err);
                }
                setImmediate(options, fileName, toStoreName, log, callback);
            });
        } catch (e) {
            log.error(e);
            setImmediate(options, fileName, toStoreName, log, callback);
        }
    } else {
        setImmediate(callback, 'Not configured');
    }
}

module.exports = {
    list,
    getFile
};