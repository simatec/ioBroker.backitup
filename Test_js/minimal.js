const iobDir = "/opt/iobroker/"; // hier muss noch der variable Pfad gebaut werden
const child_process = require('child_process');
child_process.fork(iobDir +'node_modules/iobroker.js-controller/iobroker.js backup test.tar.gz');
