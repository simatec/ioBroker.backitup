Backitup is a backup solution that enables the cyclical backup of an IoBroker installation as well as a Homematic CCU.

The adapter is suitable for multiplatforms and can be used in addition to Linux installations on Windows and Mac installations.

The CIFS mount must have cifs-utils installed.
    - `apt-get install cifs-utils`

NFS-mount must be installed for the NFS mount.
	- `sudo apt-get install nfs-common`

## 1. Backup types
Backitup offers the possibility to carry out three types (optionally with DB backup) of different backup types cyclically or at the push of a button. Each backup is placed in the / opt / iobroker / backups / directory by default. Optionally, an FTP upload can be set up or alternatively a CIFS mount can be used.

1. Standard Backup
    - This backup corresponds to the backup contained in IoBroker which can be started in the console via the call "./iobroker backup". However, it is done here through the specified settings in the adapter configuration or the OneClick Backup widget without having to use the console.
2. CCU Backup (Homematic)
    - This backup offers the possibility to save 3 different variants of a homematic installation (CCU original / pivCCU / Raspberrymatic). The execution of this backup can also be done through the settings specified in the adapter configuration or the OneClick Backup widget.
3. mysql backup (localhost)
    - This separately adjustable backup, if activated, will be created for "minimal" and will be deleted after expiration of the specified retention time. FTP or CIFS are also valid for this backup unless set for the other IoBroker backup types.
4. Redis backup
    - This separately adjustable backup, if activated, will be created for "minimal" and will be deleted after expiration of the specified retention time. FTP or CIFS are also valid for this backup unless set for the other IoBroker backup types.
5. History backup
    - This separately adjustable backup, if activated, will be created for "minimal" and will be deleted after expiration of the specified retention time. FTP or CIFS are also valid for this backup unless set for the other IoBroker backup types.

## 2. Use Ftp, CIFS, NFS, Copy or Dropbox for the optional backup on a Nas?
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
  - Google Drive:
    - To use the backup in Google Drive, an access token must fetch. You can do that on the configuration page.
    - ioBroker only accesses the defined areas. The code for oAuth can be viewed [here](https://github.com/simatec/ioBroker.backitup/blob/master/docs/oAuthService.js).
    - No tokens or user data are stored in the cloud.

## 3. Usage
1. The adapter creates 7 data points for use in Vis
    - oneClick.ccu -> serves as trigger trigger for a CCU backup (can be set to true in Vis by a button)
    - oneClick.minimal -> serves as trigger trigger for a standard backup (Can be set to true in Vis by a button)

    - history.html -> serves as a history-log which in Vis via CCS is customizable by the design.
    - history.ccuLastTime -> stores the creation date and time of the last CCU backup
    - history.minimalLastTime -> stores the creation date and time of the last standard backup
	- history.ccuSuccess -> shows the state "true" on successful backup
    - history.minimalSuccess -> shows the state "true" on successful backup

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

5. Backitup supports the following messengers for notification after a successful backup.
    - Telegram
    - Pushover
    - Email

## 4. Restore:

It is currently possible to restore the minimal backup, as well as mysql and redis either from the local path, from the Dropbox, GoogleDrive, via FTP or from the NAS.

Currently the restore is still in beta.

The CCU backup must still be restored via the web interface of the CCU.

For all backup types iobroker is stopped during the restore and then automatically restarted.

Those who prefer to manually restore their backups should do the following:

1. Restore a minimal / normal IoBroker backup:
    - The backup must be in the "opt/iobroker/backups/" directory as usual
    - It can be restored via the console using the command: "iobroker restore (number of backup from the list)".
    - After the restore an "iobroker upload all" is necessary

2. Restore a Raspberrymatic / CCU backup:
    - Copy the * .sbk file via SCP to the directory "/usr/local/tmp directory" on the Raspberrymatic
    - Log into the Raspberrymatic via the console as the root user
    - Run the command: "/bin/restoreBackup.sh /user/local/tmp/yourbackupfilename" on the raspberrymatic.
    - Execute the command: "reboot" on the Raspberrymatic to restart the PI
    - Alternatively, the backup can of course also be restored as usual via the web interface.

3. Restore Redis:
    - The Redis database must be unpacked into the corresponding folder during a restore (ex: /var/lib/redis)

4. Restore History Data:
    - The History database must be unpacked into the corresponding folder during a restore


## 6. Troubleshooting:

1. In order to make mistakes, Backitup must be set to log level "debug" in the IoBroker rider instances

## 7. Errors / Solutions encountered:

Here is a list of problems encountered so far and their solutions, if any.

1. Olifall (from the forum) had the problem that after the Restore the web interface of the IoBrokers was not attainable, by the following steps over the console he could fix this:
    - sudo iobroker status
    - Message = "No connection to states 127.0.0.0:6379[redis"
    - sudo apt-get install redis-server

2. If the CIFS mount with IP address is not possible, the host name of the NAS should be used
3. If you use a password with special characters in the cifs-mount, users have noticed that then the password must be stored with quotation marks in the config.
4. According to some users, cifs-mount can not handle very long passwords. If the mount does not work, the password will shorten slightly (12 characters are working for me).
5. If the adapter does not install, check your versions of node and nodejs. The adapter does not support versions < Node 6.
6. If your iobroker system was installed with the new installer script, you may not have all the rights for the new user iobroker.
    Unfortunately, this also applies to backitup, since backitup uses some system-relevant commands.

    In order to solve the problem with missing rights, there is now a fix for the installer script of iobroker.
    Please run the following commands on your Iobroker environment in the console:
    ```
    curl -fsL https://iobroker.net/fix.sh | bash -
    sudo reboot
    ```
7. If you get an error when creating the Redis database, please check if your user iobroker has the rights and if he exists in the user group Redis.
    If this is not the case, you can fix it with the following command in the console.
    ```
    sudo usermod -a -G redis iobroker
    sudo reboot
    ```
    If you have not set up your Iobroker installation with the installer script and your user has a different name, please replace it with your user in the command "iobroker".