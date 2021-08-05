const utils = require('@iobroker/adapter-core');

function restore(options, fileName, log, callback) {
    const child_process = require('child_process');
    let ioPath = utils.controllerDir + '/iobroker.js';

    try {
        log.debug('Start ioBroker Restore ...');
        const cmd = child_process.fork(ioPath, ['restore', fileName], {silent: true});
        cmd.stdout.on('data', data => log.debug(data.toString()));

        cmd.stderr.on('data', data => log.error(data.toString()));

        cmd.on('close', code => {
            if (callback) {
                log.debug('ioBroker Restore completed successfully');
                callback(null, code);
                callback = null;
            }
        });

        cmd.on('error', error => {
            log.error(error);
            if (callback) {
                callback(error, -1);
                callback = null;
            }
        });
    } catch (error) {
        log.error('ioBroker Restore not completed');
        log.error(error);

        if (callback) {
            callback(error, -1);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: true
};