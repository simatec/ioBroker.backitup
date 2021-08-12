const fs = require('fs');
const fs_async = require('fs').promises;
const path = require('path');
const fse = require('fs-extra');

let waitRestore;
let timerDone;

async function postData(options, log, tmpDir) {
    return new Promise(async (resolve) => {

        const dashboardDir = path.join(tmpDir, 'dashboards').replace(/\\/g, '/');
        const datasourceDir = path.join(tmpDir, 'datasource').replace(/\\/g, '/');
        const dashBoards = await fs_async.readdir(dashboardDir);
        const dataSources = await fs_async.readdir(datasourceDir);

        const host = options.host ? options.host : options.grafana.host;
        const port = options.port ? options.port : options.grafana.port;
        const username = options.username ? options.username : options.grafana.username;
        const pass = options.pass ? options.pass : options.grafana.pass;
        const apiKey = options.apiKey ? options.apiKey : options.grafana.apiKey;
        const protocol = options.protocol ? options.protocol : options.grafana.protocol;

        const axios = require('axios').default;

        // Check available
        let available;
        try {
            available = await axios({
                method: 'get',
                baseURL: `${protocol}://${host}:${port}`,
                validateStatus: () => true
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
                    let dataSourceFile = await fs_async.readFile(dataSourcePth);
                    let dataSourceName = dataSource.split('.').shift();
                    log.debug(`Try to Restore: ${dataSourcePth}`);

                    await axios({
                        method: 'POST',
                        baseURL: `${protocol}://${host}:${port}`,
                        url: '/api/datasources',
                        data: dataSourceFile,
                        headers: { 'Content-Type': 'application/json' },
                        auth: {
                            'username': username,
                            'password': pass
                        }
                    }).then(result => {
                        log.debug(`datasoure restore "${dataSourceName}" finish: ${JSON.stringify(result.data)}`)
                    }).catch(err => {
                        log.debug(`cannot restore datasource "${dataSourceName}": ${JSON.stringify(err.response.data['message'])}`)
                    });
                }));
            } catch (err) {
                log.debug(`Grafana datasource restore not possible: ${err}`);
            }

            // post Dashboards
            try {
                await Promise.all(dashBoards.map(async (dashBoard) => {
                    let dashBoardPth = path.join(dashboardDir, dashBoard).replace(/\\/g, '/');
                    let dashBoardFile = await fs_async.readFile(dashBoardPth);
                    let dashBoardName = dashBoard.split('.').shift();
                    log.debug(`Try to Restore: ${dashBoardPth}`);

                    const apiOptions = {
                        baseURL: `${protocol}://${host}:${port}`,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + apiKey
                        }
                    }

                    await axios.post("/api/dashboards/db", dashBoardFile, apiOptions)
                        .then(result => {
                            log.debug(`dashboard restore for "${dashBoardName}" finish: ${JSON.stringify(result.data)}`)
                        }).catch(err => {
                            log.debug(`cannot restore dashboard "${dashBoardName}": ${JSON.stringify(err.response.data)}`)
                        });
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
        (options && options.grafana && options.grafana.host && options.grafana.username && options.grafana.port && options.grafana.pass && options.grafana.apiKey && options.grafana.protocol)) {

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
            //fs.mkdirSync(tmpDir);
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
                            timerDone = setTimeout(function () {
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
    isStop: false
};