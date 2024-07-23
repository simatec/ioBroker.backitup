// this file used only for simulation and not used in end build

import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { Box } from '@mui/material';

import { I18n, Loader, GenericApp } from '@iobroker/adapter-react-v5';

import AdapterExist from './AdapterExist';
import BackupNow from './BackupNow';
import DetectConfig from './DetectConfig';
import GoogleDrive from './GoogleDrive';
import Onedrive from './Onedrive';
import Dropbox from './Dropbox';
import CheckConfigInvisible from './CheckConfigInvisible';
import Instance from './Instance';
import RestoreBackup from './RestoreBackup';

const styles = {
    app: theme => ({
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
        height: '100%',
    }),
    item: {
        padding: 50,
        width: 400,
    },
};

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
                    <Loader themeType={this.state.themeType} />
                </ThemeProvider>
            </StyledEngineProvider>;
        }

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <Box component="div" sx={styles.app}>
                    <div style={styles.item}>
                        <AdapterExist
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomBackItUpSet/Components/AdapterExist',
                                type: 'custom',
                                // adapter: 'zigbee',
                                title: 'BackItUp Information!',
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
                                name: 'ConfigCustomBackItUpSet/Components/BackupNow',
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
                                name: 'ConfigCustomBackItUpSet/Components/DetectConfig',
                                type: 'custom',
                                adapter: 'ccu',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <CheckConfigInvisible
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomBackItUpSet/Components/DetectConfigInvisible',
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
                                name: 'ConfigCustomBackItUpSet/Components/GoogleDrive',
                                type: 'custom',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <Onedrive
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomBackItUpSet/Components/Onedrive',
                                type: 'custom',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <Dropbox
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            attr="myCustomAttribute"
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomBackItUpSet/Components/Dropbox',
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
                                name: 'ConfigCustomBackItUpSet/Components/Instance',
                                type: 'custom',
                                adapter: 'telegram',
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                            common={this.common}
                        />
                        <RestoreBackup
                            socket={this.socket}
                            themeType={this.state.themeType}
                            themeName={this.state.themeName}
                            data={this.state.data}
                            onError={() => {}}
                            instance={0}
                            schema={{
                                name: 'ConfigCustomBackItUpSet/Components/RestoreBackup',
                                type: 'custom',
                                allowDownload: false,
                            }}
                            onChange={data => {
                                this.setState({ data });
                            }}
                            adapterName="backitup"
                        />
                    </div>
                </Box>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default App;
