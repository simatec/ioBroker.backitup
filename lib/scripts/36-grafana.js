'use strict';
const fs = require('fs');
const fs_async = require('fs').promises;
const getDate = require('../tools').getDate;
const compress = require('../targz').compress;
const path = require('path');
const axios = require('axios').default;
const fse = require('fs-extra');

let waitCompress;

async function getData(options, log, dashboardDir, datasourceDir, dashboardManuallyDir, tmpDir, callback) {
    return new Promise(async (resolve, reject) => {
        let available;
        try {
            available = await axios({
                method: 'get',
                baseURL: `http://${options.host}:${options.port}`,
                validateStatus: () => true
            });
        } catch (err) {
            log.debug('Grafana is not available: ' + err)
        }
        if (available && available.status) {
            log.debug('Grafana is available ... Status: ' + available.status)

            // Load datasource
            try {
                const dataSourcesRequest = await axios({
                    method: 'get',
                    baseURL: `http://${options.host}:${options.port}`,
                    url: '/api/datasources',
                    auth: {
                        'username': options.username,
                        'password': options.pass
                    },
                    responseType: 'json'
                });

                await Promise.all(dataSourcesRequest.data.map(async (dataSource) => {
                    await fs_async.writeFile(`${datasourceDir}/${dataSource.name}.json`, JSON.stringify(dataSource, null, 2));
                }));
            } catch (err) {
                log.debug('Error on Grafana Datasource Request');
            }

            // Load Dashboards
            let dashBoards = [];

            try {
                const dashBoardsRequest = await axios({
                    method: 'get',
                    baseURL: `http://${options.host}:${options.port}`,
                    url: '/api/search',
                    headers: { 'Authorization': 'Bearer ' + options.apiKey },
                    responseType: 'json'
                });

                await Promise.all(dashBoardsRequest.data.map(async (dashBoard) => {
                    if (dashBoards.indexOf(dashBoard.uri) === -1) {
                        dashBoards.push(dashBoard.uri);
                    }
                }));
            } catch (err) {
                log.debug('Error on Grafana Dashoard Request: ' + err);
            }

            try {
                await Promise.all(dashBoards.map(async (dashBoard) => {
                    let dashBoardRequest = await axios({
                        method: 'get',
                        baseURL: `http://${options.host}:${options.port}`,
                        url: `/api/dashboards/${dashBoard}`,
                        headers: { 'Authorization': 'Bearer ' + options.apiKey },
                        responseType: 'json'
                    });

                    let dashBoardName = dashBoard.split('/').pop();
                    log.debug('found Dashboard: ' + dashBoardName)

                    const changedJSON = dashBoardRequest.data;

                    delete changedJSON["meta"];
                    changedJSON.dashboard.id = null;
                    changedJSON.overwrite = true;

                    let manuellyJSON = dashBoardRequest.data.dashboard;

                    manuellyJSON.id = null;

                    fs_async.writeFile(path.join(dashboardDir, `${dashBoardName}.json`).replace(/\\/g, '/'), JSON.stringify(changedJSON, null, 2));
                    fs_async.writeFile(path.join(dashboardManuallyDir, `${dashBoardName}.json`).replace(/\\/g, '/'), JSON.stringify(manuellyJSON, null, 2));
                }));
            } catch (err) {
                log.debug('Error on Grafana Dashoard backup: ' + err);
            }
            // request finish
            resolve();
        } else {
            log.debug('Grafana is not available!');
            try {
                log.debug(`Try deleting the Grafana tmp directory: "${tmpDir}"`);
                fse.removeSync(tmpDir);
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`Grafana tmp directory "${tmpDir}" successfully deleted`);
                }
                log.debug('Grafana Backup cannot created ...');
                callback(null, 'done');
                callback = null;
            } catch (err) {
                log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                callback(null, err);
                callback = null;
            }
        }
    });
}

async function command(options, log, callback) {

    const tmpDir = path.join(options.backupDir, 'grafana_tmp').replace(/\\/g, '/');
    const dashboardDir = path.join(tmpDir, 'dashboards').replace(/\\/g, '/');
    const datasourceDir = path.join(tmpDir, 'datasource').replace(/\\/g, '/');
    const dashboardManuallyDir = path.join(tmpDir, 'dashboards_manually_restore').replace(/\\/g, '/');

    const desiredMode = '0o2775';

    log.debug('Start Grafana Backup ...');

    if (!fs.existsSync(tmpDir)) {
        try {
            fse.ensureDirSync(tmpDir, desiredMode);
            //fs.mkdirSync(tmpDir);
            log.debug(`Created grafana_tmp directory: "${tmpDir}"`);
        } catch (err) {
            log.debug(`Grafana tmp directory "${tmpDir}" cannot created ... ${err}`);
        }
    } else {
        try {
            log.debug(`Try deleting the old grafana_tmp directory: "${tmpDir}"`);
            fse.removeSync(tmpDir);
        } catch (err) {
            log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted ... ${err}`);
        }
        if (!fs.existsSync(tmpDir)) {
            try {
                log.debug(`old grafana_tmp directory "${tmpDir}" successfully deleted`);
                fse.ensureDirSync(tmpDir, desiredMode);
                //fs.mkdirSync(tmpDir);
                log.debug('Created grafana_tmp directory');
            } catch (err) {
                log.debug(`Grafana tmp directory "${tmpDir}" cannot created ... ${err}`);
            }
        }
    }
    try {
        if (!fs.existsSync(dashboardDir)) {
            fse.ensureDirSync(dashboardDir, desiredMode);
            //fs.mkdirSync(dashboardDir);
            log.debug('Created dashboard directory');
        }
        if (!fs.existsSync(dashboardManuallyDir)) {
            fse.ensureDirSync(dashboardManuallyDir, desiredMode);
            //fs.mkdirSync(dashboardManuallyDir);
            log.debug('Created dashboards_manually_restore directory');
        }

        if (!fs.existsSync(datasourceDir)) {
            fse.ensureDirSync(datasourceDir, desiredMode);
            //fs.mkdirSync(datasourceDir);
            log.debug('Created datasource directory');
        }
    } catch (err) {
        log.debug(`Grafana Backup cannot created: ${err}`);
        callback(err);
        callback = null;
    }

    if (fs.existsSync(tmpDir) && fs.existsSync(datasourceDir) && fs.existsSync(dashboardDir)) {

        try {
            log.debug('start Grafana request ...');
            await getData(options, log, dashboardDir, datasourceDir, dashboardManuallyDir, tmpDir, callback);
            log.debug('start Grafana backup compress ...');

            // compress Backup
            try {
                const dashBoardFiles = await fs_async.readdir(dashboardDir);
                const dataSourcesFiles = await fs_async.readdir(datasourceDir);

                if (dataSourcesFiles.length !== 0 && dashBoardFiles.length !== 0) {

                    const fileName = path.join(options.backupDir, `grafana_${getDate()}_backupiobroker.tar.gz`);

                    options.context.fileNames.push(fileName);

                    waitCompress = setTimeout(() =>
                        compress({
                            src: tmpDir,
                            dest: fileName,
                        }, (err, stdout, stderr) => {
                            if (err) {
                                options.context.errors.grafana = err.toString();
                                stderr && log.error(stderr);
                                if (callback) {
                                    callback(err, stderr);
                                    callback = null;
                                    clearTimeout(waitCompress);
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
                                    clearTimeout(waitCompress);
                                }
                            }
                        }), 5000);
                } else {
                    try {
                        log.debug(`Try deleting the Grafana tmp directory: "${tmpDir}"`);
                        fse.removeSync(tmpDir);
                        if (!fs.existsSync(tmpDir)) {
                            log.debug(`Grafana tmp directory "${tmpDir}" successfully deleted`);
                        }
                    } catch (err) {
                        log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                    }
                    log.debug('cannot found Grafana Backup files');
                    callback(null);
                    callback = null;
                    clearTimeout(waitCompress);
                }
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
                clearTimeout(waitCompress);
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
            clearTimeout(waitCompress);
        }
    } else {
        log.debug('Grafana Backup cannot created ...');
        callback(null);
        callback = null;
        clearTimeout(waitCompress);
    }
}

module.exports = {
    command,
    ignoreErrors: true
};