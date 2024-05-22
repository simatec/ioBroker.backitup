const fs = require('node:fs');

function getDate(d) {
    d = d || new Date();

    return d.getFullYear() + '_' +
        (d.getMonth() + 1).padStart(2, '0') + '_' +
        d.getDate().padStart(2, '0') + '-' +
        d.getHours().padStart(2, '0') + '_' +
        d.getMinutes().padStart(2, '0') + '_' +
        d.getSeconds().padStart(2, '0');
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
    const utils = require('@iobroker/adapter-core');
    const path = require('node:path');
    //const tools = require(utils.controllerDir + '/lib/tools.js');
    let backupDir = path.join(utils.getAbsoluteDefaultDataDir(), 'iobroker.json').replace(/\\/g, '/');
    let parts = backupDir.split('/');
    parts.pop(); // iobroker.json
    parts.pop(); // iobroker-data.json
    return parts.join('/');
}

// function to create a date string                               #
const MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    pl: ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'],
    uk: ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'],
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    'zh-cn': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
};
const timePattern = {
    en: '%d at %t Hours',
    de: '%d um %t Uhr',
    ru: '%d в %t',
    es: '%d a las %t horas',
    it: '%d alle ore %t',
    pt: '%d às %t horas',
    pl: '%d o godzinie %t',
    uk: '%d о %t годині',
    fr: '%d à %t heures',
    'zh-cn': '%d %t',
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
        .replace('%d', padding0(day) + '. ' + (MONTHS[systemLang] || MONTHS.en)[monthIndex] + ' ' + year)
        .replace('%t', padding0(hours) + ':' + padding0(minutes));
}

// Next Backup Time
function getNextTimeString(systemLang, nextDate) {
    let day = nextDate.getDate();
    let monthIndex = nextDate.getMonth();
    let year = nextDate.getFullYear();
    let hours = nextDate.getHours();
    let minutes = nextDate.getMinutes();

    return (timePattern[systemLang] || timePattern.en)
        .replace('%d', padding0(day) + '. ' + (MONTHS[systemLang] || MONTHS.en)[monthIndex] + ' ' + year)
        .replace('%t', padding0(hours) + ':' + padding0(minutes));
}

function _(word, systemLang) {
    const translations = require(`../admin/i18n/${systemLang ? systemLang : 'en'}/translations.json`);

    if (translations[word]) {
        return translations[word];
    } else {
        console.warn(`Please translate in translations.json: ${word}`);
        return word;
    }
}

function getSize(bytes) {
    if (bytes > 1024 * 1024 * 512) {
        return `${Math.round(bytes / (1024 * 1024 * 1024) * 10) / 10} GiB`;
    }

    if (bytes > 1024 * 1024) {
        return `${Math.round(bytes / (1024 * 1024) * 10) / 10} MiB`;
    }

    if (bytes > 1024) {
        return `${Math.round(bytes / (1024) * 10) / 10} KiB`;
    }
    return `${bytes} bytes`;
}

module.exports = {
    getDate,
    getSize,
    copyFile,
    getIobDir,
    getTimeString,
    getNextTimeString,
    _,
};
