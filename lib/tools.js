"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDate = getDate;
exports.copyFile = copyFile;
exports.getIobDir = getIobDir;
exports.padding0 = padding0;
exports.getTimeString = getTimeString;
exports.getNextTimeString = getNextTimeString;
exports._ = _;
exports.getSize = getSize;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const adapter_core_1 = require("@iobroker/adapter-core");
const en_json_1 = __importDefault(require("../admin/i18n/en.json"));
const de_json_1 = __importDefault(require("../admin/i18n/de.json"));
const es_json_1 = __importDefault(require("../admin/i18n/es.json"));
const fr_json_1 = __importDefault(require("../admin/i18n/fr.json"));
const it_json_1 = __importDefault(require("../admin/i18n/it.json"));
const nl_json_1 = __importDefault(require("../admin/i18n/nl.json"));
const pl_json_1 = __importDefault(require("../admin/i18n/pl.json"));
const pt_json_1 = __importDefault(require("../admin/i18n/pt.json"));
const ru_json_1 = __importDefault(require("../admin/i18n/ru.json"));
const uk_json_1 = __importDefault(require("../admin/i18n/uk.json"));
const zh_cn_json_1 = __importDefault(require("../admin/i18n/zh-cn.json"));
const translations = {
    en: en_json_1.default,
    de: de_json_1.default,
    es: es_json_1.default,
    fr: fr_json_1.default,
    it: it_json_1.default,
    nl: nl_json_1.default,
    pl: pl_json_1.default,
    pt: pt_json_1.default,
    ru: ru_json_1.default,
    uk: uk_json_1.default,
    'zh-cn': zh_cn_json_1.default,
};
/**
 * Convert Date or current time into string "YYYY_MM_DD-hh_mm_ss"
 *
 * @param d optional Date object
 */
function getDate(d) {
    d = d || new Date();
    return `${d.getFullYear()}_${(d.getMonth() + 1).toString().padStart(2, '0')}_${d.getDate().toString().padStart(2, '0')}-${d.getHours().toString().padStart(2, '0')}_${d.getMinutes().toString().padStart(2, '0')}_${d.getSeconds().toString().padStart(2, '0')}`;
}
/**
 * Copy one file with streams
 *
 * @param source Source file name
 * @param target Target file name
 * @param cb optional callback function to get error or when the coping is finished
 */
function copyFile(source, target, cb) {
    const rd = (0, node_fs_1.createReadStream)(source);
    rd.on('error', (err) => {
        if (cb) {
            cb(err);
            cb = undefined;
        }
    });
    const wr = (0, node_fs_1.createWriteStream)(target);
    wr.on('error', (err) => {
        if (cb) {
            cb(err);
            cb = undefined;
        }
    });
    wr.on('close', (_ex) => {
        if (cb) {
            cb();
            cb = undefined;
        }
    });
    rd.pipe(wr);
}
/**
 * looks for iobroker home folder
 */
function getIobDir() {
    const backupDir = (0, node_path_1.join)((0, adapter_core_1.getAbsoluteDefaultDataDir)(), 'iobroker.json').replace(/\\/g, '/');
    const parts = backupDir.split('/');
    parts.pop(); // iobroker.json
    parts.pop(); // iobroker-data.json
    return parts.join('/');
}
// function to create a date string                               #
const MONTHS = {
    en: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ],
    de: [
        'Januar',
        'Februar',
        'Maerz',
        'April',
        'Mai',
        'Juni',
        'Juli',
        'August',
        'September',
        'Oktober',
        'November',
        'Dezember',
    ],
    ru: [
        'январь',
        'февраль',
        'март',
        'апрель',
        'май',
        'июнь',
        'июль',
        'август',
        'сентябрь',
        'октябрь',
        'ноябрь',
        'декабрь',
    ],
    es: [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
    ],
    it: [
        'gennaio',
        'febbraio',
        'marzo',
        'aprile',
        'maggio',
        'giugno',
        'luglio',
        'agosto',
        'settembre',
        'ottobre',
        'novembre',
        'dicembre',
    ],
    nl: [
        'januari',
        'februari',
        'maart',
        'april',
        'mei',
        'juni',
        'juli',
        'augustus',
        'september',
        'oktober',
        'november',
        'december',
    ],
    pt: [
        'janeiro',
        'fevereiro',
        'março',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro',
    ],
    pl: [
        'styczeń',
        'luty',
        'marzec',
        'kwiecień',
        'maj',
        'czerwiec',
        'lipiec',
        'sierpień',
        'wrzesień',
        'październik',
        'listopad',
        'grudzień',
    ],
    uk: [
        'січень',
        'лютий',
        'березень',
        'квітень',
        'травень',
        'червень',
        'липень',
        'серпень',
        'вересень',
        'жовтень',
        'листопад',
        'грудень',
    ],
    fr: [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre',
    ],
    'zh-cn': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
};
const timePattern = {
    en: '%d at %t Hours',
    de: '%d um %t Uhr',
    ru: '%d в %t',
    es: '%d a las %t horas',
    it: '%d alle ore %t',
    nl: '%d om %t uur',
    pt: '%d às %t horas',
    pl: '%d o godzinie %t',
    uk: '%d о %t годині',
    fr: '%d à %t heures',
    'zh-cn': '%d %t',
};
/**
 * Pad with zeros the number to 'XX'
 *
 * @param number Number to pad
 */
function padding0(number) {
    return number < 10 ? `0${number}` : number.toString();
}
/**
 * Convert time to language specific string like "10. April at 03:15 Hours"
 *
 * @param systemLang Language
 * @param date optional Date
 */
function getTimeString(systemLang, date) {
    date = date || new Date();
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return (timePattern[systemLang] || timePattern.en)
        .replace('%d', `${padding0(day)}. ${(MONTHS[systemLang] || MONTHS.en)[monthIndex]} ${year}`)
        .replace('%t', `${padding0(hours)}:${padding0(minutes)}`);
}
/**
 * Get next backup time as string like "10. April at 03:15 Hours"
 *
 * @param systemLang Language
 * @param nextDate Date
 */
function getNextTimeString(systemLang, nextDate) {
    const day = nextDate.getDate();
    const monthIndex = nextDate.getMonth();
    const year = nextDate.getFullYear();
    const hours = nextDate.getHours();
    const minutes = nextDate.getMinutes();
    return (timePattern[systemLang] || timePattern.en)
        .replace('%d', `${padding0(day)}. ${(MONTHS[systemLang] || MONTHS.en)[monthIndex]} ${year}`)
        .replace('%t', `${padding0(hours)}:${padding0(minutes)}`);
}
/**
 * Translate word to specific language
 *
 * @param word Word to translate
 * @param systemLang System language
 */
function _(word, systemLang) {
    if (!translations[systemLang]) {
        console.warn(`No language ${systemLang}`);
        return word;
    }
    if (translations[systemLang][word]) {
        return translations[systemLang][word];
    }
    console.warn(`Please translate in translations.json: ${word}`);
    return word;
}
/**
 * Convert size into the human-readable string
 *
 * @param bytes File size or just size
 */
function getSize(bytes) {
    if (bytes > 1024 * 1024 * 512) {
        return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10} GiB`;
    }
    if (bytes > 1024 * 1024) {
        return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;
    }
    if (bytes > 1024) {
        return `${Math.round((bytes / 1024) * 10) / 10} KiB`;
    }
    return `${bytes} bytes`;
}
//# sourceMappingURL=tools.js.map