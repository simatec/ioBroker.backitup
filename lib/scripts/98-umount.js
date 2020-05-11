'use strict';
const child_process = require('child_process');
const fs = require('fs');

function command(options, log, callback) {
	if (!options.mount) {
		return callback('NO mount path specified!');
	}
	if (options.mountType === 'CIFS' || options.mountType === 'NFS') {
		if (fs.existsSync(options.fileDir + '/.mount')) {
			child_process.exec(`mount | grep -o "${options.backupDir}"`, (error, stdout, stderr) => {
				if (stdout.indexOf(options.backupDir) !== -1) {
					log.debug('mount activ... umount in 60 Seconds!!');
					setTimeout(function () {
						child_process.exec(`${options.sudo ? 'sudo umount' : 'umount'} ${options.backupDir}`, (error, stdout, stderr) => {
							if (error) {
								log.debug('device is busy... wait 10 Minutes!!');
								setTimeout(function () {
									child_process.exec(`${options.sudo ? 'sudo umount' : 'umount'} ${options.backupDir}`, (error, stdout, stderr) => {
										if (error) {
											options.context.errors.umount = error;
											log.error(stderr);
											callback(error)
										} else {
											options.context.done.push('umount');
											log.debug('umount successfully completed');
											try {
												fs.existsSync(options.fileDir + '/.mount') && fs.unlinkSync(options.fileDir + '/.mount');
											} catch (e) {
												log.debug('file ".mount" cannot deleted: ' + e);
											}
											callback(null, stdout);
										}
									});
								}, 600000);
							} else {
								options.context.done.push('umount');
								log.debug('umount successfully completed');
								try {
									fs.existsSync(options.fileDir + '/.mount') && fs.unlinkSync(options.fileDir + '/.mount');
								} catch (e) {
									log.debug('file ".mount" cannot deleted: ' + e);
								}
								callback(null, stdout);
							}
						});
					}, 60000);
				}
			});
		}
	} else {
		callback(null);
	}
}

module.exports = {
	command,
	ignoreErrors: true
};