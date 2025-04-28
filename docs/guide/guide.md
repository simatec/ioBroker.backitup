**Hier findet ihr eine kleine Sammlung an Tipps und Tricks, die von Usern für User geschrieben ist. 
Vorschläge und Verbesserungen könnt ihr gerne im [Forum](https://forum.iobroker.net/topic/63694/aufruf-zur-unterst%C3%BCtzung-f%C3%BCr-backitup-wiki?page=1) posten.**

---

# Adapter Konfiguration von ioBroker.backitup sichern

Um bei der Einrichtung eines neuen Systems den Restore auszuführen, ist es meist wichtig, den ioBroker.backitup Adapter im Vorfeld zu konfigurieren.
Dafür gibt es eine einfache Möglichkeit.

Man kann sich auf dem alten System die Konfiguration sichern und / oder auch sehr einfach wieder laden.

Das sichern und laden der Konfiguration erfolgt im Menü des Adapters über die Pfeiltasten oben rechts.
Des Weiteren besteht im Tab-Menü des Adapters die Möglichkeit über den Button `BACKITUP-EINSTELLUNGEN SICHERN`


_[Zurück zum Anfang](#start-of-content)_

---


# Adapter Konfiguration von ioBroker.backitup wiederherstellen

Um bei der Einrichtung eines neuen Systems den Restore auszuführen, ist es wichtig, den ioBroker.backitup Adapter im Vorfeld zu konfigurieren.
Dafür gibt es eine einfache Möglichkeit.

Man kann sich auf dem alten System die Konfiguration sichern und / oder auch sehr einfach wieder laden.

Das wiederherstellen der Adapterkonfiguration kann ganz einfach über das TAB Menü von ioBroker Backitup erledigt werden.
Über den Button `BACKITUP-EINSTELLUNGEN WIEDERHERSTELLEN` könnt ihr die Konfiguartionsdatei auswählen und wiederherstellen.


_[Zurück zum Anfang](#start-of-content)_

---


# CIFS SMB Freigaben unter FritzNAS 7 auf einer Fritzbox

Vorab: Es empfiehlt sich das NAS mit einem Linux-Dateisystem zu betreiben, dann fällt schon mal die Übersetzung der unix-Rechte weg. Hier ist allerdings für den Betrieb an der FritzBox ein Tweak für eine frisch mit ext4 formatierte Partition erforderlich:

```
sudo tune2fs -O ^metadata_csum /dev/sdXY
sudo tune2fs -O ^64bit /dev/sdXY
```

(Die Gerätedatei /dev/sdXY muss passend ersetzt werden!)

Wenn der Datenträger an die FritzBox gesteckt wurde legt man im FritzOS unter

System FRITZ!Box-Benutzer

einen eigenen User wie z. B. 'iobrokerbackupper' oder etwas ähnliches an. Diesem User verpassen wir die Rechte: Zugang zu NAS-Inhalten

Unter http://fritz.box/nas#/files legt man nun am besten einen eigenes Verzeichnis für die künftigen Backups an.

In den Einstellungen des ioBroker.backitup-Adapters stellt man folgendes ein:

![224140112-a0a99554-f9c1-4712-ae9f-4fb5a88c4ec4](https://user-images.githubusercontent.com/39792461/224364096-c39691b6-0d4d-41fd-b627-00002ea2695e.png)

Den Pfad zum freigegebenen Verzeichnis in der letzten Zeile muss man noch mit der Datenträgerbezeichnug ergänzen. Diese kann man u. a. hier finden: http://fritz.box/#usbOv

**Danke an Thomas für die Erstellung des Beitrags**

_[Zurück zum Anfang](#start-of-content)_

---


# Externe Datenbanken im Docker Container sichern.
Um externe Datenbanken wie mySql oder influxDB mit ioBroker.Backitup sichern zu können, muss der Container eine Environment Variable(ENV) gesetzt bekommen.
Diese sollte wie folgt aussehen:

`IOB_BACKITUP_EXTDB`

Diese Variable aktiviert die Sicherung externer Datenbanken im ioBroker.backitup Adapter und kann "true" oder "false" sein.


_[Zurück zum Anfang](#start-of-content)_

---

# Google Drive Tutorial

**Vorwort**

Leider kommt es immer mal wieder vor, dass Cloud-Anbieter ihre Richtlinien oder Berechtigungen der API's ändern.
Auch bei Google tritt das ab und an mal auf.

Solltest du Probleme haben, dass keine Backups mehr gespeichert werden, oder sich alte Backups nicht löschen lassen, gehe bitte wie folgt vor.

1. Erstelle über die Konfiguration von Backitup ein neuen Token
2. Ändere in Backitup den Speicherpfad (von z.B. `/backups/iobroker` auf `/backups-neu/iobroker`). Backitup legt diesen Pfad dann automatisch an
3. Verschiebe in Google Drive die Backups in den neuen Speicherpfad

Danach sollten alle Probleme behoben sein.


_[Zurück zum Anfang](#start-of-content)_

---

# InfluxDB2 Restore

**Vorwort**

Der im Folgenden beschriebene Restore einer InfluxdB zeigt das Vorgehen für ein neu installierten ioBroker, wie z.B. bei Hardwareumzug einer nativen Installation.

Dabei steht eine größtmöglich Nutzung der aktuellen ioBroker.backitup GUI im Vordergrund (Alternativen über die Kommandozeile sind hier nicht beschrieben). 

**Voraussetzung**

Ein funktionales Grundsystem bestehend aus ioBroker inkl. ioBroker.backitup wie es z.B. nach einer Neuinstallation vorliegt. 
Funktionale Backup-Files einer versionsgleichen InfluxdB für ein Restore verstehen sich von selbst.

Ein Restore des ioBroker's (ohne InfluxdB) hat mittels ioBroker.backitup bereits stattgefunden und der InfluxdB Adapter ist installiert sowie die jeweilige Instanz ist mit den alten Einstellungen bereits wiederhergestellt. 

Die InfluxdB Instanz(en) sind in den Stop-Zustand zu versetzen.

**Restore influxdb2**

Durch das ioBroker-Restore befinden sich nicht mehr nutzbare Token in der InfluxdB (All-Access) und ioBroker.backitup (Admin) Instanz.

Man beginnt nun mit der Installation von InfluxdB2 auf dem System nach allg. bekannten Weg.
 
Bei der Neuinstallation ist kein Bucket neu anzulegen bzw. mindestens ein neuer Bucketname zu wählen.
ioBroker.backitup löscht/ergänzt/überschreibt etc. aktuell **kein** Bucket mit identischem Namen beim Restore.

In der Access-Verwaltung von Influxdb2 ist ein Token für den Zugriff von ioBroker anzulegen und diesen in die InfluxdB-Instanz einzutragen.

Nun benötigen wir für den ioBroker.backitup Adapter den neuen Operator-Token, welcher z.B. über die Linux-Kommandozeile durch 

```influx auth list -t <ein all access token>```

über den ersten Eintrag der Ausgabe eingesehen werden kann. (Hinweis: Beim Kopieren in die Instanz-Settings auf Zeilenumbrüche etc. achten!).

Nun ist ein neuer Operator-Token in der InfluxdB-Instanz und ein Operator-Token in ioBroker.backitup eingetragen.

Nun kann ein Restore von ioBroker.backitup der InfluxdB gestartet und durchgeführt werden.


Der Log ist zu kontrollieren und die Influx-Instanz(en) können wieder gestartet werden.

**Danke an @Dieter_P für die Erstellung des Beitrags**


_[Zurück zum Anfang](#start-of-content)_

---


# Operator-Token für InfluxDB 2.x wiederherstellen

Der Operator-Token ist für die InfluxDB 2.x extrem wichtig und wird bei der Ersteinrichtung generiert.
Dieser Token sollte sicher notiert und aufbewahrt werden.

Sollte es aus irgendwelchen Gründen nun passieren, dass man den Token versehentlich gelöscht hat, so kann man ihn mit einigen Befehlen wiederherstellen.

Was benötigen wir dafür?

* Wir benötigen den Namen der Organisation
* Es wird der Username das Hauptbenutzer (Admin) benötigt
* Der Bolt-Pfad zur Datei influxd.bolt wird benötigt (Standard: /var/lib/influxdb2/influxd.bolt)

Als erstes müssen wir den InfluxDB-Server stoppen

```
sudo service influxdb stop
```

Um sicherzustellen, dass der Prozess beendet wurde, sollte der Status überprüft werden.

```
sudo service influxdb status
```

Sollte die Datenbank gestoppt sein, könnt ihr weitermachen.

Der eigentliche Befehl zur Wiederherstellung eures Operator-Tokens erfolgt mit folgenden Befehl:

```
sudo influxd recovery auth create-operator --org <deine_org> --username <dein_user> --bolt-path /var/lib/influxdb2/influxd.bolt
```

Ist die Wiederherstellung erfolgreich abgeschlossen, erhaltet ihr in der Log-Ausgabe alle Token angezeigt.
Der letzte Token in der Liste mit der Description `<dein_user>'s Recovery Token` ist der neu erstellte Operator-Token.

Sollte eine Fehlermeldung wie z.B. `Error: bucket "authorizationsv1": bucket not found` kommen, dann ist der bolt-path nicht korrekt.



Dies kann passieren, wenn eure Influxdb 2.x Installation aus einer Influxdb 1.x migriert wurde.
Hier kann der bolt-path abweichen (/var/lib/influxdb/influxd.bolt)

Solltet ihr nicht genau wissen, wo die Datei "influxd.bolt" sich im System befindet, könnt Ihr mit folgenden Befehl danach suchen.

```
find / -name influxd.bolt
```

Wenn Ihr den Pfad ermittelt habt, führt den Recovery-Befehl erneut aus.

Nachdem der Operator-Token nun wiederhergestellt ist, achtet bitte darauf, diesen sorgfältig zu behandeln.

_[Zurück zum Anfang](#start-of-content)_

---


# Token für InfluxDB 2.x Backup richtig erstellen

Das Backup einer influxDB v2.x lässt sich nur mit einem Operator-Token (manchmal auch als Master-Token bezeichnet) durchführen.
Dieses wird während der Installation von influxDB erstellt. 

In der aktuellen grafischen Oberfläche lässt sich dieses Token nicht mehr anzeigen. Daher muss es über das CLI (Kommandozeile influx) ausgegeben werden.

Dazu wie folgt vorgehen:

1)  Wenn in der infllux Oberfläche bereits ein all-access API Token erstellt wurde, dann weiter mit Schritt 3

2)  Ein neues all-access API Token im GUI erstellen

    ![influx-1](https://user-images.githubusercontent.com/39792461/224361203-7932e815-d8d4-4abb-ad7f-544f46b61e1d.png)

    Token kopieren

    ![influx-2](https://user-images.githubusercontent.com/39792461/224361519-6b8188c4-cc29-46a0-8ee0-c2b4b0f260df.png)

    Achtung, der Copy Button funktioniert nicht immer. Also evtl ctrl-C oder rechts-Klick-Kopieren nutzen
   
3)  Ausgabe der vorhandenen Tokens

   ```
   influx auth list -t <TOKEN> --json
   ```

4) Das erste gelistete Token ist das Operator-Token. 
   Beispiel  
```
{
     "id": "0abfe8ca7acd6aaa",
     "description": "iobroker's Token",
     "token": "<Operator-Token>",
     "status": "active",
     "userName": "iobroker",
     "userID": "0abfe8ca664d6aaa",
     "permissions": [
         "read:/authorizations",
         "write:/authorizations",
         "read:/buckets",
         "write:/buckets",
         "read:/dashboards",
         "write:/dashboards",
         "read:/orgs",
         "write:/orgs",
         "read:/sources",
         "write:/sources",
         "read:/tasks",
         "write:/tasks",
         "read:/telegrafs",
         "write:/telegrafs",
         "read:/users",
         "write:/users",
         "read:/variables",
         "write:/variables",
         "read:/scrapers",
         "write:/scrapers",
         "read:/secrets",
         "write:/secrets",
         "read:/labels",
         "write:/labels",
         "read:/views",
         "write:/views",
         "read:/documents",
         "write:/documents",
         "read:/notificationRules",
         "write:/notificationRules",
         "read:/notificationEndpoints",
         "write:/notificationEndpoints",
         "read:/checks",
         "write:/checks",
         "read:/dbrp",
         "write:/dbrp",
         "read:/notebooks",
         "write:/notebooks",
         "read:/annotations",
         "write:/annotations",
         "read:/remotes",
         "write:/remotes",
         "read:/replications",
         "write:/replications"
    ]
}
```
5) Wenn es keinen solchen Eintrag gibt, dann wurde das Operator-Token gelöscht. Auch das kann repariert werden. [Hier](#operator-token-für-influxdb-2x-wiederherstellen) findet Ihr eine Anleitung, wie ihr den Token wiederherstellen könnt.

6) Testen mit
   ```
   influx backup --bucket <iobroker-bucket> --host http://<ip-influx-server>:8086 -t <Operator-Token> "/tmp/influx-test"   
   ```
   Wenn das sauber durchläuft funktioniert das Backup und das Verzeichnis /tmp/influx-test kann gelöscht werden
   
7) Das Operator-Token  in den ioBroker.backitup Adapter Einstellungen eintragen.

**Danke an @ostfrieseunterwegs für die Erstellung des Beitrags**

_[Zurück zum Anfang](#start-of-content)_

---
