'use strict';
const {spawn} = require('child_process');

function command(options, log, callback) {
    const cmd = spawn('ping', ['127.0.0.1']); // just an example

    cmd.stdout.on('data', data => {
        const text = data.toString();
        const lines = text.split('\n');
        lines.forEach(line => {
            line = line.replace(/\r/g, ' ').trim();
            line && adapter.log.debug(`[${type}] ${line}`);
        });
        callback(null, text);
    });
}

module.exports = {
    command,
    ignoreErrors: true
};