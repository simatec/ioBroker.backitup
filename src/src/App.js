import React from 'react';
import { withStyles } from '@mui/styles';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    Card, CardContent, Button, TextField, MenuItem,
} from '@mui/material';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader, AdminConnection } from '@iobroker/adapter-react-v5';
import {
    CloudUpload, FormatListBulleted, Search, SettingsBackupRestore, Upload,
} from '@mui/icons-material';
import BackupHistory from './Components/BackupHistory';
import GetBackups from './Components/GetBackups';
import UploadBackup from './Components/UploadBackup';

const styles = theme => ({
    root: {},
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto',
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto',
    },
    selected: {
        color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
    },
    indicator: {
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
    },
});

class App extends GenericApp {
    constructor(props) {
        const extendedProps = { ...props };
        extendedProps.encryptedFields = ['pass'];
        extendedProps.Connection = AdminConnection;
        extendedProps.translations = {
            en: require('./i18n/en'),
            de: require('./i18n/de'),
            ru: require('./i18n/ru'),
            pt: require('./i18n/pt'),
            nl: require('./i18n/nl'),
            fr: require('./i18n/fr'),
            it: require('./i18n/it'),
            es: require('./i18n/es'),
            pl: require('./i18n/pl'),
            uk: require('./i18n/uk'),
            'zh-cn': require('./i18n/zh-cn'),
        };

        extendedProps.sentryDSN = window.sentryDSN;
        // extendedProps.socket = {
        //     protocol: 'http:',
        //     host: '192.168.178.45',
        //     port: 8081,
        // };

        super(props, extendedProps);

        this.state.showBackupHistory = false;
        this.state.showGetBackups = false;
        this.state.showUploadBackup = false;
        this.state.backupSource = 'local';
    }

    onConnectionReady() {
        if (this.state.native.minimalEnabled) {
            this.socket.getState(`${this.adapterName}.${this.instance}.history.iobrokerLastTime`)
                .then(state => {
                    this.setState({ iobrokerLastTime: state.val });
                });
            this.socket.getState(`${this.adapterName}.${this.instance}.info.iobrokerNextTime`)
                .then(state => {
                    this.setState({ iobrokerNextTime: state.val });
                });
        }
        if (this.state.native.ccuEnabled) {
            this.socket.getState(`${this.adapterName}.${this.instance}.history.ccuLastTime`)
                .then(state => {
                    this.setState({ ccuLastTime: state.val });
                });
            this.socket.getState(`${this.adapterName}.${this.instance}.info.ccuNextTime`)
                .then(state => {
                    this.setState({ ccuNextTime: state.val });
                });
        }
    }

    renderBackupInformation() {
        return <Card>
            <CardContent>
                <h4>
                    {I18n.t('Backup information')}
                </h4>
                <ul>
                    {this.state.native.minimalEnabled &&
                <li>
                    <div>{I18n.t('Last iobroker Backup:')}</div>
                    <div>{this.state.iobrokerLastTime}</div>
                </li>}
                    {this.state.native.ccuEnabled &&
                <li>
                    <div>{I18n.t('Last CCU Backup:')}</div>
                    <div>{this.state.ccuLastTime}</div>
                </li>}
                    {this.state.native.minimalEnabled &&
                <li>
                    <div>{I18n.t('Next iobroker Backup:')}</div>
                    <div>{this.state.iobrokerNextTime}</div>
                </li>}
                    {this.state.native.ccuEnabled &&
                <li>
                    <div>{I18n.t('Next CCU Backup:')}</div>
                    <div>{this.state.ccuNextTime}</div>
                </li>}
                </ul>
            </CardContent>
        </Card>;
    }

    renderActivatedStorageOptions() {
        const options = [
            { name: 'cifsEnabled', label: `NAS (${this.state.native.connectType})` },
            { name: 'ftpEnabled', label: 'FTP' },
            { name: 'dropboxEnabled', label: 'Dropbox' },
            { name: 'onedriveEnabled', label: 'Onedrive' },
            { name: 'googledriveEnabled', label: 'Google Drive' },
            { name: 'webdavEnabled', label: 'WebDAV' },
        ];
        return <Card>
            <CardContent>
                <h4>
                    {I18n.t('Activated storageoptions')}
                </h4>
                <ul>
                    {options.map(option => this.state.native[option.name] && <li key={option.name}>{I18n.t(option.label)}</li>)}
                </ul>
            </CardContent>
        </Card>;
    }

    renderActivatedBackupOptions() {
        const options = [
            { name: 'jarvisEnabled', label: 'Jarvis Backup' },
            { name: 'minimalEnabled', label: 'ioBroker' },
            { name: 'ccuEnabled', label: 'Homematic CCU backup' },
            { name: 'redisEnabled', label: 'Save Redis state' },
            { name: 'javascriptsEnabled', label: 'Javascripts Backup' },
            { name: 'zigbeeEnabled', label: 'Save Zigbee database' },
            { name: 'esphomeEnabled', label: 'ESPHome' },
            { name: 'zigbee2mqttEnabled', label: 'Zigbee2MQTT' },
            { name: 'noderedEnabled', label: 'Node-Red Backup' },
            { name: 'yahkaEnabled', label: 'Yahka (Homekit) Backup' },
            { name: 'historyEnabled', label: 'Save History Data' },
            { name: 'influxDBEnabled', label: 'InfluxDB Backup' },
            { name: 'mySqlEnabled', label: 'MySql Backup' },
            { name: 'sqliteEnabled', label: 'sqlite3 Backup' },
            { name: 'grafanaEnabled', label: 'Grafana Backup' },
        ];
        return <Card>
            <CardContent>
                <h4>
                    {I18n.t('Activated backupoptions')}
                </h4>
                <ul>
                    {options.map(option => this.state.native[option.name] && <li key={option.name}>{I18n.t(option.label)}</li>)}
                </ul>
            </CardContent>
        </Card>;
    }

    render() {
        if (!this.state.loaded) {
            return <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <Loader theme={this.state.themeType} />
                </ThemeProvider>
            </StyledEngineProvider>;
        }
        const options = [
            { label: 'Local', value: 'local' },
            { name: 'cifsEnabled', label: `NAS (${this.state.native.connectType})`, value: 'cifs' },
            { name: 'ftpEnabled', label: 'FTP', value: 'ftp' },
            { name: 'dropboxEnabled', label: 'Dropbox', value: 'dropbox' },
            { name: 'onedriveEnabled', label: 'Onedrive', value: 'onedrive' },
            { name: 'googledriveEnabled', label: 'Google Drive', value: 'googledrive' },
            { name: 'webdavEnabled', label: 'WebDAV', value: 'webdav' },
        ];

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <div className="App" style={{ background: this.state.theme.palette.background.default, color: this.state.theme.palette.text.primary }}>
                    <h4>
                        {I18n.t('Backup information')}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        {this.renderBackupInformation()}
                        {this.renderActivatedStorageOptions()}
                        {this.renderActivatedBackupOptions()}
                    </div>
                    <h4>
                        {I18n.t('System backup')}
                    </h4>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        gap: 12,
                        justifyItems: 'center',
                    }}
                    >
                        <div>
                            <Button
                                variant="contained"
                                color="grey"
                                endIcon={<CloudUpload />}
                            >
                                {I18n.t('Iobroker start backup')}
                            </Button>
                        </div>
                        <div>
                            <Button
                                variant="contained"
                                color="grey"
                                endIcon={<CloudUpload />}
                            >
                                {I18n.t('Homematic start backup')}
                            </Button>
                        </div>
                        <div>
                            <Button
                                onClick={() => this.setState({ showBackupHistory: true })}
                                variant="contained"
                                color="grey"
                                endIcon={<FormatListBulleted />}
                            >
                                {I18n.t('Backup history')}
                            </Button>
                        </div>
                        <div>
                            <Button
                                variant="contained"
                                color="grey"
                                endIcon={<CloudUpload />}
                            >
                                {I18n.t('Save backitup settings')}
                            </Button>
                        </div>
                    </div>
                    <h4>
                        {I18n.t('Restore')}
                    </h4>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        gap: 12,
                        justifyItems: 'center',
                    }}
                    >
                        <div style={{ width: '100%' }}>
                            <TextField
                                select
                                label={I18n.t('Backup source')}
                                variant="standard"
                                fullWidth
                                value={this.state.backupSource}
                                onChange={e => this.setState({ backupSource: e.target.value })}
                            >
                                {options.map(option =>
                                    (!option.name || this.state.native[option.name] ?
                                        <MenuItem key={option.value} value={option.value}>{I18n.t(option.label)}</MenuItem> :
                                        null))}
                            </TextField>
                        </div>
                        <div>
                            <Button
                                onClick={() => this.setState({ showGetBackups: true })}
                                variant="contained"
                                color="grey"
                                endIcon={<Search />}
                            >
                                {I18n.t('Get backups')}
                            </Button>
                        </div>
                        <div>
                            <Button
                                onClick={() => this.setState({ showUploadBackup: true })}
                                variant="contained"
                                color="grey"
                                endIcon={<Upload />}
                            >
                                {I18n.t('Upload backup file')}
                            </Button>
                        </div>
                        <div>
                            <Button
                                variant="contained"
                                color="grey"
                                endIcon={<SettingsBackupRestore />}
                            >
                                {I18n.t('Restore backitup settings')}
                            </Button>
                        </div>
                    </div>
                    {this.renderError()}
                </div>
                <BackupHistory
                    open={this.state.showBackupHistory}
                    onClose={() => this.setState({ showBackupHistory: false })}
                    socket={this.socket}
                    adapterName={this.adapterName}
                    instance={this.instance}
                />
                <GetBackups
                    open={this.state.showGetBackups}
                    onClose={() => this.setState({ showGetBackups: false })}
                    socket={this.socket}
                    adapterName={this.adapterName}
                    instance={this.instance}
                    backupSource={this.state.backupSource}
                />
                <UploadBackup
                    open={this.state.showUploadBackup}
                    onClose={() => this.setState({ showUploadBackup: false })}
                    socket={this.socket}
                    adapterName={this.adapterName}
                    instance={this.instance}
                />
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
