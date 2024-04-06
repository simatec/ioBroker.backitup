/*!
 * ioBroker gulpfile
 * Date: 2023-02-22
 */
const gulp = require('gulp');
const fs = require('node:fs');
const cp = require('node:child_process');
const gulpHelper = require('@iobroker/vis-2-widgets-react-dev/gulpHelper');

function deleteFoldersRecursive(path, exceptions) {
    if (fs.existsSync(path)) {
        const files = fs.readdirSync(path);
        for (const file of files) {
            const curPath = `${path}/${file}`;
            if (exceptions && exceptions.find(e => curPath.endsWith(e))) {
                continue;
            }

            const stat = fs.statSync(curPath);
            if (stat.isDirectory()) {
                deleteFoldersRecursive(curPath, exceptions);
                const files = fs.readdirSync(curPath);
                if (!files.length) {
                    fs.rmdirSync(curPath);
                }
            } else {
                fs.unlinkSync(curPath);
            }
        }
    }
}

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

function build() {
    sync();
    return new Promise((resolve, reject) => {
        const options = {
            stdio: 'pipe',
            cwd:   `${__dirname}/src/`,
        };

        const version = JSON.parse(fs.readFileSync(`${__dirname}/package.json`).toString('utf8')).version;
        const data = JSON.parse(fs.readFileSync(`${__dirname}/src/package.json`).toString('utf8'));
        data.version = version;
        fs.writeFileSync(`${__dirname}/src/package.json`, JSON.stringify(data, null, 4));

        console.log(options.cwd);

        let script = `${__dirname}/src/node_modules/react-scripts/scripts/build.js`;
        if (!fs.existsSync(script)) {
            script = `${__dirname}/node_modules/react-scripts/scripts/build.js`;
        }
        if (!fs.existsSync(script)) {
            console.error(`Cannot find execution file: ${script}`);
            reject(`Cannot find execution file: ${script}`);
        } else {
            const child = cp.fork(script, [], options);
            child.stdout.on('data', data => console.log(data.toString()));
            child.stderr.on('data', data => console.log(data.toString()));
            child.on('close', code => {
                console.log(`child process exited with code ${code}`);
                code ? reject(`Exit code: ${code}`) : resolve();
            });
        }
    });
}

function sync() {
    sync2files(`${__dirname}/src-admin/src/BackupNow.jsx`, `${__dirname}/src/src/Components/BackupNow.js`);
    sync2files(`${__dirname}/src-admin/src/Components/SourceSelector.jsx`, `${__dirname}/src/src/Components/SourceSelector.js`);
}

function buildAdmin() {
    sync();
    return gulpHelper.buildWidgets(__dirname, `${__dirname}/src-admin/`);
}

// TASKS
gulp.task('admin-0-clean', done => {
    deleteFoldersRecursive(`${__dirname}/admin/custom`);
    deleteFoldersRecursive(`${__dirname}/src-admin/build`);
    done();
});

gulp.task('admin-1-npm', async () => gulpHelper.npmInstall(`${__dirname}/src-admin/`));

gulp.task('admin-2-compile', async () => buildAdmin());

gulp.task('admin-3-copy', () => Promise.all([
    gulp.src(['src-admin/build/static/js/*.js', '!src-admin/build/static/js/vendors*.js']).pipe(gulp.dest('admin/custom/static/js')),
    gulp.src(['src-admin/build/static/js/*.map', '!src-admin/build/static/js/vendors*.map']).pipe(gulp.dest('admin/custom/static/js')),
    gulp.src(['src-admin/build/static/js/vendors-node_modules_react-icons_*.*']).pipe(gulp.dest('admin/custom/static/js')),
    gulp.src(['src-admin/build/customComponents.js']).pipe(gulp.dest('admin/custom')),
    gulp.src(['src-admin/build/customComponents.js.map']).pipe(gulp.dest('admin/custom')),
    gulp.src(['src-admin/src/i18n/*.json']).pipe(gulp.dest('admin/custom/i18n')),
]));

gulp.task('admin-build', gulp.series(['admin-0-clean', 'admin-1-npm', 'admin-2-compile', 'admin-3-copy']));

gulp.task('clean', done => {
    deleteFoldersRecursive(`${__dirname}/admin`, [
        'backitup.png',
        'jsonConfig.json',
        'jsonConfig.json5',
        'jsonConfigExtras.json5',
        'jsonConfigRestore.json5',
        'jsonConfigNotifications.json5',
        'jsonConfigMain.json5',
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
    ]);
    done();
});

gulp.task('2-npm', () => {
    if (fs.existsSync(`${__dirname}/src/node_modules`)) {
        return Promise.resolve();
    } else {
        return gulpHelper.npmInstall(`${__dirname}/src/`);
    }
});

gulp.task('2-npm-dep', gulp.series('clean', '2-npm'));

gulp.task('3-build', () => build());

gulp.task('3-build-dep', gulp.series('2-npm-dep', '3-build'));

gulp.task('5-copy', () =>
    gulp.src([
        'src/build/*/**',
        'src/build/*',
        // replace it later with
        // ...gulpHelper.ignoreSvgFiles(`${__dirname}/src/`),
        `!src/build/index.html`,
        `!src/build/static/media/Alarm Systems.*.svg`,
        `!src/build/static/media/Amplifier.*.svg`,
        `!src/build/static/media/Anteroom.*.svg`,
        `!src/build/static/media/Attic.*.svg`,
        `!src/build/static/media/Awnings.*.svg`,
        `!src/build/static/media/Balcony.*.svg`,
        `!src/build/static/media/Barn.*.svg`,
        `!src/build/static/media/Basement.*.svg`,
        `!src/build/static/media/Bathroom.*.svg`,
        `!src/build/static/media/Battery Status.*.svg`,
        `!src/build/static/media/Bedroom.*.svg`,
        `!src/build/static/media/Boiler Room.*.svg`,
        `!src/build/static/media/Carport.*.svg`,
        `!src/build/static/media/Ceiling Spotlights.*.svg`,
        `!src/build/static/media/Cellar.*.svg`,
        `!src/build/static/media/Chamber.*.svg`,
        `!src/build/static/media/Chandelier.*.svg`,
        `!src/build/static/media/Climate.*.svg`,
        `!src/build/static/media/Coffee Makers.*.svg`,
        `!src/build/static/media/Cold Water.*.svg`,
        `!src/build/static/media/Computer.*.svg`,
        `!src/build/static/media/Consumption.*.svg`,
        `!src/build/static/media/Corridor.*.svg`,
        `!src/build/static/media/Curtains.*.svg`,
        `!src/build/static/media/Dining Area.*.svg`,
        `!src/build/static/media/Dining Room.*.svg`,
        `!src/build/static/media/Dining.*.svg`,
        `!src/build/static/media/Dishwashers.*.svg`,
        `!src/build/static/media/Doors.*.svg`,
        `!src/build/static/media/Doorstep.*.svg`,
        `!src/build/static/media/Dressing Room.*.svg`,
        `!src/build/static/media/Driveway.*.svg`,
        `!src/build/static/media/Dryer.*.svg`,
        `!src/build/static/media/Entrance.*.svg`,
        `!src/build/static/media/Equipment Room.*.svg`,
        `!src/build/static/media/Fan.*.svg`,
        `!src/build/static/media/Floor Lamps.*.svg`,
        `!src/build/static/media/Front Yard.*.svg`,
        `!src/build/static/media/Gallery.*.svg`,
        `!src/build/static/media/Garage Doors.*.svg`,
        `!src/build/static/media/Garage.*.svg`,
        `!src/build/static/media/Garden.*.svg`,
        `!src/build/static/media/Gates.*.svg`,
        `!src/build/static/media/Ground Floor.*.svg`,
        `!src/build/static/media/Guest Bathroom.*.svg`,
        `!src/build/static/media/Guest Room.*.svg`,
        `!src/build/static/media/Gym.*.svg`,
        `!src/build/static/media/Hairdryer.*.svg`,
        `!src/build/static/media/Hall.*.svg`,
        `!src/build/static/media/Handle.*.svg`,
        `!src/build/static/media/Hanging Lamps.*.svg`,
        `!src/build/static/media/Heater.*.svg`,
        `!src/build/static/media/Home Theater.*.svg`,
        `!src/build/static/media/Hoods.*.svg`,
        `!src/build/static/media/Hot Water.*.svg`,
        `!src/build/static/media/Humidity.*.svg`,
        `!src/build/static/media/Iron.*.svg`,
        `!src/build/static/media/Irrigation.*.svg`,
        `!src/build/static/media/Kitchen.*.svg`,
        `!src/build/static/media/Laundry Room.*.svg`,
        `!src/build/static/media/Led Strip.*.svg`,
        `!src/build/static/media/Light.*.svg`,
        `!src/build/static/media/Lightings.*.svg`,
        `!src/build/static/media/Living Area.*.svg`,
        `!src/build/static/media/Living Room.*.svg`,
        `!src/build/static/media/Lock.*.svg`,
        `!src/build/static/media/Locker Room.*.svg`,
        `!src/build/static/media/Louvre.*.svg`,
        `!src/build/static/media/Mowing Machine.*.svg`,
        `!src/build/static/media/Music.*.svg`,
        `!src/build/static/media/names.*.txt`,
        `!src/build/static/media/Nursery.*.svg`,
        `!src/build/static/media/Office.*.svg`,
        `!src/build/static/media/Outdoor Blinds.*.svg`,
        `!src/build/static/media/Outdoors.*.svg`,
        `!src/build/static/media/People.*.svg`,
        `!src/build/static/media/Playroom.*.svg`,
        `!src/build/static/media/Pool.*.svg`,
        `!src/build/static/media/Power Consumption.*.svg`,
        `!src/build/static/media/Printer.*.svg`,
        `!src/build/static/media/Pump.*.svg`,
        `!src/build/static/media/Rear Wall.*.svg`,
        `!src/build/static/media/Receiver.*.svg`,
        `!src/build/static/media/Sconces.*.svg`,
        `!src/build/static/media/Second Floor.*.svg`,
        `!src/build/static/media/Security.*.svg`,
        `!src/build/static/media/Shading.*.svg`,
        `!src/build/static/media/Shed.*.svg`,
        `!src/build/static/media/Shutters.*.svg`,
        `!src/build/static/media/Sleeping Area.*.svg`,
        `!src/build/static/media/SmokeDetector.*.svg`,
        `!src/build/static/media/Sockets.*.svg`,
        `!src/build/static/media/Speaker.*.svg`,
        `!src/build/static/media/Stairway.*.svg`,
        `!src/build/static/media/Stairwell.*.svg`,
        `!src/build/static/media/Storeroom.*.svg`,
        `!src/build/static/media/Stove.*.svg`,
        `!src/build/static/media/Summer House.*.svg`,
        `!src/build/static/media/Swimming Pool.*.svg`,
        `!src/build/static/media/Table Lamps.*.svg`,
        `!src/build/static/media/Temperature Sensors.*.svg`,
        `!src/build/static/media/Terrace.*.svg`,
        `!src/build/static/media/Toilet.*.svg`,
        `!src/build/static/media/Tv.*.svg`,
        `!src/build/static/media/Upstairs.*.svg`,
        `!src/build/static/media/Vacuum Cleaner.*.svg`,
        `!src/build/static/media/Ventilation.*.svg`,
        `!src/build/static/media/Wardrobe.*.svg`,
        `!src/build/static/media/Washing Machines.*.svg`,
        `!src/build/static/media/Washroom.*.svg`,
        `!src/build/static/media/Water Consumption.*.svg`,
        `!src/build/static/media/Water Heater.*.svg`,
        `!src/build/static/media/Water.*.svg`,
        `!src/build/static/media/Wc.*.svg`,
        `!src/build/static/media/Weather.*.svg`,
        `!src/build/static/media/Window.*.svg`,
        `!src/build/static/media/Windscreen.*.svg`,
        `!src/build/static/media/Workshop.*.svg`,
        `!src/build/static/media/Workspace.*.svg`,

    ])
        .pipe(gulp.dest('admin/')));

gulp.task('5-copy-dep', gulp.series('3-build-dep', '5-copy'));

gulp.task('6-patch', () => new Promise(resolve => {
    if (fs.existsSync(`${__dirname}/src/build/index.html`)) {
        let code = fs.readFileSync(`${__dirname}/src/build/index.html`).toString('utf8');
        code = code.replace(/<script>var script=document\.createElement\("script"\)[^<]+<\/script>/,
            `<script type="text/javascript" src="./../../lib/js/socket.io.js"></script>`);

        fs.existsSync(`${__dirname}/admin/tab_m.html`) && fs.unlinkSync(`${__dirname}/admin/tab_m.html`);
        fs.writeFileSync(`${__dirname}/admin/tab_m.html`, code);
    }

    resolve();
}));

gulp.task('6-patch-dep', gulp.series('5-copy-dep', '6-patch'));

gulp.task('default', gulp.series('6-patch-dep', 'admin-build'));
