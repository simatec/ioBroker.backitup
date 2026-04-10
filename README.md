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
### **WORK IN PROGRESS**
* (simatec) dependencies updated
* (simatec) Changelog old added

### 3.3.14 (2026-02-18)
* (simatec) License updated
* (simatec) dependencies updated
* (simatec) Fix CCU Backup
* (simatec) added SSL Skip for mysql Backup

### 3.3.13 (2025-12-14)
* (simatec) Fix Error Log for CCU Backup

### 3.3.12 (2025-12-14)
* (simatec) Fix Error Log for CCU Backup
* (simatec) dependencies updated

### 3.3.11 (2025-11-23)
* (simatec) Update Dependabot
* (simatec) dependencies updated

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

---

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
