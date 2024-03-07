import React from 'react';
import { withStyles } from '@mui/styles';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    AppBar,
} from '@mui/material';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader, AdminConnection } from '@iobroker/adapter-react-v5';

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

    // socket.emit('getState', adapter + '.' + instance + '.history.iobrokerLastTime', function (err, state) {
    //     if (state && state.val && settings.minimalEnabled) {
    //         text += `<li class="next-last-backups"><b>${_('Last iobroker Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
    //     }
    //     socket.emit('getState', adapter + '.' + instance + '.history.ccuLastTime', function (err, state) {
    //         if (state && state.val && settings.ccuEnabled) {
    //             text += `<li class="next-last-backups"><b>${_('Last CCU Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
    //         }
    //         socket.emit('getState', adapter + '.' + instance + '.info.iobrokerNextTime', function (err, state) {
    //             if (state && state.val && settings.minimalEnabled) {
    //                 text += `<li class="next-last-backups"><b>${_('Next iobroker Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
    //             }
    //             socket.emit('getState', adapter + '.' + instance + '.info.ccuNextTime', function (err, state) {
    //                 if (state && state.val && settings.ccuEnabled) {
    //                     text += `<li class="next-last-backups"><b>${_('Next CCU Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
    //                 }
    //                 var $backups = $('.card-content-text');
    //                 $backups
    //                     .find('.fillBackups')
    //                     .html(text);
    //             });
    //         });
    //     });

    onConnectionReady() {
        if (this.state.minimalEnabled) {
            this.socket.getState(`${this.adapterName}.${this.instance}.history.iobrokerLastTime`)
                .then(state => {
                    this.setState({ iobrokerLastTime: state.val });
                });
            this.socket.getState(`${this.adapterName}.${this.instance}.info.iobrokerNextTime`)
                .then(state => {
                    this.setState({ iobrokerNextTime: state.val });
                });
        }
        if (this.state.ccuEnabled) {
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

    }

    renderActivatedStorageOptions() {

    }

    renderActivatedBackupOptions() {
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
                    <AppBar position="static">
11
                    </AppBar>

                    <div className={this.isIFrame ? this.props.classes.tabContentIFrame : this.props.classes.tabContent}>

                    </div>
                    {this.renderError()}
                </div>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
