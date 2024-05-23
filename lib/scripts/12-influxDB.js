'use strict';


const getDate = require('../tools').getDate;
const path = require('node:path');
const fs = require('node:fs');
const fse = require('fs-extra');

async function command(options, log, callback) {
	if (options.influxDBMulti) {
		for (let i = 0; i < options.influxDBEvents.length; i++) {
			options.port = options.influxDBEvents[i].port ? options.influxDBEvents[i].port : '';
			options.host = options.influxDBEvents[i].host ? options.influxDBEvents[i].host : '';
			options.dbName = options.influxDBEvents[i].dbName ? options.influxDBEvents[i].dbName : '';
			options.nameSuffix = options.influxDBEvents[i].nameSuffix ? options.influxDBEvents[i].nameSuffix : '';
			options.token = options.influxDBEvents[i].token ? options.influxDBEvents[i].token : '';
			options.dbversion = options.influxDBEvents[i].dbversion ? options.influxDBEvents[i].dbversion : '';
			options.protocol = options.influxDBEvents[i].protocol ? options.influxDBEvents[i].protocol : '';

			log.debug(`InfluxDB-Backup for ${options.nameSuffix} is started ...`);
			await startBackup(options, log, callback);
			log.debug(`InfluxDB-Backup for ${options.nameSuffix} is finish`);
		}

		options.context.done.push('influxDB');
		options.context.types.push('influxDB');

		return callback && callback(null);
	} else if (!options.influxDBMulti) {
		log.debug('InfluxDB-Backup started ...');
		await startBackup(options, log, callback);
		log.debug('InfluxDB-Backup for is finish');

		options.context.done.push('influxDB');
		options.context.types.push('influxDB');

		return callback && callback(null);
	}
}

async function startBackup(options, log, callback) {
	return new Promise(async (resolve) => {
		let nameSuffix;
		if (options.hostType === 'Slave' && !options.influxDBMulti) {
			nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
		} else {
			nameSuffix = options.nameSuffix ? options.nameSuffix : '';
		}
		const fileName = path.join(options.backupDir, `influxDB_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`);
		const tmpDir = path.join(options.backupDir, `influxDB_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker`);

		options.context.fileNames.push(fileName);

		log.debug('Start InfluxDB Backup ...');

		const desiredMode = {
			mode: 0o2775
		};

		if (!fs.existsSync(tmpDir)) {
			try {
				await fse.ensureDir(tmpDir, desiredMode);
			} catch (e) {
				log.debug('InfluxDB Backup tmp directory cannot created ');
			}
			log.debug('InfluxDB Backup tmp directory created ');
		}

		let influxDBCMD;

		if (options.dbversion === '2.x') {
			influxDBCMD = `${options.exe ? `"${options.exe}"` : 'influx'} backup --bucket ${options.dbName}${options.dbType === 'remote' ? ` --host ${options.protocol}://${options.host}:${options.port}${options.protocol === 'https' ? ' --skip-verify' : ''}` : ''} -t ${options.token} "${tmpDir}"`;
		} else {
			influxDBCMD = `${options.exe ? `"${options.exe}"` : 'influxd'} backup -portable -database ${options.dbName}${options.dbType === 'remote' ? ` -host ${options.host}:${options.port}` : ''} "${tmpDir}"`;
		}

		const child_process = require('node:child_process');

		child_process.exec(influxDBCMD, { maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
			if (error) {
				options.context.errors.influxDB = error.toString();
				if (fs.existsSync(tmpDir)) {
					try {
						await delTmp(options, tmpDir, log);
					} catch (err) {
						log.error(`The temporary directory "${tmpDir}" could not be deleted. Please check the directory permissions and delete the directory manually`)
					}
				}
				log.debug(stdout);
				callback && callback(error, stderr);
				callback = null;
				resolve();
			} else {
				let timer = setInterval(async () => {
					if (fs.existsSync(fileName)) {
						const stats = fs.statSync(fileName);
						const fileSize = Math.floor(stats.size / (1024 * 1024));
						log.debug(`Packed ${fileSize}MB so far...`);
					}
				}, 10000);

				const compress = require('../targz').compress;

				compress({
					src: tmpDir,
					dest: fileName,
				}, async (err, stdout, stderr) => {
					clearInterval(timer);
					if (err) {
						options.context.errors.influxDB = err.toString();
						try {
							await delTmp(options, tmpDir, log);
						} catch (err) {
							log.error(`The temporary directory "${tmpDir}" could not be deleted. Please check the directory permissions and delete the directory manually`)

						}

						if (callback) {
							callback(err, stderr);
							callback = null;
						}
						resolve();
					} else {
						log.debug(`Backup created: ${fileName}`)

						if (fs.existsSync(tmpDir)) {
							try {
								await delTmp(options, tmpDir, log);
							} catch (err) {
								log.error(`The temporary directory "${tmpDir}" could not be deleted. Please check the directory permissions and delete the directory manually`)

							}
						}
						resolve();
					}
				});
			}
		});
	});
}

async function delTmp(options, tmpDir, log) {
	return new Promise(async (resolve, reject) => {
		log.debug(`Try deleting the InfluxDB tmp directory: "${tmpDir}"`);

		await fse.remove(tmpDir)
			.then(() => {
				if (!fs.existsSync(tmpDir)) {
					log.debug(`InfluxDB tmp directory "${tmpDir}" successfully deleted`);
				}
				resolve();
			})
			.catch(err => {
				options.context.errors.influxDB = JSON.stringify(err);
				log.error(`The temporary directory "${tmpDir}" could not be deleted. Please check the directory permissions and delete the directory manually`)
				reject(err);
			});
	});
}

module.exports = {
	command,
	ignoreErrors: true
};
