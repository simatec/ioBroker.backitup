'use strict';
const {spawn} = require('child_process');
const getDate = require('../tools').getDate;
const path = require('path');

function command(options, log, callback) {
    const cmd = spawn('ping', ['127.0.0.1']); // just an example

    cmd.stdout.on('data', data => {
        const text = data.toString();
        const lines = text.split('\n');
        lines.forEach(line => {
            line = line.replace(/\r/g, ' ').trim();
            line && adapter.log.debug(`[${type}] ${line}`);
        });

        const fileName = path.join(options.backupDir , `mySql_${getDate()}_backupiobroker.tar.gz`);

        options.context.fileNames = options.context.fileNames || [];
        options.context.fileNames.push(fileName);

        callback(null, text);
    });
}

module.exports = {
    command,
    ignoreErrors: true
};