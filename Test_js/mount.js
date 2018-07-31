// #### child_process.exec funktioniert (manueller Test mit sudo node mount.js ####

const child_process = require('child_process');
child_process.exec('mount -t cifs -o user=xxx,password=xxx,rw,file_mode=0777,dir_mode=0777,vers=1.0 //192.168.123.xxx/HARDDISK/Backup/ioBroker/Test-pi/minimal /opt/iobroker/backups', function(error, stdout, stderr){
	console.log(stdout);
});

// ### child_process.spawn geht bisher nicht ###

//const {spawn} = require('child_process');

//const cmd = spawn('mount', ['-t cifs -o user=xxx,password=xxxxx,rw,file_mode=0777,dir_mode=0777,vers=1.0 //192.168.123.xxx/HARDDISK/Backup/ioBroker/Test-pi/minimal /opt/iobroker/backups',]);
/*
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
        });       cmd.stdout.on('data', data => {
            const text = data.toString();
            const lines = text.split('\n');
            lines.forEach(line => {
                line = line.replace(/\r/g, ' ').trim();
                line && console.log(`[${type}] ${line}`);
            });
            adapter.setState('output.line', '[DEBUG] ' + text);
        });
*/