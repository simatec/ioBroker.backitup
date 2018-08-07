const fs = require('fs');
const words = require('../admin/words');

let systemLang = 'de';

function getDate(d) {
    d = d || new Date();

    return d.getFullYear() + '_' +
        ('0' + (d.getMonth() + 1)).slice(-2) + '_' +
        ('0' + d.getDate()).slice(-2) + '-' +
        ('0' + d.getHours()).slice(-2) + '_' +
        ('0' + d.getMinutes()).slice(-2) + '_' +
        ('0' + d.getSeconds()).slice(-2);
}

function copyFile(source, target, cb) {
    const rd = fs.createReadStream(source);
    rd.on('error', err => {
        if (cb) {
            cb(err);
            cb = null;
        }
    });

    const wr = fs.createWriteStream(target);
    wr.on('error', err => {
        if (cb) {
            cb(err);
            cb = null;
        }
    });

    wr.on('close', ex => {
        if (cb) {
            cb();
            cb = null;
        }
    });
    rd.pipe(wr);
}

/**
 * looks for iobroker home folder
 *
 * @returns {string}
 */
function getIobDir() {
    const utils = require('./utils');
    const tools = require(utils.controllerDir + '/lib/tools.js');
    let backupDir = tools.getConfigFileName().replace(/\\/g, '/');
    let parts = backupDir.split('/');
    parts.pop(); // iobroker.json
    parts.pop(); // iobroker-data.json
    return parts.join('/');
}

// function to create a date string                               #
const MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    ru: ['??????',  '???????', '????', '??????', '???', '????', '????', '??????', '????????', '???????', '??????', '???????'],
    es: ['enero',   'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    pt: ['janeiro', 'fevereiro', 'mar�o', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    pl: ['styczen', 'luty', 'marzec', 'kwiecien', 'maj', 'czerwiec', 'lipiec', 'sierpien', 'wrzesien', 'pazdziernik', 'listopad', 'grudzien'],
    fr: ['janvier', 'f�vrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'ao�t', 'septembre', 'octobre', 'novembre', 'd�cembre'],
};
const timePattern = {
    en: '%d at %t Hours',
    de: '%d um %t Uhr',
    ru: '%d ? %t'
};

function padding0(number) {
    return (number < 10) ? '0' + number : number;
}

function getTimeString(systemLang, date) {
    date = date || new Date();

    let day = date.getDate();
    let monthIndex = date.getMonth();
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes();

    return (timePattern[systemLang] || timePattern.en)
        .replace('%d', padding0(day)   + ' ' + (MONTHS[systemLang] || MONTHS.en)[monthIndex] + ' ' + year)
        .replace('%t', padding0(hours) + ':' + padding0(minutes));
}

function _(word, systemLang) {
    if (words[word]) {
        return words[word][systemLang] || words[word].en;
    } else {
        console.warn('Please translate in words.js: ' + word);
        return word;
    }
}

module.exports = {
    getDate,
    copyFile,
    getIobDir,
    getTimeString,
    _
};