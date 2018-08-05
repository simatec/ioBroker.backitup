'use strict';

const Client = require('ftp');

function uploadFiles(client, dir, fileNames, log, callback) {
	if (!fileNames || !fileNames.length) {
		callback();
	} else {
		let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
		const onlyFileName = fileName.split('/').pop();

        client.put(fileName, dir + '/' + onlyFileName, err => {
        	if (err) {
        		log.error(err);
			}
            setImmediate(uploadFiles, client, fileNames, callback);
        });
	}
}

function command(options, log, callback) {
	if (options.context && options.context.fileNames && options.context.fileNames.length) {
		const client = new Client();
		const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
		client.on('ready', () => {
			uploadFiles(client, options.dir, fileNames, err => {
				client.end();
				if (callback) {
					callback(err);
					callback = null;
				}
			});
		});
		client.on('error', err => {
			if (callback) {
				callback(err);
				callback = null;
			}
		});

		const srcFTP = {
			host     : options.host,
			port     : options.port || 21,
			user     : options.user,
			password : options.pass
		};

		client.connect(srcFTP);
	} else {
		callback();
	}
}

module.exports = {
    command,
    ignoreErrors: true
};