// width = 100% for Button BackupNow not working :(
import React from 'react';
import { withStyles } from '@mui/styles';
import { saveAs } from 'file-saver';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    Card, CardContent, Button, MenuItem,
    AppBar, Toolbar, FormControl,
    InputLabel, Select,
} from '@mui/material';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader, AdminConnection } from '@iobroker/adapter-react-v5';
import {
    CloudUpload, FormatListBulleted,
    Info, Search, SettingsBackupRestore,
    Upload, Storage,
} from '@mui/icons-material';

import logo from './assets/backitup.png';

import BackupHistory from './Components/BackupHistory';
import GetBackups from './Components/GetBackups';
import UploadBackup from './Components/UploadBackup';
import UploadSettings from './Components/UploadSettings';
import BackupNow from './Components/BackupNow';

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
    headerArea: {
        backgroundImage: 'linear-gradient(135deg, #174475 0%, #3399CC 30%)',
        boxShadow: '0 3px 3px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2)',
    },
    header: {
        fontSize: '0.9rem',
        fontWeight: 400,
        lineHeight: '110%',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: theme.palette.secondary.main,
        padding: '0.3rem',
        borderRadius: 4,
        color: '#FFF !important',
        backgroundImage: 'linear-gradient(179deg, #3399CC 0%, #174475 60%) !important',
        boxShadow: '0 3px 3px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2)',
    },
    subHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#FFF !important',
    },
    cardHeader: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginBottom: 8,
        padding: '16px',
    },
    headerIcon: {
        height: 24,
        width: 24,
        fontSize: '24px',
        float: 'left',
        margin: '0 10px 0 5px',
    },
    icon: {
        height: 80,
        width: 100,
        margin: 4,
        marginTop: '1.5rem',
        color: '#3399CC !important',
        fontSize: '80px',
    },
    iconDiv: {
        display: 'inline-block',
        background: '#e2e2e2',
        backgroundImage: 'linear-gradient(179deg, #e2e2e2 40%, #474747 180%)',
        maxWidth: '30%',
        height: '100%',
        marginRight: 8,
        verticalAlign: 'top',
    },
    textDiv: {
        width: 'calc(100% - 120px)',
        display: 'inline-block',
    },
    cardContent: {
        padding: '0px',
        height: '100%',
    },
    label: {
        fontWeight: 'bold',
    },
    value: {
        marginLeft: 8,
    },
    footer: {
        fontSize: '0.8rem',
        fontWeight: 400,
        lineHeight: '110%',
        textAlign: 'center',
        marginTop: 8,
        position: 'fixed',
        bottom: 0,
        width: '100%',
        overflow: 'overlay',
        zIndex: 997,
        backgroundColor: theme.palette.secondary.main,
        backgroundImage: 'linear-gradient(179deg, #3399CC 0%, #174475 60%) !important',
        boxShadow: '0 3px 3px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2)',
        color: '#FFF !important',
        padding: '5px 0 5px 0',
        margin: '0 0 0 -8px',
    },
    buttonWidth: {
        width: '100% !important',
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
        this.state.backupSource = window.localStorage.getItem('BackItUp.backupSource') || 'local';
        this.state.myAlive = false;
    }

    async onConnectionReady() {
        const myAlive = await this.socket.getState(`system.adapter.${this.adapterName}.${this.instance}.alive`);
        const newState = { myAlive: !!myAlive?.val };

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
        await this.socket.subscribeObject(`system.adapter.${this.adapterName}.${this.instance}`, this.onSettings);
        await this.socket.subscribeState(`${this.adapterName}.${this.instance}.history.iobrokerLastTime`, this.onHistory);
        await this.socket.subscribeState(`${this.adapterName}.${this.instance}.info.iobrokerNextTime`, this.onHistory);
        await this.socket.subscribeState(`${this.adapterName}.${this.instance}.history.ccuLastTime`, this.onHistory);
        await this.socket.subscribeState(`${this.adapterName}.${this.instance}.info.ccuNextTime`, this.onHistory);

        this.setState(newState);
    }

    onSettings = (id, obj) => {
        if (id === `system.adapter.${this.adapterName}.${this.instance}`) {
            this.setState({ native: obj.native });
        }
    };

    onHistory = (id, state) => {
        if (id === `${this.adapterName}.${this.instance}.history.iobrokerLastTime` && state.val !== this.state.iobrokerLastTime) {
            this.setState({ iobrokerLastTime: state.val });
        } else if (id === `${this.adapterName}.${this.instance}.history.iobrokerNextTime` && state.val !== this.state.iobrokerNextTime) {
            this.setState({ iobrokerNextTime: state.val });
        } else if (id === `${this.adapterName}.${this.instance}.history.ccuLastTime` && state.val !== this.state.ccuLastTime) {
            this.setState({ ccuLastTime: state.val });
        } else if (id === `${this.adapterName}.${this.instance}.history.ccuNextTime` && state.val !== this.state.ccuNextTime) {
            this.setState({ ccuNextTime: state.val });
        }
    };

    componentWillUnmount() {
        super.componentWillUnmount();
        this.socket.unsubscribeState(`system.adapter.${this.adapterName}.${this.instance}.alive`, this.onAlive);
        this.socket.unsubscribeObject(`system.adapter.${this.adapterName}.${this.instance}`, this.onSettings);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.history.iobrokerLastTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.info.iobrokerNextTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.history.ccuLastTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.info.ccuNextTime`, this.onHistory);
    }

    onAlive = (id, state) => {
        if (id === `system.adapter.${this.adapterName}.${this.instance}.alive`) {
            if (!!state?.val !== this.state.myAlive) {
                this.setState({ myAlive: !!state?.val });
            }
        }
    };

    renderBackupInformation() {
        return <Card>
            <CardContent className={this.props.classes.cardContent}>
                <div className={this.props.classes.iconDiv}>
                    <Info className={this.props.classes.icon} />
                </div>
                <div className={this.props.classes.textDiv}>
                    <div className={this.props.classes.cardHeader}>
                        {I18n.t('Backupinformations')}
                    </div>
                    <ul>
                        {this.state.native.minimalEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Last iobroker Backup: ')}</span><br/>
                            <span className={this.props.classes.value}>{this.state.iobrokerLastTime}</span>
                        </li>}
                        {this.state.native.ccuEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Last CCU Backup: ')}</span><br/>
                            <span className={this.props.classes.value}>{this.state.ccuLastTime}</span>
                        </li>}
                        {this.state.native.minimalEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Next iobroker Backup: ')}</span><br/>
                            <span className={this.props.classes.value}>{this.state.iobrokerNextTime}</span>
                        </li>}
                        {this.state.native.ccuEnabled && <li>
                            <span className={this.props.classes.label}>{I18n.t('Next CCU Backup: ')}</span><br/>
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
                    <div className={this.props.classes.cardHeader}>
                        {I18n.t('activated storageoptions')}
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
                    <div className={this.props.classes.cardHeader}>
                        {I18n.t('activated backupoptions')}
                    </div>
                    <ul style={{ maxHeight: 150, overflow: 'auto' }}>
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
        />;
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
                <div
                    className="App"
                    style={{
                        background: this.state.theme.palette.background.default,
                        color: this.state.theme.palette.text.primary,
                    }}
                >
                    <AppBar className={this.props.classes.headerArea} position="static" enableColorOnDark>
                        <Toolbar>
                            <img src={logo} alt="logo" style={{ height: 48, marginRight: 16 }} />
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: 20, color: '#fff' }}>Backitup</div>
                                <div style={{ color: '#fff' }}>{I18n.t('Backup your System …')}</div>
                            </div>
                        </Toolbar>
                    </AppBar>
                    <div
                        style={{
                            width: 'calc(100% - 16px)',
                            height: 'calc(100% - 64px - 16px)',
                            overflow: 'auto',
                            padding: 8,
                        }}
                    >
                        <div className={this.props.classes.header} style={{ margin: '0.2rem 0 1.0rem 0' }}>
                            <Info className={this.props.classes.headerIcon}/><span>{I18n.t('Backupinformations')}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, height: '300px' }}>
                            {this.renderBackupInformation()}
                            {this.renderActivatedStorageOptions()}
                            {this.renderActivatedBackupOptions()}
                        </div>
                        <div className={this.props.classes.header} style={{ margin: '1rem 0 1rem 0' }}>
                            <CloudUpload className={this.props.classes.headerIcon}/><span>{I18n.t('System backup')}</span>
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                                gap: 12,
                                justifyContent: 'space-evenly',
                                alignContent: 'center',
                                justifyItems: 'stretch',
                                alignItems: 'stretch',
                            }}
                        >
                            {this.state.myAlive && this.state.native.minimalEnabled ? <BackupNow
                                className={this.props.classes.buttonWidth}
                                style={{ width: '100%' }}
                                variant="contained"
                                color="grey"
                                adapterName={this.adapterName}
                                instance={this.instance}
                                alive
                                socket={this.socket}
                                themeType={this.state.themeType}
                                endIcon={<CloudUpload />}
                                schema={{
                                    backUpType: 'iobroker',
                                    label: 'iobroker start backup',
                                }}
                            /> : <Button
                                    style={{ width: '100%' }}
                                    disabled
                                    color="grey"
                                    variant="contained"
                                    endIcon={<CloudUpload />}
                                >
                                    {I18n.t('iobroker start backup')}
                                </Button>}
                            {this.state.myAlive && this.state.native.ccuEnabled ? <BackupNow
                                className={this.props.classes.buttonWidth}
                                style={{ width: '100% !important' }}
                                variant="contained"
                                adapterName={this.adapterName}
                                instance={this.instance}
                                color="grey"
                                alive
                                socket={this.socket}
                                themeType={this.state.themeType}
                                endIcon={<CloudUpload />}
                                schema={{
                                    backUpType: 'ccu',
                                    label: 'Homematic start backup',
                                }}
                            /> : <Button
                                style={{ width: '100%' }}
                                disabled
                                color="grey"
                                variant="contained"
                                endIcon={<CloudUpload />}
                            >
                                {I18n.t('Homematic start backup')}
                            </Button>}
                            <Button
                                style={{ width: '100%' }}
                                onClick={() => this.setState({ showBackupHistory: true })}
                                variant="contained"
                                color="grey"
                                endIcon={<FormatListBulleted />}
                            >
                                {I18n.t('Backup history')}
                            </Button>
                            <Button
                                style={{ width: '100%' }}
                                variant="contained"
                                color="grey"
                                onClick={async() => {
                                    let obj = await this.socket.getObject(`system.adapter.${this.adapterName}.${this.instance}`);
                                    
                                    if (obj && obj.common && obj.common.news) {
                                        delete obj.common.news;
                                    }
                                    if (obj && obj.common && obj.common.titleLang) {
                                        delete obj.common.titleLang;
                                    }
                                    if (obj && obj.common && obj.common.desc) {
                                        delete obj.common.desc;
            }
                                    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json;charset=utf-8' });
                                    const now = new Date();
                                    saveAs(blob, `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}-${this.adapterName}.${this.instance}.json`);
                                }}
                                endIcon={<CloudUpload />}
                            >
                                {I18n.t('save Backitup settings')}
                            </Button>
                        </div>
                        <div className={this.props.classes.header} style={{ margin: '1rem 0 1rem 0' }}>
                            <SettingsBackupRestore className={this.props.classes.headerIcon}/><span>{I18n.t('Restore')}</span>
                        </div>
                        <div style={{
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr 1fr',
                            gap: 12,
                            justifyItems: 'stretch',
                            justifyContent: 'space-evenly',
                            alignContent: 'center',
                            alignItems: 'stretch',
                        }}
                        >
                            <FormControl fullWidth variant="standard" style={{ height: 32, marginTop: 6, width: '100%' }}>
                                <InputLabel>{I18n.t('source type')}</InputLabel>
                                <Select
                                    variant="standard"
                                    value={this.state.backupSource}
                                    onChange={e => {
                                        window.localStorage.setItem('BackItUp.backupSource', e.target.value);
                                        this.setState({ backupSource: e.target.value });
                                    }}
                                >
                                    {options.map(option =>
                                        (!option.name || this.state.native[option.name] ? <MenuItem key={option.value} value={option.value}>
                                            {I18n.t(option.label)}
                                        </MenuItem> : null))}
                                </Select>
                            </FormControl>
                            <Button
                                style={{ marginTop: 16, width: '100%' }}
                                onClick={() => this.setState({ showGetBackups: true })}
                                disabled={!this.state.myAlive}
                                variant="contained"
                                color="grey"
                                endIcon={<Search />}
                            >
                                {I18n.t('Get list')}
                            </Button>
                            <Button
                                style={{ marginTop: 16, width: '100%' }}
                                onClick={() => this.setState({ showUploadBackup: true })}
                                variant="contained"
                                color="grey"
                                endIcon={<Upload />}
                            >
                                {I18n.t('Upload Backup File')}
                            </Button>
                            <Button
                                style={{ marginTop: 16, width: '100%' }}
                                variant="contained"
                                color="grey"
                                onClick={() => this.setState({ showUploadSettings: true })}
                                endIcon={<SettingsBackupRestore />}
                            >
                                {I18n.t('restore Backitup settings')}
                            </Button>
                        </div>
                        {this.renderError()}
                        <div
                            className={this.props.classes.footer}
                        >
                            {I18n.t('All backup settings can be changed in the adapter configuration of Backitup.')}
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
                    alive={this.state.myAlive}
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
