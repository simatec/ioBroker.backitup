Backitup is a backup solution that enables the cyclical backup of an IoBroker installation as well as a Homematic CCU.

The adapter is suitable for multiplatforms and can be used in addition to Linux installations on Windows and Mac installations.

The CIFS mount must have cifs-utils installed.

    - apt-get install cifs-utils

NFS-mount must be installed for the NFS mount.

	- sudo apt-get install nfs-common

## Table of Contents:
1. Backup Type
    - 1.1 Minimal Backup (Standard IoBroker Backup)
    - 1.2 Complete backup
    - 1.3 CCU Backup (CCU-Original / pivCCU / Raspberrymatic)
    - 1.4 Optional Mysql backup (Localhost)
    - 1.5 Optional Redis backup

2. Preparation

3. Ftp, CIFS, NFS, Copy and Dropbox

4. Use
    - 4.1 created data points
    - 4.3 Format History Log with CCS
    - 4.4 Display backup status in the OneClick button
5. Restore a backup
    - 5.1 Restore minimal backup
    - 5.2 Restore completely backup
    - 5.3 Restore Raspberrymatic / CCU Backup
6. Troubleshooting
    - Activate 6.1 Logging
    - 6.2 Enable debugging
7. Errors / Solutions encountered
    - 7.1 Web interface not accessible after Restore
    - 7.2 JS datapoint not writable
    - 7.3 Error message: "Command not found"
    - 7.4 Full Backup Hangs
    - 7.5 Changed values in Dp are not accepted


## 1. Backup types:

Backitup offers the possibility to carry out three types (optionally with DB backup) of different backup types cyclically or at the push of a button. Each backup is placed in the / opt / iobroker / backups / directory by default. Optionally, an FTP upload can be set up or alternatively a CIFS mount can be used.

1. Standard Backup
    - This backup corresponds to the backup contained in IoBroker which can be started in the console via the call "./iobroker backup". However, it is done here through the specified settings in the adapter configuration or the OneClick Backup widget without having to use the console.
2. Complete backup
    - This backup secures the complete IoBroker folder including all subfolders and their files including file permissions. In this case, the file size should not be ignored, because such a backup often has several hundred MB.
To make sure that all the latest states have to be backed up, you have to set this in the configuration of the hack at IoBroker Stop / Start.
3. CCU Backup (Homematic)
    - This backup offers the possibility to save 3 different variants of a homematic installation (CCU original / pivCCU / Raspberrymatic). The execution of this backup can also be done through the settings specified in the adapter configuration or the OneClick Backup widget.
4. mysql backup (localhost)
    - This separately adjustable backup, if activated, will be created for every backup whether "minimal" or "complete" and will be deleted after expiration of the specified retention time. FTP or CIFS are also valid for this backup unless set for the other IoBroker backup types.
5. Redis backup
    - This separately adjustable backup, if activated, will be created for every backup whether "minimal" or "complete" and will be deleted after expiration of the specified retention time. FTP or CIFS are also valid for this backup unless set for the other IoBroker backup types.

## 2. Preparation:

The following steps should be used to use the adapter (if the v1 / v2 / v3 backup script was used, first delete everything (disable / delete data points / enum.functions / shell script and javascript!)

## 3. Use Ftp, CIFS, NFS, Copy or Dropbox for the optional backup on a Nas?

- CIFS:
    - CIFS mount is not a problem on Linux.
    - It should be noted that cifs-utils is installed
    - The path should look like this (eg: "/Sharename/Path")
    - Optionally, you can enable / disable whether the backups should be deleted from the NAS
- NFS:
	- NFS mount is not a problem on Linux.
	- It should be noted that nfs-common is installed
	- The path should look like this (Ex: "/Sharename/path")
	- Optionally, you can enable / disable whether the backups should be deleted from the NAS
- FTP:
    - FTP is possible on all OS and serves as an alternative to the CIFS mount
    - The path under FTP must always begin with "/" (Ex: "/path")
    - Optionally, you can enable / disable whether the backups should be deleted from the NAS
- Copy:
    - If no CIFS mount is possible, there is another possibility of the copy function
    - In the CIFS settings, the path must be entered here, where the copy should be made
    - The specification of the IP address must remain empty for the copy function
- Dropbox:
    - To use the backup in the Dropbox, an Access Token and an APP must be created at https://www.dropbox.com/developers/apps
    - Step 1: Use the button "Create Backup"
    - Step 2: Select "Dropbox API"
    - Step 3: Select "App folder"
    - Step 4: Give "Name your app"
    - Step 5: Press "Generated access token" button (The token is entered in the settings of Backitup)
    - In your Dropbox there is now a new folder with the name "Apps"


## 4. Usage:

1. The adapter creates 7 data points for use in Vis
    - oneClick.ccu -> serves as trigger trigger for a CCU backup (can be set to true in Vis by a button)
    - oneClick.minimal -> serves as trigger trigger for a standard backup (Can be set to true in Vis by a button)
    - oneClick.total -> serves as trigger trigger for a complete backup (Can be set to true in Vis by a button)

    - history.html -> serves as a history-log which in Vis via CCS is customizable by the design.
    - history.ccuLastTime -> stores the creation date and time of the last CCU backup
    - history.minimalLastTime -> stores the creation date and time of the last standard backup
    - history.totalLastTime -> saves the creation date and time of the last complete backup

2. Show history log in Vis
    - It is possible to display the history log, for example, in a html widget by entering the following line in HTML:

```
{backitup.0.history.html}
```
Syntax: {BackitupInstance.history.html}


3. CCS formatting of the history log
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
   .backup-type-total
       {
           float:left;
           color:yellow;
           font-size:20px;
       }
   .backup-type-ccu
       {
           float:left;
           color:red;
           font-size:20px;
    }
   ```
4. OneClick button with status text
    - If a OneClick data point is set to true the corresponding backup starts and after a predefined time this data point is set to false again so it is possible to create a button with status, adjust the following line and enter it in Vis as button text:
```
{value: backitup.0.oneClick.minimal; value === "true" || value === true ? "Minimal Backup </br> will be created" : "Minimal Backup </br> starten"}

```
Syntax: {value: <BackitupInstance>.oneClick.<trigger>; value ==="true" || value === true ? "Text during backup creation" : "Standard text"}

## 5. Restore:

As of version 0.30, backitup has a restore function.
It is currently possible to restore the total backup, the minimal backup, as well as mysql and redis either from the local path, from the Dropbox, via FTP or from the NAS.

Currently the restore is still in beta.

The CCU backup must still be restored via the web interface of the CCU.

For all backup types iobroker is stopped during the restore and then automatically restarted.

Those who prefer to manually restore their backups should do the following:

1. Restore a minimal / normal IoBroker backup:
    - The backup must be in the "opt/iobroker/backups/" directory as usual
    - It can be restored via the console using the command: "iobroker restore (number of backup from the list)".
    - After the restore an "iobroker upload all" is necessary

2. Restore a complete backup:
    - Execute the command: "sudo iobroker stop" via the console
    - The created backup must be copied to the directory "root/"
    - Run the command: "sudo tar -xzvf Backupname.tar.gz -C /" from the console
    - Wait - During the restoration you will see what is being done
    - Execute the command: "sudo iobroker start" via the console

3. Restore a Raspberrymatic / CCU backup:
    - Copy the * .sbk file via SCP to the directory "/usr/local/tmp directory" on the Raspberrymatic
    - Log into the Raspberrymatic via the console as the root user
    - Run the command: "/bin/restoreBackup.sh /user/local/tmp/yourbackupfilename" on the raspberrymatic.
    - Execute the command: "reboot" on the Raspberrymatic to restart the PI
    - Alternatively, the backup can of course also be restored as usual via the web interface.
4. Restore Redis:
    - The Redis database must be unpacked into the corresponding folder during a restore (ex: /var/lib/redis)


## 6. Troubleshooting:

1. In order to make mistakes, Backitup must be set to log level "debug" in the IoBroker rider instances

## 7. Errors / Solutions encountered:

Here is a list of problems encountered so far and their solutions, if any.

1. Olifall (from the forum) had the problem that after the Restore the web interface of the IoBrokers was not attainable, by the following steps over the console he could fix this:
    - sudo iobroker status
    - Message = "No connection to states 127.0.0.0:6379[redis"
    - sudo apt-get install redis-server

2. If the CIFS mount with IP address is not possible, the host name of the NAS should be used