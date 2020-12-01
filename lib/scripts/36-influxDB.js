'use strict';

const child_process = require('child_process');
const getDate = require('../tools').getDate;
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');

function command(options, log, callback) {
	const fileName = path.join(options.backupDir, `influxDB_${getDate()}${options.nameSuffix ? '_' + options.nameSuffix : ''}_backupiobroker.tar.gz`);
	const tmpDir = path.join(options.backupDir, `influxDB_${getDate()}${options.nameSuffix ? '_' + options.nameSuffix : ''}_backupiobroker`).replace(/\\/g, '/');

	options.context.fileNames = options.context.fileNames || [];
	options.context.fileNames.push(fileName);

	log.debug('Start infulxDB Backup ...');
	let stat;
	if (fs.existsSync(options.backupDir)) {
		stat = fs.statSync(options.backupDir);
	}
	if (!fs.existsSync(tmpDir)) {
		fs.mkdirSync(tmpDir);
		log.debug('Created InfuxDB Backup dir');
	}
	log.debug(`path 1: ${options.exe ? options.exe : 'influxd'} backup -portable -database ${options.dbName}${options.host ? ` -host ${options.host}:${options.port}` : ''} ${tmpDir}`);
	log.debug(`path 2: ${options.exe ? options.exe : 'influxd'} backup -portable -database ${options.dbName} -host ${options.host}:${options.port} ${tmpDir}`);
	child_process.exec(`${options.exe ? options.exe : 'influxd'} backup -portable -database ${options.dbName}${options.host ? ` -host ${options.host}:${options.port}` : ''} ${tmpDir}`, (error, stdout, stderr) => {
		if (error) {
			if (fs.existsSync(tmpDir)) {
				try {
					log.debug('Try deleting the InfluxDB tmp directory');
					fse.removeSync(tmpDir);
					if (!fs.existsSync(tmpDir)) {
						log.debug('InfluxDB tmp directory was successfully deleted');
					}
				} catch(e) {
					log.debug('InfluxDB tmp directory could not be deleted: ' + e);
				}
			}
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
				src: tmpDir,
				dest: fileName,
			}, (err, stdout, stderr) => {

				clearInterval(timer);

				if (err) {
					if (callback) {
						callback(err, stderr);
						callback = null;
					}
				} else {
					options.context.done.push('influxDB');
					options.context.types.push('influxDB');
					if (callback) {
						if (fs.existsSync(tmpDir)) {
							try {
								log.debug('Try deleting the InfluxDB tmp directory');
								fse.removeSync(tmpDir);
								if (!fs.existsSync(tmpDir)) {
									log.debug('InfluxDB tmp directory was successfully deleted');
								}
							} catch(e) {
								log.debug('InfluxDB tmp directory could not be deleted: ' + e);
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