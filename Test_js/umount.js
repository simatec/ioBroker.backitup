// #### child_process.exec funktioniert (manueller Test mit sudo node umount.js ####
/*
const child_process = require('child_process');
child_process.exec('umount /opt/iobroker/backups', function(error, stdout, stderr){
	console.log(stdout);
});
*/

// ### child_process.spawn funktioniert (manueller Test mit sudo node umount.js ####

const {spawn} = require('child_process');

const cmd = spawn('umount', ['/opt/iobroker/backups',]); // Pfad nur zum testen ... muss noch mit iobrokerdir angepasst werden

        cmd.stdout.on('data', data => {
		            const text = data.toString();
		            const lines = text.split('\n');
		            lines.forEach(line => {
		                line = line.replace(/\r/g, ' ').trim();
		                line && adapter.log.debug(`[${type}] ${line}`);
		            });
		            adapter.setState('output.line', '[DEBUG] ' + text);
		        });

		        cmd.stderr.on('data', data => {
		            const text = data.toString();
		            const lines = text.split('\n');
		            lines.forEach(line => {
		                line = line.replace(/\r/g, ' ').trim();
		                if (line) {
		                    if (text[0] === '*' || text[0] === '<' || text[0] === '>') {
		                        adapter.log.debug(`[${type}] ${line}`);
		                    } else {
		                        adapter.log.error(`[${type}] ${line}`);
		                    }
		                }
		            });

		            if (text[0] === '*' || text[0] === '<' || text[0] === '>') {
		                adapter.setState('output.line', '[DEBUG] ' + text);
		            } else {
		                adapter.setState('output.line', '[ERROR] ' + text);
		            }
        });
