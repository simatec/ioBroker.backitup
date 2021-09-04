'use strict';

const getDate = require('../tools').getDate;
const path = require('path');
const fs = require('fs');

async function command(options, log, callback) {
	if (options.mySqlMulti) {
		for (let i = 0; i < options.mySqlEvents.length; i++) {
			options.port = options.mySqlEvents[i].port ? options.mySqlEvents[i].port : '';
			options.host = options.mySqlEvents[i].host ? options.mySqlEvents[i].host : '';
			options.user = options.mySqlEvents[i].user ? options.mySqlEvents[i].user : '';
			options.pass = options.mySqlEvents[i].pass ? options.mySqlEvents[i].pass : '';
			options.exe = options.mySqlEvents[i].exe ? options.mySqlEvents[i].exe : '';
			options.dbName = options.mySqlEvents[i].dbName ? options.mySqlEvents[i].dbName : '';
			options.nameSuffix = options.mySqlEvents[i].nameSuffix ? options.mySqlEvents[i].nameSuffix : '';

			log.debug(`MySql-Backup for ${options.nameSuffix} is started ...`);
			await startBackup(options, log, callback);
			log.debug(`MySql-Backup for ${options.nameSuffix} is finish`);
		}
		options.context.done.push('mysql');
		options.context.types.push('mysql');
		return callback && callback(null);
		//return callback && callback();
	} else if (!options.mySqlMulti) {
		log.debug('MySql-Backup started ...');
		await startBackup(options, log, callback);
		log.debug('MySql-Backup for is finish');
		options.context.done.push('mysql');
		options.context.types.push('mysql');
		return callback && callback(null);
		//return callback && callback();
	}
}

async function startBackup(options, log, callback) {
	return new Promise(async (resolve) => {
		let nameSuffix;
		if (options.hostType == 'Slave' && !options.mySqlMulti) {
			nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
		} else {
			nameSuffix = options.nameSuffix ? options.nameSuffix : '';
		}
		const fileName = path.join(options.backupDir, `mysql_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
		const fileNameMysql = path.join(options.backupDir, `mysql_${getDate()}_backupiobroker.sql`);

		options.context.fileNames = options.context.fileNames || [];
		options.context.fileNames.push(fileName);

		const child_process = require('child_process');

		child_process.exec(`${options.exe ? options.exe : 'mysqldump'}  -u ${options.user} -p${options.pass} ${options.dbName} -h ${options.host} -P ${options.port}${options.mysqlQuick ? ' --quick' : ''}${options.mysqlSingleTransaction ? ' --single-transaction' : ''} > ${fileNameMysql}`, async (error, stdout, stderr) => {
			if (error) {
				let errLog = '' + error;
				errLog = errLog.replace(new RegExp(options.pass, 'g'), "****");
				options.context.errors.mysql = errLog.toString();
				callback && callback(errLog, stderr);
				callback = null;
			} else {
				let timer = setInterval(async () => {
					if (fs.existsSync(fileName)) {
						const stats = fs.statSync(fileName);
						const fileSize = Math.floor(stats.size / (1024 * 1024));
						log.debug('Packed ' + fileSize + 'MB so far...');
					}
				}, 10000);

				const compress = require('../targz').compress;

				compress({
					src: fileNameMysql,
					dest: fileName,
				}, async (err, stdout, stderr) => {

					clearInterval(timer);

					if (err) {
						options.context.errors.mysql = err.toString();
						if (callback) {
							callback(err, stderr);
							callback = null;
						}
					} else {
						//options.context.done.push('mysql');
						//options.context.types.push('mysql');
						if (fileNameMysql) {
							try {
								fs.unlinkSync(fileNameMysql);
								log.debug('MySql File deleted!');
							} catch (e) {
								log.debug('MySql File cannot deleted: ' + e);
							}
						}
						//callback && callback(null, stdout);
						//callback = null;
						resolve();
					}
				});
			}
		});
	});
}

module.exports = {
	command,
	ignoreErrors: true
};