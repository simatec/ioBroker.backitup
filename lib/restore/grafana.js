const fs = require('node:fs');
const fsAsync = require('node:fs').promises;
const path = require('node:path');
const fse = require('fs-extra');

let waitRestore;
let timerDone;

async function postData(options, log, tmpDir) {
    return new Promise(async (resolve) => {

        const dashboardDir = path.join(tmpDir, 'dashboards').replace(/\\/g, '/');
        const datasourceDir = path.join(tmpDir, 'datasource').replace(/\\/g, '/');
        const folderDir = path.join(tmpDir, 'folder').replace(/\\/g, '/');
        const dashBoards = await fsAsync.readdir(dashboardDir);
        const dataSources = await fsAsync.readdir(datasourceDir);
        const folders = await fsAsync.readdir(folderDir);

        const host = options.host ? options.host : options.grafana.host;
        const port = options.port ? options.port : options.grafana.port;
        const username = options.username ? options.username : options.grafana.username;
        const pass = options.pass ? options.pass : options.grafana.pass;
        const apiKey = options.apiKey ? options.apiKey : options.grafana.apiKey;
        const protocol = options.protocol ? options.protocol : options.grafana.protocol;
        const signedCertificates = options.signedCertificates ? options.signedCertificates : options.grafana.signedCertificates ? options.grafana.signedCertificates : true;

        const axios = require('axios');
        const https = require('node:https');

        // Check available
        let available;
        try {
            available = await axios({
                method: 'get',
                url: `${protocol}://${host}:${port}`,
                validateStatus: () => true,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: signedCertificates,
                })
            });
        } catch (err) {
            log.debug(`Grafana is not available: ${err}`);
        }
        if (available && available.status) {
            log.debug(`Grafana is available ... Status: ${available.status}`);

            // post datasource
            try {
                await Promise.all(dataSources.map(async (dataSource) => {
                    let dataSourcePth = path.join(datasourceDir, dataSource).replace(/\\/g, '/');
                    let dataSourceFile = await fsAsync.readFile(dataSourcePth);
                    let dataSourceName = dataSource.split('.').shift();
                    log.debug(`Try to Restore: ${dataSourcePth}`);

                    await axios({
                        method: 'POST',
                        baseURL: `${protocol}://${host}:${port}`,
                        url: '/api/datasources',
                        data: dataSourceFile,
                        headers: { 'Content-Type': 'application/json' },
                        auth: {
                            username: username,
                            password: pass,
                        },
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: signedCertificates,
                        }),
                    })
                        .then(result => {
                            log.debug(`datasoure restore "${dataSourceName}" finish: ${JSON.stringify(result.data)}`)
                        }).catch(err => {
                            log.debug(`cannot restore datasource "${dataSourceName}": ${JSON.stringify(err.response.data['message'])}`)
                        });
                }));
            } catch (err) {
                log.debug(`Grafana datasource restore not possible: ${err}`);
            }

            // restore folders
            try {
                await Promise.all(folders.map(async (folderFile) => {
                    const folderPath = path.join(folderDir, folderFile).replace(/\\/g, '/');
                    const folderJson = JSON.parse(await fsAsync.readFile(folderPath, 'utf8'));
                    const folderTitle = folderJson.title;
                    const folderUid = folderJson.uid;

                    log.debug(`Try to restore folder: ${folderTitle} (${folderUid})`);

                    await axios({
                        method: 'POST',
                        baseURL: `${protocol}://${host}:${port}`,
                        url: '/api/folders',
                        data: folderJson,
                        headers: {
                            'Content-Type': 'application/json',
                            // eslint-disable-next-line quote-props
                            'Authorization': `Bearer ${apiKey}`
                        },
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: signedCertificates,
                        }),
                    }).then(result => {
                        log.debug(`Folder "${folderTitle}" restored: ${JSON.stringify(result.data)}`);
                    }).catch(err => {
                        const message = err.response?.data?.message || err.message;
                        log.debug(`Cannot restore folder "${folderTitle}": ${message}`);
                    });

                }));
            } catch (err) {
                log.debug(`Grafana folder restore not possible: ${err}`);
            }

            const folderMapPath = path.join(folderDir, 'dashboard_folder_map.json').replace(/\\/g, '/');
            let dashboardFolderMap = {};

            try {
                const mapData = await fsAsync.readFile(folderMapPath, 'utf8');
                dashboardFolderMap = JSON.parse(mapData);
                log.debug(`Loaded dashboard-folder mapping with ${Object.keys(dashboardFolderMap).length} entries`);
            } catch (err) {
                log.debug(`No dashboard-folder mapping found or invalid: ${err}`);
            }

            // post Dashboards
            try {
                await Promise.all(dashBoards.map(async (dashBoard) => {
                    let dashBoardPth = path.join(dashboardDir, dashBoard).replace(/\\/g, '/');
                    let dashBoardFile = await fsAsync.readFile(dashBoardPth);
                    let dashBoardName = dashBoard.split('.').shift();
                    log.debug(`Try to Restore: ${dashBoardPth}`);

                    const apiOptions = {
                        baseURL: `${protocol}://${host}:${port}`,
                        headers: {
                            'Content-Type': 'application/json',
                            // eslint-disable-next-line quote-props
                            'Authorization': `Bearer ${apiKey}`
                        },
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: signedCertificates,
                        }),
                    };

                    let dashJson = JSON.parse(dashBoardFile);
                    const folderUid = dashboardFolderMap[dashBoardName];

                    if (folderUid && folderUid !== 'general') {
                        dashJson.folderUid = folderUid;
                    }

                    await axios.post('/api/dashboards/db', dashJson, apiOptions)
                        .then(result =>
                            log.debug(`dashboard restore for "${dashBoardName}" finish: ${JSON.stringify(result.data)}`))
                        .catch(err =>
                            log.debug(`cannot restore dashboard "${dashBoardName}": ${JSON.stringify(err.response.data)}`));
                }));
            } catch (err) {
                log.debug(`Grafana dashboard restore not possible: ${err}`);
            }
            // request finish
            resolve();
        } else {
            log.debug('Grafana is not available!');
            // request finish
            resolve();
        }
    });
}

function restore(options, fileName, log, adapter, callback) {
    if ((options && options.host && options.username && options.port && options.pass && options.apiKey && options.protocol) ||
        (options && options.grafana && options.grafana.host && options.grafana.username && options.grafana.port && options.grafana.pass && options.grafana.apiKey && options.grafana.protocol)
    ) {

        log.debug('Start Grafana Restore ...');

        const tmpDir = path.join(options.backupDir, 'grafana_tmp').replace(/\\/g, '/');

        log.debug(`filename for restore: ${fileName}`);

        if (fs.existsSync(tmpDir)) {
            try {
                fse.removeSync(tmpDir);
                if (!fs.existsSync(tmpDir)) {
                    log.debug('old Grafana tmp directory was successfully deleted');
                }
            } catch (e) {
                log.debug('old Grafana tmp directory cannot deleted');
            }
        }
        const desiredMode = '0o2775';

        try {
            fse.ensureDirSync(tmpDir, desiredMode);
            log.debug(`Grafana tmp directory created: ${tmpDir}`)
        } catch (e) {
            log.debug(`Grafana tmp directory cannot created: ${e}`);
        }

        try {
            log.debug('start decompress');

            const decompress = require('../targz').decompress;

            waitRestore = setTimeout(() =>
                decompress({
                    src: fileName,
                    dest: tmpDir,
                }, async (err, stdout, stderr) => {
                    if (err) {
                        log.error('Grafana restore not completed');
                        log.error(err);
                        if (callback) {
                            callback(err, stderr);
                            callback = null;
                            clearTimeout(timerDone);
                            clearTimeout(waitRestore);
                        }
                    } else {
                        if (callback) {
                            try {
                                log.debug('Grafana request started');
                                await postData(options, log, tmpDir);
                                log.debug('Grafana request ended');

                                log.debug('Try deleting the Grafana tmp directory');
                                fse.removeSync(tmpDir);
                                if (!fs.existsSync(tmpDir)) {
                                    log.debug('Grafana tmp directory was successfully deleted');
                                }

                            } catch (err) {
                                callback && callback(err);
                                callback = null;
                                clearTimeout(timerDone);
                                clearTimeout(waitRestore);
                            }
                            timerDone = setTimeout(() => {
                                log.debug('Grafana Restore completed successfully');
                                callback && callback(null, 'Grafana restore done');
                                callback = null;
                                clearTimeout(timerDone);
                                clearTimeout(waitRestore);
                            }, 2000);
                        }
                    }
                }), 1000);
        } catch (e) {
            if (callback) {
                callback(e);
                callback = null;
                clearTimeout(timerDone);
                clearTimeout(waitRestore);
            }
        }
    } else {
        log.debug('Grafana restore not completed. Please check your Configuration');
        callback && callback(null, 'Grafana restore not completed. Please check your Configuration');
    }
}

module.exports = {
    restore,
    isStop: false,
};
