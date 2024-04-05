import React from 'react';
import { withStyles } from '@mui/styles';
import { saveAs } from 'file-saver';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    Card, CardContent, Button, TextField, MenuItem, AppBar, Toolbar,
} from '@mui/material';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader, AdminConnection } from '@iobroker/adapter-react-v5';
import {
    CloudUpload, FormatListBulleted, Info, Search, SettingsBackupRestore, Upload, Storage
} from '@mui/icons-material';

import logo from './assets/backitup.png';

import BackupHistory from './Components/BackupHistory';
import GetBackups from './Components/GetBackups';
import UploadBackup from './Components/UploadBackup';
import UploadSettings from "./Components/UploadSettings";

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
    header: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.palette.secondary.main,
        padding: '2px 16px',
        borderRadius: 4,
    },
    subHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    icon: {
        height: 64,
        width: 64,
        margin: 4,
    },
    iconDiv: {
        display: 'inline-block',
        backgroundColor: theme.palette.primary.main,
        height: '100%',
        marginRight: 8,
        verticalAlign: 'top',
    },
    textDiv: {
        width: 'calc(100% - 80px)',
        display: 'inline-block',
    },
    cardContent: {
        height: 'calc(100% - 32px)',
    },
    label: {
        fontWeight: 'bold',
    },
    value: {
        marginLeft: 8,
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
        this.state.alive = false;
    }

    async onConnectionReady() {
        const alive = await this.socket.getState(`system.adapter.${this.adapterName}.${this.instance}.alive`);
        const newState = { alive: !!alive?.val };

        if (this.state.native.minimalEnabled) {
            const iobrokerLastTime = await this.socket.getState(`${this.adapterName}.${this.instance}.history.iobrokerLastTime`);
            const iobrokerNextTime = await this.socket.getState(`${this.adapterName}.${this.instance}.info.iobrokerNextTime`);
            newState.iobrokerNextTime = iobrokerNextTime.val;
            newState.iobrokerLastTime = iobrokerLastTime.val;
        }

        if (this.state.native.ccuEnabled) {
            const ccuLastTime = await this.socket.getState(`${this.adapterName}.${this.instance}.history.ccuLastTime`);
            const ccuNextTime = await this.socket.getState(`${this.adapterName}.${this.instance}.info.ccuNextTime`);
            newState.iobrokerNextTime = ccuLastTime.val;
            newState.iobrokerLastTime = ccuNextTime.val;
        }

        await this.socket.subscribeState(`system.adapter.${this.adapterName}.${this.instance}.alive`, this.onAlive);

        this.setState(newState);
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        this.socket.unsubscribeState(`system.adapter.${this.adapterName}.${this.instance}.alive`, this.onAlive);
    }

    onAlive = (id, state) => {
        if (id === `system.adapter.${this.adapterName}.${this.instance}.alive`) {
            if (!!state?.val !== this.state.alive) {
                this.setState({ alive: !!state?.val });
            }
        }
    }

    renderBackupInformation() {
        return <Card>
            <CardContent className={this.props.classes.cardContent}>
                <div className={this.props.classes.iconDiv}>
                    <Info className={this.props.classes.icon} />
                </div>
                <div className={this.props.classes.textDiv}>
                    <div className={this.props.classes.subHeader}>
                        {I18n.t('Backup information')}
                    </div>
                    <ul>
                        {this.state.native.minimalEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Last iobroker Backup:')}</span>
                            <span className={this.props.classes.value}>{this.state.iobrokerLastTime}</span>
                        </li>}
                        {this.state.native.ccuEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Last CCU Backup:')}</span>
                            <span className={this.props.classes.value}>{this.state.ccuLastTime}</span>
                        </li>}
                        {this.state.native.minimalEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Next iobroker Backup:')}</span>
                            <span className={this.props.classes.value}>{this.state.iobrokerNextTime}</span>
                        </li>}
                        {this.state.native.ccuEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Next CCU Backup:')}</span>
                            <span className={this.props.classes.value}>{this.state.ccuNextTime}</span>
                        </li>}
                    </ul>
                </div>
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
            <CardContent className={this.props.classes.cardContent}>
                <div className={this.props.classes.iconDiv}>
                    <Storage className={this.props.classes.icon} />
                </div>
                <div className={this.props.classes.textDiv}>
                    <div className={this.props.classes.subHeader}>
                        {I18n.t('Activated storage options')}
                    </div>
                    <ul>
                        {options.map(option => this.state.native[option.name] && <li key={option.name}>{I18n.t(option.label)}</li>)}
                    </ul>
                </div>
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
            <CardContent className={this.props.classes.cardContent}>
                <div className={this.props.classes.iconDiv}>
                    <CloudUpload className={this.props.classes.icon} />
                </div>
                <div className={this.props.classes.textDiv}>
                    <div className={this.props.classes.subHeader}>
                        {I18n.t('Activated backup options')}
                    </div>
                    <ul style={{maxHeight: 150, overflow: 'auto'}}>
                        {options.map(option => this.state.native[option.name] &&
                            <li key={option.name}>{I18n.t(option.label)}</li>)}
                    </ul>
                </div>
            </CardContent>
        </Card>;
    }

    renderUploadSettingsDialog() {
        if (!this.state.showUploadSettings) {
            return null;
        }
        return <UploadSettings
            onClose={() => this.setState({ showUploadSettings: false })}
            socket={this.socket}
            themeType={this.state.themeType}
            adapterName={this.adapterName}
            instance={this.instance}
        />
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
                <div className="App" style={{
                    background: this.state.theme.palette.background.default,
                    color: this.state.theme.palette.text.primary
                }}>
                    <AppBar color="primary" position="static" enableColorOnDark>
                        <Toolbar>
                            <img src={logo} alt="logo" style={{height: 48, marginRight: 16}}/>
                            <div>
                                <div style={{fontWeight: 'bold', fontSize: 20}}>BackItUp</div>
                                <div>{I18n.t('Backup your System')}</div>
                            </div>
                        </Toolbar>
                    </AppBar>
                    <div style={{
                        width: 'calc(100% - 16px)',
                        height: 'calc(100% - 64px - 16px)',
                        overflow: 'auto',
                        padding: 8
                    }}>
                        <div className={this.props.classes.header}>
                            {I18n.t('Backup information')}
                        </div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12}}>
                            {this.renderBackupInformation()}
                            {this.renderActivatedStorageOptions()}
                            {this.renderActivatedBackupOptions()}
                        </div>
                        <div className={this.props.classes.header} style={{marginTop: 10}}>
                            {I18n.t('System backup')}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr 1fr',
                            gap: 12,
                            justifyItems: 'center',
                        }}
                        >
                            <Button
                                variant="contained"
                                color="grey"
                                disabled={!this.state.alive}
                                endIcon={<CloudUpload/>}
                                onClick={() => {

                                }}
                            >
                                {I18n.t('Iobroker start backup')}
                            </Button>
                            <Button
                                variant="contained"
                                color="grey"
                                disabled={!this.state.alive}
                                endIcon={<CloudUpload/>}
                            >
                                {I18n.t('Homematic start backup')}
                            </Button>
                            <Button
                                onClick={() => this.setState({ showBackupHistory: true })}
                                variant="contained"
                                color="grey"
                                endIcon={<FormatListBulleted/>}
                            >
                                {I18n.t('Backup history')}
                            </Button>
                            <Button
                                variant="contained"
                                color="grey"
                                onClick={() => {
                                    const obj = this.socket.getObject(`system.adapter.${this.adapterName}.${this.instance}`);
                                    const blob = new Blob([JSON.stringify(obj.native)], { type: 'application/json;charset=utf-8' });
                                    const now = new Date();
                                    saveAs(blob, `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}-${this.adapterName}.${this.instance}.json`);
                                }}
                                endIcon={<CloudUpload/>}
                            >
                                {I18n.t('Save BackItUp settings')}
                            </Button>
                        </div>
                        <div className={this.props.classes.header} style={{marginTop: 10}}>
                            {I18n.t('Restore')}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr 1fr',
                            gap: 12,
                            justifyItems: 'center',
                        }}
                        >
                            <div style={{width: '100%'}}>
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
                                            <MenuItem key={option.value}
                                                      value={option.value}>{I18n.t(option.label)}</MenuItem> :
                                            null))}
                                </TextField>
                            </div>
                            <Button
                                onClick={() => this.setState({showGetBackups: true})}
                                disabled={!this.state.alive}
                                variant="contained"
                                color="grey"
                                endIcon={<Search/>}
                            >
                                {I18n.t('Get backups')}
                            </Button>
                            <Button
                                onClick={() => this.setState({ showUploadBackup: true })}
                                variant="contained"
                                color="grey"
                                endIcon={<Upload/>}
                            >
                                {I18n.t('Upload backup file')}
                            </Button>
                            <Button
                                variant="contained"
                                color="grey"
                                onClick={() => this.setState({ showUploadSettings: true })}
                                endIcon={<SettingsBackupRestore />}
                            >
                                {I18n.t('Restore BackItUp settings')}
                            </Button>
                        </div>
                        {this.renderError()}
                        <div style={{ fontWeight: 'bold', width: '100%', textAlign: 'center', marginTop: 8 }}>
                            {I18n.t('All backup settings can be changed in the adapter configuration of BackItUp.')}
                        </div>
                    </div>
                </div>
                {this.state.showBackupHistory ? <BackupHistory
                    onClose={() => this.setState({ showBackupHistory: false })}
                    socket={this.socket}
                    themeType={this.state.themeType}
                    adapterName={this.adapterName}
                    instance={this.instance}
                /> : null}
                {this.state.showGetBackups ? <GetBackups
                    onClose={() => this.setState({ showGetBackups: false })}
                    socket={this.socket}
                    themeType={this.state.themeType}
                    adapterName={this.adapterName}
                    instance={this.instance}
                    backupSource={this.state.backupSource}
                /> : null}
                {this.state.showUploadBackup ? <UploadBackup
                    alive={this.state.alive}
                    onClose={() => this.setState({ showUploadBackup: false })}
                    socket={this.socket}
                    themeType={this.state.themeType}
                    adapterName={this.adapterName}
                    instance={this.instance}
                /> : null}
                {this.renderUploadSettingsDialog()}
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
