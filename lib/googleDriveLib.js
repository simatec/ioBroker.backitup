'use strict';
// const google = require('googleapis');
const google = require('@googleapis/drive');
const { OAuth2Client } = require('google-auth-library');
const fs = require('node:fs');
const axios = require('axios');

const OAUTH_URL = 'https://googleauth.iobroker.in/googleDriveOAuth';

const NOT_FOUND = 'Not found';

class GoogleDrive {
    constructor(accessJson, newToken) {
        this.oAuth2Client = new OAuth2Client();
        this.newToken = newToken;
        if (accessJson && typeof accessJson !== 'object') {
            if (accessJson[0] === '{') {
                accessJson = JSON.parse(accessJson);
            } else {
                accessJson = JSON.parse(Buffer.from(accessJson, 'base64').toString('utf8'));
            }
        }
        accessJson && this.oAuth2Client.setCredentials(accessJson);
        this.drive = null;
    }

    _authorize() {
        // @ts-ignore
        if (this.oAuth2Client.credentials.access_token && Date.now() > this.oAuth2Client.credentials.expiry_date) {
            let url = OAUTH_URL;
            if (!this.newToken) {
                url = OAUTH_URL.replace('googleDriveOAuth', '');
            }

            return axios.post(url, this.oAuth2Client.credentials, { headers: { 'content-type': 'application/json' } })
                .then(response => {
                    if (response.data) {
                        // BF: TODO - this token should be saved in the state variable and used by the next token request
                        this.oAuth2Client.setCredentials(response.data);
                        return this.oAuth2Client;
                    }
                });
        } else {
            return Promise.resolve(this.oAuth2Client);
        }
    }

    getAuthorizeUrl() {
        return axios(OAUTH_URL)
            .then(response => {
                if (response.data) {
                    return response.data.authURL;
                }
                throw new Error('Cannot get authorize URL');
            });
    }

    _getDrive() {
        this.drive = this.drive || new google.drive_v3.Drive({
            // @ts-ignore
            version: 'v3',
            auth: this.oAuth2Client,
        });

        // update access_token
        return this._authorize()
            .then(client => this.drive)
            .catch(() => console.log('Error Google Drive _getDrive'));
    }

    _createFolder(parts, folderId, callback) {
        if (typeof parts !== 'object') {
            parts = parts.replace(/\\/g, '/').split('/').filter(p => !!p);
        }
        if (!parts.length) {
            callback && callback(NOT_FOUND)
        } else {
            const dir = parts.shift();
            this._getFileOrFolderId([dir], folderId, (err, _folderId) => {
                if (!_folderId) {
                    const fileMetadata = {
                        // eslint-disable-next-line quote-props
                        'name': dir,
                        // eslint-disable-next-line quote-props
                        'mimeType': 'application/vnd.google-apps.folder'
                    };

                    if (folderId) {
                        fileMetadata.parents = [folderId];
                    }

                    this._getDrive().then(drive =>
                        drive.files.create({
                            resource: fileMetadata,
                            fields: 'id'
                        }, (err, file) => {
                            if (err) {
                                callback && callback(err);
                            } else {
                                const __folderId = file.data.id;
                                if (!parts.length || !__folderId) {
                                    callback && callback(null, __folderId);
                                } else {
                                    setTimeout(() => this._createFolder(parts, __folderId, callback), 150);
                                }
                            }
                        })).catch(() => console.log('Error Google Drive _getDrive'));
                } else {
                    if (!parts.length || !_folderId) {
                        callback && callback(null, _folderId);
                    } else {
                        setTimeout(() => this._createFolder(parts, _folderId, callback), 150);
                    }
                }
            });
        }
    }

    createFolder(path) {
        return new Promise((resolve, reject) => {
            this.getFileOrFolderId(path)
                .then(id => {
                    if (id) {
                        resolve(id);
                    } else {
                        this._createFolder(path, null, (err, folderId) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(folderId);
                            }
                        });
                    }
                }).catch(() => console.log('Error Google Drive create folder'));
        });
    }

    writeFile(folderId, fileName, dataStream, log) {
        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };
        const media = {
            mimeType: 'application/gzip',
            body: dataStream,
        };

        return new Promise((resolve, reject) => {
            this._getDrive().then(drive =>
                drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: 'id',
                }, (err, file) => {
                    if (err) {
                        // Handle error
                        reject(err);
                    } else {
                        resolve(file.data.id);
                    }
                })).catch(err => log.warn(`Error Google Drive write file: ${err}`));
        });
    }

    /*
    deleteFile(folderOrFileId, fileName) {
        return new Promise((resolve, reject) => {
            if (folderOrFileId && !fileName) {
                this._getDrive()
                    .then(drive => drive.files.delete({fileId: folderOrFileId}, err => {
                        if (err) {
                            // Handle error
                            reject(err);
                        } else {
                            resolve();
                        }
                    }));
            } else {
                this.getFileOrFolderId(fileName, folderOrFileId)
                    .then(fileId => {
                        this._getDrive()
                            .then(drive => drive.files.delete({fileId}, err => {
                                if (err) {
                                    // Handle error
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            }));
                    });
            }
        });
    }
    */

    async deleteFile(folderOrFileId, fileName) {
        try {
            const drive = await this._getDrive()
            if (folderOrFileId && !fileName) {
                await drive.files.delete({ fileId: folderOrFileId });
            } else {
                const fileId = await this.getFileOrFolderId(fileName, folderOrFileId);
                await drive.files.delete({ fileId });
            }
        } catch (e) {
            console.log(`error delete files on GoogleDrive: ${e}`);
        }
    }

    _getFileOrFolderId(parts, folderId, callback) {
        if (typeof parts === 'string') {
            parts = parts.replace(/\\/g, '/').split('/').filter(part => part);
        }
        if (!parts.length) {
            return callback && callback(NOT_FOUND);
        }
        const dir = parts.shift();
        const q = folderId ? `"${folderId}" in parents and name="${dir}" and trashed=false` : `name="${dir}" and trashed=false`;
        try {
            this._getDrive()
                .then(drive => drive.files.list({
                    q,
                    fields: 'files(id)',
                    spaces: 'drive',
                    pageToken: null
                }, (err, res) => {
                    if (err) {
                        // Handle error
                        callback(err);
                    } else {
                        folderId = res.data.files[0] ? res.data.files[0].id : null;
                        if (!parts.length || !folderId) {
                            callback && callback(!folderId ? NOT_FOUND : null, folderId);
                        } else {
                            setTimeout(() => this._getFileOrFolderId(parts, folderId, callback), 150);
                        }
                    }
                })).catch(() => console.log('Error Google Drive getFileOrFolderId'));
        } catch (e) {
            console.log(`error get File or FolderId on GoogleDrive: ${e}`);
        }
    }

    getFileOrFolderId(path, folderId) {
        return new Promise((resolve, reject) => {
            this._getFileOrFolderId(path, folderId, (err, folderId) => {
                if (err && err !== NOT_FOUND) {
                    reject(err);
                } else {
                    resolve(folderId);
                }
            })
        });
    }

    _listFilesInFolder(folderId, cb, pageToken, _list) {
        pageToken = pageToken || null;
        _list = _list || [];
        this._getDrive()
            .then(drive => drive.files.list({
                q: `"${folderId}" in parents and trashed=false`,
                fields: 'nextPageToken, files(name, id, modifiedTime, size)',
                spaces: 'drive',
                pageToken: pageToken
            }, (err, res) => {
                if (err) {
                    // Handle error
                    cb(err);
                } else {
                    res.data.files.forEach(file => _list.push(file));
                    if (res.nextPageToken) {
                        setTimeout(() => this._listFilesInFolder(folderId, cb, res.nextPageToken, _list), 150);
                    } else {
                        cb(null, _list);
                    }
                }
            })).catch(() => console.log('Error Google Drive _listFilesInFolder'));
    }

    listFilesInFolder(folderId) {
        return new Promise((resolve, reject) =>
            this._listFilesInFolder(folderId, (err, list) => err ? reject(err) : resolve(list)));
    }

    readFile(fileId, localFileName) {
        return new Promise((resolve, reject) => {
            let dest;
            try {
                dest = fs.createWriteStream(localFileName);
                dest.on('error', err => reject(err));
            } catch (e) {
                return reject(e);
            }

            this._getDrive()
                .then(drive =>
                    drive.files.get({
                        fileId,
                        alt: 'media'
                    }, { responseType: 'stream' }, (err, res) => {
                        if (err) {
                            console.error(err);
                            return reject(err);
                        }
                        res.data
                            // @ts-ignore
                            .on('end', () => resolve())
                            .on('error', err => reject(err))
                            .pipe(dest);
                    }))
                .catch(e => {
                    return reject(e);
                });
        });
    }
}

// @ts-ignore
if (module.parent) {
    module.exports = GoogleDrive;
} else {
    // @ts-ignore
    const token = require('./test');
    const gDrive = new GoogleDrive(token);

    gDrive.createFolder('/iobroker-backup/broker/one')
        .then(id => console.log(`ID=${id}`))
        .catch(() => console.log('Error Google Drive createFolder'));
}
