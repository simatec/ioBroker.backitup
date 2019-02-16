'use strict';

//const {spawn} = require('child_process');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const tools = require('../tools');

const cmdDir = path.join(tools.getIobDir(), 'node_modules/iobroker.backitup/lib');

function command(options, log, callback) {
	if (options.name === 'total' && options.stopIoB) {
		const isWin = process.platform.startsWith('win');

		child_process.exec(isWin ? 'startIOB.bat' : 'bash startIOB.sh', (error, stdout, stderr) => {
			log.debug('IoBroker started ...');
			});

		/*
		const cmd = spawn(isWin ? 'start_b_IOB.bat' : 'bash', [isWin ? '' : 'startIOB.sh'], {detached: true, cwd: cmdDir, stdio: ['ignore', 'ignore', 'ignore']});

		cmd.unref();
		*/

		callback();
    } else {
		callback();
	}
}

module.exports = {
    command,
    ignoreErrors: true
};