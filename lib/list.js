const tools = require('./tools');
const fs = require('fs');
const path = require('path');
const storages = {};

module.exports = function (config, log, callback) {
    const backupDir = path.join(tools.getIobDir(), 'backups').replace(/\\/g, '/');
    const files = {};
    if (fs.existsSync(backupDir)) {
        files.local = fs.readdirSync(backupDir).sort().map(file => path.join(backupDir, file).replace(/\\/g, '/'));
    }

    let counter = 0;
    for (const type in config) {
        if (config.hasOwnProperty(type)) {
            for (const attr in config[type]) {
                if (config[type].hasOwnProperty(attr) &&
                    typeof config[type][attr] === 'object' &&
                    config[type][attr].type === 'storage') {
                    try {
                        storages[attr] = storages[attr] || require('./list/' + attr);
                    } catch (e) {
                        log.error('Cannot load list module ' + attr + ': ' + e);
                        continue;
                    }

                    counter++;
                    storages[attr].list(config[type][attr], log, (err, result, type) => {
                        err && log.error(err);
                        if (result && result.length) {
                            if (type === 'cifs') {
                                result = result.filter(file => files.local.indexOf(file) === -1);
                            }

                            if (result.length) {
                                files[type] = result;
                            }
                        }
                        if (!--counter && callback) callback({error: err, data: files});
                    });
                }
            }
        }
    }

    if (!counter) {
        callback && callback({error: null, data: files});
    }
};