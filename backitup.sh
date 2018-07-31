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
# Version: 3.0.6    - Bugfix - Change Backupname for Restore procedure
# Version: 3.0.7    - Check for dependencies
#                   - Delete older files if number of files greater than X
#                   - Check for Backup Dir
# Version: 3.0.8    - Add redis path
#
#
# Use:  bash backitup.sh "BACKUP-Type|NAME-Suffix|DELETE_AFTER_X_Days|NAS-Host|NAS-Directory|NAS-User|NAS-Password|CCU-Host|CCU-User|CCU-Password|CIFS-Mount|IOB-Restart|REDIS-Backup|MYSQL-DBName|MYSQL-User|MYSQL-Password|MYSQL-DELETE_AFTER_X_Days|MYSQL-Host|MYSQL-Port|IOB-HomeDirectory"
#
#
STRING=$1
IFS="|"
VAR=($STRING)

############################################################################
#                                                                          #
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
REDIS_PATH=${VAR[13]}
MYSQL_DBNAME=${VAR[14]}
MYSQL_USER=${VAR[15]}
MYSQL_PASS=${VAR[16]}
MYSQL_DELETE_AFTER=${VAR[17]}
MYSQL_HOST=${VAR[18]}
MYSQL_PORT=${VAR[19]}
IOBROKER_DIR=${VAR[20]}
FILENAME_ADDITION="_backupiobroker"

# Variable for optional copying
BACKUP_OK="NO"

# Date for ioBroker
date=`date +%Y_%m_%d`

# Define backup path in ioBroker
backupDir="${IOBROKER_DIR}/backups"

# Time determined
time=`date +%H_%M_%S`

# Define hour
hour=`date +%H`

# Define minute
minute=`date +%M`

echo "Creating $BACKUP_TYPE backup [$STRING]"

# Check for Backup Dir
if ! [ -d "$backupDir" ]; then
     mkdir $backupDir && echo "--- Created Backup Dir ---"
fi
# Check for Package tar
PackageTar=`type -p tar`
if [ ! -f "$PackageTar" ]; then 
    apt-get -y install tar && echo " --- tar is being installed --- "
fi

############################################################################
#                                                                          #
# Optional Mount to CIFS-Server                                            #
#                                                                          #
############################################################################

if [ $CIFS_MOUNT == "CIFS" ] && [ -n "$NAS_DIR" ]; then

    # Check for Package cifs-utils
    PackageCifs=`type -p mount`
    if [ ! -f "$PackageCifs" ]; then 
        apt-get -y install cifs-utils && echo " --- mount is being installed --- "
    fi
    
    echo "--- Mount Backup-Path on CIFS ---"

    mount | grep -q "${backupDir}"
    if [ $? -eq 0 ] ; then
        umount $backupDir && echo success "--- Unmount CIFS Server ---" || echo error "--- Backup path was not disconnected from the CIFS server ---"
    fi

    mount -t cifs -o user=$NAS_USER,password=$NAS_PASS,rw,file_mode=0777,dir_mode=0777,vers=1.0 //$NAS_HOST/$NAS_DIR $backupDir

    mount | grep -q "${backupDir}"
    if [ $? -eq 0 ] ; then
        echo success "--- CIFS server connected ---"
    else
        mount -t cifs -o user=$NAS_USER,password=$NAS_PASS,rw,file_mode=0777,dir_mode=0777 //$NAS_HOST/$NAS_DIR $backupDir && echo success "--- CIFS server connected ---" || echo error "--- Backup path was not connected to CIFS server ---"
    fi
fi


############################################################################
#                                                                          #
# Create MySql Backup                                                      #
#                                                                          #
############################################################################

if [ -n "$MYSQL_DBNAME" ]; then

    # Check for Package mysql-client
    PackageMysqldump=`type -p mysqldump`
    if [ ! -f "$PackageMysqldump" ]; then 
        apt-get -y install mysql-client && echo " --- mysql-client is being installed --- "
    fi
    
    if [ $BACKUP_TYPE == "minimal" ] || [ $BACKUP_TYPE == "total" ]; then
        echo "--- Creating MYSQL-Backup ---"
        mysqldump -u $MYSQL_USER -p$MYSQL_PASS $MYSQL_DBNAME -h $MYSQL_HOST -P $MYSQL_PORT > $backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql && echo success "--- MYSQL Backup was created ---" || echo error "--- MYSQL Backup was not created ---"
        cd $backupDir
        tar -czf backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.tar.gz backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql && echo success "--- MySql was compressed ---" || echo error "--- MySql was not compressed ---"

        if [ -f $backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql ] && [ -f $backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.tar.gz ]; then
            rm -f backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.sql
        fi

        cd ..
    fi
fi


############################################################################
#                                                                          #
# Create minimal Backup                                                    #
#                                                                          #
############################################################################

if [ $BACKUP_TYPE == "minimal" ]; then

#   Start Backup
    echo "--- Minimal Backup started ---"
    iobroker backup minimal$NAME_SUFFIX-$date-$time$FILENAME_ADDITION.tar.gz && echo success "--- Minimal Backup created ---" || echo error "--- Cannot create minimal backup ---"
    BACKUP_OK="YES"

############################################################################
#                                                                          #
# Create total Backup                                                      #
#                                                                          #
############################################################################

elif [ $BACKUP_TYPE == "total" ]; then

#   Stop IoBroker
    if [ $IOBROKER_RESTART == "true" ]; then
        cd $IOBROKER_DIR
        sleep 10
        iobroker stop
        echo "--- IoBroker stopped ---"
    fi

#   Start Backup
    echo "--- Total Backup started ---"
    tar -czf $backupDir/total$NAME_SUFFIX-$date-$time$FILENAME_ADDITION.tar.gz --exclude="$backupDir" -P $IOBROKER_DIR && echo success "--- Total Backup created ---" || echo error "--- Cannot create total backup ---"



    BACKUP_OK="YES"

#   Save Redis State
    if [ $REDIS_STATE == "true" ]; then
        cp $REDIS_PATH $backupDir/dump_redis_$date-$time.rdp && echo success "--- Redis Backup created ---" || echo error "--- Cannot create Redis Backup ---"
        cd $backupDir
        chmod 777 dump_redis_$date-$time.rdp
        tar -czf backup_redis_state_$date-$time.tar.gz dump_redis_$date-$time.rdp && echo success "--- Redis Backup was packed ---" || echo error "--- Redis Backup was not packed ---"

        if [ -f $backupDir/dump_redis_$date-$time.rdp ] && [ -f $backupDir/backup_redis_state_$date-$time.tar.gz ]; then
            rm -f dump_redis_$date-$time.rdp
        fi

        cd ..
        echo "--- Redis Backup created ---"
    fi
#     Restart ioBroker
    if [ $IOBROKER_RESTART == "true" ]; then
#        cd $IOBROKER_DIR
        iobroker restart
#        iobroker start
        echo "--- IoBroker started ---"
    fi

############################################################################
#                                                                          #
# Create backup of Homematic-CCU                                           #
#                                                                          #
############################################################################

elif [ $BACKUP_TYPE == "ccu" ]; then

    # Check for Package wget
    PackageWget=`type -p wget`
    if [ ! -f "$PackageWget" ]; then 
        apt-get -y install wget && echo " --- wget is being installed --- "
    fi

#   Message
    echo "--- Start Homematic CCU Backup ---"

    run=$0.lastrun
 
#   Homematic Login
    wget --post-data '{"method":"Session.login","params":{"username":"'$CCU_USER'","password":"'$CCU_PASS'"}}' http://$CCU_HOST/api/homematic.cgi -O hm.login.response -q >$run 2>&1 && echo success "--- Login Homematic CCU successful ---" || echo error "--- Login Homematic CCU unsuccessful ---"
    BACKUP_OK="YES"
 
#   Login Check
    loginerror=`cat hm.login.response|cut -d "," -f3|awk '{print $2}'`
    if [ "$loginerror" != "null}" ]; then
        echo "Error by Homematic-Login !"|tee -a $run
        cat hm.login.response|grep message|cut -d '"' -f4|tee -a $run
        echo "--- Error by Homematic-Login!! Details here: $run ---"
        exit 1
    fi
    sessionid=`cat hm.login.response|cut -d "," -f2|awk '{print $2}'|cut -d '"' -f2`

#   Check Homematic-Version
    VER=$(wget -q -O - http://$CCU_HOST/api/backup/version.cgi)
    ccuversion="${VER:8:7}"
 
#   Download Backup
    wget "http://$CCU_HOST/config/cp_security.cgi?sid=@$sessionid@&action=create_backup" -O $backupDir/Homematic-Backup-$ccuversion-$date-$time.tar.sbk -q >>$run 2>&1 && echo success "--- Homematic CCU backup has been created ---" || echo error "--- Homematic CCU backup could not be created ---"
 
#   Homematic Logout
    wget --post-data '{"method":"Session.logout","params":{"_session_id_":"'$sessionid'"}}' http://$CCU_HOST/api/homematic.cgi -O hm.logout.response -q >>$run 2>&1
 
#   delete temp. Files
    rm hm.login.response hm.logout.response >>$run 2>&1

    BACKUP_OK="YES"

else
    echo "--- No valid Backup Type selected! Possible types: 'minimal', 'total' or 'ccu' ---"
fi

############################################################################
#                                                                          #
# delete old Backups                                                       #
#                                                                          #
############################################################################

# Check for Package findutils
PackageFind=`type -p find`
if [ ! -f "$PackageFind" ]; then 
    apt-get -y install findutils && echo " --- findutils is being installed --- "
fi

#DeleteDays="${BACKUP_DELETE_AFTER}p"

if [ -n "$MYSQL_DELETE_AFTER" ]; then
    results=( $(find $backupDir -name "backupiobroker_mysql*.tar.gz" -mtime -$MYSQL_DELETE_AFTER) )
    if (( ${#results[@]} )) ; then
        find $backupDir -name "backupiobroker_mysql*.tar.gz" -mtime +$MYSQL_DELETE_AFTER -exec rm '{}' \; && echo success "--- Checking and deletion of the old MySql backup files was successful ---" || echo error "--- Checking and deletion of the old MySql backup files was NOT successful ---"
    else
        echo "--- No old MySql backups were deleted ---"
    fi
    #find $backupDir -maxdepth 1 -name "backupiobroker_mysql*.tar.gz" -type f ! -newer "$(ls -t1 | sed -n $DeleteDays)" -delete && echo success "--- [MySql] Checking and deletion of the old backup files was successful ---" || echo error "--- [MySql Checking and deletion of the old backup files was NOT successful ---"
fi

if [ $BACKUP_OK == "YES" ]; then

    if [ -n "$BACKUP_DELETE_AFTER" ]; then
        echo "--- Delete old backups ---"
        if [ $BACKUP_TYPE == "total" ]; then
            if [ $REDIS_STATE == "true" ]; then
                results=( $(find $backupDir -name "backup_redis_state_*.tar.gz" -mtime -$BACKUP_DELETE_AFTER) )
                if (( ${#results[@]} )) ; then
                    find $backupDir -name "backup_redis_state_*.tar.gz" -mtime +$BACKUP_DELETE_AFTER -exec rm '{}' \; && echo success "--- [REDIS] Checking and deletion of the old backup files was successful ---" || echo error "--- [REDIS] Checking and deletion of the old backup files was NOT successful ---"
                else
                    echo "--- No old Redis backups were deleted ---"
                fi
                #find $backupDir -maxdepth 1 -name "backup_redis_state_*.tar.gz" -type f ! -newer "$(ls -t1 | sed -n $DeleteDays)" -delete && echo success "--- [REDIS] Checking and deletion of the old backup files was successful ---" || echo error "--- [REDIS] Checking and deletion of the old backup files was NOT successful ---"
                sleep 10
            fi
        fi
        
        if [ $BACKUP_TYPE == "ccu" ]; then
            results=( $(find $backupDir -name "*.tar.sbk" -mtime -$BACKUP_DELETE_AFTER) )
            if (( ${#results[@]} )) ; then
            find $backupDir -name "*.tar.sbk" -mtime +$BACKUP_DELETE_AFTER -exec rm '{}' \; && echo success "--- [CCU] Checking and deletion of the old backup files was successful ---" || echo error "--- [CCU] Checking and deletion of the old backup files was NOT successful ---"
            else
                echo "--- No old $BACKUP_TYPE backups were deleted ---"
            fi
            #find $backupDir -maxdepth 1 -name "*.tar.sbk" -type f ! -newer "$(ls -t1 | sed -n $DeleteDays)" -exec rm '{}' \; && echo success "--- [CCU] Checking and deletion of the old backup files was successful ---" || echo error "--- [CCU] Checking and deletion of the old backup files was NOT successful ---"
            sleep 10
        else
            results=( $(find $backupDir -name "$BACKUP_TYPE$NAME_SUFFIX*$FILENAME_ADDITION.tar.gz" -mtime -$BACKUP_DELETE_AFTER) )
            if (( ${#results[@]} )) ; then
                find $backupDir -name "$BACKUP_TYPE$NAME_SUFFIX*$FILENAME_ADDITION.tar.gz" -mtime +$BACKUP_DELETE_AFTER -exec rm '{}' \; && echo success "--- Checking and deletion of the old $BACKUP_TYPE backup files was successful ---" || echo error "--- Checking and deletion of the old $BACKUP_TYPE backup files was NOT successful ---"
            else
                echo "--- No old $BACKUP_TYPE backups were deleted ---"
            fi
            #find $backupDir -maxdepth 1 -name "$BACKUP_TYPE$NAME_SUFFIX*$FILENAME_ADDITION.tar.gz" -type f ! -newer "$(ls -t1 | sed -n $DeleteDays)" -delete && echo success "--- Checking and deletion of the old backup files was successful ---" || echo error "--- Checking and deletion of the old backup files was NOT successful ---"
            sleep 10
        fi
    else
        echo "--- No old backups were deleted ---"
    fi


############################################################################
#                                                                          #
# FTP Upload                                                               #
#                                                                          #
############################################################################

    if [ $CIFS_MOUNT == "FTP" ]; then
    
        # Check for Package curl
        PackageCurl=`type -p curl`
        if [ ! -f "$PackageCurl" ]; then 
            apt-get -y install curl && echo " --- curl is being installed --- "
        fi
        
        if [ -n "$NAS_HOST" ]; then
#           Backup-Files FTP copy
            echo "--- Starting Backup-File FTP-Upload ---"
#           Change Dir
            cd $backupDir/
            ls

            if [ -n "$MYSQL_DBNAME" ]; then
                curl -s --disable-epsv -T "$backupDir/backupiobroker_mysql-$MYSQL_DBNAME-$date-$time.tar.gz" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup file was copied to other directory ---" || echo error "--- Backup-File was not copied to other directory ---"
            fi

            if [ $BACKUP_TYPE == "ccu" ]; then
                curl -s --disable-epsv -T "$backupDir/Homematic-Backup-$ccuversion-$date-$time.tar.sbk" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup file was copied to other directory ---" || echo error "--- Backup-File was not copied to other directory ---"
            else
                curl -s --disable-epsv -T "$backupDir/$BACKUP_TYPE$NAME_SUFFIX-$date-$time$FILENAME_ADDITION.tar.gz" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup file was copied to other directory ---" || echo error "--- Backup-File was not copied to other directory ---"


            fi
            if [ $REDIS_STATE == "true" ]; then
            curl -s --disable-epsv -T "$backupDir/backup_redis_state_$date-$time.tar.gz" -u"$NAS_USER:$NAS_PASS" "ftp://$NAS_HOST$NAS_DIR/" && echo success "--- Backup file was copied to other directory ---" || echo error "--- Backup-File was not copied to other directory ---"
            fi
        fi
    fi
    BACKUP_OK="NO"
else
    echo "--- No Backup created! ---"
fi


############################################################################
#                                                                          #
# Umount CIFS-Servers                                                      #
#                                                                          #
############################################################################

if [ $CIFS_MOUNT == "CIFS" ]; then

#    Mount Backup-Directory on CIFS

    mount | grep -q "${backupDir}"
    if [ $? -eq 0 ] ; then
        umount $backupDir && echo success "--- Umount CIFS Server ---" || echo error "--- Backup path was not removed from CIFS-Server ---"
    fi
fi

exit 0