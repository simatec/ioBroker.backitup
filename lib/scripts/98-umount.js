'use strict';
const fs = require('fs');

function command(options, log, callback) {
	if (!options.mount) {
		return callback && callback('NO mount path specified!');
	}
	if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
		const child_process = require('child_process');

		if (fs.existsSync(options.fileDir + '/.mount')) {
			child_process.exec(`mount | grep -o "${options.backupDir}"`, (error, stdout, stderr) => {
				if (stdout.indexOf(options.backupDir) !== -1) {
					log.debug('mount activ, umount is started ...');
					setTimeout(function () {
						child_process.exec(`${options.sudo ? 'sudo umount' : 'umount'} ${options.backupDir}`, (error, stdout, stderr) => {
							if (error) {
								log.debug('device is busy... wait 2 Minutes!!');
								setTimeout(function () {
									child_process.exec(`${options.sudo ? 'sudo umount' : 'umount'} -l ${options.backupDir}`, (error, stdout, stderr) => {
										if (error) {
											options.context.errors.umount = error;
											log.error(stderr);
											callback && callback(error)
										} else {
											options.context.done.push('umount');
											log.debug('umount successfully completed');
											try {
												fs.existsSync(options.fileDir + '/.mount') && fs.unlinkSync(options.fileDir + '/.mount');
											} catch (e) {
												log.debug('file ".mount" cannot deleted: ' + e);
											}
											callback && callback(null, stdout);
										}
									});
								}, 120000);
							} else {
								options.context.done.push('umount');
								log.debug('umount successfully completed');
								try {
									fs.existsSync(options.fileDir + '/.mount') && fs.unlinkSync(options.fileDir + '/.mount');
								} catch (e) {
									log.debug('file ".mount" cannot deleted: ' + e);
								}
								callback && callback(null, stdout);
							}
						});
					}, 5000);
				}
			});
		}
	} else {
		callback && callback(null);
	}
}

module.exports = {
	command,
	ignoreErrors: true
};