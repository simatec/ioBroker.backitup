'use strict';
const {spawn} = require('child_process');
const getDate = require('../tools').getDate;
const path = require('path');
const fs = require('fs');

function command(options, log, callback) {
    const fileName = path.join(options.backupDir , `mySql_${getDate()}_backupiobroker.tar.gz`);

    options.context.fileNames = options.context.fileNames || [];
    options.context.fileNames.push(fileName);

    const stream = fs.createWriteStream(fileName);

    stream.once('open', fd => {
        const cmd = spawn(options.exe || 'mysqldump', [
            '-u', options.user,
            '-p' + options.pass,
            options.dbName,
            '-h', options.host,
            '-P', options.port]);

        cmd.stdout.on('data', data => stream.write(data));

        cmd.stderr.on('data', data => log.error(data));

        cmd.on('close', code => {
            // todo ZIP

            stream.end();
            callback();
        });

        cmd.on('error', (error) => {
            stream.end();
            callback(error);
        });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};