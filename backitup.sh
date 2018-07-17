#!/bin/bash

# Description: Backup script for IoBroker
#
# Based on the script by Kuddel: http://forum.iobroker.net/viewtopic.php?f=21&t=9861
#
# Features: - Create a normal ioBroker backup
# - Make a backup of the entire ioBroker folder
# - Optionally delete backups older than x days
# - Optional further copy to an FTP server
#
#
# Author: Steffen
# Version: 1.0      - First draft of the backup script
# Version: 1.0.1    - Optional upload to FTP server
# Version: 2.0      - Raspberrymatic backup included
# Version: 2.0.1    - Optional use of CIFS mount included
#                   - Iobroker stop and start at full backup inserted
# Version: 2.0.2    - Additional MYSQL backup including upload to FTP server
# Version: 2.0.3    - First version on Github
# Version: 2.0.4    - Backup option for Homematic CCU and pivccu integrated
# Version: 3.0.0    - Backup for Raspberrymatic removed (everything is now done via the Homematic CCU Backup)
#                   - various changes and improvements in the script
# Version: 3.0.1    - FTP upload changed to "curl" (The LFTP package is no longer needed)
# Versíon: 3.0.2    - Added backup to Redis State
# Version: 3.0.3    - bugfix mount
# Version: 3.0.4    - Bugfix complete backup
# Version: 3.0.5    - Mysql extension to host and port
#                   - Compressing the MySql backup
#
#
# Use:  bash backitup.sh "Backup_Typ|NAME_SUFFIX|DELETE_AFTER_X_Tagen|NAS_Host|NAS_Verzeichnis|NAS_User|NAS_Passwort|CCU-IP|CCU-USER|CCU-PW|CIFS_MNT|IOBROKER_RESTART|REDIS_STATE|MYSQL_DBNAME|MYSQL_USR|MYSQL_PW|MYSQL_DELETE_AFTER_X_Tagen|MYSQL_HOST|MYSQL_PORT"
#
#
STRING=$1
echo $STRING
IFS="|"
VAR=($STRING)


############################################################################
#									                                       #
# Definieren der Scriptvariablen                                           #
#                                                                          #
############################################################################

BKP_TYP=${VAR[0]}
NAME_SUFFIX=${VAR[1]}
BKP_DELETE_AFTER=${VAR[2]}
NAS_HOST=${VAR[3]}
NAS_DIR=${VAR[4]}
NAS_USR=${VAR[5]}
NAS_PASS=${VAR[6]}
CCU_HOST=${VAR[7]}
CCU_USER=${VAR[8]}
CCU_PASS=${VAR[9]}
CIFS_MNT=${VAR[10]}
IOBROKER_RESTART=${VAR[11]}
REDIS_STATE=${VAR[12]}
MYSQL_DBNAME=${VAR[13]}
MYSQL_USR=${VAR[14]}
MYSQL_PW=${VAR[15]}
MYSQL_DELETE_AFTER=${VAR[16]}
MYSQL_HOST=${VAR[17]}
MYSQL_PORT=${VAR[18]}

# Variable für optionales Weiterkopieren
BKP_OK="NEIN"

# Datum definieren für iobroker
datum=`date +%Y_%m_%d`

# Backuppfad im iobroker definieren
bkpdir="/opt/iobroker/backups"

# Uhrzeit bestimmten
uhrzeit=`date +%H_%M_%S`

# Stunde definieren
stunde=`date +%H`

# Minute definieren
minute=`date +%M`



############################################################################
#									   #
# Optionaler Mount auf CIFS-Server                                 	   #
#                                                                          #
############################################################################

if [ $CIFS_MNT == "CIFS" ]; then
	echo "--- Backup-Pfad auf CIFS mounten ---"
	
	mount | grep -q "${bkpdir}"
	if [ $? -eq 0 ] ; then
		sudo umount $bkpdir && echo success "--- Umount CIFS Server ---" || echo error "--- Backup-Pfad wurde nicht vom CIFS-Server getrennt ---"
	fi
	
	sudo mount -t cifs -o user=$NAS_USR,password=$NAS_PASS,rw,file_mode=0777,dir_mode=0777,vers=1.0 //$NAS_HOST/$NAS_DIR $bkpdir
	
	mount | grep -q "${bkpdir}"
	if [ $? -eq 0 ] ; then
		echo success "--- CIFS-Server verbunden ---"
	else
		sudo mount -t cifs -o user=$NAS_USR,password=$NAS_PASS,rw,file_mode=0777,dir_mode=0777 //$NAS_HOST/$NAS_DIR $bkpdir && echo success "--- CIFS-Server verbunden ---" || echo error "--- Backup-Pfad wurde nicht auf CIFS-Server verbunden ---"
	fi
fi


############################################################################
#									   #
# Optionales MYSQL-Datenbank-Backup                 		           #
#                                                                          #
############################################################################

if [ -n "$MYSQL_DBNAME" ]; then
	if [ $BKP_TYP == "minimal" ] || [ $BKP_TYP == "komplett" ]; then
		echo "--- MYSQL-Backup wird erstellt ---"
		mysqldump -u $MYSQL_USR -p$MYSQL_PW $MYSQL_DBNAME -h $MYSQL_HOST -P $MYSQL_PORT > $bkpdir/backupiobroker_mysql-$MYSQL_DBNAME-$datum-$uhrzeit.sql && echo success "--- MYSQL Backup wurde erstellt ---" || echo error "--- MYSQL Backup konnte nicht erstellt werden ---"
		cd $bkpdir
		tar -czf backupiobroker_mysql-$MYSQL_DBNAME-$datum-$uhrzeit.tar.gz backupiobroker_mysql-$MYSQL_DBNAME-$datum-$uhrzeit.sql && echo success "--- MySql wurde komprimiert ---" || echo error "--- MySql wurde nicht komprimiert ---"
		
		if [ -f $bkpdir/backupiobroker_mysql-$MYSQL_DBNAME-$datum-$uhrzeit.sql ] && [ -f $bkpdir/backupiobroker_mysql-$MYSQL_DBNAME-$datum-$uhrzeit.tar.gz ]; then
			rm -f backupiobroker_mysql-$MYSQL_DBNAME-$datum-$uhrzeit.sql
		fi

		cd ..
	fi
fi


############################################################################
#									   #
# Erstellen eines normalen ioBroker Backups                                #
#                                                                          #
############################################################################

if [ $BKP_TYP == "minimal" ]; then

#	Backup ausfuehren
	echo "--- Es wurde ein Normales Backup gestartet ---"
	iobroker backup && echo success "--- Ein normales Backup wurde erstellt ---" || echo error "--- Ein normales Backup konnte nicht erstellt werden ---"
	BKP_OK="JA"

#	Backup umbenennen
	mv $bkpdir/$datum-$stunde* $bkpdir/backupiobroker_minimal$NAME_SUFFIX-$datum-$uhrzeit.tar.gz


############################################################################
#									   #
# Erstellen eines Backups des ganzen ioBroker-Ordners                      #
#                                                                          #
############################################################################

elif [ $BKP_TYP == "komplett" ]; then

#	IoBroker stoppen
	if [ $IOBROKER_RESTART == "true" ]; then
		cd /opt/iobroker
		sleep 10
		iobroker stop
		echo "--- IoBroker gestoppt ---"
	fi

#	Ins ioBroker Verzeichnis wechseln um komplettes IoBroker Verzeichnis zu sichern

#	Backup ausfuehren
	echo "--- Es wurde ein Komplettes Backup gestartet ---"
	tar -czf $bkpdir/backupiobroker_komplett$NAME_SUFFIX-$datum-$uhrzeit.tar.gz --exclude="$bkpdir" -P /opt/iobroker && echo success "--- Ein komplettes Backup wurde erstellt ---" || echo error "--- Ein komplettes Backup konnte nicht erstellt werden ---"
	BKP_OK="JA"

#	Redis State sichern
	if [ $REDIS_STATE == "true" ]; then
		cp /var/lib/redis/dump.rdb $bkpdir/dump_redis_$datum-$uhrzeit.rdp && echo success "--- Ein Redis Backup wurde erstellt ---" || echo error "--- Ein Redis Backup konnte nicht erstellt werden ---"
		cd $bkpdir
		chmod 777 dump_redis_$datum-$uhrzeit.rdp
		tar -czf backup_redis_state_$datum-$uhrzeit.tar.gz dump_redis_$datum-$uhrzeit.rdp && echo success "--- Redis Backup wurde komprimiert ---" || echo error "--- Redis Backup wurde nicht komprimiert ---"
		
		if [ -f $bkpdir/dump_redis_$datum-$uhrzeit.rdp ] && [ -f $bkpdir/backup_redis_state_$datum-$uhrzeit.tar.gz ]; then
			rm -f dump_redis_$datum-$uhrzeit.rdp
		fi

		cd ..
		echo "--- Redis Backup wurde erstellt ---"
	fi
# 	IoBroker neustarten
	if [ $IOBROKER_RESTART == "true" ]; then
 		iobroker restart
#		cd /opt/iobroker
#		iobroker start
		echo "--- IoBroker gestartet ---"
	fi
	
############################################################################
#									   #
# Erstellen eines Backups der Homematic-CCU                                #
#                                                                          #
############################################################################

elif [ $BKP_TYP == "ccu" ]; then

# 	Meldung
	echo "--- Es wurde ein Homematic CCU Backup gestartet ---"

	run=$0.lastrun
 
# 	Homematic Login
	wget --post-data '{"method":"Session.login","params":{"username":"'$CCU_USER'","password":"'$CCU_PASS'"}}' http://$CCU_HOST/api/homematic.cgi -O hm.login.response -q >$run 2>&1 && echo success "--- Login Homematic-CCU erfolgreich ---" || echo error "--- Login Homematic-CCU nicht erfolgreich ---"
	BKP_OK="JA"
 
# 	Login-Pruefung
	loginerror=`cat hm.login.response|cut -d "," -f3|awk '{print $2}'`
	if [ "$loginerror" != "null}" ]; then
		echo "Fehler beim Homematic-Login !"|tee -a $run
		cat hm.login.response|grep message|cut -d '"' -f4|tee -a $run
		echo "--- Fehler beim Homematic-Login!! Details unter: $run ---"
		exit 1
	fi
	sessionid=`cat hm.login.response|cut -d "," -f2|awk '{print $2}'|cut -d '"' -f2`
	
#	Homematic-Version auslesen
	VER=$(wget -q -O - http://$CCU_HOST/api/backup/version.cgi)
	ccuversion="${VER:8:7}"
 
# 	Backupdatei herunterladen
	wget "http://$CCU_HOST/config/cp_security.cgi?sid=@$sessionid@&action=create_backup" -O $bkpdir/Homematic-Backup-$ccuversion-$datum-$uhrzeit.tar.sbk -q >>$run 2>&1 && echo success "--- Ein Homematic-CCU Backup wurde erstellt ---" || echo error "--- Ein Homematic-CCU Backup konnte nicht erstellt werden ---"
 
# 	Homematic Logout
	wget --post-data '{"method":"Session.logout","params":{"_session_id_":"'$sessionid'"}}' http://$CCU_HOST/api/homematic.cgi -O hm.logout.response -q >>$run 2>&1
 
# 	temp. Dateien loeschen
	rm hm.login.response hm.logout.response >>$run 2>&1

	BKP_OK="JA"
	
else
	echo "--- Kein gueltiger Backup Typ gewaehlt! Moegliche Auswahl: 'minimal', 'komplett' oder 'ccu' ---"
fi



############################################################################
#									   #
# Optionales Loeschen alter Backups                                        #
#                                                                          #
############################################################################

if [ -n "$MYSQL_DELETE_AFTER" ]; then
	find $bkpdir -name "backupiobroker_mysql*.tar.gz" -mtime +$MYSQL_DELETE_AFTER -exec rm '{}' \;
fi

if [ $BKP_OK == "JA" ]; then
	if [ -n "$BKP_DELETE_AFTER" ]; then
#		Backups Älter X Tage löschen
		echo "--- Alte Backups entfernen ---"
        if [ $BKP_TYP == "komplett" ]; then
            if [ $REDIS_STATE == "true" ]; then
                find $bkpdir -name "backup_redis_state_*.tar.gz" -mtime +$BKP_DELETE_AFTER -exec rm '{}' \; && echo success "--- Ueberpruefung auf alte Dateien und loeschen erfolgreich ---" || echo error "--- Ueberpruefung auf alte Dateien und loeschen nicht erfolgreich ---"
                sleep 10
            fi
        fi
        
		if [ $BKP_TYP == "ccu" ]; then
			find $bkpdir -name "*.tar.sbk" -mtime +$BKP_DELETE_AFTER -exec rm '{}' \; && echo success "--- Ueberpruefung auf alte Dateien und loeschen erfolgreich ---" || echo error "--- Ueberpruefung auf alte Dateien und loeschen nicht erfolgreich ---"
			sleep 10
		else
			find $bkpdir -name "backupiobroker_$BKP_TYP$NAME_SUFFIX*.tar.gz" -mtime +$BKP_DELETE_AFTER -exec rm '{}' \; && echo success "--- Ueberpruefung auf alte Dateien und loeschen erfolgreich ---" || echo error "--- Ueberpruefung auf alte Dateien und loeschen nicht erfolgreich ---"
			sleep 10
		fi
	else
		echo "--- Es werden keine alten Backups geloescht ---"
	fi


############################################################################
#									   #
# Optionaler Upload des Backups auf einen FTP-Server                       #
#                                                                          #
############################################################################

	if [ $CIFS_MNT == "FTP" ]; then
		if [ -n "$NAS_HOST" ]; then
#			Backup-Files via FTP kopieren
			echo "--- Backup-File FTP-Upload wird gestartet ---"
#			Verzeichnis wechseln
			cd $bkpdir/
			ls

			if [ -n "$MYSQL_DBNAME" ]; then
				curl -s --disable-epsv -v -T"$bkpdir/backupiobroker_mysql-$MYSQL_DBNAME-$datum-$uhrzeit.tar.gz" -u"$NAS_USR:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
			fi

			if [ $BKP_TYP == "ccu" ]; then
				curl -s --disable-epsv -v -T"$bkpdir/Homematic-Backup-$ccuversion-$datum-$uhrzeit.tar.sbk" -u"$NAS_USR:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
			else
				curl -s --disable-epsv -v -T"$bkpdir/backupiobroker_$BKP_TYP$NAME_SUFFIX-$datum-$uhrzeit.tar.gz" -u"$NAS_USR:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
			fi
			if [ $REDIS_STATE == "true" ]; then
			curl -s --disable-epsv -v -T"$bkpdir/backup_redis_state_$datum-$uhrzeit.tar.gz" -u"$NAS_USR:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
			fi
		fi
	fi
	BKP_OK="NEIN"
else
	echo "--- Kein Backup erstellt! ---"
fi


############################################################################
#									   #
# Optionaler Umount des CIFS-Servers                    		   #
#                                                                          #
############################################################################

if [ $CIFS_MNT == "CIFS" ]; then

#	Backup-Pfad auf CIFS umounten

	mount | grep -q "${bkpdir}"
	if [ $? -eq 0 ] ; then
		sudo umount $bkpdir && echo success "--- Umount CIFS Server ---" || echo error "--- Backup-Pfad wurde nicht vom CIFS-Server getrennt ---"
	fi
fi

exit 0