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
# Use:  bash backitup.sh "BACKUP-Type|NAME-Suffix|DELETE_AFTER_X_Days|NAS-Host|NAS-Directory|NAS-User|NAS-Password|CCU-Host|CCU-User|CCU-Password|CIFS-Mount|IOB-Restart|REDIS-Backup|MYSQL-DBName|MYSQL-User|MYSQL-Password|MYSQL-DELETE_AFTER_X_Days|MYSQL-Host|MYSQL-Port|IOB-HomeDirectory"
#
#
STRING=$1
echo $STRING
IFS="|"
VAR=($STRING)


############################################################################
#									                                       #
# Definition of the script variables                                       #
#                                                                          #
############################################################################

BACKUP_TYPE=${VAR[0]}
NAME_SUFFIX=${VAR[1]}
BACKUP_DELETE_AFTER=${VAR[2]}
NAS_HOST=${VAR[3]}
NAS_DIR=${VAR[4]}
NAS_USER=${VAR[5]}
NAS_PASS=${VAR[6]}
CCU_HOST=${VAR[7]}
CCU_USER=${VAR[8]}
CCU_PASS=${VAR[9]}
CIFS_MOUNT=${VAR[10]}
IOBROKER_RESTART=${VAR[11]}
REDIS_STATE=${VAR[12]}
MYSQL_DBNAME=${VAR[13]}
MYSQL_USER=${VAR[14]}
MYSQL_PASS=${VAR[15]}
MYSQL_DELETE_AFTER=${VAR[16]}
MYSQL_HOST=${VAR[17]}
MYSQL_PORT=${VAR[18]}
IOBROKER_DIR=${VAR[19]}

# Variable für optionales Weiterkopieren
BACKUP_OK="NO"

# Date for ioBroker
date=`date +%Y_%m_%d`

# Backuppfad im ioBroker definieren
backupDir="${IOBROKER_DIR}/backups"

# Uhrzeit bestimmten
time=`date +%H_%M_%S`

# Stunde definieren
hour=`date +%H`

# Minute definieren
minute=`date +%M`



############################################################################
#									                                       #
# Optional Mount to CIFS-Server                                 	       #
#                                                                          #
############################################################################

if [ $CIFS_MOUNT == "CIFS" ]; then
    echo "--- Mount Backup-Path on CIFS ---"

    mount | grep -q "${backupDir}"
    if [ $? -eq 0 ] ; then
        sudo umount $backupDir && echo success "--- Unmount CIFS Server ---" || echo error "--- Backup-Pfad wurde nicht vom CIFS-Server getrennt ---"
    fi

    sudo mount -t cifs -o user=$NAS_USER,password=$NAS_PASS,rw,file_mode=0777,dir_mode=0777,vers=1.0 //$NAS_HOST/$NAS_DIR $backupDir

    mount | grep -q "${backupDir}"
    if [ $? -eq 0 ] ; then
        echo success "--- CIFS-Server verbunden ---"
    else
        sudo mount -t cifs -o user=$NAS_USER,password=$NAS_PASS,rw,file_mode=0777,dir_mode=0777 //$NAS_HOST/$NAS_DIR $backupDir && echo success "--- CIFS-Server verbunden ---" || echo error "--- Backup-Pfad wurde nicht auf CIFS-Server verbunden ---"
    fi
fi


############################################################################
#						                                    			   #
# Optionales MYSQL-Datenbank-Backup                      		           #
#                                                                          #
############################################################################

if [ -n "$MYSQL_DBNAME" ]; then
    if [ $BACKUP_TYPE == "minimal" ] || [ $BACKUP_TYPE == "total" ]; then
        echo "--- Creating MYSQL-Backup ---"
        mysqldump -u $MYSQL_USER -p$MYSQL_PASS $MYSQL_DBNAME -h $MYSQL_HOST -P $MYSQL_PORT > $backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql && echo success "--- MYSQL Backup wurde erstellt ---" || echo error "--- MYSQL Backup konnte nicht erstellt werden ---"
        cd $backupDir
        tar -czf backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.tar.gz backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql && echo success "--- MySql wurde komprimiert ---" || echo error "--- MySql wurde nicht komprimiert ---"

        if [ -f $backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql ] && [ -f $backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.tar.gz ]; then
            rm -f backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql
        fi

        cd ..
    fi
fi


############################################################################
#									   #
# Erstellen eines normalen ioBroker Backups                                #
#                                                                          #
############################################################################

if [ $BACKUP_TYPE == "minimal" ]; then

#	Backup ausfuehren
    echo "--- Es wurde ein Normales Backup gestartet ---"
    iobroker backup && echo success "--- Ein normales Backup wurde erstellt ---" || echo error "--- Ein normales Backup konnte nicht erstellt werden ---"
    BACKUP_OK="JA"

#	Backup umbenennen
    mv $backupDir/$date-$hour* $backupDir/backupiobroker_minimal$NAME_SUFFIX-$date-$time.tar.gz


############################################################################
#									   #
# Erstellen eines Backups des ganzen ioBroker-Ordners                      #
#                                                                          #
############################################################################

elif [ $BACKUP_TYPE == "total" ]; then

#	IoBroker stoppen
    if [ $IOBROKER_RESTART == "true" ]; then
        cd $IOBROKER_DIR
        sleep 10
        iobroker stop
        echo "--- IoBroker stopped ---"
    fi

#	Ins ioBroker Verzeichnis wechseln um totales IoBroker Verzeichnis zu sichern

#	Backup ausfuehren
    echo "--- Es wurde ein Komplettes Backup gestartet ---"
    tar -czf $backupDir/backupiobroker_total$NAME_SUFFIX-$date-$time.tar.gz --exclude="$backupDir" -P $IOBROKER_DIR && echo success "--- Ein totales Backup wurde erstellt ---" || echo error "--- Ein totales Backup konnte nicht erstellt werden ---"
    BACKUP_OK="JA"

#	Redis State sichern
    if [ $REDIS_STATE == "true" ]; then
        # Avoid direct paths!
        cp /var/lib/redis/dump.rdb $backupDir/dump_redis_$date-$time.rdp && echo success "--- Ein Redis Backup wurde erstellt ---" || echo error "--- Ein Redis Backup konnte nicht erstellt werden ---"
        cd $backupDir
        chmod 777 dump_redis_$date-$time.rdp
        tar -czf backup_redis_state_$date-$time.tar.gz dump_redis_$date-$time.rdp && echo success "--- Redis Backup wurde komprimiert ---" || echo error "--- Redis Backup wurde nicht komprimiert ---"

        if [ -f $backupDir/dump_redis_$date-$time.rdp ] && [ -f $backupDir/backup_redis_state_$date-$time.tar.gz ]; then
            rm -f dump_redis_$date-$time.rdp
        fi

        cd ..
        echo "--- Redis Backup wurde erstellt ---"
    fi
# 	Restart ioBroker
    if [ $IOBROKER_RESTART == "true" ]; then
#		cd $IOBROKER_DIR
        iobroker restart
#		iobroker start
        echo "--- IoBroker gestartet ---"
    fi

############################################################################
#							                                      		   #
# Create backup of Homematic-CCU                                           #
#                                                                          #
############################################################################

elif [ $BACKUP_TYPE == "ccu" ]; then

# 	Meldung
    echo "--- Es wurde ein Homematic CCU Backup gestartet ---"

    run=$0.lastrun
 
# 	Homematic Login
    wget --post-data '{"method":"Session.login","params":{"username":"'$CCU_USER'","password":"'$CCU_PASS'"}}' http://$CCU_HOST/api/homematic.cgi -O hm.login.response -q >$run 2>&1 && echo success "--- Login Homematic-CCU erfolgreich ---" || echo error "--- Login Homematic-CCU nicht erfolgreich ---"
    BACKUP_OK="JA"
 
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
    wget "http://$CCU_HOST/config/cp_security.cgi?sid=@$sessionid@&action=create_backup" -O $backupDir/Homematic-Backup-$ccuversion-$date-$time.tar.sbk -q >>$run 2>&1 && echo success "--- Ein Homematic-CCU Backup wurde erstellt ---" || echo error "--- Ein Homematic-CCU Backup konnte nicht erstellt werden ---"
 
# 	Homematic Logout
    wget --post-data '{"method":"Session.logout","params":{"_session_id_":"'$sessionid'"}}' http://$CCU_HOST/api/homematic.cgi -O hm.logout.response -q >>$run 2>&1
 
# 	temp. Dateien loeschen
    rm hm.login.response hm.logout.response >>$run 2>&1

    BACKUP_OK="JA"

else
    echo "--- Kein gueltiger Backup Typ gewaehlt! Moegliche Auswahl: 'minimal', 'total' oder 'ccu' ---"
fi



############################################################################
#								                                     	   #
# Optionales Loeschen alter Backups                                        #
#                                                                          #
############################################################################

if [ -n "$MYSQL_DELETE_AFTER" ]; then
    find $backupDir -name "backupiobroker_mysql*.tar.gz" -mtime +$MYSQL_DELETE_AFTER -exec rm '{}' \;
fi

if [ $BACKUP_OK == "JA" ]; then
    if [ -n "$BACKUP_DELETE_AFTER" ]; then
#		Backups Älter X Tage löschen
        echo "--- Alte Backups entfernen ---"
        if [ $BACKUP_TYPE == "total" ]; then
            if [ $REDIS_STATE == "true" ]; then
                find $backupDir -name "backup_redis_state_*.tar.gz" -mtime +$BACKUP_DELETE_AFTER -exec rm '{}' \; && echo success "--- Ueberpruefung auf alte Dateien und loeschen erfolgreich ---" || echo error "--- Ueberpruefung auf alte Dateien und loeschen nicht erfolgreich ---"
                sleep 10
            fi
        fi
        
        if [ $BACKUP_TYPE == "ccu" ]; then
            find $backupDir -name "*.tar.sbk" -mtime +$BACKUP_DELETE_AFTER -exec rm '{}' \; && echo success "--- Ueberpruefung auf alte Dateien und loeschen erfolgreich ---" || echo error "--- Ueberpruefung auf alte Dateien und loeschen nicht erfolgreich ---"
            sleep 10
        else
            find $backupDir -name "backupiobroker_$BACKUP_TYPE$NAME_SUFFIX*.tar.gz" -mtime +$BACKUP_DELETE_AFTER -exec rm '{}' \; && echo success "--- Ueberpruefung auf alte Dateien und loeschen erfolgreich ---" || echo error "--- Ueberpruefung auf alte Dateien und loeschen nicht erfolgreich ---"
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

    if [ $CIFS_MOUNT == "FTP" ]; then
        if [ -n "$NAS_HOST" ]; then
#			Backup-Files via FTP kopieren
            echo "--- Backup-File FTP-Upload wird gestartet ---"
#			Verzeichnis wechseln
            cd $backupDir/
            ls

            if [ -n "$MYSQL_DBNAME" ]; then
                curl -s --disable-epsv -v -T"$backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.tar.gz" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
            fi

            if [ $BACKUP_TYPE == "ccu" ]; then
                curl -s --disable-epsv -v -T"$backupDir/Homematic-Backup-$ccuversion-$date-$time.tar.sbk" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
            else
                curl -s --disable-epsv -v -T"$backupDir/backupiobroker_$BACKUP_TYPE$NAME_SUFFIX-$date-$time.tar.gz" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
            fi
            if [ $REDIS_STATE == "true" ]; then
            curl -s --disable-epsv -v -T"$backupDir/backup_redis_state_$date-$time.tar.gz" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup-File wurde erfolgreich auf ein anderes Verzeichnis kopiert ---" || echo error "--- Backup-File wurde nicht auf ein anderes Verzeichnis kopiert ---"
            fi
        fi
    fi
    BACKUP_OK="NO"
else
    echo "--- Kein Backup erstellt! ---"
fi


############################################################################
#								                                     	   #
# Optionaler Umount des CIFS-Servers                    	         	   #
#                                                                          #
############################################################################

if [ $CIFS_MOUNT == "CIFS" ]; then

#	Mount Backup-Directory on CIFS

    mount | grep -q "${backupDir}"
    if [ $? -eq 0 ] ; then
        sudo umount $backupDir && echo success "--- Umount CIFS Server ---" || echo error "--- Backup-Pfad wurde nicht vom CIFS-Server getrennt ---"
    fi
fi

exit 0