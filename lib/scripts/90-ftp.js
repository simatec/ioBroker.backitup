'use strict';

const Client = require('ftp');
const fs = require('fs');

function command(options, log, callback) {

	const filenameMinimal = options.backupDir + '/' + options.backupNameMinimal;
	const uploadnameMinimal = options.dir + '/' + options.backupNameMinimal;
    
    const filenameTotal = options.backupDir + '/' + options.backupNameTotal;
	const uploadnameTotal = options.dir + '/' + options.backupNameTotal;
    
    const filenameRedis = options.backupDir + '/' + options.redisName;
	const uploadnameRedis = options.dir + '/' + options.redisName;
    
    const filenameMysql = options.backupDir + '/' + options.mysqlName;
	const uploadnameMysql = options.dir + '/' + options.mysqlName;

	const srcFTP = {

		host     : options.host,
		port     : 21,
		user     : options.user,
		password : options.pass
	}
	if (options.name === 'minimal') {
		const c = new Client();

		c.on('ready', function() {
			c.put(filenameMinimal, uploadnameMinimal, function(err) {
				if (err) throw err;
					c.end();
			});
		});
		c.connect(srcFTP);
	}
    if (options.name === 'total') {
		const c = new Client();

		c.on('ready', function() {
			c.put(filenameTotal, uploadnameTotal, function(err) {
				if (err) throw err;
					c.end();
			});
		});
		c.connect(srcFTP);
	}
    if (options.name === 'total' && options.redisState === 'true') {
		const c = new Client();

		c.on('ready', function() {
			c.put(filenameRedis, uploadnameRedis, function(err) {
				if (err) throw err;
					c.end();
			});
		});
		c.connect(srcFTP);
	}
    if (options.name === 'total' && options.mysqlState === 'true') {
		const c = new Client();

		c.on('ready', function() {
			c.put(filenameMysql, uploadnameMysql, function(err) {
				if (err) throw err;
					c.end();
			});
		});
		c.connect(srcFTP);
	}
    callback(null);
}

module.exports = {
    command,
    ignoreErrors: true
};