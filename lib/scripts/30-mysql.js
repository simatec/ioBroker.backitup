'use strict';
//const {spawn} = require('child_process');
const child_process = require('child_process');
const getDate = require('../tools').getDate;
const path = require('path');
const fs = require('fs');
const targz = require('targz');

function command(options, log, callback) {
    const fileName = path.join(options.backupDir , `mysql_${getDate()}_backupiobroker.tar.gz`);
    const fileNameMysql = path.join(options.backupDir , `mysql_${getDate()}_backupiobroker.sql`);

    options.context.fileNames = options.context.fileNames || [];
	options.context.fileNames.push(fileName);

	child_process.exec(`${options.exe ? options.exe : 'mysqldump'}  -u ${options.user} -p${options.pass} ${options.dbName} -h ${options.host} -P ${options.port} > ${fileNameMysql}`, (error, stdout, stderr) => {
		if (error) {
			callback(error, stderr);
			callback = null;
		} else {
			let timer = setInterval(() => {
				if (fs.existsSync(fileName))  {
					const stats = fs.statSync(fileName);
					const fileSize = Math.floor(stats.size / (1024 * 1024));
					log.debug('Packed ' + fileSize + 'MB so far...');
				}
			}, 10000);

			targz.compress({
				src: fileNameMysql,
				dest: fileName,
			}, (err, stdout, stderr) => {

				clearInterval(timer);

				if (err) {
					if (callback) {
						callback(err, stderr);
						callback = null;
					}
				} else {
					options.context.done.push('mysql');
					options.context.types.push('mysql');
					if (callback) {
						if (fileNameMysql) {
							fs.unlink(fileNameMysql, function (err) {
								if (err) throw err;
								log.debug('MySql File deleted!');
							});
						}
						callback(null, stdout);
						callback = null;
					}
				}
			});
		}
	});
	/*
    try {
        const stream = fs.createWriteStream(fileNameMysql);

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
				let timer = setInterval(() => {
					if (fs.existsSync(fileName))  {
						const stats = fs.statSync(fileName);
						const fileSize = Math.floor(stats.size / (1024 * 1024));
						log.debug('Packed ' + fileSize + 'MB so far...');
					}
				}, 10000);

				targz.compress({
					src: fileNameMysql,
					dest: fileName,
				}, (err, stdout, stderr) => {

					clearInterval(timer);

					if (err) {
						if (callback) {
							callback(err, stderr);
							callback = null;
						}
					} else {
						options.context.done.push('mysql');
						options.context.types.push('mysql');
						if (callback) {
							if (fileNameMysql) {
								fs.unlink(fileNameMysql, function (err) {
									if (err) throw err;
									log.debug('MySql File deleted!');
								});
							}
							callback(null, stdout);
							callback = null;
						}
					}
				});
                stream.end();
                callback();
            });

            cmd.on('error', error => {
                options.context.errors.mysql = error;
                stream.end();
                callback(error);
            });
        });

    } catch (e) {
        options.context.errors.mysql = e.toString();
        callback(e);
	}
	*/
}

module.exports = {
    command,
    ignoreErrors: true
};