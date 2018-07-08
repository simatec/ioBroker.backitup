/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const { exec } = require('child_process');
var schedule = require('node-schedule');

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.backitup.0
const adapter = new utils.Adapter('backitup');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

/*
// Im Script unten integriert und in Verwendung
// deshalb hier auskommentiert.
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});
*/
// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function main() {

// ############## Anfang backitup #########################

// -----------------------------------------------------------------------------
// allgemeine Variablen
// -----------------------------------------------------------------------------
const logging = adapter.config.state_log;                                                 // Logging on/off
const debugging = adapter.config.state_debug;										      // Detailiertere Loggings

const bash_script = 'bash /opt/iobroker/node_modules/iobroker.backitup/backitup.sh ';        // Pfad zu backup.sh Datei

const anzahl_eintraege_history = adapter.config.history_status;                          // Anzahl der Einträge in der History

let Backup = [];                                                // Array für die Definition der Backuptypen und deren Details

// Konfigurationen für das Standard-IoBroker Backup
    Backup[0] = [];
    Backup[0][0] = 'minimal';                                   // Backup Typ (nicht verändern!)
    Backup[0][1] = adapter.config.minimal_NamensZusatz;        	// Names Zusatz, wird an den Dateinamen angehängt
    Backup[0][2] = adapter.config.minimal_BackupLoeschenNach;  	// Alte Backups löschen nach X Tagen
    Backup[0][3] = adapter.config.FtpHost;             	        // FTP-Host
	if(adapter.config.nas_var === true) {             	        // genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server
		Backup[0][4] = adapter.config.FtpDir_minimal;
	}
	else {
	    Backup[0][4] = adapter.config.FtpDir;
	}
    Backup[0][5] = adapter.config.FtpUser;             	        // Username für FTP Server - Verbindung
    Backup[0][6] = adapter.config.FtpPw;               	        // Passwort für FTP Server - Verbindung
    Backup[0][7] = '';                                          // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[0][8] = '';                                          // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[0][9] = '';                                          // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[0][10] = adapter.config.CifsMount;         	        // Festlegen ob CIFS-Mount genutzt werden soll
    Backup[0][11] = '';                                         // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[0][12] = '';                                         // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)


// Konfigurationen für das Komplette-IoBroker Backup

    Backup[1] = [];
    Backup[1][0] = 'komplett';                                  // Backup Typ (nicht verändern)
    Backup[1][1] = adapter.config.komplett_NamensZusatz;       	// Names Zusatz, wird an den Dateinamen angehängt
    Backup[1][2] = adapter.config.komplett_BackupLoeschenNach; 	// Alte Backups löschen nach X Tagen
    Backup[1][3] = adapter.config.FtpHost;            	        // FTP-Host
    if(adapter.config.nas_var === true) {             	        // genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server
		Backup[1][4] = adapter.config.FtpDir_komplett;
	}
	else {
    	Backup[1][4] = adapter.config.FtpDir;
	}
    Backup[1][5] = adapter.config.FtpUser;            	        // Username für FTP Server - Verbindung
    Backup[1][6] = adapter.config.FtpPw;              	        // Passwort für FTP Server - Verbindung
    Backup[1][7] = '';                                          // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[1][8] = '';                                          // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[1][9] = '';                                          // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[1][10] = adapter.config.CifsMount;       		    // Festlegen ob CIFS-Mount genutzt werden soll
    Backup[1][11] = adapter.config.IoStopStart;         	    // Festlegen ob IoBroker gestoppt/gestartet wird
    Backup[1][12] = adapter.config.redis_state;         	    // Festlegen ob die Redis-DB mit gesichert werden soll

// Konfiguration für das CCU / pivCCU / Raspberrymatic Backup

    Backup[2] = [];
    Backup[2][0] = 'ccu';                                       // Backup Typ (nicht verändern)
    Backup[2][1] = '';                                          // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[2][2] = adapter.config.ccu_BackupLoeschenNach;       // Alte Backups löschen nach X Tagen
    Backup[2][3] = adapter.config.FtpHost;            	        // FTP-Host
    if(adapter.config.nas_var === true) {             	        // genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server
			Backup[2][4] = adapter.config.FtpDir_ccu;
		}
		else {
	    	Backup[2][4] = adapter.config.FtpDir;
	}
    Backup[2][5] = adapter.config.FtpUser;            	        // Username für FTP Server - Verbindung
    Backup[2][6] = adapter.config.FtpPw;              	        // Passwort für FTP Server - Verbindung
    Backup[2][7] = adapter.config.ccuCcuIp;                     // IP-Adresse der CCU
    Backup[2][8] = adapter.config.ccuCcuUser;                   // Username der CCU
    Backup[2][9] = adapter.config.ccuCcuPw;                     // Passwort der CCU
    Backup[2][10] = adapter.config.CifsMount;         	        // Festlegen ob CIFS-Mount genutzt werden soll
    Backup[2][11] = '';                                         // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)
    Backup[2][12] = '';                                         // Nicht benötigt bei diesem BKP-Typ (nicht verändern!)

const Mysql_DBname = adapter.config.MysqlDbName;                // Name der Datenbank
const Mysql_User = adapter.config.MysqlDbUser;           	    // Benutzername für Datenbank
const Mysql_PW = adapter.config.MysqlDbPw;           		    // Passwort für Datenbank
const Mysql_LN = adapter.config.MysqlBackupLoeschenNach; 	    // DB-Backup löschen nach X Tagen
const Mysql_Host = adapter.config.MysqlHost; 	                // Hostname

let BkpZeit_Schedule = [];                                      // Array für die Backup Zeiten

let Enum_ids =[];                                               // Array für die ID's die später in der enum.function erstellt werden

let history_array = [];                                         // Array für das anlegen der Backup-Historie
// =============================================================================
// Objekte
// =============================================================================

// Leere Datenpunkte mit Standardwerten befüllen.
adapter.getState('History.Backup_history', function (err, state) {
    if(state ===null  || state.val===null) {
        adapter.setState('History.Backup_history', { val: '<span class="bkptyp_komplett">Noch keine Backups erstellt</span>', ack: true });}
});
adapter.getState('History.letztes_minimal_Backup', function (err, state) {
    if(state ===null  || state.val===null) {
        adapter.setState('History.letztes_minimal_Backup', { val: 'Noch keine Backups erstellt', ack: true });}
});
adapter.getState('History.letztes_komplett_Backup', function (err, state) {
    if(state ===null  || state.val===null) {
        adapter.setState('History.letztes_komplett_Backup', { val: 'Noch keine Backups erstellt', ack: true });}
});
adapter.getState('History.letztes_ccu_Backup', function (err, state) {
    if(state ===null  || state.val===null) {
        adapter.setState('History.letztes_ccu_Backup', { val: 'Noch keine Backups erstellt', ack: true });}
});
adapter.getState('OneClick.start_minimal_Backup', function (err, state) {
    if(state ===null  || state.val===null) {adapter.setState('OneClick.start_minimal_Backup', { val:false, ack: true });}
});
adapter.getState('OneClick.start_komplett_Backup', function (err, state) {
    if(state ===null  || state.val===null) {
        adapter.setState('OneClick.start_komplett_Backup', { val:false, ack: true });}
});
adapter.getState('OneClick.start_ccu_Backup', function (err, state) {
    if(state ===null  || state.val===null) {
        adapter.setState('OneClick.start_ccu_Backup', { val:false, ack: true });}
});

// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$

// #############################################################################
// #                                                                           #
// #  Funktion zum anlegen eines Schedules fuer Backupzeit                      #
// #                                                                           #
// #############################################################################

function BackupStellen() {
    adapter.setState('Auto_Backup', false);
    Backup.forEach(function(Bkp) {

           if(adapter.config[Bkp[0]+'_BackupState'] === true) {

			    let BkpUhrZeit = (adapter.config[Bkp[0]+'_BackupZeit']).split(':');

                if(logging) adapter.log.info('Ein '+Bkp[0]+' Backup wurde um '+adapter.config[Bkp[0]+'_BackupZeit']+' Uhr jeden '+adapter.config[Bkp[0]+'_BackupTageZyklus']+' Tag  aktiviert');

                if(BkpZeit_Schedule[Bkp[0]]) schedule.clearScheduleJob(BkpZeit_Schedule[Bkp[0]]);

                BkpZeit_Schedule[Bkp[0]] = schedule.scheduleJob('10 '+BkpUhrZeit[1] + ' ' +BkpUhrZeit[0] + ' */'+adapter.config[Bkp[0]+'_BackupTageZyklus']+' * * ', function (){
                	backup_erstellen(Bkp[0], Bkp[1], Bkp[2], Bkp[3], Bkp[4], Bkp[5], Bkp[6], Bkp[7], Bkp[8], Bkp[9], Bkp[10], Bkp[11], Bkp[12], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN, Mysql_Host);
                });

                if(debugging) adapter.log.info('10 '+BkpUhrZeit[1] + ' ' + BkpUhrZeit[0] + ' */'+adapter.config[Bkp[0]+'_BackupTageZyklus']+' * * ');
            }
            else {
                if(logging) adapter.log.info ('Das '+Bkp[0]+' Backup wurde deaktiviert');

                if(BkpZeit_Schedule[Bkp[0]]) schedule.clearScheduleJob(BkpZeit_Schedule[Bkp[0]]);
            }
    });
}

// #############################################################################
// #                                                                           #
// #  Funktion zum Ausführen des Backups mit obigen Einstellungen              #
// #                                                                           #
// #############################################################################


function backup_erstellen(typ, name, zeit, host, pfad, user, passwd, ccuip, ccuusr, ccupw, cifsmnt, bkpiors, redisst, mysqldb, mysqlusr, mysqlpw, mysqlln, mysqlhost) {

    if(debugging) adapter.log.info(bash_script+'"'+typ+'|'+name+'|'+zeit+'|'+host+'|'+pfad+'|'+user+'|'+passwd+'|'+ccuip+'|'+ccuusr+'|'+ccupw+'|'+cifsmnt+'|'+bkpiors+'|'+redisst+'|'+mysqldb+'|'+mysqlusr+'|'+mysqlpw+'|'+mysqlln+'|'+mysqlhost+'"');

// Telegram
    if(adapter.config.telegram_message === true){
        adapter.log.info('Telegram Message ist aktiv');

        let messagetext = 'Es wurde am '+HistoryEintrag(new Date())+' ein neues '+typ+' Backup erstellt';
        if(host !== '') messagetext += ', und nach '+host+pfad+' kopiert/verschoben';
        messagetext += '!';
        adapter.sendTo("telegram", "send", {text: 'BackItUp:\n' + messagetext});
//        adapter.sendTo("telegram", "send", {text: (String('BackItUp:\n' + messagetext))});
    }

// hier kein new HistoryEintrag(new Date()) machen dann funktioniert das ganze nicht mehr
    adapter.setState('History.letztes_'+typ+'_Backup', HistoryEintrag(new Date()));

    let ftp_bkp_u;
    if(cifsmnt === 'FTP') ftp_bkp_u = 'FTP'; else ftp_bkp_u = 'CIFS';
    new Backup_history_anlegen(typ, ftp_bkp_u);

    exec((bash_script+' "'+typ+'|'+name+'|'+zeit+'|'+host+'|'+pfad+'|'+user+'|'+passwd+'|'+ccuip+'|'+ccuusr+'|'+ccupw+'|'+cifsmnt+'|'+bkpiors+'|'+redisst+'|'+mysqldb+'|'+mysqlusr+'|'+mysqlpw+'|'+mysqlln+'|'+mysqlhost+'"'), function(err, stdout, stderr) {
        if(logging){
            if(err) adapter.log.info(stderr, 'error');
            else adapter.log.info('exec: ' + stdout);
        }
    });

}
// #############################################################################
// #                                                                           #
// #  Funktion zum erstellen eines Datum-Strings                               #
// #                                                                           #
// #############################################################################

function HistoryEintrag(date) {
  const MonatsNamen = [
    "Januar", "Februar", "Maerz",
    "April", "Mai", "Juni", "Juli",
    "August", "September", "Oktober",
    "November", "Dezember"
  ];

  let Tag = date.getDate();
  let MonatsIndex = date.getMonth();
  let Jahr = date.getFullYear();
  let Stunde = date.getHours();
  let Minute = date.getMinutes();

//  return Tag+' '+MonatsNamen[MonatsIndex]+' '+Jahr+ ' um '+Stunde+':'+Minute+' Uhr';
  return ('0' + Tag).slice(-2)+' '+MonatsNamen[MonatsIndex]+' '+Jahr+ ' um '+('0' + Stunde).slice(-2)+':'+('0' + Minute).slice(-2)+' Uhr';

}

// #############################################################################
// #                                                                           #
// #  Backupdurchführung in History eintragen                                  #
// #                                                                           #
// #############################################################################

function Backup_history_anlegen(typ, ftp_bkp_u) {
   adapter.getState('History.Backup_history', function (err, state) {
        let history_liste = state.val;
        if(history_liste == '<span class="bkptyp_komplett">Noch keine Backups erstellt</span>') history_liste = '';
        history_array = history_liste.split('&nbsp;');
        if(history_array.length >= anzahl_eintraege_history){
            history_array.splice((anzahl_eintraege_history - 1),1);
        }
        let zeitstempel = HistoryEintrag(new Date());
        history_array.unshift('<span class="bkptyp_'+typ+'">' + zeitstempel + ' - Typ:' +typ+ ' - NAS-Sicherung: ' +ftp_bkp_u+ '</span>');

        adapter.setState('History.Backup_history', history_array.join('&nbsp;'));
    });

}


// #############################################################################
// #                                                                           #
// #  Ablaeufe nach Neustart des Backupscripts                                  #
// #                                                                           #
// #############################################################################

function ScriptStart() {

    new BackupStellen();

}

// #############################################################################
// #                                                                           #
// #  Beobachten der drei One-Click-Backup Datenpunkte                         #
// #  - Bei Aktivierung start des jeweiligen Backups                           #
// #                                                                           #
// #############################################################################

adapter.subscribeStates('OneClick*'); // subscribe on all variables of this adapter instance with pattern "adapterName.X.memory*"

// Wird ausgefürt wenn sich ein State ändert
adapter.on('stateChange', function (id, state) {

    if (id == adapter.name+'.'+adapter.instance+'.OneClick.start_minimal_Backup' && state.val === true ){
        adapter.log.info('OneClick Minimal Backup gestartet');
        backup_erstellen(Backup[0][0], Backup[0][1], Backup[0][2], Backup[0][3], Backup[0][4], Backup[0][5], Backup[0][6], Backup[0][7], Backup[0][8], Backup[0][9], Backup[0][10], Backup[0][11], Backup[0][12], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN, Mysql_Host);
        if(debugging)adapter.log.info('backup_erstellen('+Backup[0][0]+','+Backup[0][1]+','+Backup[0][2]+','+Backup[0][3]+','+Backup[0][4]+','+Backup[0][5]+','+Backup[0][6]+','+Backup[0][7]+','+Backup[0][8]+','+Backup[0][9]+','+Backup[0][10]+','+Backup[0][11]+','+Backup[0][12]+','+Mysql_DBname+','+Mysql_User+','+Mysql_PW+','+Mysql_LN+','+Mysql_Host+')');
        setTimeout(function(){ adapter.setState('OneClick.start_minimal_Backup', false, true); }, 20000);
    }
    if (id == adapter.name+'.'+adapter.instance+'.OneClick.start_komplett_Backup' && state.val === true ){
        adapter.log.info('OneClick Komplett Backup gestartet');
        backup_erstellen(Backup[1][0], Backup[1][1], Backup[1][2], Backup[1][3], Backup[1][4], Backup[1][5], Backup[1][6], Backup[1][7], Backup[1][8], Backup[1][9], Backup[1][10], Backup[1][11], Backup[1][12], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN, Mysql_Host);
        if(debugging)adapter.log.info('backup_erstellen('+Backup[1][0]+','+Backup[1][1]+','+Backup[1][2]+','+Backup[1][3]+','+Backup[1][4]+','+Backup[1][5]+','+Backup[1][6]+','+Backup[1][7]+','+Backup[1][8]+','+Backup[1][9]+','+Backup[1][10]+','+Backup[1][11]+','+Backup[1][12]+','+Mysql_DBname+','+Mysql_User+','+Mysql_PW+','+Mysql_LN+','+Mysql_Host+')');
        setTimeout(function(){ adapter.setState('OneClick.start_komplett_Backup', false, true); }, 5000);
    }
    if (id == adapter.name+'.'+adapter.instance+'.OneClick.start_ccu_Backup' && state.val === true ){
        adapter.log.info('OneClick CCU Backup gestartet');
        backup_erstellen(Backup[2][0], Backup[2][1], Backup[2][2], Backup[2][3], Backup[2][4], Backup[2][5], Backup[2][6], Backup[2][7], Backup[2][8], Backup[2][9], Backup[2][10], Backup[2][11], Backup[2][12], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN, Mysql_Host);
        if(debugging)adapter.log.info('backup_erstellen('+Backup[2][0]+','+Backup[2][1]+','+Backup[2][2]+','+Backup[2][3]+','+Backup[2][4]+','+Backup[2][5]+','+Backup[2][6]+','+Backup[2][7]+','+Backup[2][8]+','+Backup[2][9]+','+Backup[2][10]+','+Backup[2][11]+','+Backup[2][12]+','+Mysql_DBname+','+Mysql_User+','+Mysql_PW+','+Mysql_LN+','+Mysql_Host+')');
        setTimeout(function(){ adapter.setState('OneClick.start_ccu_Backup', false, true); }, 20000);
    }

});

ScriptStart();


// ############## Ende backitup #########################
/*
    adapter.checkGroup('admin', 'admin', function (res) {
        console.log('check group user admin group admin: ' + res);
    });
*/


}
