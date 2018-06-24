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

/*Variable declaration, since ES6 there are let to declare variables. Let has a more clearer definition where
it is available then var.The variable is available inside a block and it's childs, but not outside.
You can define the same variable name inside a child without produce a conflict with the variable of the parent block.*/
let variable = 1234;

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

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

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

// config zum testen in Log schreiben
/*
    adapter.log.info('config minimal_BackupState: '    + adapter.config.minimal_BackupState);
    adapter.log.info('config minimal_BackupZeit: '    + adapter.config.minimal_BackupZeit);
    adapter.log.info('config minimal_BackupTageZyklus: ' + adapter.config.minimal_BackupTageZyklus);
    adapter.log.info('config minimal_BackupState: ' + adapter.config.minimal_BackupState);
    adapter.log.info('config minimal_BackupZeit: ' + adapter.config.minimal_BackupZeit);
	adapter.log.info('config minimal_BackupTageZyklus: ' + adapter.config.minimal_BackupTageZyklus);
	adapter.log.info('config minimal_BackupLoeschenNach: ' + adapter.config.minimal_BackupLoeschenNach);
	adapter.log.info('config minimal_NamensZusatz: ' + adapter.config.minimal_NamensZusatz);
	adapter.log.info('config komplett_BackupState: ' + adapter.config.komplett_BackupState);
	adapter.log.info('config komplett_BackupZeit: ' + adapter.config.komplett_BackupZeit);
	adapter.log.info('config komplett_BackupTageZyklus: ' + adapter.config.komplett_BackupTageZyklus);
	adapter.log.info('config komplett_BackupLoeschenNach: ' + adapter.config.komplett_BackupLoeschenNach);
	adapter.log.info('config komplett_NamensZusatz: ' + adapter.config.komplett_NamensZusatz);
	adapter.log.info('config IoStopStart: ' + adapter.config.IoStopStart);
	adapter.log.info('config MysqlDbName: ' + adapter.config.MysqlDbName);
	adapter.log.info('config MysqlDbUser: ' + adapter.config.MysqlDbUser);
	adapter.log.info('config MysqlDbPw: ' + adapter.config.MysqlDbPw);
	adapter.log.info('config MysqlBackupLoeschenNach: ' + adapter.config.MysqlBackupLoeschenNach);
	adapter.log.info('config ccu_BackupState: ' + adapter.config.ccu_BackupState);
	adapter.log.info('config ccu_BackupZeit: ' + adapter.config.ccu_BackupZeit);
	adapter.log.info('config ccu_BackupTageZyklus: ' + adapter.config.ccu_BackupTageZyklus);
	adapter.log.info('config ccu_BackupLoeschenNach: ' + adapter.config.ccu_BackupLoeschenNach);
	adapter.log.info('config ccu_NamensZusatz: ' + adapter.config.ccu_NamensZusatz);
	adapter.log.info('config ccuCcuIp: ' + adapter.config.ccuCcuIp);
	adapter.log.info('config ccuCcuUser: ' + adapter.config.ccuCcuUser);
	adapter.log.info('config ccuCcuPw: ' + adapter.config.ccuCcuPw);
	adapter.log.info('config CifsMount: ' + adapter.config.CifsMount);
	adapter.log.info('config FtpHost: ' + adapter.config.FtpHost);
	adapter.log.info('config FtpDir: ' + adapter.config.FtpDir);
	adapter.log.info('config FtpUser: ' + adapter.config.FtpUser);
	adapter.log.info('config FtpPw: ' + adapter.config.FtpPw);
*/
// -----------------------------------------------------------------------------
// allgemeine Variablen
// -----------------------------------------------------------------------------
const logging = true;                                                 // Logging on/off
const debugging = false;										        // Detailiertere Loggings
const instanz = 'backitup.0.';                                                              //


const bash_script = 'bash /opt/iobroker/node_modules/iobroker.backitup/backitup.sh ';        // Pfad zu backup.sh Datei

const anzahl_eintraege_history = 25;                          // Anzahl der EintrŠge in der History


//#################################################################################################
//###                                                                                           ###
//###  Ab hier nichts mehr Šndern alle Einstellungen sind in den angelegten Datenpunkten oder   ###
//###  den paar wenigen obigen Variablen zu tŠtigen                                             ###
//###                                                                                           ###
//#################################################################################################


let Backup = [];                                        // Array fŸr die Definition der Backuptypen und deren Details

// Konfigurationen für das Standard-IoBroker Backup

    Backup[0] = [];
    Backup[0][0] = 'minimal';   // Backup Typ (nicht verŠndern!)
    Backup[0][1] = adapter.config.minimal_NamensZusatz;        	// Names Zusatz, wird an den Dateinamen angehŠngt bspw. Master/Slave (falls gewŸnscht, ansonsten leer lassen)
    Backup[0][2] = adapter.getState(adapter.config.minimal_BackupLoeschenNach);  	// Alte Backups lšschen nach X Tagen (falls gewŸnscht, ansonsten leer lassen)
    Backup[0][3] = adapter.getState(adapter.config.FtpHost);             	// FTP-Host
    Backup[0][4] = adapter.getState(adapter.config.FtpDir);              	// genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server (falls gewŸnscht, ansonsten leer lassen)
    Backup[0][5] = adapter.getState(adapter.config.FtpUser);             	// Username fŸr FTP Server - Verbindung
    Backup[0][6] = adapter.getState(adapter.config.FtpPw);               	// Passwort fŸr FTP Server - Verbindung
    Backup[0][7] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)
    Backup[0][8] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)
    Backup[0][9] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)
    Backup[0][10] = adapter.getState(adapter.config.CifsMount);         	// Festlegen ob CIFS-Mount genutzt werden soll
    Backup[0][11] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)


// Konfigurationen fŸr das Komplette-IoBroker Backup

    Backup[1] = [];
    Backup[1][0] = 'komplett';  // Backup Typ (nicht verŠndern)
    Backup[1][1] = adapter.getState(adapter.config.komplett_NamensZusatz);       	// Names Zusatz, wird an den Dateinamen angehŠngt bspw. Master/Slave (falls gewŸnscht, ansonsten leer lassen)
    Backup[1][2] = adapter.getState(adapter.config.komplett_BackupLoeschenNach); 	// Alte Backups lšschen nach X Tagen (falls gewŸnscht, ansonsten leer lassen)
    Backup[1][3] = adapter.getState(adapter.config.FtpHost);            	// FTP-Host
    Backup[1][4] = adapter.getState(adapter.config.FtpDir);             	// genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server (falls gewŸnscht, ansonsten leer lassen)
    Backup[1][5] = adapter.getState(adapter.config.FtpUser);            	// Username fŸr FTP Server - Verbindung
    Backup[1][6] = adapter.getState(adapter.config.FtpPw);              	// Passwort fŸr FTP Server - Verbindung
    Backup[1][7] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)
    Backup[1][8] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)
    Backup[1][9] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)
    Backup[1][10] = adapter.getState(adapter.config.CifsMount);       		// Festlegen ob CIFS-Mount genutzt werden soll
    Backup[1][11] = adapter.getState(adapter.config.IoStopStart);         	// Festlegen ob IoBroker gestoppt/gestartet wird

// Konfiguration fŸr das CCU / pivCCU / Raspberrymatic Backup

    Backup[2] = [];
    Backup[2][0] = 'ccu'; // Backup Typ (nicht verŠndern)
    Backup[2][1] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)
    Backup[2][2] = adapter.getState(adapter.config.ccu_BackupLoeschenNach); // Alte Backups lšschen nach X Tagen (falls gewŸnscht, ansonsten leer lassen)
    Backup[2][3] = adapter.getState(adapter.config.FtpHost);            	// FTP-Host
    Backup[2][4] = adapter.getState(adapter.config.FtpDir);             	// genaue Verzeichnissangabe bspw. /volume1/Backup/ auf FTP-Server (falls gewŸnscht, ansonsten leer lassen)
    Backup[2][5] = adapter.getState(adapter.config.FtpUser);            	// Username fŸr FTP Server - Verbindung
    Backup[2][6] = adapter.getState(adapter.config.FtpPw);              	// Passwort fŸr FTP Server - Verbindung
    Backup[2][7] = adapter.getState(adapter.config.ccuCcuIp);              // IP-Adresse der CCU
    Backup[2][8] = adapter.getState(adapter.config.ccuCcuUser);            // Username der CCU
    Backup[2][9] = adapter.getState(adapter.config.ccuCcuPw);              // Passwort der CCU
    Backup[2][10] = adapter.getState(adapter.config.CifsMount);         	// Festlegen ob CIFS-Mount genutzt werden soll
    Backup[2][11] = ''; // Nicht benštigt bei diesem BKP-Typ (nicht verŠndern!)

const Mysql_DBname = adapter.getState(adapter.config.MysqlDbName);           // Name der Datenbank (wenn nicht verwendet leer lassen!)
const Mysql_User = adapter.getState(adapter.config.MysqlDbUser);           	// Benutzername fŸr Datenbank (wenn nicht verwendet leer lassen!)
const Mysql_PW = adapter.getState(adapter.config.MysqlDbPw);           		// Passwort fŸr Datenbank (wenn nicht verwendet leer lassen!)
const Mysql_LN = adapter.getState(adapter.config.MysqlBackupLoeschenNach); 	// DB-Backup lšschen nach (wenn nicht verwendet leer lassen!)

let BkpZeit_Schedule = [];                              // Array fuer die Backup Zeiten

let Enum_ids =[];                                       // Array fuer die ID's die spŠter in der enum.function erstellt werden

let history_array = [];                                // Array fuer das anlegen der Backup-Historie
// =============================================================================
// Objekte
// =============================================================================
// Objekt zur PrŸfung ob Auto_Backup aktiv ist.


adapter.log.info('--------------------------------------- Anfang Log ---------------------------------');

adapter.getState('History.letztes_ccu_Backup', function (err, state) {
    adapter.log.info(
          state.val
    ); 

}); 

//Test SetState
//adapter.setState('History.letztes_ccu_Backup', { val: 'funktioniert des zeug', ack: true });

/*
adapter.getState('state.name', function (err, state) {
        // err prüfen, wenn err gesetzt dann Fehler
        // state checken, kann leer/null/undefined sein!
        // sonst state.val
        if (state.val === 'whatever') {
           ... logik
        }
});
*/

adapter.log.info('--------------------------------------- Ende Log ---------------------------------');


/* Beispeil zum Anlegen der Datenpunkte
adapter.setObjectNotExists('test.state', {
            type: 'state',
            common: {
               name: 'STATE of ',
                desc: 'Boolean datapoint for switches for ',
                type: 'boolean',
                role: 'switch',
                def: false,
                read: true,
                write: true
            },
            native: {}
        });
*/

adapter.setObjectNotExists('Auto_Backup', {type: 'state', common: {name: 'Automatisches Backup', type: 'boolean', state: 'false', role: 'indicator'}, native: {}});
adapter.setObjectNotExists('Auto_Backup_test', {type: 'state', common: {name: 'Automatisches Backup', type: 'boolean', state: 'false', role: 'indicator'}, native: {}});

// Neu seit V2 Objekt zur Erstellung der enum.functions EintrŠge
adapter.setObjectNotExists('Konfiguration.Konfig_abgeschlossen', {type: 'state', common: {name: 'Alle benoetigten Objekte erstellt', type: 'boolean', state: 'false', role: 'indicator'}, native: {}});

// Neu seit V2 Objekt zum PrŸfen ob IoBroker wegen einem kompletten Backup neu gestartet ist.
adapter.setObjectNotExists('Konfiguration.IoRestart_komp_Bkp', {type: 'state', common: {name: 'Restart IoBroker wegen komplett Backup', type: 'boolean', state: 'false', role: 'indicator'}, native: {}});

//Neu seit V2 HistoryLog fŸr die ausgefŸhren Backups
adapter.setObjectNotExists('History.' + 'Backup_history', {type: 'state', common: {name: 'History der Backups', type: 'string', state: '<span class="bkptyp_komplett">Noch kein Backup</span>', role: 'indicator'}, native: {}});

//Neu seit V2 einen separaten Zeitstempel fŸr jeden Backuptyp
adapter.setObjectNotExists('History.letztes_minimal_Backup', {type: 'state', common: {name: 'Letztes minimal Backup', type: 'string', state: 'Noch kein Backup', role: 'indicator'}, native: {}});
adapter.setObjectNotExists('History.letztes_komplett_Backup', {type: 'state', common: {name: 'Letztes komplett Backup', type: 'string', state: 'Noch kein Backup', role: 'indicator'}, native: {}});
adapter.setObjectNotExists('History.letztes_ccu_Backup', {type: 'state', common: {name: 'Letztes CCU Backup', type: 'state', state: 'Noch kein Backup', role: 'indicator'}, native: {}});

//Neu seit V2 ein jetzt Backup durchfŸhren fŸr jeden Backuptyp
adapter.setObjectNotExists('OneClick.start_minimal_Backup', {type: 'state', common: {name: 'Minimal Backup ausfuehren', type: 'boolean', state: 'false', role: 'indicator'}, native: {}});
adapter.setObjectNotExists('OneClick.start_komplett_Backup', {type: 'state', common: {name: 'Komplett Backup ausfuehren', type: 'boolean', state: 'false', role: 'indicator'}, native: {}});
adapter.setObjectNotExists('OneClick.start_ccu_Backup', {type: 'state', common: {name: 'CCU Backup ausfuehren', type: 'boolean', state: 'false', role: 'indicator'}, native: {}});


// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
// $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$

// #############################################################################
// #                                                                           #
// #  Funktion zum anlegen eines Schedules fŸr Backupzeit                      #
// #                                                                           #
// #############################################################################

function BackupStellen() {
    adapter.setState('Auto_Backup', false);
    Backup.forEach(function(Bkp) {

// ###################################### Ab hier mŸssen noch Fehler gesucht werden und Anpssungen gemacht werden (deshalb auskommentiert) ###############################################
           if(adapter.config[Bkp[0]+'_BackupState'] === true) {
              //adapter.log.info('Zeit: ' +adapter.config[Bkp[0]+'_BackupZeit']);
			    var schedule = require('node-schedule');
			    var parser = require('cron-parser');
			    
                let BkpUhrZeit = (adapter.config[Bkp[0]+'_BackupZeit']).split(':');
                adapter.log.info('BkpUhrZeit: ' +BkpUhrZeit);
                if(logging) adapter.log.info('Ein '+Bkp[0]+' Backup wurde um '+adapter.config[Bkp[0]+'_BackupZeit']+' Uhr jeden '+adapter.config[Bkp[0]+'_BackupTageZyklus']+' Tag  aktiviert');
                if(BkpZeit_Schedule[Bkp[0]]) schedule.clearScheduleJob(BkpZeit_Schedule[Bkp[0]]);
                BkpZeit_Schedule[Bkp[0]] = schedule.Job('10 '+BkpUhrZeit[1] + ' ' +BkpUhrZeit[0] + ' */'+adapter.config[Bkp[0]+'_BackupTageZyklus']+' * * ', function (){backup_erstellen(Bkp[0], Bkp[1], Bkp[2], Bkp[3], Bkp[4], Bkp[5], Bkp[6], Bkp[7], Bkp[8], Bkp[9], Bkp[10], Bkp[11], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN)});
				
				adapter.log.info('BkpZeit_Schedule: ' +BkpZeit_Schedule[Bkp[0]]);
				
                if(debugging) adapter.log.info('10 '+BkpUhrZeit[1] + ' ' + BkpUhrZeit[0] + ' */'+adapter.config[Bkp[0]+'_BackupTageZyklus']+' * * ');
            }
            else {
                if(logging) adapter.log.info ('Das '+Bkp[0]+' Backup wurde deaktiviert');
                if(BkpZeit_Schedule[Bkp[0]]) schedule.clearScheduleJob(BkpZeit_Schedule[Bkp[0]]);
            }

            // -----------------------------------------------------------------------------
            //  Erstellen der Aufzaehlungen fŸr die Backupdatenpunkte
            // -----------------------------------------------------------------------------
            if(!adapter.getState('System.Iobroker.Backup.Konfiguration.Konfig_abgeschlossen')) {

                Enum_ids.push(instanz + Bkp[0] +'_BackupState');
                Enum_ids.push(instanz + Bkp[0] +'_BackupZeit');
                Enum_ids.push(instanz + Bkp[0] +'_BackupTageZyklus');

                Enum_ids.push(instanz + Bkp[0] +'_NamensZusatz');
                Enum_ids.push(instanz + Bkp[0] +'_BackupLoeschenNach');
                Enum_ids.push(adapter.config.FtpHost);
                Enum_ids.push(adapter.config.FtpDir);
                Enum_ids.push(adapter.config.FtpUser);
                Enum_ids.push(adapter.config.FtpPw);
                Enum_ids.push(adapter.config.CifsMount);

                if(Bkp[0] == 'ccu') {
                    Enum_ids.push(adapter.config.CcuIp);
                    Enum_ids.push(adapter.config.CcuUser);
                    Enum_ids.push(adapter.config.CcuPw);
                }
                if(Bkp[0] == 'komplett') {
                    Enum_ids.push(adapter.config.IoStopStart);
                    Enum_ids.push(adapter.config.MysqlDbName);
                    Enum_ids.push(adapter.config.MysqlDbUser);
                    Enum_ids.push(adapter.config.MysqlDbPasswort);
                    Enum_ids.push(adapter.config.MysqlLoeschenNach);
                }
            }

    });

    if(!adapter.getState('Konfiguration.Konfig_abgeschlossen')) {
        var Enum_obj = {};
        Enum_obj.type = 'enum';
        Enum_obj.common = {};
        Enum_obj.common.name = 'BackItUp';
        Enum_obj.common.members = Enum_ids;
        adapter.setObject('enum.functions.BackItUp', Enum_obj);
    }
adapter.setState('Konfiguration.Konfig_abgeschlossen', true);
}

// #############################################################################
// #                                                                           #
// #  Funktion zum AusfŸhren des Backups mit obigen Einstellungen              #
// #                                                                           #
// #############################################################################


function backup_erstellen(typ, name, zeit, host, pfad, user, passwd, ccuip, ccuusr, ccupw, cifsmnt, bkpiors, mysqldb, mysqlusr, mysqlpw, mysqlln) {

    if(debugging) adapter.log.info(bash_script+'"'+typ+'|'+name+'|'+zeit+'|'+host+'|'+pfad+'|'+user+'|'+passwd+'|'+ccuip+'|'+ccuusr+'|'+ccupw+'|'+cifsmnt+'|'+bkpiors+'|'+mysqldb+'|'+mysqlusr+'|'+mysqlpw+'|'+mysqlln+'"');

    if(typ == 'komplett' && bkpiors === true){
        adapter.setState(instanz + 'IoRestart_komp_Bkp', true);
    }
    adapter.setState('System.Iobroker.BackupHistory.letztes_'+typ+'_Backup', new DatumUhrzeitString(new Date()));

    let ftp_bkp_u;
    if(host === '') ftp_bkp_u = 'NEIN'; else ftp_bkp_u = 'JA';
// geht nicht    backup_history_anlegen(formatDate(new Date(), 'DD.MM.YYYY') +' um '+ formatDate(new Date(), 'hh:mm:ss')+' Uhr',typ,ftp_bkp_u);
        new Backup_history_anlegen(new DatumUhrzeitString(new Date()));

    exec((bash_script+' "'+typ+'|'+name+'|'+zeit+'|'+host+'|'+pfad+'|'+user+'|'+passwd+'|'+ccuip+'|'+ccuusr+'|'+ccupw+'|'+cifsmnt+'|'+bkpiors+'|'+mysqldb+'|'+mysqlusr+'|'+mysqlpw+'|'+mysqlln+'"'), function(err, stdout, stderr) {
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
function DatumUhrzeitString(date) {
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

  return Tag+' '+MonatsNamen[MonatsIndex]+' '+Jahr+ ' um '+Stunde+':'+Minute+' Uhr';
}

// #############################################################################
// #                                                                           #
// #  BackupdurchfŸhrung in History eintragen                                  #
// #                                                                           #
// #############################################################################

function Backup_history_anlegen(zeitstempel,typ,ftp_bkp_u) {
//     let history_liste = System.Iobroker.Backup.History.Backup_history;
//         history_array = history_liste.split('&nbsp;');


     if(history_array.length >= anzahl_eintraege_history){
        history_array.splice((anzahl_eintraege_history - 1),1);
     }
     history_array.unshift('<span class="bkptyp_'+ typ +'">' + zeitstempel + ' - Typ:' + typ + ' - Ftp-Sicherung:' + ftp_bkp_u + '</span>');
     adapter.setState('System.Iobroker.Backup.History.Backup_history', history_array.join('&nbsp;'));
}

// #############################################################################
// #                                                                           #
// #  AblŠufe nach Neustart des Backupscripts                                  #
// #                                                                           #
// #############################################################################

function ScriptStart() {
    if(adapter.getState('System.Iobroker.Backup.Konfiguration.IoRestart_komp_Bkp').val === true){
        adapter.setStateDelayed('System.Iobroker.Backup.Konfiguration.IoRestart_komp_Bkp', false, 5000);
    }

    new BackupStellen();

}
/*
function WerteAktualisieren() {
    runScript(name);
    log('Werte wurden aktualisiert');
}
*/
// #############################################################################
// #                                                                           #
// #  Beim ersten Start alle benštigten Datenpunkte / Enum.funcitons erstellen #
// #                                                                           #
// #############################################################################

if(!adapter.getObject('enum.functions.BackItUp') || !adapter.getObject('System.Iobroker.Backup.Konfiguration.Konfig_abgeschlossen') || adapter.getState('System.Iobroker.Backup.Konfiguration.Konfig_abgeschlossen').val === false) {
    new BackupStellen();
}

// #############################################################################
// #                                                                           #
// #  Beobachten der drei One-Click-Backup Datenpunkte                         #
// #  - Bei Aktivierung start des jeweiligen Backups                           #
// #                                                                           #
// #############################################################################
adapter.on({id: 'System.Iobroker.Backup.OneClick.start_minimal_Backup', change: "ne"}, function (dp) {
    if(dp.state.val === true){
        adapter.log.info('OneClick Minimal Backup gestartet');
        backup_erstellen(Backup[0][0], Backup[0][1], Backup[0][2], Backup[0][3], Backup[0][4], Backup[0][5], Backup[0][6], Backup[0][7], Backup[0][8], Backup[0][9], Backup[0][10], Backup[0][11], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN);
        if(debugging)adapter.log.info('backup_erstellen('+Backup[0][0]+','+Backup[0][1]+','+Backup[0][2]+','+Backup[0][3]+','+Backup[0][4]+','+Backup[0][5]+','+Backup[0][6]+','+Backup[0][7]+','+Backup[0][8]+','+Backup[0][9]+','+Backup[0][10]+','+Backup[0][11]+','+Mysql_DBname+','+Mysql_User+','+Mysql_PW+','+Mysql_LN+')');
        adapter.setStateDelayed('System.Iobroker.Backup.OneClick.start_minimal_Backup', false, 20000);
    }
});
adapter.on({id: 'System.Iobroker.Backup.OneClick.start_komplett_Backup', change: "ne"}, function (dp) {
    if(dp.state.val === true){
        adapter.log.info('OneClick Komplett Backup gestartet');
        backup_erstellen(Backup[1][0], Backup[1][1], Backup[1][2], Backup[1][3], Backup[1][4], Backup[1][5], Backup[1][6], Backup[1][7], Backup[1][8], Backup[1][9], Backup[1][10], Backup[1][11], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN);
        if(debugging)adapter.log.info('backup_erstellen('+Backup[1][0]+','+Backup[1][1]+','+Backup[1][2]+','+Backup[1][3]+','+Backup[1][4]+','+Backup[1][5]+','+Backup[1][6]+','+Backup[1][7]+','+Backup[1][8]+','+Backup[1][9]+','+Backup[1][10]+','+Backup[1][11]+','+Mysql_DBname+','+Mysql_User+','+Mysql_PW+','+Mysql_LN+')');
        adapter.setStateDelayed('System.Iobroker.Backup.OneClick.start_komplett_Backup', false, 5000);
    }
});
adapter.on({id: 'System.Iobroker.Backup.OneClick.start_ccu_Backup', change: "ne"}, function (dp) {
    if(dp.state.val === true){
        adapter.log.info('OneClick CCU Backup gestartet');
        backup_erstellen(Backup[2][0], Backup[2][1], Backup[2][2], Backup[2][3], Backup[2][4], Backup[2][5], Backup[2][6], Backup[2][7], Backup[2][8], Backup[2][9], Backup[2][10], Backup[2][11], Mysql_DBname, Mysql_User, Mysql_PW, Mysql_LN);
        if(debugging)adapter.log.info('backup_erstellen('+Backup[2][0]+','+Backup[2][1]+','+Backup[2][2]+','+Backup[2][3]+','+Backup[2][4]+','+Backup[2][5]+','+Backup[2][6]+','+Backup[2][7]+','+Backup[2][8]+','+Backup[2][9]+','+Backup[2][10]+','+Backup[2][11]+','+Mysql_DBname+','+Mysql_User+','+Mysql_PW+','+Mysql_LN+')');
        adapter.setStateDelayed('System.Iobroker.Backup.OneClick.start_ccu_Backup', false, 20000);
    }
});
// #############################################################################
// #                                                                           #
// #  Beobachten aller Backupdatenpunkte                                       #
// #                                                                           #
// #############################################################################
/*
$('state(functions=BackItUp)').on(function(obj) {
    WerteAktualisieren();
});
// #############################################################################
// #                                                                           #
// #  Bei Scriptstart Schedules setzen                                         #
// #                                                                           #
// #############################################################################
ScriptStart();
*/
// ############## Ende backitup #########################

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:

/*
    /**
     *
     *      For every state in the system there has to be also an object of type state
     *
     *      Here a simple backitup for a boolean variable named "testVariable"
     *
     *      Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
     *
     */
/*
    adapter.setObject('testVariable', {
        type: 'state',
        common: {
            name: 'testVariable',
            type: 'boolean',
            role: 'indicator'
        },
        native: {}
    });
    // in this backitup all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
    /**
     *   setState examples
     *
     *   you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
     *
     */
/*
    // the variable testVariable is set to true as command (ack=false)
    adapter.setState('testVariable', true);
    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
    adapter.setState('testVariable', {val: true, ack: true});
    // same thing, but the state is deleted after 30s (getState will return null afterwards)
    adapter.setState('testVariable', {val: true, ack: true, expire: 30});
    // examples for the checkPassword/checkGroup functions
    adapter.checkPassword('admin', 'iobroker', function (res) {
        console.log('check user admin pw ioboker: ' + res);
    });
*/
    adapter.checkGroup('admin', 'admin', function (res) {
        console.log('check group user admin group admin: ' + res);
    });



}
