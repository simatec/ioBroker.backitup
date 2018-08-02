'use strict';

const Client = require('ftp');
const fs = require('fs');

function command(options, log, callback) {

	const filename = options.backupDir + '/minimal__2018_08_02-17_37_43_backupiobroker.tar.gz'; // Todo Filename durch Variable aus der main.js ersetzen
	const uploadname = options.dir + '/minimal__2018_08_02-17_37_43_backupiobroker.tar.gz'; // Todo Filename durch Variable aus der main.js ersetzen

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
	c.connect(srcFTP);
}

module.exports = {
    command,
    ignoreErrors: true
};