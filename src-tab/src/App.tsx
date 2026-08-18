import React from 'react';
import { saveAs } from 'file-saver';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { Card, CardContent, Button, AppBar, Toolbar, Tooltip, Fab, Box, CssBaseline } from '@mui/material';

import {
    CloudUploadOutlined,
    FormatListBulleted,
    InfoOutlined,
    Search,
    SettingsBackupRestore,
    UploadOutlined,
    StorageOutlined,
    Help,
    School,
    Favorite,
    History,
    Alarm,
} from '@mui/icons-material';

import {
    GenericApp,
    I18n,
    Loader,
    AdminConnection,
    ScrollbarStyles,
    type IobTheme,
    type GenericAppProps,
    type GenericAppState,
} from '@iobroker/gui-components';

import logo from './assets/backitup.svg';

import BackupHistory from './Components/BackupHistory';
import GetBackups from './Components/GetBackups';
import GetLogs from './Components/GetLogs';
import UploadBackup from './Components/UploadBackup';
import UploadSettings from './Components/UploadSettings';
import BackupNow from './Components/BackupNow';
import SourceSelector from './Components/SourceSelector';
import Restore from './Components/Restore';

import enLang from './i18n/en.json';
import deLang from './i18n/de.json';
import ruLang from './i18n/ru.json';
import ptLang from './i18n/pt.json';
import nlLang from './i18n/nl.json';
import frLang from './i18n/fr.json';
import itLang from './i18n/it.json';
import esLang from './i18n/es.json';
import plLang from './i18n/pl.json';
import ukLang from './i18n/uk.json';
import zhCnLang from './i18n/zh-cn.json';

declare module '@mui/material/Button' {
    interface ButtonPropsColorOverrides {
        grey: true;
    }
}

const isDarkThemeName = (themeName?: string): boolean => themeName === 'modernDark' || themeName === 'dark';

const styles: Record<string, any> = {
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
    headerArea: (theme: IobTheme): React.CSSProperties => ({
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : '#FFFFFF',
        backgroundImage: 'none',
        boxShadow: theme.palette.mode === 'dark' ? '0 1px 2px 0 rgba(0,0,0,0.4)' : '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        borderBottom: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E5E7EB',
    }),
    header: {
        fontSize: '1.05rem',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        lineHeight: '130%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        p: '0.35rem 0 0.6rem 0',
        borderBottom: '2px solid #3B82F6',
    },
    headerDark: {
        color: '#E2E8F0',
        backgroundImage: 'none',
        borderBottom: '2px solid #29A8D8',
    },
    headerLight: {
        color: '#0F2E5C',
        backgroundImage: 'none',
        borderBottom: '2px solid #1B6FA8',
    },
    subHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#0F2E5C',
    },
    cardHeader: {
        fontSize: '1.15rem',
        lineHeight: '38px',
        fontWeight: '700',
        letterSpacing: '-0.01em',
        marginBottom: 8,
    },
    headerIcon: {
        height: 22,
        width: 22,
        fontSize: 22,
        float: 'left',
        margin: '0 10px 0 0',
    },
    historyIcon: {
        height: 20,
        width: 20,
        fontSize: 20,
        marginTop: 2,
        flexShrink: 0,
        opacity: 0.55,
    },
    icon: {
        height: 44,
        width: 44,
        fontSize: 22,
        padding: 11,
        borderRadius: '10px',
        boxSizing: 'content-box',
        filter: 'none',
    },
    iconDiv: {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
    },
    iconDivLight: {},
    iconDivDark: {},
    textDiv: {
        flex: 1,
        minWidth: 0,
    },
    cardInner: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 20,
        padding: '20px 22px',
        height: '100%',
        boxSizing: 'border-box',
    },
    cardContent: (theme: IobTheme): React.CSSProperties => ({
        padding: 0,
        height: '100%',
        borderRadius: '12px',
        boxShadow: theme.palette.mode === 'dark' ? '0 1px 2px rgba(0,0,0,0.35)' : '0 1px 3px rgba(15, 23, 42, 0.06)',
        backgroundImage: 'none',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
        border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E5E7EB',
    }),
    card: {
        borderRadius: '12px',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 18px 0 rgba(15, 23, 42, 0.14)',
        },
    },
    label: {
        fontWeight: 600,
        fontSize: '0.75em',
        opacity: 0.55,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        marginBottom: 2,
    },
    value: {
        fontSize: 'clamp(0.8em, 0.55em + 0.6vw, 0.95em)',
        fontWeight: 600,
    },
    footer: {
        fontSize: '0.85rem',
        fontWeight: 400,
        lineHeight: '110%',
        textAlign: 'center',
        marginTop: 8,
        position: 'fixed',
        bottom: 0,
        width: '100%',
        overflow: 'overlay',
        zIndex: 997,
        padding: '7px 0 7px 0',
        margin: '0 0 0 -8px',
        cursor: 'pointer',
        borderTop: '1px solid #E5E7EB',
        textDecoration: 'none',
        opacity: 0.9,
        transition: 'opacity 0.15s ease',
    },
    footerDark: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        color: '#E2E8F0',
        borderTop: '1px solid rgba(255,255,255,0.08)',
    },
    footerLight: {
        backgroundColor: '#FFFFFF',
        color: '#64748B',
    },
    buttonWidth: {
        width: '100%',
    },
    helpButtonGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        position: 'absolute',
        right: 10,
        top: 9,
    },
    helpButton: (theme: IobTheme) => ({
        width: 36,
        height: 36,
        boxShadow: 'none',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.045)',
        color: theme.palette.mode === 'dark' ? '#CBD5E1' : '#475569',
        transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(15, 23, 42, 0.10)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        },
    }),

    button: (theme: IobTheme) => ({
        borderRadius: '8px',
        textTransform: 'none',
        fontWeight: 600,
        transition: 'filter 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
        '&:hover': {
            filter: theme.palette.mode === 'dark' ? 'brightness(1.16)' : 'brightness(0.93)',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.20)',
        },
        '&:active': {
            filter: theme.palette.mode === 'dark' ? 'brightness(1.06)' : 'brightness(0.87)',
        },
        '&.Mui-disabled': {
            filter: 'none',
            boxShadow: 'none',
        },
    }),
    list: {
        listStyleType: 'disc',
        padding: '0 0 0 18px',
        margin: 0,
        overflow: 'visible',
    },
    listItem: {
        marginBottom: 8,
        lineHeight: 1.4,
    },
    infoListItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
    },
};

interface AppState extends GenericAppState {
    showBackupHistory: boolean;
    showGetBackups: boolean;
    showRestore: any;
    showUploadBackup: boolean;
    backupSource: string;
    connectType: string;
    myAlive: boolean;
    restoreIfWait: number;
    iobrokerLastTime: string;
    iobrokerNextTime: string;
    ccuLastTime: string;
    ccuNextTime: string;
    systemInfo: { systemOS: string } | null;
    showUploadSettings: boolean;
    showLogs: null | { fileName: string; timestamp: number; index: number };
    hoverIobrokerBackup: boolean;
    hoverCcuBackup: boolean;
}

export default class App extends GenericApp<GenericAppProps, AppState> {
    constructor(props: GenericAppProps) {
        const extendedProps = { ...props };
        extendedProps.encryptedFields = ['pass'];
        // @ts-expect-error fix later
        extendedProps.Connection = AdminConnection;
        extendedProps.translations = {
            en: enLang,
            de: deLang,
            ru: ruLang,
            pt: ptLang,
            nl: nlLang,
            fr: frLang,
            it: itLang,
            es: esLang,
            pl: plLang,
            uk: ukLang,
            'zh-cn': zhCnLang,
        };

        extendedProps.sentryDSN = window.sentryDSN;
        // extendedProps.socket = {
        //     protocol: 'http:',
        //     host: '192.168.178.45',
        //     port: 8081,
        // };

        super(props, extendedProps);

        this.state = {
            ...this.state,
            showBackupHistory: false,
            showGetBackups: false,
            showRestore: null,
            showUploadBackup: false,
            backupSource: window.localStorage.getItem('BackItUp.backupSource') || 'local',
            connectType: this.state.native.connectType,
            myAlive: false,
            restoreIfWait: 5000,
            hoverIobrokerBackup: false,
            hoverCcuBackup: false,
        };
    }

    /**
     * Ersetzt das veraltete this.state.themeType.
     * Ermittelt Dark/Light konsequent aus this.state.themeName
     * (gültige Werte: 'modernLight' | 'modernDark' | 'dark' | 'light').
     */
    isDark(): boolean {
        return isDarkThemeName(this.state.themeName);
    }

    /**
     * Für Kind-Komponenten, die weiterhin eine themeType-Prop ('dark' | 'light') erwarten.
     * Der Wert wird jetzt aus themeName abgeleitet statt aus dem veralteten State-Feld gelesen.
     */
    get derivedThemeType(): 'dark' | 'light' {
        return this.isDark() ? 'dark' : 'light';
    }

    /**
     * Liefert exakt dasselbe visuelle Ergebnis wie styles.button (Radius, Hover-Filter, Shadow),
     * aber als reines inline-CSSProperties-Objekt. Notwendig für BackupNow, da diese Komponente
     * nur ein "style"-Prop (kein sx / keine echten :hover-Pseudoklassen) unterstützt.
     * Dadurch identisches Verhalten in allen vier Themes (modernLight, modernDark, dark, light).
     */
    getActionButtonStyle(hovered: boolean): React.CSSProperties {
        const dark = this.isDark();
        return {
            width: '100%',
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            transition: 'filter 0.15s ease, box-shadow 0.15s ease',
            ...(hovered
                ? {
                      filter: dark ? 'brightness(1.16)' : 'brightness(0.93)',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.20)',
                  }
                : undefined),
        };
    }

    static translateTime(time: string | undefined): string {
        if (time === 'none') {
            return '--';
        }
        if (time === 'No backups yet') {
            return I18n.t('No backups yet');
        }
        if (typeof time === 'string' && time.startsWith('error')) {
            return time.replace('error', I18n.t('Error'));
        }
        return time || '';
    }

    async onConnectionReady(): Promise<void> {
        const myAlive = await this.socket.getState(`system.adapter.${this.adapterName}.${this.instance}.alive`);
        const newState: Partial<AppState> = { myAlive: !!myAlive?.val };

        if (this.state.native.minimalEnabled) {
            const iobrokerLastTime = await this.socket.getState(
                `${this.adapterName}.${this.instance}.history.iobrokerLastTime`,
            );
            const iobrokerNextTime: ioBroker.State | null | undefined = await this.socket.getState(
                `${this.adapterName}.${this.instance}.info.iobrokerNextTime`,
            );
            newState.iobrokerNextTime = App.translateTime(iobrokerNextTime?.val as string | undefined);
            newState.iobrokerLastTime = App.translateTime(iobrokerLastTime?.val as string | undefined);
        }

        if (this.state.native.ccuEnabled) {
            const ccuLastTime = await this.socket.getState(`${this.adapterName}.${this.instance}.history.ccuLastTime`);
            const ccuNextTime = await this.socket.getState(`${this.adapterName}.${this.instance}.info.ccuNextTime`);
            newState.ccuLastTime = App.translateTime(ccuLastTime?.val as string | undefined);
            newState.ccuNextTime = App.translateTime(ccuNextTime?.val as string | undefined);
        }

        await this.socket.subscribeState(`system.adapter.${this.adapterName}.${this.instance}.alive`, this.onAlive);
        await this.socket.subscribeObject(`system.adapter.${this.adapterName}.${this.instance}`, this.onSettings);
        await this.socket.subscribeState(
            `${this.adapterName}.${this.instance}.history.iobrokerLastTime`,
            this.onHistory,
        );
        await this.socket.subscribeState(`${this.adapterName}.${this.instance}.info.iobrokerNextTime`, this.onHistory);
        await this.socket.subscribeState(`${this.adapterName}.${this.instance}.history.ccuLastTime`, this.onHistory);
        await this.socket.subscribeState(`${this.adapterName}.${this.instance}.info.ccuNextTime`, this.onHistory);

        if (myAlive) {
            newState.systemInfo = await this.socket.sendTo(
                `${this.adapterName}.${this.instance}`,
                'getSystemInfo',
                null,
            );
            newState.restoreIfWait =
                newState.systemInfo?.systemOS === 'docker'
                    ? 10000
                    : newState.systemInfo?.systemOS === 'win'
                      ? 18000
                      : 5000;
        }

        this.setState(newState as AppState);
    }

    onSettings = (id: string, obj: ioBroker.Object | null | undefined): void => {
        if (obj && id === `system.adapter.${this.adapterName}.${this.instance}`) {
            this.setState({ native: (obj as ioBroker.InstanceObject).native });
        }
    };

    onHistory = (id: string, state: ioBroker.State | null | undefined): void => {
        if (!state) {
            return;
        }
        if (
            id === `${this.adapterName}.${this.instance}.history.iobrokerLastTime` &&
            state.val !== this.state.iobrokerLastTime
        ) {
            this.setState({ iobrokerLastTime: App.translateTime(state.val as string) });
        } else if (
            id === `${this.adapterName}.${this.instance}.history.iobrokerNextTime` &&
            state.val !== this.state.iobrokerNextTime
        ) {
            this.setState({ iobrokerNextTime: App.translateTime(state.val as string) });
        } else if (
            id === `${this.adapterName}.${this.instance}.history.ccuLastTime` &&
            state.val !== this.state.ccuLastTime
        ) {
            this.setState({ ccuLastTime: App.translateTime(state.val as string) });
        } else if (
            id === `${this.adapterName}.${this.instance}.history.ccuNextTime` &&
            state.val !== this.state.ccuNextTime
        ) {
            this.setState({ ccuNextTime: App.translateTime(state.val as string) });
        }
    };

    async componentWillUnmount(): Promise<void> {
        super.componentWillUnmount();
        this.socket.unsubscribeState(`system.adapter.${this.adapterName}.${this.instance}.alive`, this.onAlive);
        await this.socket.unsubscribeObject(`system.adapter.${this.adapterName}.${this.instance}`, this.onSettings);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.history.iobrokerLastTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.info.iobrokerNextTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.history.ccuLastTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.adapterName}.${this.instance}.info.ccuNextTime`, this.onHistory);
    }

    onAlive = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id === `system.adapter.${this.adapterName}.${this.instance}.alive`) {
            if (!!state?.val !== this.state.myAlive) {
                this.setState({ myAlive: !!state?.val });
            }
        }
    };

    renderBackupInformation(): React.JSX.Element {
        return (
            <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                    <div style={styles.cardInner}>
                        <div
                            style={{
                                ...styles.iconDiv,
                                ...(this.isDark() ? styles.iconDivDark : styles.iconDivLight),
                            }}
                        >
                            <InfoOutlined
                                style={styles.icon}
                                sx={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#2563EB' }}
                            />
                        </div>
                        <div style={styles.textDiv}>
                            <div style={styles.cardHeader}>{I18n.t('Backup Information')}</div>
                            <ul style={{ ...styles.list, listStyleType: 'none', padding: 0 }}>
                                {this.state.native.minimalEnabled && (
                                    <li style={styles.infoListItem}>
                                        <History style={styles.historyIcon} />
                                        <div>
                                            <div style={styles.label}>{I18n.t('Last ioBroker backup:')}</div>
                                            <div style={styles.value}>{this.state.iobrokerLastTime}</div>
                                        </div>
                                    </li>
                                )}
                                {this.state.native.minimalEnabled && (
                                    <li style={styles.infoListItem}>
                                        <Alarm style={styles.historyIcon} />
                                        <div>
                                            <div style={styles.label}>{I18n.t('Next ioBroker backup:')}</div>
                                            <div style={styles.value}>{this.state.iobrokerNextTime}</div>
                                        </div>
                                    </li>
                                )}
                                {this.state.native.ccuEnabled && (
                                    <li style={styles.infoListItem}>
                                        <History style={styles.historyIcon} />
                                        <div>
                                            <div style={styles.label}>{I18n.t('Last CCU backup:')}</div>
                                            <div style={styles.value}>{this.state.ccuLastTime}</div>
                                        </div>
                                    </li>
                                )}
                                {this.state.native.ccuEnabled && (
                                    <li style={styles.infoListItem}>
                                        <Alarm style={styles.historyIcon} />
                                        <div>
                                            <div style={styles.label}>{I18n.t('Next CCU backup:')}</div>
                                            <div style={styles.value}>{this.state.ccuNextTime}</div>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    renderActivatedStorageOptions(): React.JSX.Element {
        const options = [
            { name: 'cifsEnabled', label: `NAS (${this.state.native.connectType})` },
            { name: 'ftpEnabled', label: 'FTP' },
            { name: 'dropboxEnabled', label: 'Dropbox' },
            { name: 'onedriveEnabled', label: 'OneDrive' },
            { name: 'googledriveEnabled', label: 'Google Drive' },
            { name: 'webdavEnabled', label: 'WebDAV' },
        ];
        return (
            <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                    <div style={styles.cardInner}>
                        <div
                            style={{
                                ...styles.iconDiv,
                                ...(this.isDark() ? styles.iconDivDark : styles.iconDivLight),
                            }}
                        >
                            <StorageOutlined
                                style={styles.icon}
                                sx={{ backgroundColor: 'rgba(6,182,212,0.14)', color: '#0891B2' }}
                            />
                        </div>
                        <div style={styles.textDiv}>
                            <div style={styles.cardHeader}>{I18n.t('Activated storage options')}</div>
                            <ul style={styles.list}>
                                {options.map(
                                    option =>
                                        this.state.native[option.name] && (
                                            <li
                                                key={option.name}
                                                style={{ ...styles.listItem, fontSize: '0.95em' }}
                                            >
                                                {I18n.t(option.label)}
                                            </li>
                                        ),
                                )}
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    renderActivatedBackupOptions(): React.JSX.Element {
        const options = [
            { name: 'jarvisEnabled', label: 'Jarvis backup' },
            { name: 'minimalEnabled', label: 'ioBroker' },
            { name: 'ccuEnabled', label: 'Homematic CCU backup' },
            { name: 'redisEnabled', label: 'Save Redis state' },
            { name: 'javascriptsEnabled', label: 'Javascripts backup' },
            { name: 'zigbeeEnabled', label: 'Zigbee Backup' },
            { name: 'esphomeEnabled', label: 'ESPHome' },
            { name: 'zigbee2mqttEnabled', label: 'Zigbee2MQTT' },
            { name: 'noderedEnabled', label: 'Node-Red backup' },
            { name: 'yahkaEnabled', label: 'Yahka (Homekit) backup' },
            { name: 'historyEnabled', label: 'History Backup' },
            { name: 'influxDBEnabled', label: 'InfluxDB backup' },
            { name: 'mySqlEnabled', label: 'MySql backup' },
            { name: 'sqliteEnabled', label: 'SQLite backup' },
            { name: 'grafanaEnabled', label: 'Grafana backup' },
            { name: 'pgSqlEnabled', label: 'PostgreSQL Backup' },
        ];
        return (
            <Card sx={styles.card}>
                <CardContent sx={styles.cardContent}>
                    <div style={styles.cardInner}>
                        <div
                            style={{
                                ...styles.iconDiv,
                                ...(this.isDark() ? styles.iconDivDark : styles.iconDivLight),
                            }}
                        >
                            <CloudUploadOutlined
                                style={styles.icon}
                                sx={{ backgroundColor: 'rgba(99,102,241,0.13)', color: '#4F46E5' }}
                            />
                        </div>
                        <div style={styles.textDiv}>
                            <div style={styles.cardHeader}>{I18n.t('Activated backup options')}</div>
                            <ul style={styles.list}>
                                {options.map(
                                    option =>
                                        this.state.native[option.name] && (
                                            <li
                                                key={option.name}
                                                style={{ ...styles.listItem, fontSize: '0.95em' }}
                                            >
                                                {I18n.t(option.label)}
                                            </li>
                                        ),
                                )}
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    renderUploadSettingsDialog(): React.JSX.Element | null {
        if (!this.state.showUploadSettings) {
            return null;
        }
        return (
            <UploadSettings
                onClose={() => this.setState({ showUploadSettings: false })}
                socket={this.socket}
                themeType={this.derivedThemeType}
                adapterName={this.adapterName}
                instance={this.instance}
            />
        );
    }

    render(): React.JSX.Element {
        if (!this.state.loaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <Loader themeType={this.derivedThemeType} />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <CssBaseline />
                    <ScrollbarStyles theme={this.state.theme} />
                    <div
                        className="App"
                        style={{
                            background: this.state.theme.palette.background.default,
                            color: this.state.theme.palette.text.primary,
                        }}
                    >
                        <AppBar
                            sx={styles.headerArea}
                            position="static"
                            enableColorOnDark
                        >
                            <Toolbar>
                                <img
                                    src={logo}
                                    alt="logo"
                                    style={{ height: 42, marginRight: 16 }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontWeight: 700,
                                            fontSize: 19,
                                            color: this.isDark() ? '#F1F5F9' : '#0F2E5C',
                                            letterSpacing: '-0.01em',
                                        }}
                                    >
                                        Backitup
                                    </div>
                                    <div
                                        style={{
                                            color: this.isDark() ? '#94A3B8' : '#64748B',
                                            fontStyle: 'normal',
                                            fontSize: 'clamp(0.7em, 0.7em + 0.6vw, 1em)',
                                        }}
                                    >
                                        {I18n.t('Backup your System …')}
                                    </div>
                                </div>
                            </Toolbar>
                            <div style={styles.helpButtonGroup}>
                                <Tooltip
                                    title="PayPal.Me"
                                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                                >
                                    <Fab
                                        sx={styles.helpButton}
                                        onClick={() => {
                                            window.open('https://paypal.me/mk1676', '_blank');
                                        }}
                                    >
                                        <Favorite />
                                    </Fab>
                                </Tooltip>
                                <Tooltip
                                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                                    title="Wiki"
                                >
                                    <Fab
                                        sx={styles.helpButton}
                                        onClick={() =>
                                            window.open('https://github.com/simatec/ioBroker.backitup/wiki', '_blank')
                                        }
                                    >
                                        <School />
                                    </Fab>
                                </Tooltip>
                                <Tooltip
                                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                                    title="Show adapter documentation"
                                >
                                    <Fab
                                        sx={styles.helpButton}
                                        onClick={() => {
                                            window.open(
                                                'https://github.com/simatec/ioBroker.backitup/blob/master/README.md',
                                                '_blank',
                                            );
                                        }}
                                    >
                                        <Help />
                                    </Fab>
                                </Tooltip>
                            </div>
                        </AppBar>
                        <div
                            style={{
                                width: 'calc(100% - 16px)',
                                height: 'calc(100% - 104px)',
                                overflow: 'auto',
                                padding: 8,
                            }}
                        >
                            <Box
                                component="div"
                                sx={{
                                    m: '1rem 0 1.25rem 0',
                                    ...styles.header,
                                    ...(this.isDark() ? styles.headerDark : styles.headerLight),
                                }}
                            >
                                <InfoOutlined style={styles.headerIcon} />
                                <span>{I18n.t('Backup Information')}</span>
                            </Box>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                                    gap: 16,
                                    minHeight: 260,
                                    gridAutoRows: '1fr',
                                }}
                            >
                                {this.renderBackupInformation()}
                                {this.renderActivatedStorageOptions()}
                                {this.renderActivatedBackupOptions()}
                            </div>
                            <Box
                                component="div"
                                sx={{
                                    m: '1.5rem 0 1.25rem 0',
                                    ...styles.header,
                                    ...(this.isDark() ? styles.headerDark : styles.headerLight),
                                }}
                            >
                                <CloudUploadOutlined style={styles.headerIcon} />
                                <span>{I18n.t('System backup')}</span>
                            </Box>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                                    gap: 16,
                                    justifyContent: 'space-evenly',
                                    alignContent: 'center',
                                    justifyItems: 'stretch',
                                    gridAutoRows: '1fr',
                                }}
                            >
                                {this.state.myAlive && this.state.native.minimalEnabled ? (
                                    <div
                                        onMouseEnter={() => this.setState({ hoverIobrokerBackup: true })}
                                        onMouseLeave={() => this.setState({ hoverIobrokerBackup: false })}
                                    >
                                        <BackupNow
                                            style={this.getActionButtonStyle(this.state.hoverIobrokerBackup)}
                                            color={this.isDark() ? 'primary' : 'grey'}
                                            oContext={{
                                                adapterName: this.adapterName,
                                                socket: this.socket,
                                                instance: this.instance,
                                                themeType: this.derivedThemeType,
                                                dateFormat:
                                                    this.socket.systemConfig?.common.dateFormat || 'DD.MM.YYYY HH:mm',
                                                isFloatComma: this.socket.systemConfig?.common.isFloatComma || false,
                                                theme: this.state.theme,
                                                _themeName: this.state.themeName,
                                                systemConfig:
                                                    this.socket.systemConfig?.common ||
                                                    ({} as ioBroker.SystemConfigCommon),
                                                onCommandRunning: (_ignore: boolean): void => {},
                                                forceUpdate: (): void => {},
                                            }}
                                            alive
                                            onError={(): void => {}}
                                            schema={{
                                                backUpType: 'iobroker',
                                                label: 'ioBroker start backup',
                                                i18n: false,
                                                variant: 'contained',
                                                type: 'custom',
                                                url: '',
                                                name: '',
                                            }}
                                            changed={false}
                                            common={this.state.common || {}}
                                            themeName={this.state.themeName}
                                            data={{}}
                                            originalData={{}}
                                            onChange={(): void => {}}
                                        />
                                    </div>
                                ) : (
                                    <Button
                                        style={{ width: '100%' }}
                                        sx={styles.button}
                                        disabled
                                        color={this.isDark() ? 'primary' : 'grey'}
                                        variant="contained"
                                        endIcon={<CloudUploadOutlined />}
                                    >
                                        {I18n.t('ioBroker start backup')}
                                    </Button>
                                )}
                                {this.state.myAlive && this.state.native.ccuEnabled ? (
                                    <div
                                        onMouseEnter={() => this.setState({ hoverCcuBackup: true })}
                                        onMouseLeave={() => this.setState({ hoverCcuBackup: false })}
                                    >
                                        <BackupNow
                                            style={this.getActionButtonStyle(this.state.hoverCcuBackup)}
                                            oContext={{
                                                adapterName: this.adapterName,
                                                socket: this.socket,
                                                instance: this.instance,
                                                themeType: this.derivedThemeType,
                                                dateFormat:
                                                    this.socket.systemConfig?.common.dateFormat || 'DD.MM.YYYY HH:mm',
                                                isFloatComma: this.socket.systemConfig?.common.isFloatComma || false,
                                                theme: this.state.theme,
                                                _themeName: this.state.themeName,
                                                systemConfig:
                                                    this.socket.systemConfig?.common ||
                                                    ({} as ioBroker.SystemConfigCommon),
                                                onCommandRunning: (_ignore: boolean): void => {},
                                                forceUpdate: (): void => {},
                                            }}
                                            color={this.isDark() ? 'primary' : 'grey'}
                                            alive
                                            schema={{
                                                backUpType: 'ccu',
                                                label: 'Homematic start backup',
                                                i18n: false,
                                                variant: 'contained',
                                                type: 'custom',
                                                url: '',
                                                name: '',
                                            }}
                                            onError={(): void => {}}
                                            changed={false}
                                            common={this.state.common || {}}
                                            themeName={this.state.themeName}
                                            data={{}}
                                            originalData={{}}
                                            onChange={(): void => {}}
                                        />
                                    </div>
                                ) : (
                                    <Button
                                        style={{ width: '100%' }}
                                        sx={styles.button}
                                        disabled
                                        color={this.isDark() ? 'primary' : 'grey'}
                                        variant="contained"
                                        endIcon={<CloudUploadOutlined />}
                                    >
                                        {I18n.t('Homematic start backup')}
                                    </Button>
                                )}
                                <Button
                                    style={{ width: '100%' }}
                                    sx={styles.button}
                                    onClick={() => this.setState({ showBackupHistory: true })}
                                    variant="contained"
                                    color={this.isDark() ? 'primary' : 'grey'}
                                    endIcon={<FormatListBulleted />}
                                >
                                    {I18n.t('Backup history')}
                                </Button>
                                <Button
                                    style={{ width: '100%' }}
                                    sx={styles.button}
                                    variant="contained"
                                    color={this.isDark() ? 'primary' : 'grey'}
                                    onClick={async () => {
                                        const obj = await this.socket.getObject(
                                            `system.adapter.${this.adapterName}.${this.instance}`,
                                        );

                                        if (obj && obj.common && obj.common.news) {
                                            delete obj.common.news;
                                        }
                                        if (obj && obj.common && obj.common.titleLang) {
                                            delete obj.common.titleLang;
                                        }
                                        if (obj && obj.common && obj.common.desc) {
                                            delete obj.common.desc;
                                        }
                                        const blob = new Blob([JSON.stringify(obj)], {
                                            type: 'application/json;charset=utf-8',
                                        });
                                        const now = new Date();
                                        saveAs(
                                            blob,
                                            `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}-${this.adapterName}.${this.instance}.json`,
                                        );
                                    }}
                                    endIcon={<CloudUploadOutlined />}
                                >
                                    {I18n.t('Save BackItUp settings')}
                                </Button>
                            </div>
                            <Box
                                component="div"
                                sx={{
                                    m: '1.5rem 0px 1rem 0px',
                                    ...styles.header,
                                    ...(this.isDark() ? styles.headerDark : styles.headerLight),
                                }}
                            >
                                <SettingsBackupRestore style={styles.headerIcon} />
                                <span>{I18n.t('Restore')}</span>
                            </Box>
                            <div
                                style={{
                                    width: '100%',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                                    gap: 16,
                                    justifyItems: 'stretch',
                                    justifyContent: 'space-evenly',
                                    alignContent: 'center',
                                    alignItems: 'stretch',
                                    gridAutoRows: '1fr',
                                    marginBottom: '1rem',
                                }}
                            >
                                <SourceSelector
                                    value={this.state.backupSource}
                                    data={this.state.native}
                                    onChange={backupSource => {
                                        window.localStorage.setItem('BackItUp.backupSource', backupSource);
                                        this.setState({ backupSource });
                                    }}
                                />
                                <Button
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                    sx={styles.button}
                                    onClick={() => this.setState({ showGetBackups: true })}
                                    disabled={!this.state.myAlive}
                                    variant="contained"
                                    color={this.isDark() ? 'primary' : 'grey'}
                                    endIcon={<Search />}
                                >
                                    {I18n.t('Get list')}
                                </Button>
                                <Button
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                    sx={styles.button}
                                    onClick={() => this.setState({ showUploadBackup: true })}
                                    variant="contained"
                                    color={this.isDark() ? 'primary' : 'grey'}
                                    endIcon={<UploadOutlined />}
                                >
                                    {I18n.t('Upload Backup File')}
                                </Button>
                                <Button
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                    sx={styles.button}
                                    variant="contained"
                                    color={this.isDark() ? 'primary' : 'grey'}
                                    onClick={() => this.setState({ showUploadSettings: true })}
                                    endIcon={<SettingsBackupRestore />}
                                >
                                    {I18n.t('Restore BackItUp settings')}
                                </Button>
                            </div>
                            {this.renderError()}
                            <div
                                style={{
                                    ...styles.footer,
                                    ...(this.isDark() ? styles.footerDark : styles.footerLight),
                                }}
                                onClick={() => {
                                    try {
                                        window.parent.postMessage(
                                            `goto:tab-instances/config/system.adapter.backitup.${this.instance}`,
                                            '*',
                                        );
                                    } catch {
                                        // ignore
                                    }
                                }}
                            >
                                {I18n.t('All backup settings can be changed in the adapter configuration of BackItUp.')}
                            </div>
                        </div>
                    </div>
                    {this.state.showBackupHistory ? (
                        <BackupHistory
                            onClose={() => this.setState({ showBackupHistory: false })}
                            onLogs={(fileName, timestamp, index) =>
                                this.setState({ showLogs: { fileName, timestamp, index } })
                            }
                            socket={this.socket}
                            themeType={this.derivedThemeType}
                            themeBreakpoints={this.state.theme.breakpoints.down}
                            adapterName={this.adapterName}
                            instance={this.instance}
                        />
                    ) : null}
                    {this.state.showGetBackups ? (
                        <GetBackups
                            onClose={() => this.setState({ showGetBackups: false })}
                            onRestore={(location, object, fileName) =>
                                this.setState({ showRestore: { location, object, fileName }, showGetBackups: false })
                            }
                            socket={this.socket}
                            themeType={this.derivedThemeType}
                            themeBreakpoints={this.state.theme.breakpoints.down}
                            adapterName={this.adapterName}
                            instance={this.instance}
                            backupSource={this.state.backupSource}
                            connectType={this.state.native.connectType}
                            allowDownload
                        />
                    ) : null}
                    {this.state.showLogs ? (
                        <GetLogs
                            onClose={() => this.setState({ showLogs: null })}
                            backupLog={this.state.showLogs}
                            socket={this.socket}
                            themeType={this.derivedThemeType}
                            adapterName={this.adapterName}
                            themeBreakpoints={this.state.theme.breakpoints.down}
                            instance={this.instance}
                        />
                    ) : null}
                    {this.state.showUploadBackup ? (
                        <UploadBackup
                            onClose={() => this.setState({ showUploadBackup: false })}
                            socket={this.socket}
                            themeType={this.derivedThemeType}
                            adapterName={this.adapterName}
                            instance={this.instance}
                        />
                    ) : null}
                    {this.state.showRestore ? (
                        <Restore
                            alive={this.state.myAlive}
                            location={this.state.showRestore.location}
                            fileName={this.state.showRestore.fileName}
                            onClose={() => this.setState({ showRestore: null })}
                            socket={this.socket}
                            themeType={this.derivedThemeType}
                            adapterName={this.adapterName}
                            instance={this.instance}
                            restoreIfWait={this.state.restoreIfWait}
                        />
                    ) : null}
                    {this.renderUploadSettingsDialog()}
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
