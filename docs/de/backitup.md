Backitup ist eine Backuplösung, mit der das zyklische Sichern einer IoBroker-Installation sowie einer Homematic CCU möglich ist.

Der Adapter ist für Multiplattformen geeignet und kann  neben Linux-Installationen auch auf Windows und Mac Installationen verwendet werden.

Für den CIFS Mount muss zwingend cifs-utils installiert sein.
    - `sudo apt-get install cifs-utils`

Für den NFS Mount muss zwingend nfs-common installiert sein.
    - `sudo apt-get install nfs-common`

## 1. Backuptypen
Backitup bietet die Möglichkeit drei (optional mit DB-Backup) verschiedene Backuptypen zyklisch oder auf Knopfdruck durch zu führen. Jedes Backup wird standardmäßig im Verzeichnis /opt/iobroker/backups/ abgelegt. Optional kann ein FTP-Upload eingerichtet oder alternativ ein CIFS-Mount genutzt werden.

1. Standard Backup
   - Dieses Backup entspricht dem in IoBroker enthaltenen Backup welches man in der Konsole über den Aufruf „./iobroker backup“ starten kann. Nur wird es hier durch die festgelegten Einstellungen in der Adapterkonfiguration oder dem Widget OneClick-Backup durchgeführt ohne die Konsole verwenden zu müssen.
2. CCU Backup (Homematic)
   -  Dieses Backup bietet die Möglichkeit 3 verschiedene Varianten einer Homematic Installations (CCU-Original / pivCCU / Raspberrymatic) zu sichern. Auch die Ausführung dieses Backups kann durch die festgelegten Einstellungen in der Adapterkonfiguration oder dem Widget OneClick-Backup durchgeführt werden.
3. Mysql-Backup (Localhost)
   - Dieses separat einstellbare Backup wird sofern es aktiviert ist, bei jedem Backup „minimal“ erstellt und nach Ablauf der angegebenen Vorhaltezeit auch gelöscht. FTP oder CIFS sind für dieses Backup ebenfalls gültig sofern bei den anderen IoBroker-Backup-Typen eingestellt.
4. Redis-Backup
   - Dieses separat einstellbare Backup wird sofern es aktiviert ist, bei jedem Backup „minimal“ erstellt und nach Ablauf der angegebenen Vorhaltezeit auch gelöscht. FTP oder CIFS sind für dieses Backup ebenfalls gültig sofern bei den anderen IoBroker-Backup-Typen eingestellt.
5. History Daten Backup
   - Dieses separat einstellbare Backup wird sofern es aktiviert ist, bei jedem Backup „minimal“ erstellt und nach Ablauf der angegebenen Vorhaltezeit auch gelöscht. FTP oder CIFS sind für dieses Backup ebenfalls gültig sofern bei den anderen IoBroker-Backup-Typen eingestellt.


## 2. Ftp, CIFS, NFS, Copy oder Dropbox für das optionale weitersichern auf einen Nas nutzen?
  - CIFS:
    -	CIFS-Mount ist unter Linux kein Problem.
    -   Es sollte beachtet werden, dass cifs-utils installiert ist
    -   Die Pfadangabe sollte wie folgt aussehen (Bsp: "/Freigabename/Pfadangabe")
    -	Optional kann man aktivieren/deaktivieren, ob die Backups vom NAS gelöscht werden sollen
  - NFS:
    -	NFS-Mount ist unter Linux kein Problem.
    -   Es sollte beachtet werden, dass nfs-common installiert ist
    -   Die Pfadangabe sollte wie folgt aussehen (Bsp: "/Freigabename/Pfadangabe")
    -	Optional kann man aktivieren/deaktivieren, ob die Backups vom NAS gelöscht werden sollen
  - FTP:
    -	FTP ist auf allen OS möglich und dient als eine Alternative zum CIFS Mount
    -   Die Pfadangabe unter FTP muss immer mit "/" beginnen (Bsp: "/Pfadangabe")
    -	Optional kann man aktivieren/deaktivieren, ob die Backups vom NAS gelöscht werden sollen
  - Copy:
    -	Sollte kein CIFS-Mount möglich sein, besteht eine weitere Möglichkeit der Copy-Funktion
    -   Hier muss in den CIFS-Einstellungen die Pfadangabe eingetragen werden, wo hin kopiert werden soll
    -   Die Angabe der IP Adresse muss für die Copy-Funktion leer bleiben
  - Dropbox: 
    -	Um die Sicherung in der Dropbox zu nutzen, muss ein Access Token und eine APP unter https://www.dropbox.com/developers/apps erstellt werden
    -   Schritt 1: Den Button "Create Backup" nutzen
    -   Schritt 2: "Dropbox API" auswählen
    -   Schritt 3: "App folder" auswählen
    -   Schritt 4: "Name your app" vergeben
    -   Schritt 5: "Generated access token" Button drücken (Der Token wird in den Einstellungen von Backitup eingetragen)
    -   In deiner Dropbox gibt es nun einen neuen Ordner mit dem Namen "Apps"
  - Google Drive:
    -	Um die Sicherung in der Google Drive zu nutzen, muss ein Access Token holen. Das kann man auf der Konfigurationsseite machen
    -   ioBroker greift nur auf die definierte Bereiche an. Das Code für oAuth kann man [hier](https://github.com/simatec/ioBroker.backitup/blob/master/docs/oAuthService.js) ansehen.
    -   Keine Tokens oder Anwenderdaten werden in der Cloud gespeichert.

## 3. Verwendung
1.	Der Adapter erstellt 7 Datenpunkte zur Verwendung in Vis
	- oneClick.ccu -> dient als Auslösetrigger für ein CCU-Backup (Kann in Vis durch einen Button auf true gesetzt werden)
	- oneClick.minimal -> dient als Auslösetrigger für ein Standard-Backup (Kann in Vis durch einen Button auf true gesetzt werden)

	- history.html -> dient als History-Log welcher in Vis via CCS vom Design anpassbar ist.
	- history.ccuLastTime -> speichert das Erstell-Datum und die Uhrzeit des letzten CCU Backups
	- history.minimalLastTime -> speichert das Erstell-Datum und die Uhrzeit des letzten Standard Backups
    - history.ccuSuccess -> zeigt bei erfolgreichen Backup den State "true"
    - history.minimalSuccess -> zeigt bei erfolgreichen Backup den State "true"

2. History-Log in Vis anzeigen
   - Es ist möglich den History-Log bspw. in einem Html-Widget durch eintragen folgender Zeile in HTML darzustellen:
```
{backitup.0.history.html}
```
Syntax: {BackitupInstanz.history.html}


3. CCS-Formatierung des History-Logs:
```
   .html{
       display:block;
       width:100%;
   /*    overflow-y:scroll; */
   }
   .backup-type-minimal
       {
           float:left;
           color:white;
           font-size:20px;
       }
   .backup-type-ccu
       {
           float:left;
           color:red;
           font-size:20px;
    }
   ```
4. OneClick-Button mit Status-Text
   - Wenn ein OneClick-Datenpunkt auf true gesetzt wird startet das entsprechende Backup und nach einer vordefinierten Zeit wird dieser Datenpunkt wieder auf false gesetzt somit ist es möglich einen Button mit Status zu erstellen, hierzu folgende Zeile anpassen und in Vis als Knopftext eintragen:

```
{wert: backitup.0.oneClick.minimal; wert === "true" || wert === true ? "Minimal Backup </br> wird erstellt" : "Minimal Backup </br> starten"}

```

Syntax: {wert: <BackitupInstanz>.oneClick.<Auslösetrigger>; wert === "true" || wert === true ? "Text während der Backuperstellung" : "Standard-Text"}

5. Backitup unterstützt für die Benachrichtigung nach einem erfolgreichen Backup folgende Messenger.
   - Telegram
   - Pushover
   - E-Mail 

## 4. Restore:

Es ist möglich das minimal-Backup, als auch mysql, History Daten und Redis entweder vom lokalen Pfad, aus der Dropbox, GoogleDrive, via FTP oder vom NAS wiederherzustellen.
Aktuell befindet sich der Restore noch in der Betaphase.

Das CCU-Backup muss weiterhin über das Webinterface der CCU wiederhergestellt werden.

Bei allen Backuptypen wird beim Restore iobroker gestoppt und im Anschluss automatisch wieder gestartet.

Wer seine Backups lieber manuell wiederherstellen möchte, sollte folgende Punkte durchführen:

1. Restore eines minimalen / normalen IoBroker Backups:
    - Das Backup muss wie gewohnt im  Verzeichnis „opt/iobroker/backups/“ liegen
    - Es kann über die Konsole mit Hilfe des Befehls: „iobroker restore (Nummer des Backups aus der Liste)“ wieder hergestellt werden.
    - Nach dem Restore ist ein "iobroker upload all" nötig

2. Restore eines Raspberrymatic / CCU Backups:
    - *.sbk Datei via SCP in das Verzeichnis „ /usr/local/tmp directory“ auf die Raspberrymatic  kopieren
    - Über die Konsole  als Root-User  auf der Raspberrymatic einloggen
    - Den Befehl: „/bin/restoreBackup.sh /user/local/tmp/EuerBackupDateiname“ auf der Raspberrymatic ausführen.
    - Den Befehl:“reboot“ auf der Raspberrymatic ausführen um den PI neu zu starten
    - Alternativ kann das Backup natürlich auch wie gewohnt über das Webinterface wieder hergestellt werden.

3. Restore Redis:
    - Die Redis-Datenbank muss bei einem Restore in den dazugehörigen Ordner entpackt werden. (Bsp: /var/lib/redis) 

4. Restore History:
    - Die History-Datenbank muss bei einem Restore in den dazugehörigen Ordner entpackt werden.



## 6. Fehlersuche
    1. Um Fehler zu loggen, muss Backitup in unter dem IoBroker Reiter Instanzen auf Log-Stufe "debug" gestellt werden.

## 7. Aufgetretene Fehler / Lösungen:
Hier eine Liste der bisher aufgetretenen Probleme und deren Lösungen sofern vorhanden.

1.	Olifall (aus dem Forum) hatte das Problem dass nach dem Restore das Webinterface des IoBrokers nicht mehr erreichbar war, durch folgende Schritte über die Konsole konnte er dies beheben:
    - sudo iobroker status
    - Meldung = "No connection to states 127.0.0.0:6379[redis]"
    - sudo apt-get install redis-server

2.	Sollte der CIFS-Mount mit IP-Adresse nicht möglich sein, sollte der Hostname des NAS verwendet werden
3.  Wenn ihr beim cifs-mount ein Passwort mit Sonderzeichen verwendet, haben User festgestellt, dass dann das Passwort mit Anführungszeichen in der Config hinterlegt werden muss.
4.  cifs-mount kann laut einigen Usern mit sehr langen Passwörtern nicht umgehen. Falls der mount nicht klappen sollte, kürz das Passwort etwas ein (12 Zeichen sind funktionieren bei mir).
5.  Sollte der Adapter sich nicht installieren lassen, prüft eure Versionen von node und nodejs. Der Adapter unterstützt Versionen < Node 8 nicht.
6.  Wenn euer iobroker System mit dem neuen Installer Script installiert wurde, kann es vorkommen, dass ihr nicht alle Rechte für den neuen User iobroker habt. 
    Dies betrifft dann leider auch backitup, da backitup einige systemrelevante Befehle benutzt.

    Um das Problem mit fehlenden Rechten zu beheben, gibt es inzwischen einen Fix für den Installerscript von iobroker.
    Führt bitte folgende Befehle auf eure Iobrokerumgebung in der Konsole aus:

    ```
    curl -fsL https://iobroker.net/fix.sh | bash -
    sudo reboot
    ```
8.  Solltet Ihr eine Fehlermeldung beim erstellen der Redis Datenbank bekommen, prüft bitte, ob euer User iobroker die Rechte hat und ob er in der User-Gruppe Redis vorhanden ist.
    Wenn dies nicht der Fall ist, könnt ihr das mit folgenden Befehl in der Konsole beheben.
    
    ```
    sudo usermod -a -G redis iobroker
    sudo reboot
    ```
    Wenn ihr nicht mit dem Installerscript eure Iobroker Installation aufgesetzt habt und euer User einen anderen Namen hat, bitte in dem Befehl "iobroker" durch euren User ersetzen.



        


