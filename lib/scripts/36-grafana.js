'use strict';
const fs = require('fs');
const fs_async = require('fs').promises;
const getDate = require('../tools').getDate;
const path = require('path');
const fse = require('fs-extra');
const https = require('https');

let waitCompress;

async function getData(options, log, dashboardDir, datasourceDir, dashboardManuallyDir, tmpDir, callback) {
    return new Promise(async (resolve) => {

        const axios = require('axios');
        let available;

        try {
            available = await axios({
                method: 'get',
                url: `${options.protocol}://${options.host}:${options.port}`,
                validateStatus: () => true,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: options.signedCertificates
                })
            });
        } catch (err) {
            options.context.errors.grafana = JSON.stringify(err);
            log.debug('Grafana is not available: ' + err);
        }
        if (available && available.status) {
            log.debug('Grafana is available ... Status: ' + available.status);

            // Load datasource
            try {
                const dataSourcesRequest = await axios({
                    method: 'get',
                    url: `${options.protocol}://${options.host}:${options.port}/api/datasources`,
                    auth: {
                        'username': options.username,
                        'password': options.pass
                    },
                    responseType: 'json',
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: options.signedCertificates
                    })
                });

                await Promise.all(dataSourcesRequest.data.map(async (dataSource) => {
                    await fs_async.writeFile(`${datasourceDir}/${dataSource.name}.json`, JSON.stringify(dataSource, null, 2));
                }));
            } catch (err) {
                options.context.errors.grafana = JSON.stringify(err);
                log.debug('Error on Grafana Datasource Request');
            }

            // Load Dashboards
            let dashBoards = [];

            try {
                const dashBoardsRequest = await axios({
                    method: 'get',
                    url: `${options.protocol}://${options.host}:${options.port}/api/search`,
                    headers: { 'Authorization': 'Bearer ' + options.apiKey },
                    responseType: 'json',
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: options.signedCertificates
                    })
                });

                await Promise.all(dashBoardsRequest.data.map(async (dashBoard) => {
                    if (dashBoards.indexOf(dashBoard.uri) === -1) {
                        dashBoards.push(`${dashBoard.uid}:${dashBoard.uri.split('/').pop()}`);
                    }
                }));
            } catch (err) {
                options.context.errors.grafana = JSON.stringify(err);
                log.debug('Error on Grafana Dashoard Request: ' + err);
            }

            try {
                await Promise.all(dashBoards.map(async (dashBoard) => {
                    const dashBoardData = dashBoard.split(':');
                    let dashBoardRequest;

                    try {
                        dashBoardRequest = await axios({
                            method: 'get',
                            url: `${options.protocol}://${options.host}:${options.port}/api/dashboards/uid/${dashBoardData[0]}`,
                            headers: { 'Authorization': 'Bearer ' + options.apiKey },
                            responseType: 'json',
                            httpsAgent: new https.Agent({
                                rejectUnauthorized: options.signedCertificates
                            })
                        });
                    } catch (err) {
                        options.context.errors.grafana = JSON.stringify(err);
                        log.debug(`Error on Grafana Dashoard ${dashBoardData[0]} backup: ${err}`);
                    }

                    log.debug('found Dashboard: ' + dashBoardData[1])

                    const changedJSON = dashBoardRequest.data;

                    delete changedJSON["meta"];
                    changedJSON.dashboard.id = null;
                    changedJSON.overwrite = true;

                    let manuellyJSON = dashBoardRequest.data.dashboard;

                    manuellyJSON.id = null;
                    try {
                        await fs_async.writeFile(path.join(dashboardDir, `${dashBoardData[1]}.json`).replace(/\\/g, '/'), JSON.stringify(changedJSON, null, 2));
                    } catch (e) {
                        options.context.errors.grafana = JSON.stringify(e);
                        log.debug(`${dashBoardData[1]}.json cannot be written: ${e}`);
                    }

                    try {
                        await fs_async.writeFile(path.join(dashboardManuallyDir, `${dashBoardData[1]}.json`).replace(/\\/g, '/'), JSON.stringify(manuellyJSON, null, 2));
                    } catch (e) {
                        options.context.errors.grafana = JSON.stringify(e);
                        log.debug(`${dashBoardData[1]}.json cannot be written: ${e}`);
                    }
                }));
            } catch (err) {
                options.context.errors.grafana = JSON.stringify(err);
                log.debug('Error on Grafana Dashoard backup: ' + err);
            }
            // request finish
            resolve();
        } else {
            options.context.errors.grafana = 'Grafana is not available!';

            log.debug('Grafana is not available!');
            log.debug(`Try deleting the Grafana tmp directory: "${tmpDir}"`);

            try {
                await delTmp(options, tmpDir, log);
            } catch (err) {
                options.context.errors.grafana = JSON.stringify(err);
                log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted ... ${err}`);
                callback && callback(null, err);
                callback = null;
            }

            log.debug('Grafana Backup cannot created ...');
            callback && callback(null, 'done');
            callback = null;
        }
    });
}

async function command(options, log, callback) {
    if (options && options.protocol && options.host && options.port && options.username && options.pass && options.apiKey) {

        const tmpDir = path.join(options.backupDir, 'grafana_tmp').replace(/\\/g, '/');
        const dashboardDir = path.join(tmpDir, 'dashboards').replace(/\\/g, '/');
        const datasourceDir = path.join(tmpDir, 'datasource').replace(/\\/g, '/');
        const dashboardManuallyDir = path.join(tmpDir, 'dashboards_manually_restore').replace(/\\/g, '/');

        log.debug('Start Grafana Backup ...');

        const desiredMode = {
            mode: 0o2775
        };

        if (!fs.existsSync(tmpDir)) {
            try {
                await fse.ensureDir(tmpDir, desiredMode);
            } catch (err) {
                options.context.errors.grafana = JSON.stringify(err);
                log.debug(`Grafana tmp directory "${tmpDir}" cannot created ... ${err}`);
            }
            log.debug(`Created grafana_tmp directory: "${tmpDir}"`);
        } else {
            await delTmp(options, tmpDir, log);

            if (!fs.existsSync(tmpDir)) {
                try {
                    await fse.ensureDir(tmpDir, desiredMode);
                } catch (err) {
                    options.context.errors.grafana = JSON.stringify(err);
                    log.debug(`Grafana tmp directory "${tmpDir}" cannot created ... ${err}`);
                }
                log.debug('Created grafana_tmp directory');
            }
        }
        try {
            if (!fs.existsSync(dashboardDir)) {
                await fse.ensureDir(dashboardDir, desiredMode);
                log.debug('Created dashboard directory');
            }
            if (!fs.existsSync(dashboardManuallyDir)) {
                await fse.ensureDir(dashboardManuallyDir, desiredMode);
                log.debug('Created dashboards_manually_restore directory');
            }
            if (!fs.existsSync(datasourceDir)) {
                await fse.ensureDir(datasourceDir, desiredMode);
                log.debug('Created datasource directory');
            }
        } catch (err) {
            options.context.errors.grafana = JSON.stringify(err);
            log.debug(`Grafana Backup cannot created: ${err}`);
            callback && callback(err);
        }

        if (fs.existsSync(tmpDir) && fs.existsSync(datasourceDir) && fs.existsSync(dashboardDir) && fs.existsSync(dashboardManuallyDir)) {

            try {
                log.debug('start Grafana request ...');
                await getData(options, log, dashboardDir, datasourceDir, dashboardManuallyDir, tmpDir, callback);
                log.debug('start Grafana backup compress ...');

                // compress Backup
                try {
                    const dashBoardFiles = await fs_async.readdir(dashboardDir);
                    const dataSourcesFiles = await fs_async.readdir(datasourceDir);

                    if (dataSourcesFiles.length !== 0 && dashBoardFiles.length !== 0) {

                        let nameSuffix;
                        if (options.hostType == 'Slave') {
                            nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
                        } else {
                            nameSuffix = options.nameSuffix ? options.nameSuffix : '';
                        }

                        const fileName = path.join(options.backupDir, `grafana_${getDate()}${nameSuffix ? '_' + nameSuffix : ''}_backupiobroker.tar.gz`);

                        options.context.fileNames.push(fileName);

                        const compress = require('../targz').compress;

                        waitCompress = setTimeout(async () =>
                            compress({
                                src: tmpDir,
                                dest: fileName,
                            }, async (err, stdout, stderr) => {
                                if (err) {
                                    options.context.errors.grafana = err.toString();
                                    stderr && log.error(stderr);
                                    if (callback) {
                                        callback(err, stderr);
                                        clearTimeout(waitCompress);
                                    }
                                } else {
                                    log.debug(`Backup created: ${fileName}`)
                                    options.context.done.push('grafana');
                                    options.context.types.push('grafana');
                                    if (callback) {
                                        await delTmp(options, tmpDir, log);

                                        callback && callback(null, stdout);
                                        callback = null;
                                        clearTimeout(waitCompress);
                                    }
                                }
                            }), 5000);
                    } else {
                        await delTmp(options, tmpDir, log);

                        log.debug('cannot found Grafana Backup files');
                        callback && callback(null);
                        callback = null;
                        clearTimeout(waitCompress);
                    }
                } catch (e) {
                    options.context.errors.grafana = JSON.stringify(e);
                    log.debug(`Grafana Backup cannot created: ${e}`);

                    await delTmp(options, tmpDir, log);

                    callback && callback(null, e);
                    callback = null;
                    clearTimeout(waitCompress);
                }
            } catch (e) {
                await delTmp(options, tmpDir, log);

                log.debug(`Grafana Backup cannot created: ${e}`);
                callback && callback(null, e);
                callback = null;
                clearTimeout(waitCompress);
            }
        } else {
            log.debug('Grafana Backup cannot created ...');
            callback && callback(null);
            callback = null;
            clearTimeout(waitCompress);
        }
    } else {
        options.context.errors.grafana = 'Grafana Backup cannot created. Please check your Configuration';
        log.debug('Grafana Backup cannot created. Please check your Configuration');
        callback && callback(null);
        callback = null;
    }
}

async function delTmp(options, tmpDir, log) {
    return new Promise(async (resolve, reject) => {
        log.debug(`Try deleting the Grafana tmp directory: "${tmpDir}"`);

        await fse.remove(tmpDir)
            .then(() => {
                if (!fs.existsSync(tmpDir)) {
                    log.debug(`Grafana tmp directory "${tmpDir}" successfully deleted`);
                }
                resolve();
            })
            .catch(err => {
                options.context.errors.grafana = JSON.stringify(err);
                log.debug(`Grafana tmp directory "${tmpDir}" cannot deleted`);
                reject(err);
            });
    });
}

module.exports = {
    command,
    ignoreErrors: true
};