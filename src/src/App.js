import React from 'react';
import { withStyles } from '@mui/styles';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    Card, CardContent, Button,
} from '@mui/material';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader, AdminConnection } from '@iobroker/adapter-react-v5';
import BackupHistory from './Components/BackupHistory';
import GetBackups from './Components/GetBackups';

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
            <div>
                {I18n.t('Backup information')}
            </div>
            <CardContent>
                {this.state.native.minimalEnabled &&
                <div>
                    <div>{I18n.t('Last iobroker Backup:')}</div>
                    <div>{this.state.iobrokerLastTime}</div>
                </div>}
                {this.state.native.ccuEnabled &&
                <div>
                    <div>{I18n.t('Last CCU Backup:')}</div>
                    <div>{this.state.ccuLastTime}</div>
                </div>}
                {this.state.native.minimalEnabled &&
                <div>
                    <div>{I18n.t('Next iobroker Backup:')}</div>
                    <div>{this.state.iobrokerNextTime}</div>
                </div>}
                {this.state.native.ccuEnabled &&
                <div>
                    <div>{I18n.t('Next CCU Backup:')}</div>
                    <div>{this.state.ccuNextTime}</div>
                </div>}
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
                {options.map(option => this.state.native[option.name] && <div key={option.name}>{I18n.t(option.label)}</div>)}
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
                {options.map(option => this.state.native[option.name] && <div key={option.name}>{I18n.t(option.label)}</div>)}
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

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <div className="App" style={{ background: this.state.theme.palette.background.default, color: this.state.theme.palette.text.primary }}>
                    <div className={this.isIFrame ? this.props.classes.tabContentIFrame : this.props.classes.tabContent}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            {this.renderBackupInformation()}
                            {this.renderActivatedStorageOptions()}
                            {this.renderActivatedBackupOptions()}
                        </div>
                        <div>
                            <Button
                                onClick={() => this.setState({ showBackupHistory: true })}
                            >
                                {I18n.t('Backup history')}
                            </Button>
                            <Button
                                onClick={() => this.setState({ showGetBackups: true })}
                            >
                                {I18n.t('Get backups')}
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
                />
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
