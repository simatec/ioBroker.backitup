'use strict';

const child_process = require('child_process');
const getDate = require('../tools').getDate;
const path = require('path');
const fs = require('fs');
const targz = require('targz');

function command(options, log, callback) {
	//const fileName = path.join(options.backupDir , `mysql_${getDate()}_backupiobroker.tar.gz`);
	const fileName = path.join(options.backupDir, `mysql_${getDate()}${options.nameSuffix ? '_' + options.nameSuffix : ''}_backupiobroker.tar.gz`);
	const fileNameMysql = path.join(options.backupDir, `mysql_${getDate()}_backupiobroker.sql`);

	options.context.fileNames = options.context.fileNames || [];
	options.context.fileNames.push(fileName);

	child_process.exec(`${options.exe ? options.exe : 'mysqldump'}  -u ${options.user} -p${options.pass} ${options.dbName} -h ${options.host} -P ${options.port}${options.mysqlQuick ? ' --quick' : ''}${options.mysqlSingleTransaction ? ' --single-transaction' : ''} > ${fileNameMysql}`, (error, stdout, stderr) => {
		if (error) {
			let errLog = '' + error;
			errLog = errLog.replace(new RegExp(options.pass, 'g'), "****")
			callback(errLog, stderr);
			callback = null;
		} else {
			let timer = setInterval(() => {
				if (fs.existsSync(fileName)) {
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
							try {
								//fs.unlink(fileNameMysql, function (err) {
									//if (err) throw err;
									fs.unlinkSync(fileNameMysql);
									log.debug('MySql File deleted!');
								//});
							} catch (e) {
								log.debug('MySql File cannot deleted: ' + e);
							}
						}
						callback(null, stdout);
						callback = null;
					}
				}
			});
		}
	});
}

module.exports = {
	command,
	ignoreErrors: true
};