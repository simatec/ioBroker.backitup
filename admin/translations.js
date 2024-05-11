// collect all translations from the admin panel
const fs = require('node:fs');
const JSON5 = require('json5');
const translations = require(`${__dirname}/i18n/en/translations.json`);
const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.json5'));
// go through each file and collect all translations

function collect(schema) {
    if (schema.title) {
        if (!translations[schema.title]) {
            translations[schema.title] = schema.title;
        }
    }
    if (schema.label) {
        if (!translations[schema.label]) {
            translations[schema.label] = schema.label;
        }
    }
    if (schema.help) {
        if (!translations[schema.help]) {
            translations[schema.help] = schema.help;
        }
    }
    if (schema.text) {
        if (!translations[schema.text]) {
            translations[schema.text] = schema.text;
        }
    }
    if (schema.alert) {
        if (!translations[schema.alert]) {
            translations[schema.alert] = schema.alert;
        }
    }

    if (schema.items) {
        if (Array.isArray(schema.items)) {
            schema.items.forEach(item => collect(item));
        } else {
            Object.keys(schema.items).forEach(item => collect(schema.items[item]));
        }
    }
    if (schema.options && !schema.noTranslations) {
        schema.options.forEach(item => collect(item));
    }
}


files.forEach(file => {
    const schema = JSON5.parse(fs.readFileSync(`./${file}`).toString());
    collect(schema);
});

// sort translations
const sorted = {};
Object.keys(translations).sort().forEach(key => {
    sorted[key] = translations[key];
});

// write all translations to the file
fs.writeFileSync(`${__dirname}/i18n/en/translations.json`, JSON.stringify(sorted, null, 2));
