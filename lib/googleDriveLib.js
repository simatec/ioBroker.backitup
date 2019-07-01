'use strict';
const google = require('googleapis');
const {OAuth2Client} = require('google-auth-library');
const fs = require('fs');

const CLIENT_ID = '744690117388-fput3i99t9kv5qbc6lr9kkbe2phqvps9.apps.googleusercontent.com';
const CLIENT_SECRET = 'upvS4pYimFGfUlBESBVFH8Co';
const REDIRECT_URL = ['urn:ietf:wg:oauth:2.0:oob'];
const SCOPES = [
    'https://www.googleapis.com/auth/drive'
];

let oAuth2Client;
let drive;

function authorize(accessJson) {
    // create an oAuth client to authorize the API call
    oAuth2Client = oAuth2Client || new OAuth2Client(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URL
    );

    if (accessJson) {
        try {
            if (typeof accessJson !== 'object') {
                accessJson = JSON.parse(accessJson);
            }
            oAuth2Client.setCredentials(accessJson);
        } catch (err) {
            return null;
        }
    }

    return oAuth2Client;
}

function getAuthorizeUrl() {
    return authorize().generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES.join(' ')
    });
}

function getToken(code) {
    return new Promise((resolve, reject) => {
        authorize().getToken(code, (err, token) => {
            if (err) {
                reject(err);
            } else {
                oAuth2Client.setCredentials(token);
                resolve(token);
            }
        });
    });
}

function getDrive() {
    drive = drive || new google.drive_v3.Drive({
        version: 'v3',
        auth: oAuth2Client
    });
    return drive;
}

function createFolder(path) {
    const fileMetadata = {
        'name': path,
        'mimeType': 'application/vnd.google-apps.folder'
    };

    return new Promise((resolve, reject) => {
        getFileOrFolderId(path)
            .then(id => {
                if (id) {
                    resolve(id);
                } else {
                    getDrive().files.create({
                        resource: fileMetadata,
                        fields: 'id'
                    }, (err, file) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(file.data.id);
                        }
                    });
                }
            });

    });
}

function writeFile(folderId, fileName, data) {
    const fileMetadata = {
        name: fileName,
        parents: [folderId]
    };
    const media = {
        mimeType: 'image/jpeg',
        body: data
    };

    return new Promise((resolve, reject) => {
        getDrive().files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        }, (err, file) => {
            if (err) {
                // Handle error
                reject(err);
            } else {
                resolve(file.id);
            }
        });
    });
}

function deleteFile(folderId, fileName) {
    return new Promise((resolve, reject) => {
        getFileOrFolderId(fileName, folderId)
            .then(fileId => {
                getDrive().files.delete(fileId, (err, file) => {
                    if (err) {
                        // Handle error
                        reject(err);
                    } else {
                        resolve();
                    }
                })
            });
    });
}

function getFileOrFolderId(path, folderId) {
    return new Promise((resolve, reject) => {
        const q = folderId ? `"${folderId}" in parents and name="${path}" and trashed=false` : `name="${path}" and trashed=false`;
        getDrive().files.list({
            q,
            fields: 'files(id)',
            spaces: 'drive',
            pageToken: null
        }, (err, res) => {
            if (err) {
                // Handle error
                reject(err);
            } else {
                resolve(res.data.files[0] ? res.data.files[0].id : null);
            }
        });
    });
}

function _listFilesInFolder(folderId, cb, pageToken, _list) {
    pageToken = pageToken || null;
    _list = _list || [];
    getDrive().files.list({
        q: `"${folderId}" in parents and trashed=false`,
        fields: 'nextPageToken, files(name, id)',
        spaces: 'drive',
        pageToken: pageToken
    }, (err, res) => {
        if (err) {
            // Handle error
            cb(err);
        } else {
            res.files.forEach(file => _list.push(file));

            if (res.nextPageToken) {
                setTimeout(_listFilesInFolder, 50, folderId, cb, res.nextPageToken, _list);
            } else {
                cb(null, _list);
            }
        }
    });
}

function listFilesInFolder(folderId) {
    return new Promise((resolve, reject) => {
        _listFilesInFolder(folderId, (err, list) =>
            err ? reject(err) : resolve(list));
    });
}

function readFile(fileId, localFileName) {
    return new Promise((resolve, reject) => {
        let dest;
        try {
            dest = fs.createWriteStream(localFileName);
        } catch (e) {
            return reject(e);
        }

        drive.files.get({
            fileId,
            alt: 'media'
        })
            .on('end', () => resolve())
            .on('error', err => reject(err))
            .pipe(dest);
    });
}

if (module.parent) {
    module.exports = {
        authorize,
        getToken,
        getAuthorizeUrl,
        listFilesInFolder,
        getFileOrFolderId,
        readFile,
        writeFile,
        createFolder,
        deleteFile
    };
} else {
    const token = require('./test');
    authorize(token);
    createFolder('iobroker-backup')
        .then(id => {
            console.log('ID=' + id)
        });



    //console.log(getAuthorizeUrl());
    //getToken('4/eQHu2S90U-bA3AfjZ0QNxi8pVjRgpuDEn0wn8JnBF70ZBnleVFh_zVw').then(json => console.log(JSON.stringify(json)));
}
