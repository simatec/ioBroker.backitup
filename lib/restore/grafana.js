const fs = require('fs');
const fs_async = require('fs').promises;
const targz = require('targz');
const path = require('path');
const fse = require('fs-extra');
const axios = require('axios').default;

async function postData(options, log, tmpDir) {
    return new Promise(async (resolve, reject) => {

        const dashboardDir = path.join(tmpDir, 'dashboards').replace(/\\/g, '/');
        const datasourceDir = path.join(tmpDir, 'datasource').replace(/\\/g, '/');
        const dashBoards = await fs_async.readdir(dashboardDir);
        const dataSources = await fs_async.readdir(datasourceDir);

        const host = options.host ? options.host : options.grafana.host;
        const port = options.port ? options.port : options.grafana.port;
        const username = options.username ? options.username : options.grafana.username;
        const pass = options.pass ? options.pass : options.grafana.pass;
        const apiKey = options.apiKey ? options.apiKey : options.grafana.apiKey;

        // Check available
        let available;
        try {
            available = await axios({
                method: 'get',
                baseURL: `http://${host}:${port}`,
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
                        baseURL: `http://${host}:${port}`,
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
                        baseURL: `http://${host}:${port}`,
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

function restore(options, fileName, log, callback) {
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

    try {
        fs.mkdirSync(tmpDir);
        log.debug(`Grafana tmp directory created: ${tmpDir}`)
    } catch (e) {
        log.debug(`Grafana tmp directory cannot created: ${e}`);
    }

    try {
        log.debug('start decompress');
        targz.decompress({
            src: fileName,
            dest: tmpDir,
        }, async (err, stdout, stderr) => {
            if (err) {
                log.error('Grafana restore not completed');
                log.error(stderr);
                if (callback) {
                    callback(err, stderr);
                    callback = null;
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
                        callback(err);
                        callback = null;
                    }

                    log.debug('Grafana Restore completed successfully');
                    callback(null, 'Grafana restore done');
                    callback = null;


                }
            }
        });
    } catch (e) {
        if (callback) {
            callback(e);
            callback = null;
        }
    }
}

module.exports = {
    restore,
    isStop: false
};