import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import * as https from 'node:https';
import { join } from 'node:path';
import { ensureDirSync, removeSync } from 'fs-extra';
import axios from 'axios';

import { delay } from '../tools';
import { decompressAsync } from '../targz';
import type { BackItUpContext } from '../types';
import type { BackItUpRestoreOptions, BackItUpRestoreProps, BackItUpRestoreResultCode } from './types';

/** The connection settings, which may sit directly on the options or in a nested `grafana` slice */
interface GrafanaConnection {
    host?: string;
    port?: number | string;
    apiKey?: string;
    protocol?: 'http' | 'https';
    signedCertificates?: boolean;
}

interface GrafanaRestoreOptions extends BackItUpRestoreOptions, GrafanaConnection {
    grafana?: GrafanaConnection;
}

/** How long the original waited before unpacking */
const WAIT_MS = 1000;
/** ...and again before reporting */
const DONE_DELAY_MS = 2000;

/**
 * Writes a schema v2 dashboard back through the Kubernetes-style API: created, or - when it already
 * exists - replaced using the resource version of the current one.
 *
 * @param apiOptions base url, headers and agent of the request
 * @param dashJson the stored resource
 * @param folderUid folder the dashboard belonged to, from the folder map
 */
async function restoreResource(
    apiOptions: { baseURL: string; headers: Record<string, string>; httpsAgent: https.Agent },
    dashJson: any,
    folderUid: string | undefined,
): Promise<{ data: unknown }> {
    const [group, version] = String(dashJson.apiVersion).split('/');
    const namespace = dashJson.metadata?.namespace || 'default';
    const name = dashJson.metadata?.name;
    const path = `/apis/${group}/${version}/namespaces/${namespace}/dashboards`;

    const folder = folderUid && folderUid !== 'general' ? folderUid : dashJson.metadata?.annotations?.['grafana.app/folder'];
    const resource: any = {
        apiVersion: dashJson.apiVersion,
        kind: dashJson.kind || 'Dashboard',
        metadata: { name, ...(folder ? { annotations: { 'grafana.app/folder': folder } } : {}) },
        spec: dashJson.spec,
    };

    try {
        return await axios.post(path, resource, apiOptions);
    } catch (err: any) {
        if (err?.response?.status !== 409) {
            throw err;
        }
        const current = await axios.get(`${path}/${name}`, apiOptions);
        resource.metadata.resourceVersion = current.data?.metadata?.resourceVersion;
        return axios.put(`${path}/${name}`, resource, apiOptions);
    }
}

/**
 * Pushes the unpacked datasources, folders and dashboards back into Grafana.
 *
 * Always resolves - every failure is only logged.
 *
 * @param ctx run context, for the logger
 * @param options connection settings, flat or under `grafana`
 * @param tmpDir directory the backup was unpacked into
 */
async function postData(
    ctx: BackItUpContext,
    options: GrafanaRestoreOptions,
    tmpDir: string,
): Promise<void> {
    const dashboardDir = join(tmpDir, 'dashboards').replace(/\\/g, '/');
    const datasourceDir = join(tmpDir, 'datasource').replace(/\\/g, '/');
    const folderDir = join(tmpDir, 'folder').replace(/\\/g, '/');
    const dashBoards = await readdir(dashboardDir);
    const dataSources = await readdir(datasourceDir);
    const folders = await readdir(folderDir);

    const host = options.host ? options.host : options.grafana!.host;
    const port = options.port ? options.port : options.grafana!.port;
    const apiKey = options.apiKey ? options.apiKey : options.grafana!.apiKey;
    const protocol = options.protocol ? options.protocol : options.grafana!.protocol;
    // NOTE: the final `: true` makes this truthy even when both flags are false, so certificate
    // verification cannot be switched off here. Kept as found - see also lib/scripts/70-ftp. When
    // the flag is falsy and no `grafana` slice exists this throws instead.
    const signedCertificates = options.signedCertificates
        ? options.signedCertificates
        : options.grafana!.signedCertificates
          ? options.grafana!.signedCertificates
          : true;

    // Check available
    let available;
    try {
        available = await axios({
            method: 'get',
            url: `${protocol}://${host}:${port}`,
            validateStatus: () => true,
            httpsAgent: new https.Agent({
                rejectUnauthorized: signedCertificates,
            }),
        });
    } catch (err) {
        ctx.log.debug(`Grafana is not available: ${err}`);
    }
    if (available?.status) {
        ctx.log.debug(`Grafana is available ... Status: ${available.status}`);

        // post datasource
        try {
            await Promise.all(
                dataSources.map(async dataSource => {
                    const dataSourcePth = join(datasourceDir, dataSource).replace(/\\/g, '/');
                    const dataSourceFile = await readFile(dataSourcePth);
                    const dataSourceName = dataSource.split('.').shift();
                    ctx.log.debug(`Try to Restore: ${dataSourcePth}`);

                    await axios({
                        method: 'POST',
                        baseURL: `${protocol}://${host}:${port}`,
                        url: '/api/datasources',
                        data: dataSourceFile,
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                        },
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: signedCertificates,
                        }),
                    })
                        .then(result => {
                            ctx.log.debug(
                                `datasoure restore "${dataSourceName}" finish: ${JSON.stringify(result.data)}`,
                            );
                        })
                        .catch(err => {
                            // Reaches into `err.response` unguarded, so a network-level failure
                            // throws here and is reported by the outer catch instead.
                            ctx.log.debug(
                                `cannot restore datasource "${dataSourceName}": ${JSON.stringify(err.response.data.message)}`,
                            );
                        });
                }),
            );
        } catch (err) {
            ctx.log.debug(`Grafana datasource restore not possible: ${err}`);
        }

        // restore folders
        try {
            await Promise.all(
                folders.map(async folderFile => {
                    const folderPath = join(folderDir, folderFile).replace(/\\/g, '/');
                    const folderJson = JSON.parse(await readFile(folderPath, 'utf8'));
                    const folderTitle = folderJson.title;
                    const folderUid = folderJson.uid;

                    if (folderUid) {
                        ctx.log.debug(`Try to restore folder: ${folderTitle} (${folderUid})`);

                        await axios({
                            method: 'POST',
                            baseURL: `${protocol}://${host}:${port}`,
                            url: '/api/folders',
                            data: folderJson,
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${apiKey}`,
                            },
                            httpsAgent: new https.Agent({
                                rejectUnauthorized: signedCertificates,
                            }),
                        })
                            .then(() => {
                                ctx.log.debug(`Folder "${folderTitle}" restored`);
                            })
                            .catch(err => {
                                const message = err.response?.data?.message || err.message;
                                ctx.log.debug(`Cannot restore folder "${folderTitle}": ${message}`);
                            });
                    }
                }),
            );
        } catch (err) {
            ctx.log.debug(`Grafana folder restore not possible: ${err}`);
        }

        const folderMapPath = join(folderDir, 'dashboard_folder_map.json').replace(/\\/g, '/');
        let dashboardFolderMap: Record<string, string> = {};

        try {
            const mapData = await readFile(folderMapPath, 'utf8');
            dashboardFolderMap = JSON.parse(mapData);
            ctx.log.debug(`Loaded dashboard-folder mapping with ${Object.keys(dashboardFolderMap).length} entries`);
        } catch (err) {
            ctx.log.debug(`No dashboard-folder mapping found or invalid: ${err}`);
        }

        // post Dashboards
        try {
            await Promise.all(
                dashBoards.map(async dashBoard => {
                    const dashBoardPth = join(dashboardDir, dashBoard).replace(/\\/g, '/');
                    const dashBoardFile = await readFile(dashBoardPth);
                    const dashBoardName = dashBoard.split('.').shift()!;
                    ctx.log.debug(`Try to Restore: ${dashBoardPth}`);

                    const apiOptions = {
                        baseURL: `${protocol}://${host}:${port}`,
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                        },
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: signedCertificates,
                        }),
                    };

                    const dashJson = JSON.parse(dashBoardFile.toString());
                    const folderUid = dashboardFolderMap[dashBoardName];

                    if (folderUid && folderUid !== 'general') {
                        dashJson.folderUid = folderUid;
                    }

                    // Schema v2 dashboards are stored as a Kubernetes-style resource (see lib/scripts/36-grafana)
                    const restoreRequest = dashJson.apiVersion && dashJson.spec
                        ? restoreResource(apiOptions, dashJson, folderUid)
                        : axios.post('/api/dashboards/db', dashJson, apiOptions);

                    await restoreRequest
                        .then(result =>
                            ctx.log.debug(
                                `dashboard restore for "${dashBoardName}" finish: ${JSON.stringify(result.data)}`,
                            ),
                        )
                        .catch(err =>
                            // `err.response` is missing on network-level failures.
                            ctx.log.debug(
                                `cannot restore dashboard "${dashBoardName}": ${JSON.stringify(err.response?.data ?? err.message)}`,
                            ),
                        );
                }),
            );
        } catch (err) {
            ctx.log.debug(`Grafana dashboard restore not possible: ${err}`);
        }
        // request finish
    } else {
        ctx.log.debug('Grafana is not available!');
        // request finish
    }
}

/**
 * Unpacks a Grafana backup and pushes it back through the API.
 *
 * The callback version armed its "done" timer even after the push had failed - the catch cleared
 * the callback but did not return, so the timer only logged "completed successfully" into the void.
 * The step reports once now.
 *
 * @param props the run context, the grafana slice of the config and the archive
 */
export async function restore(props: BackItUpRestoreProps<GrafanaRestoreOptions>): Promise<BackItUpRestoreResultCode> {
    const { context: ctx, options, fileName } = props;

    if (
        !(
            (options && options.host && options.port && options.apiKey && options.protocol) ||
            (options &&
                options.grafana &&
                options.grafana.host &&
                options.grafana.port &&
                options.grafana.apiKey &&
                options.grafana.protocol)
        )
    ) {
        ctx.log.debug('Grafana restore not completed. Please check your Configuration');
        return 'Grafana restore not completed. Please check your Configuration';
    }

    ctx.log.debug('Start Grafana Restore ...');

    const tmpDir = join(options.backupDir, 'grafana_tmp').replace(/\\/g, '/');

    ctx.log.debug(`filename for restore: ${fileName}`);

    if (existsSync(tmpDir)) {
        try {
            removeSync(tmpDir);
            if (!existsSync(tmpDir)) {
                ctx.log.debug('old Grafana tmp directory was successfully deleted');
            }
        } catch {
            ctx.log.debug('old Grafana tmp directory cannot deleted');
        }
    }
    // A string, so fs-extra reads no mode from it and falls back to the default. Kept as found.
    const desiredMode = '0o2775';

    try {
        ensureDirSync(tmpDir, desiredMode as unknown as number);
        ctx.log.debug(`Grafana tmp directory created: ${tmpDir}`);
    } catch (e) {
        ctx.log.debug(`Grafana tmp directory cannot created: ${e}`);
    }

    ctx.log.debug('start decompress');

    await delay(WAIT_MS);

    try {
        await decompressAsync({ src: fileName, dest: tmpDir });
    } catch (err) {
        ctx.log.error('Grafana restore not completed');
        ctx.log.error(err);
        throw err;
    }

    ctx.log.debug('Grafana request started');
    await postData(ctx, options, tmpDir);
    ctx.log.debug('Grafana request ended');

    ctx.log.debug('Try deleting the Grafana tmp directory');
    removeSync(tmpDir);
    if (!existsSync(tmpDir)) {
        ctx.log.debug('Grafana tmp directory was successfully deleted');
    }

    await delay(DONE_DELAY_MS);

    ctx.log.debug('Grafana Restore completed successfully');
    return 'Grafana restore done';
}

export const isStop = false;
