import { readFileSync } from 'node:fs';
import GoogleDrive from './googleDriveLib';
import type { Credentials } from 'google-auth-library/build/src/auth/credentials';

const token: Credentials = JSON.parse(readFileSync('./test.json').toString());

const gDrive = new GoogleDrive(token);

gDrive
    .createFolder('/iobroker-backup/broker/one')
    .then(id => console.log(`ID=${id}`))
    .catch(() => console.log('Error Google Drive createFolder'));
