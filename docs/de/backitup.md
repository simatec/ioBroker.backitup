![Logo](admin/backitup.png)
# ioBroker.backitup
=================

[![NPM version](http://img.shields.io/npm/v/iobroker.backitup.svg)](https://www.npmjs.com/package/iobroker.backitup)
[![Downloads](https://img.shields.io/npm/dm/iobroker.backitup.svg)](https://www.npmjs.com/package/iobroker.backitup)

[![NPM](https://nodei.co/npm/iobroker.backitup.png?downloads=true)](https://nodei.co/npm/iobroker.backitup/)

Backitup ist eine Backuplösung, mit der das zyklische Sichern einer IoBroker-Installation sowie einer Homematic CCU möglich ist. 

## Inhaltsverzeichnis:
1. Backup Type
   - 1.1 Standard Backup (Standard IoBroker Backup)
   - 1.2 Komplettes Backup
   - 1.3 CCU Backup (CCU-Original / pivCCU / Raspberrymatic)
   - 1.4 Optionales Mysql-Backup (Localhost)
   - 1.5 Redis Datenbank sichern
2. Vorbereitung
   
3. Konfiguration
   - 3.1 Ftp / Cifs
   - 3.2 Telegram versenden
4. Verwendung
   - 4.1 Verwendung des VIS-Widget-Exports
5. Restore eines Backups
   - 5.1 Minimal Backup wiederherstellen
   - 5.2 Komplett Backup wiederherstellen
   - 5.3 Raspberrymatic Backup wiederherstellen
6. Fehlersuche
   - 6.1 Logging aktivieren
   - 6.2 Debugging aktivieren
7. Aufgetretene Fehler / Lösungen
   - 7.1 Webinterface nach Restore nicht erreichbar
   - 7.3 Fehlermeldung: "Komando nicht gefunden"
   - 7.4 Komplett-Backup bleibt hängen 
   - 7.5 Geänderte Werte in Dp werden nicht übernommen 

8. Changelog


## 1. Backuptypen:

Backitup bietet die Möglichkeit drei (optional mit DB-Backup) verschiedene Backuptypen zyklisch oder auf Knopfdruck durch zu führen. Jedes Backup wird standardmäßig im Verzeichnis /opt/iobroker/backups/ abgelegt. Optional kann ein FTP-Upload eingerichtet oder alternativ ein CIFS-Mount genutzt werden.

1. Standard Backup
   - Dieses Backup entspricht dem in IoBroker enthaltenen Backup welches man in der Konsole über den Aufruf „./iobroker backup“ starten kann. Nur wird es hier durch die festgelegten Einstellungen in der Adapterkonfiguration oder dem Widget OneClick-Backup durchgeführt ohne die Konsole verwenden zu müssen.
2. Komplettes Backup
   - Dieses Backup sichert den kompletten IoBroker Ordner inklusive aller Unterordner und deren Dateien samt Dateiberechtigungen. Hierbei sollte die Dateigröße nicht ausser Acht gelassen werden, denn ein solches Backup hat oft mehrere hundert MB. 
Um sicher zu gehen dass alle aktuellsten States gesichert werden muss hier in der Konfiguration der Hacken bei IoBroker Stop/Start gesetzt werden. 
3. CCU Backup (Homematic)
   -  Dieses Backup bietet die Möglichkeit 3 verschiedene Varianten einer Homematic Installations (CCU-Original / pivCCU / Raspberrymatic) zu sichern. Auch die Ausführung dieses Backups kann durch die festgelegten Einstellungen in der Adapterkonfiguration oder dem Widget OneClick-Backup durchgeführt werden.
4. Mysql-Backup (Localhost)
   - Dieses separat einstellbare Backup wird sofern es aktiviert ist, bei jedem Backup egal ob „minimal“ oder „komplett“ erstellt und nach Ablauf der angegebenen Vorhaltezeit auch gelöscht. FTP oder CIFS sind für dieses Backup ebenfalls gültig sofern bei den anderen IoBroker-Backup-Typen eingestellt.

## 2. Vorbereitung:

Folgende Schritte müssen durchgeführt werden um den Adapter verwenden zu können *(wenn das Backup-Script v1/v2/v3 verwendet wurde zuerst Alles löschen (Datenpunkte/Enum.functions/Shell-Script und JavaScript deaktivieren oder löschen!)


## 3. Konfiguration:

1.	FTP oder CIFS für das optionale weitersichern auf einen Nas nutzen?

  - Vorteile CIFS:
    -	weniger Schreibzyklen auf euren Datenträger (evtl. relevant wenn Raspberry mit SD-Karte verwendet wird um Diese zu schonen)
    -	Es ist möglich die „Alten Backups“ automatisiert auf dem Nas löschen zu lassen
    -	Keine Notwendigkeit des lftp-Service da euer Nas direkt eingehängt ist.
  - Nachteile CIFS:
    -	Wenn ein Mounten nicht möglich ist, wird kein Backup erstellt!
    -	„Alte Backups“ können automatisiert auf dem Nas gelöscht werden. Im schlimmsten Fall ist somit kein Backup mehr vorhanden wenn ihr es benötigt.
2. Telegram versenden
   - Im Adapter gibt es die Möglichkeit sich beim erstellen eines Backups eine Benachrichtigung via Telegram zusenden zu lassen. Vorraussetzung hierfür ist eine aktive, funktionierende Telegram Instanz.


## 4. Verwendung:

1. Richtige Daten beim gewünschten Backup eintragen / einstellen - speichern - fertig

3. Der History-Log kann via CSS vom Design her eingestellt / verändert werden:
   ```
   .backup_history{
       display:block;
       width:100%;
   /*    overflow-y:scroll; */
   }
   .bkptyp_minimal
       {
           float:left;
           color:white;
           font-size:18px;
       }
   .bkptyp_komplett
       {
           float:left;
           color:yellow;
           font-size:18px;
       }
   .bkptyp_ccu
       {
           float:left;
           color:red;
           font-size:18px;
       }
   ```
Hier ein Screenshot vom VIS-Widget-Export:
<img src="https://github.com/peoples0815/backitup/blob/master/img/screenshot_vis-export.jpg" align=center>

## 5. Restore:

1. Restore eines minimalen / normalen IoBroker Backups: 
    - Das Backup muss wie gewohnt im  Verzeichnis „opt/iobroker/backups/“ liegen 
    - Es kann über die Konsole mit Hilfe des Befehls: „iobroker restore (Nummer des Backups aus der Liste)“ wieder hergestellt werden.  

2. Restore eines kompletten Backups:
    - Den Befehl:“sudo  iobroker stop“ über die Konsole ausführen
    - Das erstellte Backup muss in das Verzeichnis  „root/“ kopiert werden
    - Den Befehl:" sudo tar -xzvf Backupname.tar.gz -C / " über die Konsole ausführen
    - Warten - Während der Wiederherstellung wird euch angezeigt was gerade gemacht wird
    - Den Befehl: „sudo iobroker start“ über die Konsole ausführen 

3. Restore eines Raspberrymatic / CCU Backups:
    - *.sbk Datei via SCP in das Verzeichnis „ /usr/local/tmp directory“ auf die Raspberrymatic  kopieren
    - Über die Konsole  als Root-User  auf der Raspberrymatic einloggen
    - Den Befehl: „/bin/restoreBackup.sh /user/local/tmp/EuerBackupDateiname“ auf der Raspberrymatic ausführen.
    - Den Befehl:“reboot“ auf der Raspberrymatic ausführen um den PI neu zu starten

Alternativ kann das Backup natürlich auch wie gewohnt über das Webinterface wieder hergestellt werden.
---------------------------------------------------------------------------
## 6. Fehlersuche:

1. Im Adapter gibt es die Möglichkeit logging auf true zu setzen so werden im Log verschiedene Meldungen (bspw. Backup-Zeiten und States) die zur Fehlersuche dienen können aufgelistet

2. Zusätzlich gibt es die Möglichkeit debugging auf true zu setzen nun wird im Log der Befehl ausgegeben der an die backitup.sh übergeben wird. Dieser Befehl kann eins zu eins in die Konsole (mit Putty o.ä) eingegeben werden um Fehler eingrenzen zu können.

## 7. Aufgetretene Fehler / Lösungen:

Hier eine Liste der bisher aufgetretenen Probleme und deren Lösungen sofern vorhanden.

1.	Olifall (aus dem Forum) hatte das Problem dass nach dem Restore das Webinterface des IoBrokers nicht mehr erreichbar war, durch folgende Schritte über die Konsole konnte er dies beheben:
    - sudo iobroker status
    - Meldung = "No connection to states 127.0.0.0:6379[redis]"
    - sudo apt-get install redis-server

2.	Beim Testen kam es bei Anderen vor dass einige Datenpunkte nicht beschreib /-änderbar waren, diesen Fehler konnte ich nicht nachstellen und dementsprechend nicht beheben.

3.	Fehlermeldung: „Kommando nicht gefunden“ 
Durch die Unterschiede von Unix und Windows, darf die backitup.sh nicht unter Windows (Editor) geändert werden. 
Erklärung:
Unter DOS wird in Textdateien ein Zeilenende durch die Sequenz return (Dezimalcode 13) und new line (Dezimalcode 10) dargestellt. Unix verwendet dagegen nur new line.

4. Iobroker bleibt beim komplett-Backup hängen / startet nicht mehr
Einige Benutzer berichteten dass das IoBroker komplett-Backup nicht richtig durchläuft bzw. der IoBroker gestoppt und nicht mehr gestartet wird. Hierfür ist es möglich in der Adapter- Konfigurations-Datenpunkten den Stop/Start des IoBrokers beim komplett-Backup zu deaktivieren.

## 8. Changelog:

#0.1.2 (30.06.2018)
 - (simatec/peoples) Erste Beta-Version

#0.1.0 (25.06.2018)
 - (simatec/peoples) Erste Git-Adapter-Version
