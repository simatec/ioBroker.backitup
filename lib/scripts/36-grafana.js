'use strict';
const fs = require('fs');
const targz = require('targz');
const getDate = require('../tools').getDate;
const path = require('path');
const axios = require('axios').default;
const fse = require('fs-extra');


async function getData(options, log, callback, tmpDir, dashboardDir, datasourceDir) {
    return new Promise(async (resolve, reject) => {
        //create readme for dashboard restore
        fs.writeFileSync(`${tmpDir}/readme_dashboard_restore.txt`, 'Dashboards must be restored manually using the Grafana "Import Dashboard" function!');

        // Load datasource
        await axios({
            method: 'get',
            baseURL: `http://${options.host}:${options.port}`,
            url: '/api/datasources',
            auth: {
                'username': options.username,
                'password': options.pass
            },
            responseType: 'json'
        }).then(async (response) => {
            for (const i in response.data) {
                const data = JSON.stringify(response.data[i], null, 2);

                fs.writeFileSync(`${datasourceDir}/${response.data[i].name}.json`, data);
            }

        });
        // Load Dashboards
        await axios({
            method: 'get',
            baseURL: `http://${options.host}:${options.port}`,
            url: '/api/search',
            headers: { 'Authorization': 'Bearer ' + options.apiKey },
            responseType: 'json'
        }).then(async (response) => {
            const data = response.data;
            let dashBoards = [];

            for (const i in data) {
                if (dashBoards.indexOf(data[i].uri) === -1) {
                    dashBoards.push(data[i].uri);
                }
            }
            let ctr = 0;

            await dashBoards.forEach(async (dashBoard, index, array) => {
                await axios({
                    method: 'get',
                    baseURL: `http://${options.host}:${options.port}`,
                    url: `/api/dashboards/${dashBoard}`,
                    headers: { 'Authorization': 'Bearer ' + options.apiKey },
                    responseType: 'json'
                }).then(async (response) => {
                    let dashBoardName = dashBoard.split('/').pop();
                    log.debug('found Dashboard: ' + dashBoardName)
                    fs.writeFileSync(`${dashboardDir}/${dashBoardName}.json`, JSON.stringify(response.data, null, 2));

                    ctr++;

                    if (ctr === array.length) {
                        resolve();
                    }
                });
            });
        });
    });
}

async function command(options, log, callback) {

    const tmpDir = path.join(options.backupDir, 'grafana_tmp').replace(/\\/g, '/');
    const dashboardDir = path.join(tmpDir, 'dashboards').replace(/\\/g, '/');
    const datasourceDir = path.join(tmpDir, 'datasource').replace(/\\/g, '/');

    log.debug('Start Grafana Backup ...');

    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
        log.debug('Created grafana_tmp directory');
    } else {
        log.debug(`Try deleting the old grafana_tmp directory: "${tmpDir}"`);
        fse.removeSync(tmpDir);
        if (!fs.existsSync(tmpDir)) {
            log.debug(`old grafana_tmp directory "${tmpDir}" successfully deleted`);
            fs.mkdirSync(tmpDir);
            log.debug('Created grafana_tmp directory');
        }
    }

    if (!fs.existsSync(dashboardDir)) {
        fs.mkdirSync(dashboardDir);
        log.debug('Created dashboard directory');
    }

    if (!fs.existsSync(datasourceDir)) {
        fs.mkdirSync(datasourceDir);
        log.debug('Created datasource directory');
    }

    if (fs.existsSync(tmpDir) && fs.existsSync(datasourceDir) && fs.existsSync(dashboardDir)) {

        try {
            await getData(options, log, callback, tmpDir, dashboardDir, datasourceDir);
            // compress Backup
            try {
                const fileName = path.join(options.backupDir, `grafana_${getDate()}_backupiobroker.tar.gz`);

                options.context.fileNames.push(fileName);

                targz.compress({
                    src: tmpDir,
                    dest: fileName,
                }, (err, stdout, stderr) => {

                    if (err) {
                        options.context.errors.grafana = err.toString();
                        stderr && log.error(stderr);
                        if (callback) {
                            callback(err, stderr);
                            callback = null;
                        }
                    } else {
                        log.debug(`Backup created: ${fileName}`)
                        options.context.done.push('grafana');
                        options.context.types.push('grafana');
                        if (callback) {
                            try {
                                log.debug(`Try deleting the Grafana tmp directory: "${tmpDir}"`);
                                fse.removeSync(tmpDir);
                                if (!fs.existsSync(tmpDir)) {
                                    log.debug(`Grafana tmp directory "${tmpDir}" successfully deleted`);
                                }
                            } catch (err) {
                                log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                            }
                            callback(null, stdout);
                            callback = null;
                        }
                    }
                });
            } catch (e) {
                log.debug(`Grafana Backup cannot created: ${e}`);
                try {
                    log.debug(`Try deleting the Grafana tmp directory: "${tmpDir}"`);
                    fse.removeSync(tmpDir);
                    if (!fs.existsSync(tmpDir)) {
                        log.debug(`Grafana tmp directory "${tmpDir}" successfully deleted`);
                    }
                } catch (err) {
                    log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                }
                callback(null, e);
                callback = null;
            }
        } catch (e) {
            try {
                log.debug(`Try deleting the Grafana tmp directory: "${tmpDir}"`);
                fse.removeSync(tmpDir);
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`Grafana tmp directory "${tmpDir}" successfully deleted`);
                }
            } catch (err) {
                log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted ... ${err}`);
            }
            log.debug(`Grafana Backup cannot created: ${e}`);
            callback(null, e);
            callback = null;
        }
    } else {
        log.debug('Grafana Backup cannot created ...');
        callback(null, 'done');
        callback = null;
    }
}

module.exports = {
    command,
    ignoreErrors: false
};