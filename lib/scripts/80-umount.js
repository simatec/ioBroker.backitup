'use strict';
const child_process = require('child_process');

function command(options, log, callback) {
    if (!options.mount) {
        return callback('NO mount path specified!');
    }

	child_process.exec(`umount ${options.backupDir}`, (error, stdout, stderr) => {
		if (error) {
            log.error(stderr);
			callback(error)
		} else {
            callback(null, stdout);
		}
	});
}

module.exports = {
    command,
    ignoreErrors: true
};