// this file used only for simulation and not used in end build

import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import withStyles from '@mui/styles/withStyles';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import I18n from '@iobroker/adapter-react-v5/i18n';
import Loader from '@iobroker/adapter-react-v5/Components/Loader';

import AdapterExist from './AdapterExist';
import BackupNow from './BackupNow';
import DetectConfig from './DetectConfig';
import GoogleDrive from './GoogleDrive';
import DetectConfigInvisible from './DetectConfigInvisible';
import Instance from './Instance';

const styles = theme => ({
    app: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
        height: '100%',
    },
    item: {
        padding: 50,
        width: 400,
    },
});

class App extends GenericApp {
    constructor(props) {
        const extendedProps = { ...props };
        super(props, extendedProps);

        this.state = {
            data: {
                myCustomAttribute: 'red',
                telegramInstance: 'telegram.0',
            },
            theme: this.createTheme(),
        };
        const translations = {
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

        I18n.setTranslations(translations);
        I18n.setLanguage((navigator.language || navigator.userLanguage || 'en').substring(0, 2).toLowerCase());
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
                <div className={this.props.classes.app}>
                    <div className={this.props.classes.item}>
                        <AdapterExist
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomBackitupSet/Components/TelegramComponent',
                                type: 'custom',
                                // adapter: 'zigbee',
                                title: 'Backitup Information!',
                                alert: 'The JavaScript Adapter scripts are already saved in the ioBroker backup.\n\nThis option is just an additional option to be able to restore the scripts individually if necessary.',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <BackupNow
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            alive
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomTelegramSet/Components/TelegramComponent',
                                type: 'custom',
                                backUpType: 'ccu',
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <DetectConfig
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomTelegramSet/Components/TelegramComponent',
                                type: 'custom',
                                adapter: 'ccu',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <DetectConfigInvisible
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomTelegramSet/Components/TelegramComponent',
                                type: 'custom',
                                adapter: 'ccu',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <GoogleDrive
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomTelegramSet/Components/TelegramComponent',
                                type: 'custom',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <Instance
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="telegramInstance"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomTelegramSet/Components/TelegramComponent',
                                type: 'custom',
                                adapter: 'telegram',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                    </div>
                </div>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
