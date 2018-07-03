![Logo](img/backitup.png)
# ioBroker.backitup
=================

[![NPM version](http://img.shields.io/npm/v/iobroker.backitup.svg)](https://www.npmjs.com/package/iobroker.backitup)
[![Downloads](https://img.shields.io/npm/dm/iobroker.backitup.svg)](https://www.npmjs.com/package/iobroker.backitup)

[![NPM](https://nodei.co/npm/iobroker.backitup.png?downloads=true)](https://nodei.co/npm/iobroker.backitup/)

Backitup is a backup solution that enables the cyclical backup of an IoBroker installation as well as a Homematic CCU.

## Table of Contents:
1. Backup Type
   - 1.1 Minimal Backup (Standard IoBroker Backup)
   - 1.2 Complete backup
   - 1.3 CCU Backup (CCU-Original / pivCCU / Raspberrymatic)
   - 1.4 Optional Mysql backup (Localhost)

3rd Ftp vs. CIFS

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
   - 7.5 Changed values ​​in Dp are not accepted
8. Changelog


## 1. Backuptype:

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

## 2. Preparation:

The following steps should be used to use the adapter (if the v1 / v2 / v3 backup script was used, first delete everything (disable / delete data points / enum.functions / shell script and javascript!)


## 3. Ftp service or CIFS for the optional further secure on a Nas benefit?

  - Benefits CIFS:
    - less write cycles on your data carrier (possibly relevant if Raspberry with SD card is used to protect this)
    - It is possible to automatically delete the "old backups" on the Nas
    - No need of lftp service since your nas is mounted directly.
  - Disadvantages CIFS:
    - If a mount is not possible, no backup is created!
    - "Old backups" can be automatically deleted on the Nas. In the worst case, there is no backup available if you need it.


## 4. Usage:

1. The adapter creates 7 data points for use in Vis
- start_ccu_Backup -> serves as trigger trigger for a CCU backup (can be set to true in Vis by a button)
- start_minimal_Backup -> serves as trigger trigger for a standard backup (Can be set to true in Vis by a button)
- start_komplett_Backup -> serves as trigger trigger for a complete backup (Can be set to true in Vis by a button)

- Backup_history -> dieshn as a history-log which in Vis via CCS is customizable by the design.
- Last_ccu_Backup -> stores the creation date and time of the last CCU backup
- Last_minimal_Backup -> stores the creation date and time of the last standard backup
- Last_ccu_Backup -> saves the creation date and time of the last complete backup

2. Show history log in Vis
It is possible to display the history log eg in a html widget by entering the following line in HTML:
```
{backitup.0.History.Backup_history}
```
Syntax: {BackitupInstanz.History.Backup_history}

3. CCS Formatting of the History Log:
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
4. OneClick button with status text
If a OneClick data point is set to true, the corresponding backup starts and after a predefined time, this data point is set to false again, so it is possible to create a button with status by adjusting the following line and entering it in Vis as button text:
```
{Value: backitup.0.OneClick.start_minimal_Backup; worth === "true"? "Minimal Backup </ br> will be created": "Minimal Backup </ br> start"}
```
Syntax: {value: BackitupInstance.OnClick.Solution trigger; worth === "true"? "Text during backup creation": "Standard text"}

## 5. Restore:

1. Restore a minimal / normal IoBroker backup:
    - The backup must be in the "opt / iobroker / backups /" directory as usual
    - It can be restored via the console using the command: "iobroker restore (number of backup from the list)".

2. Restore a complete backup:
    - Execute the command: "sudo iobroker stop" via the console
    - The created backup must be copied to the directory "root /"
    - Run the command: "sudo tar -xzvf Backupname.tar.gz -C /" from the console
    - Wait - During the restoration you will see what is being done
    - Execute the command: "sudo iobroker start" via the console

3. Restore a Raspberrymatic / CCU backup:
    - Copy the * .sbk file via SCP to the directory "/ usr / local / tmp directory" on the Raspberrymatic
    - Log into the Raspberrymatic via the console as the root user
    - Run the command: "/bin/restoreBackup.sh / user / local / tmp / yourbackupfilename" on the raspberrymatic.
    - Execute the command: "reboot" on the Raspberrymatic to restart the PI

Alternatively, the backup can of course also be restored as usual via the web interface.

## 6. Troubleshooting:

1. In the adapter configuration there is the possibility to activate log so in the IoBroker log various messages (eg backup times and states) that can be used for troubleshooting are listed

2. In addition, there is the possibility to enable debug now in the IoBroker log the command is issued which is passed to the backitup.sh. This command can be entered one-to-one in the console (with Putty or similar) to limit errors.

## 7. Errors / Solutions encountered:

Here is a list of problems encountered so far and their solutions, if any.

1. Olifall (from the forum) had the problem that after the Restore the web interface of the IoBrokers was not attainable, by the following steps over the console he could fix this:
    - sudo iobroker status
    - Message = "No connection to states 127.0.0.0:6379[redis"
    - sudo apt-get install redis-server

2. During testing, others found that some data points were not writable / changeable; this error could not be corrected and therefore not resolved.

3. Error message: "Command not found"
Due to the differences between Unix and Windows, the backitup.sh must not be changed under Windows (Editor).
Statement:
In DOS, a line end is represented by the sequence return (decimal code 13) and new line (decimal code 10) in text files. Unix uses only new line.

4. Iobroker gets stuck during the complete backup / does not start anymore
Some users reported that the IoBroker full backup did not go through properly or the IoBroker stopped and did not start. For this purpose it is possible to deactivate the stop / start of the IoBroker in the complete backup in the adapter configuration data points.

## 8. Changelog:

# 0.1.4 (03.07.2018)
  - (simatec / peoples) various adjustments

# 0.1.3 (02.07.2018)
  - (simatec / peoples) languages added

# 0.1.2 (30.06.2018)
 - (simatec / peoples) First beta release

# 0.1.0 (25.06.2018)
 - (simatec / peoples) First Git adapter version