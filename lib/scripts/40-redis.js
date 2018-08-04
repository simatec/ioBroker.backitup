'use strict';
const fs = require('fs');
const targz = require('targz');

function copyFile(source, target, cb) {
    const rd = fs.createReadStream(source);
    rd.on('error', err => {
        if (cb) {
            cb(err);
            cb = null;
        }
    });

    const wr = fs.createWriteStream(target);
    wr.on('error', err => {
        if (cb) {
            cb(err);
            cb = null;
        }
    });
    
    wr.on('close', ex => {
        if (cb) {
            cb();
            cb = null;
        }
    });
    rd.pipe(wr);
}

function command(options, log, callback) {
    copyFile(options.path, options.backupDir + '/redis.rdp',  err => {
        // pack it
        targz.compress({
		src: options.backupDir + '/redis.rdp',
		dest: options.backupDir + '/' + options.backupNameRedis,
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
        callback(err);
    });
}

module.exports = {
    command,
    ignoreErrors: true
};