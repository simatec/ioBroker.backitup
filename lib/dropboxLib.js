'use strict';

class DropBox {
    sessionUpload(dbx, fileName, dir, log) {
        return new Promise(async (resolve, reject) => {
            const fs = require('node:fs');
            const path = require('node:path');

            try {
                const chunkLength = 1000000;
                const fileSize = fs.statSync(fileName).size;

                if (fileSize) {
                    const onlyFileName = fileName.split('/').pop();
                    const dbxPth = path.join(dir, onlyFileName).replace(/\\/g, '/');

                    const getNextChunkStream = (start, end) => fs.createReadStream(fileName, { start, end });

                    const append = async (sessionId, start, end) => {
                        if (start === fileSize) {
                            log.debug(`${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                            resolve('done');
                            return await this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                        }

                        if (end > fileSize) {
                            end = fileSize - 1;
                            log.debug(`${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                            return await this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, fileSize - 1)
                                .then(async () => {
                                    log.debug(`${Math.round((end / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                                    resolve('done');
                                    return await this.sessionFinish(sessionId, dbx, log, dbxPth, fileSize);
                                });
                        }

                        log.debug(`${Math.round((start / fileSize) * 100)}% uploaded from ${onlyFileName}...`);
                        await this.sessionAppend(sessionId, dbx, getNextChunkStream, log, start, end)
                            .then(async () => {
                                append(sessionId, end + 1, end + chunkLength);
                            });
                    }

                    const sessionId = await this.sessionStart(dbx, log);
                    if (sessionId) {
                        append(sessionId, 0, chunkLength - 1);
                    }
                } else {
                    reject('Error Session Upload');
                }
            } catch (err) {
                reject(`Error Session Upload: ${JSON.stringify(err)}`);
            }
        });
    }

    sessionStart(dbx, log) {
        return new Promise(async (resolve, reject) => {
            dbx({
                resource: 'files/upload_session/start',
                parameters: {
                    close: false
                },
            }, async (err, result) => {
                if (err) {
                    log.error(`sessionStart error: ${JSON.stringify(err)}`);
                    reject(err);
                }
                if (result && result.session_id) {
                    resolve(result.session_id);
                } else {
                    reject();
                }
            });
        });
    }

    sessionAppend(sessionId, dbx, getNextChunkStream, log, start, end) {
        return new Promise(async (resolve, reject) => {
            dbx({
                resource: 'files/upload_session/append_v2',
                parameters: {
                    cursor: {
                        session_id: sessionId,
                        offset: start
                    },
                    close: false,
                },
                readStream: getNextChunkStream(start, end)
            }, async (err) => {
                if (err) {
                    log.error(); (`sessionAppend error: ${JSON.stringify(err)}`);
                    reject(err);
                }
                resolve();
            });
        });
    }

    sessionFinish(sessionId, dbx, log, dbxPth, fileSize) {
        return new Promise(async (resolve, reject) => {
            dbx({
                resource: 'files/upload_session/finish',
                parameters: {
                    cursor: {
                        session_id: sessionId,
                        offset: fileSize
                    },
                    commit: {
                        path: dbxPth,
                        mode: 'add',
                        autorename: true,
                        mute: false
                    }
                }
            }, (err) => {
                if (err) {
                    log.error(`sessionFinish error: ${JSON.stringify(err)}`);
                    reject(err);
                }
            });
            resolve();
        });
    }
}

module.exports = DropBox;
