![Logo](admin/backitup.svg)
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
### **WORK IN PROGRESS**
* (simatec) Fix download of backups from a NAS ("Copy" mode, and CIFS / NFS when the file is not in the mounted directory)
* (simatec) CCU backups in an own NAS directory (CIFS / NFS) are listed and can be downloaded
* (simatec) Fix Discord notification ("Cannot read properties of undefined (reading 'sendTo')")
* (simatec) Tab: restore console, restore log, backup log and loading the BackItUp settings in the new design
* (simatec) Tab: the restore console shows the result of restores without ioBroker restart
* (simatec) Tab: the JSON file is checked before the BackItUp settings are loaded
* (simatec) Tab: missing translations added

### 5.0.0 (2026-11-08)
* (simatec) many small Fixes
* (simatec) Added InfluxDB Warning before Restore 
* (simatec) Added Download from all Backups Types from Backup Tab
* (simatec) Fix MySQL Backup
* (simatec) Fix Webdav
* (simatec) Fix Grafana Backup
* (simatec) Tab History redesigned
* (bluefox) Tab redesigned, new logo and adapter icon
* (bluefox) Existing backups can be downloaded from the tab
* (bluefox) Upload accepts plain ioBroker backups (`iobroker backup`), also renamed ones
* (bluefox) A click on the status of the last backup opens the log of that run
* (bluefox) Failed backup runs save their log too
* (bluefox) Clear error message if the InfluxDB program (`influx`/`influxd`) is not installed
* (bluefox) The Homematic tile is only shown if the CCU backup is enabled
* (bluefox) Updated `@iobroker/gui-components` to 10.4.0

### 4.0.4 (2026-09-13)
* (bluefox) Fix path
* (simatec) dependencies updated
* (simatec) Adaptercheck for Node.js 26 added

### 4.0.3 (2026-08-22)
* (simatec) Fix signed FTP Certificates
* (simatec) Fix Backup Timeout
* (simatec) Fix lint check

### 4.0.2 (2026-08-18)
* (simatec) Fix Backitup Tab
* (simatec) dependencies updated

### 4.0.1 (2026-08-07)
* (simatec) Fix Backitup Tab

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

The MIT License (MIT)

Copyright (c) 2018-2026 simatec

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
