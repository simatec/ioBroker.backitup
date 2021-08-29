'use strict';


const getDate = require('../tools').getDate;
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

function command(options, log, callback) {
	let nameSuffix;
	if (options.hostType == 'Slave') {
		nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
	} else {
		nameSuffix = options.nameSuffix ? options.nameSuffix : '';
	}
	const fileName = path.join(options.backupDir, `influxDB_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);
	const tmpDir = path.join(options.backupDir, `influxDB_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker`);

	//options.context.fileNames = options.context.fileNames || [];
	options.context.fileNames.push(fileName);

	log.debug('Start InfluxDB Backup ...');
	let stat;
	const desiredMode = '0o2775';

	if (fs.existsSync(options.backupDir)) {
		stat = fs.statSync(options.backupDir);
	}
	if (!fs.existsSync(tmpDir)) {
		fse.ensureDirSync(tmpDir, desiredMode);
		//fs.mkdirSync(tmpDir);
		log.debug('InfluxDB Backup tmp directory created ');
	}
	const child_process = require('child_process');

	child_process.exec(`${options.exe ? `"${options.exe}"` : 'influxd'} backup -portable -database ${options.dbName}${options.dbType == 'remote' ? ` -host ${options.host}:${options.port}` : ''} "${tmpDir}"`, (error, stdout, stderr) => {
		if (error) {
			options.context.errors.influxDB = error.toString();
			if (fs.existsSync(tmpDir)) {
				try {
					log.debug('Try deleting the InfluxDB tmp directory');
					fse.removeSync(tmpDir);
					if (!fs.existsSync(tmpDir)) {
						log.debug('InfluxDB tmp directory was successfully deleted');
					}
				} catch (e) {
					log.debug('InfluxDB tmp directory could not be deleted: ' + e);
				}
			}
			callback && callback(error, stderr);
			callback = null;
		} else {
			let timer = setInterval(() => {
				if (fs.existsSync(fileName)) {
					const stats = fs.statSync(fileName);
					const fileSize = Math.floor(stats.size / (1024 * 1024));
					log.debug('Packed ' + fileSize + 'MB so far...');
				}
			}, 10000);

			const compress = require('../targz').compress;

			compress({
				src: tmpDir,
				dest: fileName,
			}, (err, stdout, stderr) => {
				clearInterval(timer);
				if (err) {
					options.context.errors.influxDB = err.toString();
					try {
						log.debug('Try deleting the InfluxDB tmp directory');
						fse.removeSync(tmpDir);
						if (!fs.existsSync(tmpDir)) {
							log.debug('InfluxDB tmp directory was successfully deleted');
						}
					} catch (e) {
						log.debug('InfluxDB tmp directory could not be deleted: ' + e);
					}
					if (callback) {
						callback(err, stderr);
						callback = null;
					}
				} else {
					log.debug(`Backup created: ${fileName}`)
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
							} catch (e) {
								log.debug('InfluxDB tmp directory could not be deleted: ' + e);
							}
						}
						callback && callback(null, stdout);
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