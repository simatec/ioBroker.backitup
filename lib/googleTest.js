"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const googleDriveLib_1 = __importDefault(require("./googleDriveLib"));
const token = JSON.parse((0, node_fs_1.readFileSync)('./test.json').toString());
const gDrive = new googleDriveLib_1.default(token);
gDrive
    .createFolder('/iobroker-backup/broker/one')
    .then(id => console.log(`ID=${id}`))
    .catch(() => console.log('Error Google Drive createFolder'));
//# sourceMappingURL=googleTest.js.map