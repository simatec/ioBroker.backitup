![Logo](admin/backitup.png)
# ioBroker.backitup
=================

Backitup ist eine Script Zusammenstellung zum zyklischen Sichern einer IoBroker / Homematic -Installation konfigurierbar in VIS 

Hilfe und Fragen bitte hier: [Backitup im IoBroker-Forum](https://forum.iobroker.net/viewtopic.php?f=21&t=13874&hilit=backitup)  

## Inhaltsverzeichnis:
1. Backup Type
   - 1.1 Minimales Backup (Standard IoBroker Backup)
   - 1.2 Komplettes Backup
   - 1.3 CCU Backup (CCU-Original / pivCCU / Raspberrymatic)
   - 1.4 Optionales Mysql-Backup (Localhost) 
2. Vorbereitung
   - 2.1 Vorbereitung für ftp / Cifs (wenn gewünscht)
   - 2.2 Vorbereitungen für das CCU - Backup
   - 4.3 Vorbereitung IoBroker - Javascript Adapter
3. Konfiguration
   - 3.1 Konfigurationen für Minimal und Komplett Backup
   - 3.2 Konfigurationen für Minimal und Komplett Backup
   - 3.3 Konfigurationen für CCU Backup
   - 3.4 Konfigurationen für Mysql-Datenbank Backup
   - 3.5 Konfiguration des JavaScript-Speicherorts
4. Verwendung
   - 4.1 Der erste Druchlauf des JavaScripts
   - 4.2 Verwendung des VIS-Widget-Exports
5. Restore eines Backups
   - 5.1 Minimal Backup wiederherstellen
   - 5.2 Komplett Backup wiederherstellen
   - 5.3 Raspberrymatic Backup wiederherstellen
6. Fehlersuche
   - 6.1 Logging aktivieren
   - 6.2 Debugging aktivieren
7. Aufgetretene Fehler / Lösungen
   - 7.1 Webinterface nach Restore nicht erreichbar
   - 7.2 JS-Datenbunkt nicht beschreibbar
   - 7.3 Fehlermeldung: "Komando nicht gefunden"
   - 7.4 Komplett-Backup bleibt hängen 
   - 7.5 Geänderte Werte in Dp werden nicht übernommen 
8. Todo
9. Changelog


## 1. Backuptypen:

Das Backup-Script bietet drei (optional mit DB-Backup) verschiedene Backup-Aufrufe. Jedes Backup wird standardmäßig im Verzeichnis /opt/iobroker/backups/ abgelegt. Optional kann ein FTP-Upload eingerichtet werden, zudem gibt es seit dieser Version die Möglichkeit einen CIFS-Mount ein zu richten.

1. Minimales Backup
   - Dieses Backup entspricht dem in IoBroker enthaltenen Backup welches man in der Konsole über den Aufruf „./iobroker backup“     starten kann. Nur wird es hier durch die festgelegten Einstellungen in VIS aufgerufen ohne die Konsole verwenden zu müssen.
2. Komplettes Backup
   - Dieses Backup sichert den kompletten IoBroker Ordner inklusive aller Unterordner und deren Dateien samt Dateiberechtigungen. Hierbei sollte man die Dateigröße nicht aus dem Auge verlieren die jedes einzelne Backup hat, im Schnitt über 200MB. 
Im Zuge dieses Backups wird IoBroker neu gestartet!
3. CCU Backup (Homematic)
   -  Seit Version 3 ist es möglich 3 verschidene Homematic Installationsvarianten (CCU-Original / pivCCU / Raspberrymatic) zu sichern. Auch die Ausführung dieses Backups kann durch VIS konfiguriert werden ohne dass man die Konsole dazu benötigt.
4. Mysql-Backup (Localhost)
   - Dieses separat einstellbare Backup wird sofern es aktiviert ist, bei jedem zyklisch eingestellten Backup egal ob „minimal“ oder „komplett“ erstellt und nach Ablauf der angegebenen Vorhaltezeit auch gelöscht. FTP oder CIFS sind für dieses Backup ebenfalls gültig sofern bei den IoBroker-Backup-Typen eingestellt.

## 2. Vorbereitung:

Folgende Schritte müssen durchgeführt werden um das automatische Backup V3 verwenden zu können *(wenn das Backup-Script v1 verwendet wurde zuerst alle Datenpunkte löschen!)

1.	Seit Version 3 wird der lftp-Dienst für den optionalen FTP-Upload auf bspw. einen Nas nicht mehr benötigt! Ebenfalls ist es mittlerweile möglich alternativ euren vorhandenen Nas (o.Ä) mit Hilfe von CIFS in eure IoBroker – Dateistruktur zu mounten und das Backup direkt dort zu erstellen.

  - Vorteile:
    -	weniger Schreibzyklen auf euren Datenträger (evtl. relevant wenn Raspberry mit SD-Karte verwendet wird um Diese zu schonen)
    -	Es ist möglich die „Alten Backups“ automatisiert auf dem Nas löschen zu lassen
    -	Keine Notwendigkeit des lftp-Service da euer Nas direkt eingehängt ist.
  - Nachteile:
    -	Wenn ein Mounten nicht möglich ist, wird kein Backup erstellt!
    -	„Alte Backups“ können automatisiert auf dem Nas gelöscht werden. Im schlimmsten Fall ist somit kein Backup mehr vorhanden wenn ihr es benötigt.

2.	Seit Version 3 wird für das CCU-Backup (in den o.g. 3 Varianten) kein SSH Zugang mehr benötigt stattdessen wird für das Backup der Username und das Passwort der CCU (nicht mehr SSH) benötigt. Wer den SSH-Zugang sonst nicht nutzt sollte diesen aus Sicherheitsgründen deaktivieren.

3.	Um das Script ausführen zu können müssen im IoBroker Javascript-Adapter die Hacken bei: Erlaube das Komando „setObject“  und Erlaube das Kommando „exec“ gesetzt sein (Bild 3).
<img src="https://github.com/peoples0815/backitup/blob/master/img/einstellungen_js-script_adapter.jpg" align=center>
(Bild 3)

5.	Das im Beitrag enthaltene Shell-Script muss in das IoBroker-Verzeichnis unter dem Namen backitup.sh gespeichert  (absoluter Pfad: /opt/iobroker/backitup.sh) und die Berechtigungen sollten auf 777 gesetzt werden. Bei mir läuft das Script mit Admin Rechten wenn ihr bei euch die nötigen Freigaben händisch einstellt ist dies jedoch nicht nötig. Das Script darf nicht in einem Windows Editor bearbeitet werden, da sonst unter Umständen das Script nicht mehr fehlerfrei durchläuft. 

6.	Für die spätere Konfiguration durch VIS muss nun noch der View-Export in euer Projekt importiert werden.

## 3. Konfiguration:

Wenn alles wie beschrieben durchgeführt wurde, muss das Javascript einmal durch drücken auf den "Play-Button" gestartet und wieder gestoppt werden. Hier treten im Log einige Fehlermeldungen durch subscriben nicht vorhandener Datenpunkte auf die aber NUR HIER ignoriert werden können. Hier noch ein Screenshot der Datenpunkte die nun vorhanden sein sollten und wie folgt ausgefüllt werden müssen:

<img src="https://github.com/peoples0815/backitup/blob/master/img/Screenshot-Datenpunkte.jpg" align=center>

1. Folgende Daten müssen bei dem IoBroker Backup Typ minimal  von euch eingetragen werden und richtig sein: 
   - NamensZusatz ? Wird in den Backup-Dateinamen eingefügt, wenn nicht gewünscht leer lassen!
   - BackupLoeschenNach ? Tage-Angabe nach denen erstellte Backups  gelöscht werden sollen
   - FtpHost ? IP-Adresse eures FTP-Servers 	(Wenn FTP verwendet)
   - FtpDir ? Zielverzeichnis auf dem FTP	(Wenn FTP verwendet)
   - FtpUser ? FTP – Username			(Wenn FTP verwendet)
   - FtpPw ? FTP – Passwort			(Wenn FTP verwendet )
   - CifsMount ? CIFS-Mount  	(Standard „false“ wenn gewünscht auf „true“) Ein aktivieren dieser Option schließt zeitgleich die Verwendung der FTP Funktion aus!   

2. Folgende Daten müssen bei dem IoBroker Backup Typ komplett  von euch eingetragen werden und richtig sein:
   - NamensZusatz ? Wird in den Backup-Dateinamen eingefügt, wenn nicht gewünscht leer lassen!
   - BackupLoeschenNach ? Tage-Angabe nach denen erstellte Backups  gelöscht werden sollen
   - FtpHost ? IP-Adresse eures FTP-Servers 	(Wenn FTP verwendet)
   - FtpDir ? Zielverzeichnis auf dem FTP	(Wenn FTP verwendet)
   - FtpUser ? FTP – Username			(Wenn FTP verwendet)
   - FtpPw ? FTP – Passwort			(Wenn FTP verwendet )
   - CifsMount ? CIFS-Mount  	(Standard „false“ wenn gewünscht auf „true“) Ein aktivieren dieser Option schließt zeitgleich die Verwendung der FTP Funktion aus!   
   - IoStopStart ? IoStart/Stop ob beim kompletten Backup der Iobroker gestoppt/gestartet werden soll  	(Standard „false“ wenn gewünscht auf „true“)  

3. Folgende Daten müssen für das optionale CCU Backup von euch eingetragen werden und richtig sein sofern ihr dieses nutzen möchtet:
   - BackupLoeschenNach ? Tage-Angabe nach denen erstellte Backups  gelöscht werden sollen
   - CcuIp ? IP-Adresse der CCU
   - CcuUser ? Username der CCU                            
   - CcuPw ? Passwort der CCU 
   - FtpHost ? IP-Adresse eures FTP-Servers 	(Wenn FTP verwendet)
   - FtpDir ? Zielverzeichnis auf dem FTP	(Wenn FTP verwendet)
   - FtpUser ? FTP – Username			(Wenn FTP verwendet)
   - FtpPw ? FTP – Passwort			(Wenn FTP verwendet )
   - CifsMount ? CIFS-Mount  	(Standard „false“ wenn gewünscht auf „true“) Ein aktivieren dieser Option schließt zeitgleich die Verwendung der FTP Funktion aus!   

4. Folgende Daten müssen für das optioale MYSQL-Backup  von euch eingetragen werden und richtig sein sofern ihr dieses nutzen möchtet:
   - BackupLoeschenNach ? Tage-Angabe nach denen erstellte Backups  gelöscht werden sollen
   - DbName ? Name der Datenbank
   - DbUser ? Username für die Datenbank
   - DbPw ? Passwort der Datenbank
   

5. Anpassung des Script-Speicherorts (ab Backitup_3.0.2.js nicht mehr notwendig):
    - Zu Letzt muß noch der Pfad zum Speicherort des Javascripts (Wo das Javascript abgespeichert wurde) in der Funktion WerteAktualisieren richtig eingetragen sein/werden um bei Änderung eines Datenpunkts das Script neu starten zu können. Der hier voreingestellte Pfad ist("scriptEnabled.BackitUp_V3")

## 4. Verwendung:

1.	Beim ersten Durchlauf  werden im Log „Warnings“ und evtl. „Error“ aufgelistet was nur  beim ersten Durchlauf normal ist. Dies kommt daher dass die Datenpunkte die im Nachgang abgefragt werden noch nicht vorhanden sind. Danach sollte das nicht mehr vorkommen.

2.	Alle Funktionen wie Backup – Zyklen / Uhrzeiten, das Aktivieren oder Deaktivieren, sowie ein Backup sofort ausführen ist komplett über VIS einstellbar. Auf Nachfrage habe ich auch noch eine kleine History eingefügt welcher zeigt wann welches Backup zuletzt durchgelaufen ist.

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

3. Restore eines raspberrymatic Backups:
    - *.sbk Datei via SCP in das Verzeichnis „ /usr/local/tmp directory“ auf die Raspberrymatic  kopieren
    - Über die Konsole  als Root-User  auf der Raspberrymatic einloggen
    - Den Befehl: „/bin/restoreBackup.sh /user/local/tmp/EuerBackupDateiname“ auf der Raspberrymatic ausführen.
    - Den Befehl:“reboot“ auf der Raspberrymatic ausführen um den PI neu zu starten

Alternativ kann das Backup natürlich auch wie gewohnt über das Webinterface der Raspberrymatic wieder hergestellt werden.

## 6. Fehlersuche:

1. Im JavaScript gibt es die Möglichkeit logging auf true zu setzen so werden im Log verschiedene Meldungen (bspw. Backup-Zeiten und States) die zur Fehlersuche dienen können aufgelistet

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
Einige Benutzer berichteten dass das IoBroker komplett-Backup nicht richtig durchläuft bzw. der IoBroker gestoppt und nicht mehr gestartet wird. Seit V3 ist es möglich in den Konfigurations-Datenpunkten den Stop/Start des IoBrokers beim komplett-Backup zu steuern

5. Geänderte Werte werden nicht automatisch übernommen / Javascript startet nicht von selbst neu
Wenn geänderte Werte in den Datenpunkten nicht übernommen werden kann das daran liegen, dass die Funktion des automatischen Neustarts auf Grund eines falschen Eintrags nicht ausgeführt wird. Hier muss kontrolliert werden ob der Speicherort des Javascripts im Javascript selbst (Funktion WerteAktuallisieren) richtig eingetragen ist.
Sollte ab Version Backitup_3.0.2.js nicht mehr auftreten

## 8. Todo:

Ein weiterer Schritt wird sein den Restore eines Iobroker-Backups auch auch über VIS durchführen zu können, zudem möchte ich aus dem Script früher oder später einen 
IoBroker – Adapter machen. 

## 9. Changelog:
#3.0.2
 - (peoples) Update Backitup_3.0.2.js
    - Javascript Instanz wird ausgelesen
    - Funktion WerteAktualisieren jetzt ohne Pfadangabe

#3.0.1
 - (simatec) Ftp-Upload nun ohne lftp möglich
 - (simatec) Iobroker k.Backup Stop/Start steuerbar in backitup.sh
 - (peoples) JavaScript an obige Änderungen angepasst
 - (peoples) Konfigurationseinstellungen in Datenpunkte ausgelagert

#3.0 (09.06.2018)
 - (peoples) Backup Zyklen geändert
 - (peoples) Schedule angepasst an neue Zyklen 
 - (peoples) Widget an Neuerungen angepasst
 - (simatec) backitup.sh entfernen des reinen Rasp.-Backups

#2.0.4 (31.05.2018)
 - (simatec) Backupmöglichkeit für Homematic-CCU und pivccu eingebunden
 - (peoples) Anpassung des Javascripts wegen o.g. Ergänzungen
 
#2.0.3 (24.05.2018)
 - Erste Version auf Github


## License
The MIT License (MIT)

Copyright (c) 2018 simatec <nais@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
