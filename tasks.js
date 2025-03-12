/*!
 * ioBroker gulpfile
 * Date: 2023-02-22
 */
const fs = require('node:fs');
const { deleteFoldersRecursive, buildReact, copyFiles, npmInstall } = require('@iobroker/build-tools');

function sync2files(src, dst) {
    const srcTxt = fs.readFileSync(src).toString('utf8');
    const destTxt = fs.readFileSync(dst).toString('utf8');
    if (srcTxt !== destTxt) {
        const srcs = fs.statSync(src);
        const dest = fs.statSync(dst);
        if (srcs.mtime > dest.mtime) {
            fs.writeFileSync(dst, srcTxt);
        } else {
            fs.writeFileSync(src, destTxt);
        }
    }
}

function sync() {
    // sync2files(`${__dirname}/src-admin/src/BackupNow.jsx`, `${__dirname}/src/src/Components/BackupNow.jsx`);
    sync2files(`${__dirname}/src-admin/src/Components/SourceSelector.tsx`, `${__dirname}/src/src/Components/SourceSelector.tsx`);
    sync2files(`${__dirname}/src-admin/src/Components/Restore.tsx`, `${__dirname}/src/src/Components/Restore.tsx`);
    sync2files(`${__dirname}/src-admin/src/Components/types.d.ts`, `${__dirname}/src/src/Components/types.d.ts`);
}

function buildAdmin() {
    sync();
    return buildReact(`${__dirname}/src-admin/`, { rootDir: `${__dirname}/src-admin/`, vite: true });
}

function cleanAdmin() {
    deleteFoldersRecursive(`${__dirname}/admin/custom`);
    deleteFoldersRecursive(`${__dirname}/src-admin/build`);
}

function copyAllAdminFiles() {
    copyFiles(['src-admin/build/assets/*.css', '!src-admin/build/assets/src_bootstrap_*.css'], 'admin/custom/assets');
    copyFiles(['src-admin/build/assets/*.js'], 'admin/custom/assets');
    //copyFiles(['src-admin/build/static/js/*.map', '!src-admin/build/static/js/vendors*.map', '!src-admin/build/static/js/node_modules*.map'], 'admin/custom/static/js');
    copyFiles(['src-admin/build/assets/*.png'], 'admin/custom/assets');
    copyFiles(['src-admin/build/customComponents.js'], 'admin/custom');
    //copyFiles(['src-admin/build/customComponents.js.map'], 'admin/custom');
    copyFiles(['src-admin/src/i18n/*.json'], 'admin/custom/i18n');
}

function clean() {
    deleteFoldersRecursive(`${__dirname}/src/build`);
    deleteFoldersRecursive(`${__dirname}/admin`, [
        'backitup.png',
        '.json',
        '.json5',
        'custom',
        'adapter-settings.js',
        'backitup.svg',
        'index.html',
        'index_m.html',
        'index_m.js',
        'style.css',
        'tab_m.css',
        'tab_m.html',
        'tab_m.js',
        'words.js',
        'translations.json',
        'i18n'
    ]);
}

function copyAllFiles() {
    copyFiles([
        'src/build/*',
        `!src/build/index.html`,
        `!src/build/static/js/*.map`,
    ], 'admin/');
    copyFiles(['src/build/assets/*'], 'admin/assets');
    // copyFiles(['src/build/assets/*.js'], 'admin/assets');
    // copyFiles(['src/build/assets/*.txt'], 'admin/assets');
    // copyFiles(['src/build/assets/*.css'], 'admin/assets');
    // copyFiles(['src/build/assets/*.png'], 'admin/assets');
}

function patchFiles() {
    if (fs.existsSync(`${__dirname}/src/build/index.html`)) {
        let code = fs.readFileSync(`${__dirname}/src/build/index.html`).toString('utf8');
        code = code.replace(/<script>var script=document\.createElement\("script"\)[^<]+<\/script>/,
            `<script type="text/javascript" src="./../../lib/js/socket.io.js"></script>`);

        fs.existsSync(`${__dirname}/admin/tab_m.html`) && fs.unlinkSync(`${__dirname}/admin/tab_m.html`);
        fs.writeFileSync(`${__dirname}/admin/tab_m.html`, code);
    }
}

if (process.argv.includes('--admin-0-clean')) {
    cleanAdmin();
} else if (process.argv.includes('--admin-1-npm')) {
    npmInstall(`${__dirname}/src-admin/`)
        .catch(e => console.error(e));
} else if (process.argv.includes('--admin-2-compile')) {
    buildAdmin()
        .catch(e => console.error(e));
} else if (process.argv.includes('--admin-3-copy')) {
    copyAllAdminFiles();
} else if (process.argv.includes('--admin-build')) {
    cleanAdmin();
    npmInstall(`${__dirname}/src-admin/`)
        .then(() => buildAdmin())
        .then(() => copyAllAdminFiles())
        .catch(e => console.error(e));
} else if (process.argv.includes('--0-clean')) {
    clean();
} else if (process.argv.includes('--1-npm')) {
    if (!fs.existsSync(`${__dirname}/src/node_modules`)) {
        npmInstall(`${__dirname}/src/`)
            .catch(e => console.error(e));
    }
} else if (process.argv.includes('--2-build')) {
    buildReact(`${__dirname}/src/`, { rootDir: __dirname, vite: true, tsc: true })
        .catch(e => console.error(e));
} else if (process.argv.includes('--3-copy')) {
    copyAllFiles();
} else if (process.argv.includes('--4-patch')) {
    patchFiles();
} else if (process.argv.includes('--build')) {
    clean();
    let installPromise;
    if (!fs.existsSync(`${__dirname}/src/node_modules`)) {
        installPromise = npmInstall(`${__dirname}/src/`)
            .catch(e => console.error(e));
    } else {
        installPromise = Promise.resolve();
    }
    installPromise.then(() => buildReact(`${__dirname}/src/`, { rootDir: __dirname, vite: true, tsc: true }))
        .then(() => copyAllFiles())
        .then(() => patchFiles())
        .catch(e => console.error(e));
} else {
    cleanAdmin();
    npmInstall(`${__dirname}/src-admin/`)
        .then(() => buildAdmin())
        .then(() => copyAllAdminFiles())
        .then(() => clean())
        .then(() => {
            if (!fs.existsSync(`${__dirname}/src/node_modules`)) {
                return npmInstall(`${__dirname}/src/`);
            }
        })
        .then(() => buildReact(`${__dirname}/src/`, { rootDir: __dirname, vite: true, tsc: true }))
        .then(() => copyAllFiles())
        .then(() => patchFiles())
        .catch(e => console.error(e));
}
