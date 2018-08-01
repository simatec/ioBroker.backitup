'use strict';

const Client = require('ftp');
const fs = require('fs');

function command(options, log, callback) {

	const filename = options.backupDir + '/minimal__2018_08_01-17_36_04_backupiobroker.tar.gz';
	const uploadname = options.dir + '/minimal__2018_08_01-17_36_04_backupiobroker.tar.gz';

	const srcFTP = {

		host     : options.host,
		port     : 21,
		user     : options.user,
		password : options.pass
	}
	const c = new Client();

	c.on('ready', function() {
		c.put(filename, uploadname, function(err) {
	  		if (err) throw err;
	  		c.end();
		});
	});
	c.connect(srcFTP), function(error, stdout, stderr) {
        log.error(stderr);
        log.info(stdout);
        callback(null, stdout);
        callback(error);
    }
	//c.end();
}
module.exports = {
    command,
    ignoreErrors: true
};