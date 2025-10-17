![Logo](admin/backitup.png)
# ioBroker.backitup

![Number of Installations](http://iobroker.live/badges/backitup-installed.svg)
![Number of Installations](http://iobroker.live/badges/backitup-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.backitup.svg)](https://www.npmjs.com/package/iobroker.backitup)
[![Downloads](https://img.shields.io/npm/dm/iobroker.backitup.svg)](https://www.npmjs.com/package/iobroker.backitup)
[![Known Vulnerabilities](https://snyk.io/test/github/simatec/ioBroker.backitup/badge.svg)](https://snyk.io/test/github/simatec/ioBroker.backitup)
![Test and Release](https://github.com/simatec/ioBroker.backitup/workflows/Test%20and%20Release/badge.svg)

[![License](https://img.shields.io/github/license/simatec/ioBroker.backitup?style=flat)](https://github.com/simatec/ioBroker.backitup/blob/master/LICENSE)
[![Donate](https://img.shields.io/badge/paypal-donate%20|%20spenden-blue.svg)](https://paypal.me/mk1676)
[![](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/simatec)

[![NPM](https://nodei.co/npm/iobroker.backitup.png?downloads=true)](https://nodei.co/npm/iobroker.backitup/)

This adapter uses the service `Sentry.io` to automatically report exceptions and code errors and new device schemas to me as the developer. More details see below!

**************************************************************************************************************

## Support adapter development
**If you like `ioBroker.backitup`, please consider making a donation:**
  
[![paypal](https://www.paypalobjects.com/en_US/DK/i/btn/btn_donateCC_LG.gif)](https://paypal.me/mk1676)


**************************************************************************************************************

## Haftungsausschluss
**`ioBroker.backitup` ist ein Backup-Plugin nur für die Smart Home Software ioBroker.**

**Es steht in keiner Verbindung zu [Nero BackItUp](https://www.nero.com/deu/products/nero-backitup/?vlang=de) (ein Tool zur Datensicherung unter Windows-Systemen) und wird auch nicht von diesem unterstützt.**

**Dieses persönliche Projekt `ioBroker.backitup` wird in der Freizeit betrieben und hat keine geschäftlichen Ziele.**


## Disclaimer
**`ioBroker.backitup` is a backup plugin only for the smart home software ioBroker.**

**It is not affiliated with or endorsed by [Nero BackItUp](https://www.nero.com/deu/products/nero-backitup/?vlang=en) (a Tool backup under Windows-Systems).**

**This personal project `ioBroker.backitup` is maintained in spare time and has no business goal.**

**************************************************************************************************************

`ioBroker.backitup` ermöglicht die Sicherung und Wiederherstellung deiner ioBroker Installation und anderen Systemen, wie Datenbanken, Zigbee, Skripten und vielen mehr.

:de: [Deutsche Beschreibung](https://github.com/simatec/ioBroker.backitup/wiki/ioBroker.backitup-Wiki-Deutsch)

`ioBroker.backitup` allows you to back up and restore your ioBroker installation and other systems, such as databases, Zigbee, scripts and many more.

:uk: [English Description](https://github.com/simatec/ioBroker.backitup/wiki/ioBroker.backitup-Wiki-English)

### What is Sentry.io and what is reported to the servers of that company?
`Sentry.io` is a service for developers to get an overview about errors from their applications. And exactly this is implemented in this adapter.

When the adapter crashes or another Code error happens, this error message that also appears in the ioBroker log is submitted to Sentry.
When you allow iobroker GmbH to collect diagnostic data, then also your installation ID (this is just a unique ID **without** any additional infos about you, email, name or such) is included. This allows Sentry to group errors and show how many unique users are affected by such an error. All of this helps me to provide error-free adapters that basically never crash.

**************************************************************************************************************
<!-- ### **WORK IN PROGRESS** -->

## Changelog
### 3.3.10 (2025-10-17)
* (simatec) Fix npm publish
* (simatec) dependencies updated

### 3.3.9 (2025-10-07)
* (simatec) ESPHome Backup redesigned

### 3.3.8 (2025-10-05)
* (simatec) dependencies updated
* (simatec) Fix ESPHome Backup

### 3.3.7 (2025-09-21)
* (simatec) Fix ftp signed Certificates
* (simatec) Fix vscode settings
* (simatec) Fix Error Handling for Dropbox
* (simatec) dependencies updated

### 3.3.6 (2025-08-31)
* (simatec) dependencies updated

### 3.3.5 (2025-07-05)
* (simatec) Fix Dropbox Token Check
* (simatec) dependencies updated

### 3.3.4 (2025-06-26)
* (simatec) Fix Grafana Backup & Restore

### 3.3.3 (2025-06-24)
* (simatec) Translation updated
* (simatec) Fix Grafana Backup & Restore
* (simatec) Docu updated
* (simatec) dependencies updated

### 3.3.2 (2025-06-19)
* (simatec) Base Topic for z2m Remote Backup added

### 3.3.1 (2025-06-18)
* (simatec) Fix z2m Remote Backup

### 3.3.0 (2025-06-15)
* (simatec) local onedrive api added
* (simatec) dependencies updated
* (simatec) z2m Remote Backup added
* (simatec) Fix Zigbee Backup

### 3.2.2 (2025-05-16)
* (simatec) Grafana Folder added to Restore
* (simatec) Grafanfa Folder uid added
* (simatec) dependencies updated
* (simatec) Fix Mail Subject on Error

### 3.2.1 (2025-04-25)
* (simatec) Fix Onedrive download
* (simatec) Fix Onedrive Restore

### 3.2.0 (2025-04-04)
* (Bluefox/DileSoft) json custom typescript added
* (Bluefox/simatec) Dropbox OAuth updated
* (simatec) Fix Webdav Certificates
* (simatec) Dependencies updated

### 3.1.0 (2025-03-02)
* (Bluefox) Dependencies updated
* (Bluefox) Vite added
* (simatec) jsonConfig updated
* (simatec) Fix month for history

### 3.0.37 (2025-02-28)
* (simatec) Fix CronJob

### 3.0.36 (2025-02-26)
* (simatec) Fix src-admin

### 3.0.35 (2025-02-26)
* (simatec) Fix src-admin

### 3.0.34 (2025-02-26)
* (simatec) Fix src-admin

### 3.0.33 (2025-02-25)
* (simatec) Fix cronjob
* (simatec) Fix Backup Console

### 3.0.32 (2025-02-24)
* (simatec) Error handling for GoogleDrive fix
* (simatec) globalDependencies updated
* (simatec) Dependencies updated
* (simatec) Design Fix

### 3.0.31 (2024-11-30)
* (simatec) Fix Tab Menu

### 3.0.30 (2024-11-29)
* (simatec) Fix Tab Menu

### 3.0.29 (2024-11-29)
* (simatec) Fix Tab Menu

### 3.0.28 (2024-11-27)
* (simatec) Dependencies updated
* (simatec) eslint-config added
* (bluefox) Allow to store files for up to ca 3 years
* (Marc-Berg) Grafana Docu updated

### 3.0.27 (2024-11-12)
* (simatec) dependencies updated
* (simatec) Design Fix

### 3.0.26 (2024-10-16)
* (simatec) Fix FTP Connections
* (simatec) dependencies updated
* (simatec) Issue Workflow added

### 3.0.25 (2024-09-26)
* (bluefox) Improvement of Google Drive authentication workflow
* (bluefox) Removed gulp from a build process
* (simatec) small Design Fix
* (simatec) Fix for Admin 7.1.5
* (simatec) Fix Test & Release
* (simatec) Fix ESlint errors

### 3.0.22 (2024-09-03)
* (simatec) Fix Notification Instance
* (simatec) Fix Notification Design
* (simatec) Fix Default Settings

### 3.0.21 (2024-09-01)
* (simatec) Fix Onedrive Notification
* (simatec) Fix Zigbee2MQTT Backup
* (simatec) dependencies updated

### 3.0.20 (2024-08-22)
* (simatec) Responsive Design for Tab added
* (simatec) Responsive Design for jsonConfig added
* (simatec) dependencies updated

### 3.0.19 (2024-08-15)
* (simatec) Fix CCU Backup
* (simatec) Fix InfluxDB Backup Config
* (simatec) Fix Backup-Log for Slave Instanz

### 3.0.18 (2024-08-14)
* (simatec) Package optimisation
* (simatec) Fix the warning when opening the configuration
* (simatec) dependencies updated

### 3.0.17 (2024-08-12)
* (simatec) Fix io-package for Release
* (simatec) manual-review added
* (simatec) Fix Slave Backup
* (simatec) dependencies updated

### 3.0.16 (2024-08-05)
* (bluefox) dependencies updated
* (simatec) Rename json5 Files

### 3.0.15 (2024-08-03)
* (simatec) fix dependencies

### 3.0.14 (2024-08-02)
* (simatec) dependencies updated
* (simatec) Improved log outputs

### 3.0.12 (2024-08-01)
* (simatec) Backup Log for History added
* (simatec) Added separate selection for deleting FTP backups
* (simatec) Added separate selection for deleting Onedrive backups
* (simatec) Added separate selection for deleting Webdav backups
* (simatec) Added separate selection for deleting Dropbox backups
* (simatec) Added separate selection for deleting Googledrive backups
* (simatec) Improved log outputs
* (simatec) Source code cleaned up
* (simatec) dependencies updated

### 3.0.11 (2024-07-28)
* (simatec) Design Fix
* (simatec) dependencies updated

### 3.0.10 (2024-07-22)
* (simatec) Design Fix for Dark Mode
* (bluefox) dependencies updated

### 3.0.9 (2024-07-11)
* (simatec) Tab Icons added
* (simatec) small fix
* (simatec) Docu updated

### 3.0.8 (2024-07-01)
* (Grothesk242/simatec) forceuid and forcegid added
* (simatec) dependencies updated
* (simatec) small fix

### 3.0.7 (2024-06-26)
* (simatec) Restore Information added
* (simatec) Fix Formaterrors
* (bluefox) Fixing the problems with styles
* (simatec) Fix iobroker Backup Error

### 3.0.6 (2024-06-26)
* (simatec) Restore Information added
* (simatec) Fix Formaterrors
* (bluefox) Fixing the problems with styles
* (simatec) Fix iobroker Backup Error

### 3.0.5 (2024-06-18)
* (simatec) Fix Build

### 3.0.4 (2024-06-18)
* (simatec) History Gui Fix
* (simatec) Tab GUI modified
* (bluefox) Added support for Admin 7
* (simatec) Onedrive ready for School/Business Accounts

### 3.0.3 (2024-06-10)
* (simatec) Fixed WebDav
* (simatec) Admin Notification for Backup errors added
* (simatec) Remove Sentry Config
* (simatec) Translations updated
* (simatec) Error handling optimized
* (simatec) dependencies updated

### 3.0.2 (2024-06-06)
* (simatec) Fixed Google Drive
* (simatec) Fixed Translations
* (simatec) Fixed Onedrive
* (simatec) Fixed MySql Backup
* (simatec) Fixed Translation added
* (simatec) Design Fix
* (simatec) new notifications content added

### 3.0.1 (2024-05-29)
* (simatec) Fixed umount callback
* (simatec) Fixed Backup Message
* (simatec) Translations updated
* (simatec) Fixed InfluxDB Multi Backup
* (simatec) Fixed Restore Console
* (simatec) Fixed Backup Console

### 3.0.0 (2024-05-28)
* (simatec) jsonConfig added
* (bluefox) Conversion to React
* (bluefox) Added react components
* (bluefox/simatec) Working on React GUI
* (simatec) dependencies updated
* (simatec) Fixed Yahka Backup
* (simatec) Fixed Nodered Backup
* (simatec) some bugs fixed
* (bluefox/simatec) New Restore-Interface
* (simatec) Translation updated

### 2.11.0 (2024-03-04)
* (simatec) Fixed Sqlite3 Path

### 2.10.11 (2024-02-14)
* (simatec) Design Fix
* (simatec) dependencies updated

### 2.10.10 (2024-02-04)
* (simatec) small Design Fix

### 2.10.9 (2024-02-01)
* (simatec) Fixed Translation

### 2.10.8 (2024-01-30)
* (simatec) Fixed Expert Mount
* (simatec) Docu updated
* (simatec) dependencies updated

### 2.10.7 (2024-01-29)
* (simatec) small fixes
* (simatec) small Design Fix
* (simatec) Translation updated
* (simatec) Expert Mount added

### 2.10.6 (2024-01-27)
* (simatec) Gulp deleted
* (simatec) adapter-dev added
* (simatec) Translation added
* (simatec) Customised design
* (simatec) Hover info added to the Restore tab
* (simatec) Improved mobile view
* (simatec) dependencies updated

### 2.10.5 (2024-01-22)
* (simatec) Fixed CCU Backup with selfsigned Certificates

### 2.10.4 (2024-01-21)
* (simatec) Fixed CCU Backup

### 2.10.3 (2024-01-19)
* (simatec) CCU backup switched from request to axios
* (simatec) Sentry fix

### 2.10.2 (2024-01-14)
* (simatec) Cronjob for Expert Settings added
* (simatec) Code restructured
* (simatec) Translation added

### 2.10.1 (2024-01-09)
* (simatec) small Fixes
* (simatec) Code restructured

### 2.10.0 (2024-01-06)
* (simatec) File server improved
* (simatec) Restore Tab improved
* (simatec) Design improved
* (simatec) Docu updated
* (simatec) Breaking Changes for Docker mapping ports

### 2.9.10 (2023-12-29)
* (simatec) Fixed node-red restore
* (simatec) auto install after restore for node-red added

### 2.9.9 (2023-12-29)
* (simatec) dependencies updated
* (simatec) Default storage path for history adapter added
* (simatec) Added check of the storage path from the History Adapter

### 2.9.8 (2023-12-14)
* (simatec) Sentry fix

### 2.9.7 (2023-12-12)
* (simatec) URL Update
* (simatec) Fixed redis Password

### 2.9.6 (2023-12-10)
* (simatec) Gotify Notication added
* (simatec) dependencies updated
* (simatec) Copypath check added

### 2.9.5 (2023-11-29)
* (simatec) dependencies updated
* (simatec) Fixed redis Password

### 2.9.4 (2023-11-20)
* (simatec) dependencies updated
* (simatec) Fixed CIFS Password
* (simatec) Fixed mySql Password
* (simatec) Fixed pgSql Password
* (simatec) Fixed redis Password

### 2.9.3 (2023-11-11)
* (simatec) Fixed Port for Filerserver
* (simatec) Docu updated

### 2.9.2 (2023-11-10)
* (simatec) dependencies updated
* (simatec) Design fix
* (simatec) Backup File upload added
* (simatec) Uploadserver added
* (simatec) Translation updated

### 2.9.1 (2023-11-02)
* (simatec) ignore Build directory for ESPHome added

### 2.9.0 (2023-11-01)
* (simatec) mount option "Cache Loose" added
* (simatec) ESPHome Backup added
* (simatec) dependencies updated

### 2.8.7 (2023-10-19)
* (buanet) fix restore in docker v9

### 2.8.6 (2023-10-13)
* (simatec) Fixed node-red restore
* (simatec) dependencies updated

### 2.8.5 (2023-10-13)
* (simatec) Fixed mount errors

### 2.8.4 (2023-10-11)
* (simatec) Fixed mysql Backup
* (simatec) Fixed pgsql Backup
* (simatec) Fixed InfluxDB Backup

### 2.8.3 (2023-10-10)
* (simatec) Wake on LAN Advanced Settings added
* (simatec) dependencies updated

### 2.8.2 (2023-09-28)
* (simatec) Fixed redis backup

### 2.8.1 (2023-09-12)
* (simatec) Fixed roles
* (simatec) help-links added

### 2.8.0 (2023-09-11)
* (simatec) small Sentry fixes
* (simatec) Bugfix System-Message
* (simatec) Docu & Wiki updated
* (simatec) Translation updated
* (simatec) dependencies updated
* (simatec) Fixed Webdav
* (simatec) WOL Address & Port added
* (simatec) Restore for Backitup Config added

### 2.7.0 (2023-08-14)
* (simatec) dependencies updated
* (simatec) Fixed error Messages
* (simatec) edit automatic name addition added
* (simatec) Docu & Wiki updated
* (simatec) small bug fixes
* (simatec) Translation updated
* (crycode-de) Add support for sending notifications via discord (requires ioBroker.discord >= 2.1)

### 2.6.23 (2023-05-25)
* (simatec) Fixed Influx Restore for MultiDB
* (simatec) Token renew for Onedrive added
* (simatec) Fixed PSQL Restore

### 2.6.22 (2023-05-24)
* (simatec) Fixed Influx Restore for MultiDB
* (simatec) Default Ports for InfluxDB added

### 2.6.21 (2023-05-19)
* (simatec) small Sentry fixes
* (simatec) Fixed Influx Restore
* (simatec) Fixed Onedrive Download
* (simatec) dependencies updated

### 2.6.20 (2023-05-02)
* (simatec) FTP self signed Certificates added
* (simatec) dependencies updated

### 2.6.19 (2023-04-20)
* (simatec) small fix for js-controller 5

### 2.6.18 (2023-04-19)
* (simatec) dependencies updated
* (simatec) small Sentry fixes
* (simatec) Error notifications optimized

### 2.6.17 (2023-04-13)
* (simatec) Fixed delete InfluxDB tmp dir
* (simatec) small Sentry fixes

### 2.6.16 (2023-03-30)
* (simatec) small fix for js-controller 5

### 2.6.15 (2023-03-27)
* (simatec) Node-Red Backup optimized
* (simatec) Grafana Backup optimized
* (simatec) Zigbee2mqtt Backup optimized
* (simatec) skip-verify for influxdb 2.x

### 2.6.14 (2023-03-22)
* (simatec) Bug Fix History JSON

### 2.6.13 (2023-03-22)
* (simatec) Fixed Zigbee2mqtt Restore
* (simatec) Fixed Grafana Backup
* (simatec) Backup notifications optimized
* (simatec) Error notifications optimized
* (simatec) history data optimized
* (simatec) small bug fixes

### 2.6.12 (2023-03-16)
* (simatec) Fixed Zigbee2mqtt Backup & Restore
* (simatec) Node-Red Backup optimized
* (simatec) Grafana Backup optimized
* (simatec) InfluxDB Backup optimized
* (simatec) Docu & Wiki updated

### 2.6.11 (2023-03-11)
* (simatec) Fixed Zigbee2mqtt Backup & Restore

### 2.6.10 (2023-03-10)
* (simatec) Design Fix
* (simatec) node 14 set as minimum requirement
* (simatec) cleaning status log added
* (simatec) Fixed Node-Red Backup & Restore

### 2.6.9 (2023-03-08)
* (simatec) Dropbox session upload optimized
* (simatec) Error handling optimized

### 2.6.8 (2023-03-07)
* (simatec) Fixed Dropbox session upload

### 2.6.7 (2023-03-06)
* (simatec) Dropbox session upload optimized

### 2.6.6 (2023-03-05)
* (simatec) Dropbox file upload up to 350 GB added

### 2.6.5 (2023-03-03)
* (simatec) Fixed cifs Password
* (simatec) Fixed InfluxDB-Backup

### 2.6.4 (2023-02-26)
* (simatec) Design optimized
* (simatec) Onedrive Upload Session added

### 2.6.3 (2023-02-24)
* (simatec) Fixed SQLite3 Backup
* (simatec) Fixed Matrix Message

### 2.6.2 (2023-02-23)
* (simatec) Fixed SQLite3 Backup

### 2.6.1 (2023-02-20)
* (simatec) igonore temp-files for redis added

### 2.6.0 (2023-02-16)
* (simatec) Onedrive-Api added
* (simatec) Matrix Messenger added
* (simatec) TLS for FTP added
* (simatec) Tab Extra-Settings added
* (simatec) Node-Red Backup added
* (simatec) SQLLite Backup added
* (simatec) Zigbee2MQTT Backup added
* (simatec) Local-Storage check added
* (simatec) System-Message added
* (simatec) Jarvis Backup updated
* (simatec) many small Fixes

### 2.5.12 (2023-01-19)
* (simatec) Fixed Windows ioBroker-Restore

### 2.5.11 (2023-01-18)
* (simatec) Fixed Windows ioBroker-Restore

### 2.5.10 (2023-01-03)
* (simatec) Fixed Docker Restore
* (simatec) Fixed Link Design
* (simatec) dependencies updated
* (Grothesk242) Fixed CIFS Mount

### 2.5.9 (2022-12-05)
* (simatec) dependencies dropbox-v2-api updated
* (simatec) Fixed Zigbee Restore
* (simatec) Fixed Yahka Restore
* (simatec) Fixed Javascript Restore
* (simatec) Fixed Dropbox Error Messages

### 2.5.8 (2022-12-03)
* (simatec) Fixed iobroker Backup
* (simatec) dependencies updated

### 2.5.7 (2022-11-27)
* (simatec) Axios 1.1.3 added
* (bluefox) Added ukrainian language

### 2.5.6 (2022-11-14)
* (simatec) Fixed Grafana Backup
* (simatec) Fixed Downloadserver
* (simatec) Translation updated

### 2.5.5 (2022-11-13)
* (simatec) Design Fix
* (simatec) Docker DB Support added

### 2.5.4 (2022-11-02)
* (simatec) Fixed maxBuffer for DB-Backups
* (simatec) Docu updated
* (simatec) Fixed Dropbox error messages
* (simatec) Grafana self signed Certificates added

### 2.5.3 (2022-11-01)
* (simatec) dependencies updated

### 2.5.2 (2022-10-26)
* (simatec) Bugfix Google Drive

### 2.5.1 (2022-10-26)
* (simatec) Bugfix Google Drive

### 2.5.0 (2022-10-18)
* (bluefox) Google Drive authentication was fixed
* (simatec) small Bugfix

### 2.4.16 (2022-10-04)
* (simatec) small Bugfix

### 2.4.15 (2022-10-03)
* (simatec) adapter-core updated
* (simatec) path fix

### 2.4.14 (2022-09-29)
* (simatec) small Bugfix

### 2.4.13 (2022-09-28)
* (simatec) dependencies updated
* (simatec) Fixed Grafana Backup
* (simatec) Appveyor testing removed
* (simatec) Fixed Test & Release

### 2.4.12 (2022-08-11)
* (simatec) Fixed WebDav Error Handling

### 2.4.11 (2022-08-10)
* (simatec) Filesize Check added
* (simatec) dependencies updated
* (simatec) Fixed mySql Backup
* (simatec) Fixed pgSql Backup

### 2.4.10 (2022-07-05)
* (simatec) Code cleaning
* (simatec) dependencies updated
* (simatec) Disclaimer added
* (simatec) Travis Support removed
* (simatec) Fixed backup-download with ssl

### 2.4.9 (2022-05-25)
* (simatec) German Wiki added
* (simatec) English Wiki added
* (simatec) ignore .tar.gz files for zigbee Backups

### 2.4.8 (2022-05-18)
* (simatec) Fixed restore from local Mount path

### 2.4.7 (2022-05-16)
* (simatec) dependencies updated
* (simatec) many small bugfixes
* (simatec) Fixed Sentry Error Messages
* (simatec) Default SMB Version 3.1.1

### 2.4.6 (2022-04-06)
* (simatec) https support for Download added

### 2.4.5 (2022-04-04)
* (simatec) Download-Server close added

### 2.4.4 (2022-04-02)
* (simatec) try/catch GoogleDrive added
* (Bluefox/simatec) Backup Download added

### 2.4.3 (2022-03-29)
* (simatec) Bugfixes Dropbox
* (simatec) try/catch options added
* (simatec) code verifier check for Dropbox oAuth

### 2.4.2 (2022-03-29)
* (simatec) Bugfixes Dropbox

### 2.4.1 (2022-03-29)
* (simatec) small Bugfixes
* (simatec) try/catch Dropbox Api
* (simatec) Debug Log Dropbox Api

### 2.4.0 (2022-03-28)
* (simatec) Default History path added
* (simatec) dependencies updated
* (simatec) Dropbox default APP added
* (simatec) Bugfix Info Messages
* (simatec) Info Message for Script-Backup added
* (simatec) Signal-cmb added
* (simatec) many small Bugfixes
* (simatec) Documentation updated

### 2.3.5 (2022-02-26)
* (simatec) fix Redis Config

### 2.3.4 (2022-02-26)
* (simatec) Redis Remote Backup for Docker added
* (simatec) Docu updated

### 2.3.3 (2022-02-17)
* (simatec) small GUI fixes
* (simatec) Docker restore tunning

### 2.3.2 (2022-02-13)
* (simatec) Bugfix Restore Interface for http
* (simatec) Fixed json history

### 2.3.1 (2022-02-12)
* (simatec) Bugfix Grafana
* (simatec) Bugfix Restore for Docker System
* (simatec) Restore Interface with https Support
* (simatec) use iobroker SSL Certificates for https

### 2.3.0 (2022-02-11)
* (simatec) Influxdb2 Backup added
* (simatec) Influxdb2 Restore added
* (simatec) Bugfix Grafana Backup
* (simatec) Bugfix GUI
* (simatec) Bugfix Redis Restore
* (simatec) New Restore WebIf added
* (simatec) dependencies updated
* (simatec) Bugfix start after Restore
* (simatec) redis remote Backup added
* (simatec) Error messages configurable
* (simatec) Translations added
* (simatec) Adjustments to js-controller 4

### 2.2.4 (2022-01-27)
* (simatec) Restore backup of different controller version added
* (simatec) Fixed YAHKA Backup for more Instances

### 2.2.3 (2022-01-10)
* (simatec) Bugfix Error Message
* (simatec) dependencies updated

### 2.2.2 (06.11.2021)
* (simatec) Fixed CCU option to use self-signed certificates
* (simatec) Fixed Config Menu
* (simatec) dependabot added
* (simatec) small Bugfixes

### 2.2.1 (08.10.2021)
* (simatec) CCU option to use self-signed certificates
* (simatec) small fix for Javascript Message

### 2.2.0 (06.10.2021)
* (simatec) multihost function for master/slave systems added
* (simatec) Multi CCU Backup added
* (simatec) Multi InfluxDB Backup added
* (simatec) Multi MySql Backup added
* (simatec) Multi PGSql Backup added
* (simatec) Yahka backup added
* (simatec) Yahka Restore added
* (simatec) new Restore Interface added
* (simatec) new Tab-Menu added
* (simatec) Docker Support added
* (simatec) delete option for temp-directory added
* (simatec) breaking changes!! Javascript Backup from Objects added
* (simatec) breaking changes!! Javascript Restore from Objects added
* (simatec) WebDav option to use self-signed certificates

### 2.1.17 (15.08.2021)
* (simatec) dependencies updated
* (simatec) Preparation for dark design by Admin 5

### 2.1.16 (12.08.2021)
* (simatec) dependencies updated
* (simatec) https support for ccu backup
* (simatec) sentry Bugfixes

### 2.1.15 (05.08.2021)
* (simatec) Bugfix Google Drive
* (simatec) memory optimization
* (simatec) fix Zigbee Restore
* (simatec) Grafana Protocol selection added
* (simatec) translations updated

### 2.1.14 (04.08.2021)
* (simatec) dependencies updated
* (simatec) RAM memory optimization
* (simatec) googleapis deleted
* (simatec) @googleapis/drive added

### 2.1.13 (14.06.2021)
* (simatec) ready for Grafana 8.x
* (simatec) BugFix PostgreSQL
* (simatec) dependencies updated
* (simatec) Name-Sufix for Messages added

### 2.1.12 (01.06.2021)
* (simatec) adminTab edited
* (simatec) translation changed
* (simatec) dependencies updated
* (simatec) more debug for mount added
* (simatec) Bugfix history json

### 2.1.11 (19.05.2021)
* (simatec) adminTab edited
* (simatec) translation changed

### 2.1.10 (16.05.2021)
* (simatec) Bugfix adminTab

### 2.1.9 (15.05.2021)
* (simatec) adminTab for admin 5 changed

### 2.1.8 (14.05.2021)
* (simatec) adminTab for admin 5 changed

### 2.1.7 (14.05.2021)
* (simatec) Bugfix mysql Restore
* (simatec) Bugfix pgsql Restore
* (simatec) small Bugfix
* (simatec) dependencies updated
* (simatec) node 16 support added

### 2.1.6 (01.05.2021)
* (simatec) Bugfix for js-controller 3.3.x
* (simatec) small Bugfix Dropbox Log
* (simatec) small Bugfix for History Config reading

### 2.1.5 (29.04.2021)
* (simatec) Bugfix AdminTab
* (simatec) small Bugfix

### 2.1.4 (26.04.2021)
* (simatec) Redesign Restore GUI
* (simatec) small GUI Bugfix

### 2.1.3 (22.04.2021)
* (simatec) Admin-Tab changed
* (simatec) Javascript Restore changed
* (simatec) Redesign Admin-Tab
* (simatec) Redesign Config
* (simatec) Preparation for admin 5

### 2.1.2 (13.04.2021)
* (simatec) Creation of temporary folders changed
* (simatec) Filter for redis rdb files changed
* (simatec) automatic deletion of old influx databases added
* (simatec) noserverino option for CIFS mount added
* (simatec) dependencies updated

### 2.1.1 (11.04.2021)
* (simatec) Bugfix redis
* (simatec) debug Log for Restore request added
* (simatec) Bugfix influxdb
* (simatec) ignore Filenames for javascript-Backup added

### 2.1.0 (24.03.2021)
* (simatec) Admin-Tab added
* (simatec) dependencies targz removed
* (simatec) dependencies tar-fs added
* (simatec) dependencies updated
* (simatec) small Bugfixes

### 2.0.5 (14.03.2021)
* (simatec) error handling for redis backup added
* (simatec) error handling for history backup added
* (simatec) BugFix Grafana backup

### 2.0.4 (10.03.2021)
* (simatec) Bugfix history json
* (simatec) BugFix Redis backup
* (simatec) chmod for backup directory added
* (simatec) error handling for Grafana backup added

### 2.0.3 (04.03.2021)
* (simatec) Promise for redis aof added
* (simatec) BugFix Grafana restore
* (simatec) small BugFix umount

### 2.0.2 (03.03.2021)
* (simatec) BugFix redis backup
* (simatec) aof for redis added

### 2.0.1 (23.02.2021)
* (simatec) BugFix redis backup/restore
* (simatec) dependencies node-tar added
* (simatec) BugFix Notification
* (simatec) BugFix Grafana backup

### 2.0.0 (31.01.2021)
* (simatec) BugFix detect last backup
* (simatec) WebDAV added
* (simatec) BugFix Zigbee
* (simatec) stop/start Instances on restore
* (simatec) Download Icon for Cloud Restore added
* (simatec) javscript Backup added
* (simatec) Grafana Backup added
* (simatec) Restore added for some types without restart
* (simatec) timestamp for history-json added
* (simatec) Source code rewritten
* (simatec) Restore revised
* (simatec) fixed many small bugs
* (simatec) Added warning messages
* (simatec) Fixed cloud restore

### 1.8.5 (11.01.2021)
* (simatec) Bugfix Jarvis Backup
* (simatec) Bugfix GUI

### 1.8.4 (09.01.2021)
* (simatec) Bugfix influxDB Backup
* (simatec) Bugfix influxDB Restore
* (simatec) Jarvis Backup added
* (simatec) Jarvis Restore added
* (simatec) Bugfix mysql Backup
* (simatec) Bugfix pgsql Backup
* (simatec) small Bugfixes
* (simatec) Info-Message for storage added

### 1.8.3 (22.12.2020)
* (simatec) Bugfix iobroker start after restore on Windows
* (simatec) changed webui-port for restore
* (simatec) Bugfix influxDB Restore
* (simatec) dependencies updated

### 1.8.2 (09.12.2020)
* (simatec) code cleaned
* (simatec) code for history.html object revised
* (simatec) code for history.json object revised

### 1.8.1 (07.12.2020)
* (simatec) influxDB Backup added
* (simatec) influxDB Restore added
* (simatec) Postgresql Backup added
* (simatec) Postgresql Restore added
* (simatec) translation added
* (simatec) new zigbee Restore added
* (simatec) dependencies updated
* (simatec) many small bugfixes
* (simatec) new redis Restore added
* (simatec) enable/disable option for Sentry Plugin
* (simatec) smb 3.02 support added
* (simatec) smb 3.1.1 support added

### 1.7.0 (26.10.2020)
* (simatec) small Bugfix for umount on cifs/nfs mount
* (simatec) Dev-Dependencies updated
* (simatec) Dependencies updated

### 1.6.9 (30.09.2020)
* (simatec) Timeout fix for backup process

### 1.6.8 (24.09.2020)
* (simatec) Translations update for Weblate
* (simatec) dependencies updated
* (simatec) devdependencies updated
* (weblate) translation updated

### 1.6.7 (09.09.2020)
* (simatec) Bugfix error on GoogleDrive

### 1.6.6 (08.09.2020)
* (simatec) Bugfix clean local backups
* (simatec) Bugfix mount and umount for sentry.io

### 1.6.5 (07.09.2020)
* (simatec) Bugfix GoogleDrive Rate Limit errors 
* (simatec) small fixes on zigbee backup

### 1.6.4 (04.09.2020)
* (simatec) small fixes for sentry.io
* (simatec) small fixes on zigbee backup

### 1.6.3 (01.09.2020)
* (simatec) dependencies for googleapis updated
* (simatec) dependencies for dropbox-v2-api updated
* (simatec) devdependencies updated

### 1.6.2 (31.08.2020)
* (simatec) added whatsapp-cmb support for notifications

### 1.6.1 (24.08.2020)
* (Apollon77) several fixes and optimizations

### 1.6.0 (03.08.2020)
* (Jey-Cee/simatec) adapter configuration revised

### 1.5.9 (21.07.2020)
* (simatec) small fixes on mysql backup
* (simatec) next bugfixs error handling sentry.io
* (simatec) updated dependencies

### 1.5.8 (20.05.2020)
* (simatec) small fixes on zigbee backup
* (simatec) added log for zigbee Instances
* (simatec) next bugfix error handling sentry.io

### 1.5.7 (11.05.2020)
* (simatec) bugfix error handling sentry.io
* (simatec) updated dependencies
* (simatec) added node14 support

### 1.5.6 (02.05.2020)
* (simatec) Bugfix reading restore list

### 1.5.5 (01.05.2020)
* (simatec) bugfix error handling sentry.io

### 1.5.4 (29.04.2020)
* (simatec) added osDependencies for nfs and cifs
* (simatec) Bugfixes for error handling telegram, pushover, e-mail, ftp list and create backup folder

### 1.5.3 (28.04.2020)
* (simatec) many smal Bugfixes for error handling sentry.io

### 1.5.2 (24.04.2020)
* (simatec) error handling sentry.io
* (AlCalzone) docu updated

### 1.5.1 (23.04.2020)
* (simatec) Bugfix list from nas
* (simatec) Bugfix sentry errors

### 1.5.0 (21.04.2020)
* (simatec) revised error handling
* (simatec) revised mount process
* (simatec) revised umount process
* (simatec) added log for last backup file
* (simatec) updated dependencies
* (simatec) added sentry.io support

### 1.4.5 (23.03.2020)
* (simatec) Bugfix CIFS Domain

### 1.4.4 (23.03.2020)
* (simatec) Fixed history error

### 1.4.3 (21.03.2020)
* (simatec) Fixed for autochecker

### 1.4.2 (21.03.2020)
* (simatec) Fixed start after restore
* (simatec) update dependencies

### 1.4.1 (02.03.2020)
* (simatec) json historystate with more options

### 1.4.0 (27.02.2020)
* (simatec) added next Backup Time
* (simatec) added Name Suffix for mysql Backup
* (simatec) added more Options for mysql
* (simatec) added domain support for cifs
* (simatec) added json history state

### 1.3.6 (18.12.2019)
* (simatec) Fixed historyList for compact-mode
* (simatec) Added ack for history states

### 1.3.5 (17.12.2019)
* (simatec) Fixed compact-mode for history

### 1.3.4 (15.12.2019)
* (simatec) Fixed hide passwords

### 1.3.3 (14.12.2019)
* (simatec) Fixed Webinterface for Restore
* (simatec) Fixed MySql Backup
* (simatec) Added some debug logs for Restore
* (simatec) some Bug Fix
* (simatec) Messagebox for restore list
* (simatec) hide password on log
* (simatec) Added password hiding
* (simatec) Clean Code
* (simatec) detected history path
* (simatec) Fix detected

### 1.3.2 (04.12.2019)
* (simatec) Add Webinterface for Restore
* (simatec) Bug fix

### 1.3.1 (02.12.2019)
* (bluefox) Added information about the latest backup
* (simatec) some Bug fix
* (simatec) add new translation
* (simatec) Fixed translation
* (simatec) Default backup renamed to ioBroker backup
* (simatec) delete old objects

### 1.3.0 (22.11.2019)
* (simatec) support end for the total backup
* (simatec) Added backup of a history data path
* (simatec) Added startup of all adapters after restore
* (simatec) Revision of the restoration for Redis
* (simatec) revision of log issues
* (simatec) Rebuild the start / stop processes under Unix
* (simatec) Rebuilding the start / stop processes under Windows
* (simatec) new translations
* (simatec) adjustments to the new Windows Installer
* (simatec) adjustments to the new Linux installer
* (simatec) fixed some small bugs

### 1.2.2 (20.10.2019)
* (simatec) Fixed update process

### 1.2.1 (19.10.2019)
* (simatec) Fixed CIFS password with special characters

### 1.2.0 (02.07.2019)
* (bluefox) Google Drive was added
* (simatec) Support for node 6 ended

### 1.1.4 (08.04.2019)
* (simatec) Support for SMB3
* (simatec) Backup for Zigbee Database
* (simatec) Restore for Zigbee Database

### 1.1.3 (12.03.2019)
* (simatec) Timeout for email sending
* (simatec) Timeout for pushover sending
* (simatec) Timeout for telegram sending
* (simatec) Code cleaned up

### 1.1.2 (21.02.2019)
* (simatec) exec Start for iobroker
* (simatec) Fixed umount before Restore

### 1.1.1 (12.02.2019)
* (simatec) Fixed iobroker-stop for total backup

### 1.1.0 (10.02.2019)
* (simatec) stable Release

### 1.0.9 (02.02.2019)
* (simatec) Add New umount query
* (simatec) Add Umount wait by device busy
* (simatec) Add Timeout for History settings
* (simatec) Add Notification only on error

### 1.0.8 (26.01.2019)
* (simatec) modification for new installer
* (simatec) WOL-wait time adjustable
* (simatec) Fixed History settings

### 1.0.7 (17.01.2019)
* (simatec) better start/stop Handling for backup and restore

### 1.0.6 (16.01.2019)
* (simatec) Fixed Start/Stop for new iobroker-installer

### 1.0.5 (14.01.2019)
* (simatec) Fixed compact mode
* (simatec) Fixed total backup
* (simatec) better history handling for html
* (simatec) better history handling
* (simatec) error Message for telegram
* (simatec) error Message for E-Mail
* (simatec) error Message for pushover

### 1.0.4 (08.01.2019)
* (simatec) support for compact mode

### 1.0.3 (06.01.2019)
* (simatec) Bugfix

### 1.0.2 (05.01.2019)
* (simatec) Fixed start/stop for new iobroker-Installer

### 1.0.1 (30.12.2018)
* (simatec) Fixed delete old Files
* (simatec) Add a wake on LAN for CIFS and NFS

### 1.0.0 (24.12.2018)
* (simatec) Stable Release

### 0.4.4 (19.12.2018)
* (simatec) Fixed cifs-mount User

### 0.4.3 (17.12.2018)
* (simatec) Add device ID for pushover

### 0.4.2 (10.12.2018)
* (simatec) Fixed mount / umount
* (simatec) Fixed Readme

### 0.4.1 (07.12.2018)
* (simatec) Added boolean for backup Success
* (simatec) Added Selection menu SMB type (CIFS)
* (simatec) Added Checkbox for mount as root (sudo)

### 0.4.0 (04.12.2018)
* (simatec) Added Pushover Notification

### 0.3.9 (03.12.2018)
* (simatec) Fixed cifs/nfs mount and umount

### 0.3.8 (08.11.2018)
* (simatec) Fixed notifications format
* (simatec) Fixed Telegram User

### 0.3.7 (07.11.2018)
* (simatec) Added e-mail notification
* (simatec) Create backup directory on first boot
* (simatec) many small changes
* (peoples) Fixed Telegram SilentNotice
* (peoples) Added Possibility to select a Telegram Receiver
* (peoples) Added Possibility to select a Telegram Notification length
* (peoples) Some Translations

### 0.3.6 (16.10.2018)
* (simatec) Fixed Dropbox Backup
* (simatec) Fixed Restore path for ownDir
* (simatec) Fixed FTP and NAS path
* (simatec) Fixed Access Token for dropbox

### 0.3.5 (03.10.2018)
* (simatec) Fixed Translation
* (simatec) Fixed Filename Suffix for Restore
* (peoples) Bugfix Title for Backup deletion

### 0.3.4 (01.10.2018)
* (simatec) Fixed Restart after total-backup

### 0.3.3 (27.09.2018)
* (simatec) Fixed Backup-Directory for dropbox
* (simatec) Fixed Restart after total-backup
* (simatec) Fixed error Log on cifs

### 0.3.2 (25.09.2018)
* (simatec) Fixed Filename for ccu backup

### 0.3.1 (25.09.2018)
* (simatec) Fixed FTP Directory
* (simatec) delete old Files

### 0.3.0 (24.09.2018)
* (bluefox/simatec) Add Multiplatform (Windows/Linux/Mac)
* (bluefox/simatec) ioBroker.backitup switched to Javascript
* (bluefox/simatec) shell support removed
* (bluefox/simatec) Deleting old backups up to the last X backups added
* (bluefox/simatec) restore feature added (beta)
* (bluefox/simatec) Restore added via NAS/FTP/Local/Dropbox (Beta)
* (simatec) NFS support added
* (bluefox) Dropbox Support added
* (bluefox) Fixed History
* (peoples) Added silent mode for telegram
* (simatec) Redis/mysql added with standard backup
* (simatec) translations added
* (simatec) Docs adapted

### 0.2.7 (29.07.2018)
* (simatec) Fixed Delete old Files

### 0.2.6 (27.07.2018)
* (bluefox) Configurable redis path was added
* (simatec) Translations Script
* (simatec) Fixed FTP Upload

### 0.2.5 (26.07.2018)
* (simatec) Check for dependencies
* (simatec) Delete older files if the number of files is greater than X
* (simatec) Check for Backup Dir
* (simatec) Translations added

### 0.2.4 (23.07.2018)
 * (peoples) Some Bugfixes
 * (peoples) Added translations in words.js

### 0.2.3 (19.07.2018)
 * (bluefox) The backup buttons in the configuration dialog were added
 * (bluefox) Show bash output text
 * (peoples) Bug Fix Mysql-Login Error

### 0.2.2 (17.07.2018)
 * (peoples/simatec/bluefox) Bug Fix Code

### 0.2.1 (15.07.2018)
 * (peoples/simatec) Bug Fix

### 0.2.0 (14.07.2018)
 * (blufox) Code formatting

### 0.1.8 (11.07.2018)
 * (darkiop) MySQL-Sicherung um Host- und Portabfrage erweitert
 * (peoples) Versendende Telegram-Instanz wählbar
 * (peoples) Telegram-Nachrichten angepasst an Verbindungstyp
 * (peoples) History-Log angepasst an Verbindungstyp
 * (simatec) Komprimierung der MySQL-Datenbank-Sicherung eingebaut
 * (simatec) Anpassung der Konfigoberfläche an Telegram-Instanz Auswahl

### 0.1.7 (05.07.2018)
 * (peoples) Datenpunkte in io-package definiert

### 0.1.6 (04.07.2018)
 * (simatec/peoples) Beta Version

### 0.1.5 (03.07.2018)
 * (peoples) Log Einträge neu formatiert

### 0.1.4 (02.07.2018)
 * (simatec/peoples) diverse Anpassungen

### 0.1.3 (01.07.2018)
 * (simatec/peoples) Sprachen hinzugefügt

### 0.1.2 (30.06.2018)
 * (simatec/peoples) Erste Beta-Version

### 0.1.0 (25.06.2018)
 * (simatec/peoples) Erste Git-Adapter-Version

## License

The MIT License (MIT)

Copyright (c) 2018-2025 simatec

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
