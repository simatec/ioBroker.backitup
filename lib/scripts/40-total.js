'use strict';

const targz = require('targz');
const path = require('path');

function command(options, log, callback) {

	targz.compress({
		src: options.dir,
		dest: options.backupDir + '/test2.tar.gz', // Todo Filename durch Variable aus der main.js ersetzen
		tar: {
			ignore: function(name) {
				return path.dirname(name) === options.backupDir
			}
		},
		gz: {
			level: 6,
			memLevel: 6
		}
	}, function(err, stdout, stderr){
		if(err) {
			console.log(err);
			callback(err)
		} else {
			console.log("Done!");
			callback(null, stdout);
		}
	});
}

module.exports = {
    command,
    ignoreErrors: true
};