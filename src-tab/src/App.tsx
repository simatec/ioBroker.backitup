import React from 'react';
import { saveAs } from 'file-saver';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { Box, CssBaseline, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';

import {
    ArrowForward,
    ChevronRight,
    CloudUploadOutlined,
    Favorite,
    FileDownloadOutlined,
    FormatListBulleted,
    Help,
    History,
    LayersOutlined,
    MoreVert,
    PlayArrow,
    School,
    Search,
    SettingsBackupRestore,
    SettingsOutlined,
    StorageOutlined,
} from '@mui/icons-material';

import {
    GenericApp,
    I18n,
    IconPlayPause,
    IconUpload,
    Loader,
    AdminConnection,
    ScrollbarStyles,
    type GenericAppProps,
    type GenericAppState,
} from '@iobroker/gui-components';

import logo from './assets/backitup-cloud.svg';

import BackupHistory from './Components/BackupHistory';
import GetBackups from './Components/GetBackups';
import GetLogs from './Components/GetLogs';
import UploadBackup from './Components/UploadBackup';
import UploadSettings from './Components/UploadSettings';
import BackupNow from './Components/BackupNow';
import Restore from './Components/Restore';
import HeroCard, { type HeroBackupInfo, parseLastTime } from './Components/Dashboard/HeroCard';
import AliveLed from './Components/Dashboard/AliveLed';
import { type HoverEffect, revealSx } from './Components/Dashboard/motion';
import RecentBackups, { type HistoryEntry } from './Components/Dashboard/RecentBackups';
import { StorageIcon } from './Components/Dashboard/StorageIcons';
import SourceSelect from './Components/Dashboard/SourceSelect';
import { getTokens, type DashboardTokens } from './Components/Dashboard/tokens';
import {
    ActionTile,
    CheckMark,
    DashboardCard,
    IconBox,
    Pill,
    RoundButton,
    SectionHeader,
} from './Components/Dashboard/Parts';

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

/** How many history entries are shown in "Recent backups" */
const RECENT_BACKUPS = 3;

const STORAGE_OPTIONS: { name: string; type: string; label: string }[] = [
    { name: 'cifsEnabled', type: 'cifs', label: 'NAS' },
    { name: 'ftpEnabled', type: 'ftp', label: 'FTP' },
    { name: 'dropboxEnabled', type: 'dropbox', label: 'Dropbox' },
    { name: 'onedriveEnabled', type: 'onedrive', label: 'OneDrive' },
    { name: 'googledriveEnabled', type: 'googledrive', label: 'Google Drive' },
    { name: 'webdavEnabled', type: 'webdav', label: 'WebDAV' },
];

const BACKUP_OPTIONS: { name: string; label: string }[] = [
    { name: 'minimalEnabled', label: 'ioBroker' },
    { name: 'ccuEnabled', label: 'Homematic CCU backup' },
    { name: 'jarvisEnabled', label: 'Jarvis backup' },
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

/**
 * Takes the free height of the page between two blocks, so the dashboard fills the screen without
 * an empty area at the bottom. It never grows above `MAX_SPACER` and shrinks to 0 if the page has to scroll.
 */
const MAX_SPACER = 28;
function Spacer(): React.JSX.Element {
    return <Box sx={{ flex: '1 1 0', maxHeight: MAX_SPACER, minHeight: 0 }} />;
}

const cardTitleStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    marginBottom: 6,
};

interface AppState extends GenericAppState {
    showBackupHistory: boolean;
    /** 'local' lists the local backups whatever source is selected (e.g. after an upload) */
    showGetBackups: boolean | 'local';
    showRestore: { location: string; object: string; fileName: string } | null;
    showUploadBackup: boolean;
    backupSource: string;
    connectType: string;
    myAlive: boolean;
    restoreIfWait: number;
    /** Raw state values. They are formatted while rendering */
    iobrokerLastTime: string;
    iobrokerNextTime: string;
    ccuLastTime: string;
    ccuNextTime: string;
    /** oneClick.<type>: the backup runs now, also the scheduled one */
    iobrokerRunning: boolean;
    ccuRunning: boolean;
    history: HistoryEntry[];
    /** Index of the recent backup whose download is being prepared */
    downloadIndex: number | null;
    moreMenu: HTMLElement | null;
    systemInfo: { systemOS: string } | null;
    showUploadSettings: boolean;
    /**
     * `latest`: the log of the last run of this type, also of a failed one.
     * `failedAt`: time of the failed run the user clicked on
     */
    showLogs: null | {
        fileName: string;
        timestamp: number;
        index: number;
        latest?: 'iobroker' | 'ccu';
        failedAt?: string;
    };
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
            iobrokerRunning: false,
            ccuRunning: false,
            history: [],
            downloadIndex: null,
            moreMenu: null,
        };
    }

    /**
     * Dark/Light is taken from this.state.themeName
     * (valid values: 'modernLight' | 'modernDark' | 'dark' | 'light').
     */
    isDark(): boolean {
        return isDarkThemeName(this.state.themeName);
    }

    /** For child components that still expect a themeType prop ('dark' | 'light') */
    get derivedThemeType(): 'dark' | 'light' {
        return this.isDark() ? 'dark' : 'light';
    }

    get statePrefix(): string {
        return `${this.adapterName}.${this.instance}`;
    }

    static parseHistory(val: ioBroker.StateValue | undefined): HistoryEntry[] {
        if (typeof val !== 'string' || !val) {
            return [];
        }
        try {
            const list = JSON.parse(val);
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    }

    async onConnectionReady(): Promise<void> {
        const myAlive = await this.socket.getState(`system.adapter.${this.statePrefix}.alive`);
        const newState: Partial<AppState> = { myAlive: !!myAlive?.val };

        const [iobrokerLastTime, iobrokerNextTime, ccuLastTime, ccuNextTime, history] = await Promise.all([
            this.socket.getState(`${this.statePrefix}.history.iobrokerLastTime`),
            this.socket.getState(`${this.statePrefix}.info.iobrokerNextTime`),
            this.socket.getState(`${this.statePrefix}.history.ccuLastTime`),
            this.socket.getState(`${this.statePrefix}.info.ccuNextTime`),
            this.socket.getState(`${this.statePrefix}.history.json`),
        ]);
        newState.iobrokerLastTime = iobrokerLastTime?.val as string;
        newState.iobrokerNextTime = iobrokerNextTime?.val as string;
        newState.ccuLastTime = ccuLastTime?.val as string;
        newState.ccuNextTime = ccuNextTime?.val as string;
        newState.history = App.parseHistory(history?.val);

        const [iobrokerRunning, ccuRunning] = await Promise.all([
            this.socket.getState(`${this.statePrefix}.oneClick.iobroker`),
            this.socket.getState(`${this.statePrefix}.oneClick.ccu`),
        ]);
        newState.iobrokerRunning = !!iobrokerRunning?.val;
        newState.ccuRunning = !!ccuRunning?.val;

        await this.socket.subscribeState(`system.adapter.${this.statePrefix}.alive`, this.onAlive);
        await this.socket.subscribeObject(`system.adapter.${this.statePrefix}`, this.onSettings);
        await this.socket.subscribeState(`${this.statePrefix}.history.iobrokerLastTime`, this.onHistory);
        await this.socket.subscribeState(`${this.statePrefix}.info.iobrokerNextTime`, this.onHistory);
        await this.socket.subscribeState(`${this.statePrefix}.history.ccuLastTime`, this.onHistory);
        await this.socket.subscribeState(`${this.statePrefix}.info.ccuNextTime`, this.onHistory);
        await this.socket.subscribeState(`${this.statePrefix}.history.json`, this.onHistory);
        await this.socket.subscribeState(`${this.statePrefix}.oneClick.iobroker`, this.onHistory);
        await this.socket.subscribeState(`${this.statePrefix}.oneClick.ccu`, this.onHistory);

        if (myAlive?.val) {
            newState.systemInfo = await this.socket.sendTo(this.statePrefix, 'getSystemInfo', null);
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
        if (obj && id === `system.adapter.${this.statePrefix}`) {
            this.setState({ native: (obj as ioBroker.InstanceObject).native });
        }
    };

    onHistory = (id: string, state: ioBroker.State | null | undefined): void => {
        if (!state) {
            return;
        }
        switch (id) {
            case `${this.statePrefix}.history.iobrokerLastTime`:
                this.setState({ iobrokerLastTime: state.val as string });
                break;
            case `${this.statePrefix}.info.iobrokerNextTime`:
                this.setState({ iobrokerNextTime: state.val as string });
                break;
            case `${this.statePrefix}.history.ccuLastTime`:
                this.setState({ ccuLastTime: state.val as string });
                break;
            case `${this.statePrefix}.info.ccuNextTime`:
                this.setState({ ccuNextTime: state.val as string });
                break;
            case `${this.statePrefix}.history.json`:
                this.setState({ history: App.parseHistory(state.val) });
                break;
            case `${this.statePrefix}.oneClick.iobroker`:
                this.setState({ iobrokerRunning: !!state.val });
                break;
            case `${this.statePrefix}.oneClick.ccu`:
                this.setState({ ccuRunning: !!state.val });
                break;
            default:
                break;
        }
    };

    componentWillUnmount(): void {
        super.componentWillUnmount();
        this.socket.unsubscribeState(`system.adapter.${this.statePrefix}.alive`, this.onAlive);
        void this.socket.unsubscribeObject(`system.adapter.${this.statePrefix}`, this.onSettings);
        this.socket.unsubscribeState(`${this.statePrefix}.history.iobrokerLastTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.statePrefix}.info.iobrokerNextTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.statePrefix}.history.ccuLastTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.statePrefix}.info.ccuNextTime`, this.onHistory);
        this.socket.unsubscribeState(`${this.statePrefix}.history.json`, this.onHistory);
        this.socket.unsubscribeState(`${this.statePrefix}.oneClick.iobroker`, this.onHistory);
        this.socket.unsubscribeState(`${this.statePrefix}.oneClick.ccu`, this.onHistory);
    }

    onAlive = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id === `system.adapter.${this.statePrefix}.alive`) {
            if (!!state?.val !== this.state.myAlive) {
                this.setState({ myAlive: !!state?.val });
            }
        }
    };

    /**
     * Schedule of a backup type as text, e.g. "Daily, 02:48".
     *
     * @param type backup type
     */
    getInterval(type: 'iobroker' | 'ccu'): string {
        const native = this.state.native;
        const isCron = type === 'iobroker' ? native.iobrokerCron : native.ccuCron;
        if (isCron) {
            return `Cron: ${(type === 'iobroker' ? native.iobrokerCronJob : native.ccuCronJob) || ''}`;
        }
        const time: string = (type === 'iobroker' ? native.minimalTime : native.ccuTime) || '--:--';
        const days = parseInt(type === 'iobroker' ? native.minimalEveryXDays : native.ccuEveryXDays, 10) || 1;

        return days <= 1 ? I18n.t('Daily, %s', time) : I18n.t('Every %s days, %s', days.toString(), time);
    }

    openConfiguration(): void {
        try {
            window.parent.postMessage(`goto:tab-instances/config/system.adapter.${this.statePrefix}`, '*');
        } catch {
            // ignore
        }
    }

    async saveSettings(): Promise<void> {
        const obj = await this.socket.getObject(`system.adapter.${this.statePrefix}`);

        if (obj?.common?.news) {
            delete obj.common.news;
        }
        if (obj?.common?.titleLang) {
            delete (obj.common as Partial<ioBroker.InstanceCommon>).titleLang;
        }
        if (obj?.common?.desc) {
            delete obj.common.desc;
        }
        const blob = new Blob([JSON.stringify(obj)], {
            type: 'application/json;charset=utf-8',
        });
        const now = new Date();
        saveAs(
            blob,
            `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}-${this.statePrefix}.json`,
        );
    }

    /**
     * Finds a backup from the history in the local backup directory.
     *
     * @param name file name of the archive
     * @returns the full path or null if the file is not stored locally (anymore)
     */
    async findLocalBackup(name: string): Promise<string | null> {
        const result: { data?: { local?: Record<string, { name: string; path: string }[]> } } | null =
            await this.socket.sendTo(this.statePrefix, 'list', 'local');
        const local = result?.data?.local;
        if (local) {
            for (const files of Object.values(local)) {
                const file = files.find(f => f.name === name);
                if (file) {
                    return file.path;
                }
            }
        }
        return null;
    }

    /** The file is gone from the local directory, so let the user pick it from the storages */
    showNotFoundLocally(): void {
        this.showToast(I18n.t('The backup file was not found locally. Please select it from the backup list.'));
        this.setState({ showGetBackups: true });
    }

    onDownloadRecent = async (entry: HistoryEntry, index: number): Promise<void> => {
        if (!entry.name) {
            return;
        }
        this.setState({ downloadIndex: index });
        try {
            const path = await this.findLocalBackup(entry.name);
            if (!path) {
                this.showNotFoundLocally();
                return;
            }
            const data: { fileName?: string; listenPort?: number; error?: string } | null = await this.socket.sendTo(
                this.statePrefix,
                'getFile',
                { type: 'local', fileName: path, protocol: window.location.protocol },
            );
            if (!data?.listenPort) {
                this.showToast(data?.error ? `${I18n.t('Error')}: ${data.error}` : I18n.t('Error'));
                return;
            }
            saveAs(
                `${window.location.protocol}//${window.location.hostname}:${data.listenPort}/${encodeURIComponent(data.fileName || entry.name)}`,
            );
        } catch (e) {
            this.showToast(`${I18n.t('Error')}: ${e}`);
        } finally {
            this.setState({ downloadIndex: null });
        }
    };

    onRestoreRecent = async (entry: HistoryEntry): Promise<void> => {
        if (!entry.name) {
            return;
        }
        try {
            const path = await this.findLocalBackup(entry.name);
            if (path) {
                this.setState({ showRestore: { location: 'local', object: entry.type, fileName: path } });
            } else {
                this.showNotFoundLocally();
            }
        } catch (e) {
            this.showToast(`${I18n.t('Error')}: ${e}`);
        }
    };

    getBackupNowContext(): React.ComponentProps<typeof BackupNow>['oContext'] {
        return {
            adapterName: this.adapterName,
            socket: this.socket,
            instance: this.instance,
            themeType: this.derivedThemeType,
            dateFormat: this.socket.systemConfig?.common.dateFormat || 'DD.MM.YYYY HH:mm',
            isFloatComma: this.socket.systemConfig?.common.isFloatComma || false,
            theme: this.state.theme,
            _themeName: this.state.themeName,
            systemConfig: this.socket.systemConfig?.common || ({} as ioBroker.SystemConfigCommon),
            onCommandRunning: (_ignore: boolean): void => {},
            forceUpdate: (): void => {},
        };
    }

    renderBackupNowTile(
        t: DashboardTokens,
        type: 'iobroker' | 'ccu',
        enabled: boolean,
        label: string,
        /** A function gets the running state and shows it itself, otherwise a spinner replaces the icon */
        icon: React.ReactNode | ((executing: boolean) => React.ReactNode),
        primary: boolean,
        hoverEffect?: HoverEffect,
    ): React.JSX.Element {
        const animated = typeof icon === 'function';
        if (!this.state.myAlive || !enabled) {
            return (
                <ActionTile
                    t={t}
                    vertical
                    disabled
                    primary={primary}
                    icon={animated ? icon(false) : icon}
                    label={I18n.t(label)}
                />
            );
        }
        return (
            <BackupNow
                oContext={this.getBackupNowContext()}
                color={this.isDark() ? 'primary' : 'grey'}
                alive
                onError={(): void => {}}
                schema={{
                    backUpType: type,
                    label,
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
                renderButton={button => (
                    <ActionTile
                        t={t}
                        vertical
                        primary={primary}
                        icon={animated ? icon(button.executing) : icon}
                        hoverEffect={hoverEffect}
                        label={button.label}
                        disabled={button.disabled && !button.executing}
                        busy={!animated && button.executing}
                        onClick={button.executing ? undefined : button.onClick}
                    />
                )}
            />
        );
    }

    renderHeader(t: DashboardTokens): React.JSX.Element {
        return (
            <Box
                component="header"
                sx={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: '10px', sm: '14px' },
                    padding: { xs: '6px 12px', sm: '8px 20px' },
                    borderBottom: `1px solid ${t.divider}`,
                    background: t.dark ? 'rgba(255, 255, 255, 0.015)' : '#FFFFFF',
                }}
            >
                <img
                    src={logo}
                    alt="BackItUp"
                    style={{
                        height: 40,
                        flexShrink: 0,
                        filter: t.dark ? 'drop-shadow(0 0 8px rgba(56, 160, 255, 0.35))' : undefined,
                    }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: '1.35rem',
                            fontWeight: 700,
                            letterSpacing: '-0.01em',
                            lineHeight: 1.15,
                            color: t.text,
                        }}
                    >
                        BackItUp
                        <AliveLed
                            socket={this.socket}
                            instanceId={this.statePrefix}
                            alive={this.state.myAlive}
                        />
                    </div>
                    <div
                        style={{
                            color: t.textSecondary,
                            fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.9rem)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {I18n.t('Back up your system automatically and reliably.')}
                    </div>
                </div>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: '8px' }}>
                    <RoundButton
                        t={t}
                        title="PayPal.Me"
                        onClick={() => window.open('https://paypal.me/mk1676', '_blank')}
                    >
                        <Favorite />
                    </RoundButton>
                    <RoundButton
                        t={t}
                        title="Wiki"
                        onClick={() => window.open('https://github.com/simatec/ioBroker.backitup/wiki', '_blank')}
                    >
                        <School />
                    </RoundButton>
                    <RoundButton
                        t={t}
                        title={I18n.t('Show adapter documentation')}
                        onClick={() =>
                            window.open('https://github.com/simatec/ioBroker.backitup/blob/master/README.md', '_blank')
                        }
                    >
                        <Help />
                    </RoundButton>
                </Box>
                <Tooltip
                    title={I18n.t('More')}
                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                >
                    <IconButton
                        onClick={e => this.setState({ moreMenu: e.currentTarget })}
                        sx={{ color: t.text }}
                    >
                        <MoreVert />
                    </IconButton>
                </Tooltip>
                <Menu
                    open={!!this.state.moreMenu}
                    anchorEl={this.state.moreMenu}
                    onClose={() => this.setState({ moreMenu: null })}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            this.openConfiguration();
                        }}
                    >
                        <ListItemIcon>
                            <SettingsOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>{I18n.t('Open adapter configuration')}</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            window.open('https://paypal.me/mk1676', '_blank');
                        }}
                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                    >
                        <ListItemIcon>
                            <Favorite fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>PayPal.Me</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            window.open('https://github.com/simatec/ioBroker.backitup/wiki', '_blank');
                        }}
                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                    >
                        <ListItemIcon>
                            <School fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Wiki</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            window.open('https://github.com/simatec/ioBroker.backitup/blob/master/README.md', '_blank');
                        }}
                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                    >
                        <ListItemIcon>
                            <Help fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>{I18n.t('Show adapter documentation')}</ListItemText>
                    </MenuItem>
                </Menu>
            </Box>
        );
    }

    renderHero(): React.JSX.Element {
        const native = this.state.native;
        const both = !!native.minimalEnabled && !!native.ccuEnabled;
        const rows: HeroBackupInfo[] = [];
        if (native.minimalEnabled) {
            rows.push({
                title: both ? 'ioBroker' : undefined,
                lastTime: this.state.iobrokerLastTime,
                nextTime: this.state.iobrokerNextTime,
                interval: this.getInterval('iobroker'),
                running: this.state.iobrokerRunning,
                onShowLog: () => this.showLatestLog('iobroker', this.state.iobrokerLastTime),
            });
        }
        if (native.ccuEnabled) {
            rows.push({
                title: both ? I18n.t('Homematic CCU backup') : undefined,
                lastTime: this.state.ccuLastTime,
                nextTime: this.state.ccuNextTime,
                interval: this.getInterval('ccu'),
                running: this.state.ccuRunning,
                onShowLog: () => this.showLatestLog('ccu', this.state.ccuLastTime),
            });
        }
        return <HeroCard rows={rows} />;
    }

    showLatestLog(latest: 'iobroker' | 'ccu', lastTime: string): void {
        const last = parseLastTime(lastTime);
        this.setState({
            showLogs: {
                fileName: '',
                timestamp: 0,
                index: -1,
                latest,
                failedAt: last.status === 'error' ? last.text : undefined,
            },
        });
    }

    renderStorageOptions(t: DashboardTokens): React.JSX.Element {
        const native = this.state.native;
        const enabled = STORAGE_OPTIONS.filter(option => native[option.name]);
        const list = enabled.length ? enabled : [{ name: 'local', type: 'local', label: 'Local' }];

        return (
            <DashboardCard
                t={t}
                style={{ padding: '12px 8px 12px 14px', display: 'flex', alignItems: 'flex-start', gap: 14 }}
            >
                <IconBox
                    t={t}
                    size={40}
                >
                    <StorageOutlined fontSize="inherit" />
                </IconBox>
                <div style={{ flex: 1, minWidth: 0, color: t.text }}>
                    <div style={cardTitleStyle}>{I18n.t('Storage options')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {list.map(option => (
                            <div
                                key={option.name}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}
                            >
                                <span
                                    style={{
                                        width: 28,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <StorageIcon type={option.type} />
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        fontSize: '0.92rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {option.type === 'cifs' && native.connectType
                                        ? `NAS (${native.connectType})`
                                        : I18n.t(option.label)}
                                </span>
                                <Pill
                                    color={t.success}
                                    background={t.successBg}
                                    border={t.successBorder}
                                >
                                    {I18n.t('Active')}
                                </Pill>
                            </div>
                        ))}
                    </div>
                </div>
                <Tooltip
                    title={I18n.t('Open adapter configuration')}
                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                >
                    <IconButton
                        onClick={() => this.openConfiguration()}
                        size="small"
                        sx={{ alignSelf: 'center', color: t.text }}
                    >
                        <ChevronRight />
                    </IconButton>
                </Tooltip>
            </DashboardCard>
        );
    }

    renderBackupOptions(t: DashboardTokens): React.JSX.Element {
        const enabled = BACKUP_OPTIONS.filter(option => this.state.native[option.name]);

        return (
            <DashboardCard
                t={t}
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 14 }}
            >
                <IconBox
                    t={t}
                    size={40}
                >
                    <LayersOutlined fontSize="inherit" />
                </IconBox>
                <div style={{ flex: 1, minWidth: 0, color: t.text }}>
                    <div style={cardTitleStyle}>{I18n.t('Activated backup options')}</div>
                    {enabled.length ? (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                gap: '6px 16px',
                            }}
                        >
                            {enabled.map(option => (
                                <div
                                    key={option.name}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
                                >
                                    <CheckMark />
                                    <span
                                        style={{
                                            fontSize: '0.92rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {I18n.t(option.label)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: t.textMuted }}>{I18n.t('No backup activated')}</div>
                    )}
                </div>
            </DashboardCard>
        );
    }

    renderActions(t: DashboardTokens): React.JSX.Element {
        const native = this.state.native;
        return (
            <>
                <SectionHeader
                    t={t}
                    icon={<PlayArrow fontSize="inherit" />}
                    title={I18n.t('Actions')}
                />
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 12,
                    }}
                >
                    {this.renderBackupNowTile(
                        t,
                        'iobroker',
                        !!native.minimalEnabled,
                        'ioBroker start backup',
                        executing => (
                            <IconPlayPause
                                running={false}
                                pending={executing}
                                fontSize="inherit"
                            />
                        ),
                        true,
                    )}
                    {/* most systems have no Homematic CCU: no tile for a backup that is not configured */}
                    {native.ccuEnabled
                        ? this.renderBackupNowTile(
                              t,
                              'ccu',
                              true,
                              'Homematic start backup',
                              <CloudUploadOutlined fontSize="inherit" />,
                              false,
                              'lift',
                          )
                        : null}
                    <ActionTile
                        t={t}
                        vertical
                        icon={<SettingsOutlined fontSize="inherit" />}
                        hoverEffect="spin"
                        label={I18n.t('Save BackItUp settings')}
                        onClick={() => void this.saveSettings()}
                    />
                    <ActionTile
                        t={t}
                        vertical
                        icon={<FileDownloadOutlined fontSize="inherit" />}
                        hoverEffect="drop"
                        label={I18n.t('Restore BackItUp settings')}
                        onClick={() => this.setState({ showUploadSettings: true })}
                    />
                    <ActionTile
                        t={t}
                        vertical
                        icon={<FormatListBulleted fontSize="inherit" />}
                        hoverEffect="lines"
                        label={I18n.t('Show backup history')}
                        onClick={() => this.setState({ showBackupHistory: true })}
                    />
                </div>
            </>
        );
    }

    renderRecentBackups(t: DashboardTokens): React.JSX.Element {
        return (
            <>
                <SectionHeader
                    t={t}
                    icon={<History fontSize="inherit" />}
                    title={I18n.t('Recent backups')}
                    right={
                        <Box
                            component="button"
                            type="button"
                            onClick={() => this.setState({ showBackupHistory: true })}
                            sx={{
                                appearance: 'none',
                                border: 0,
                                background: 'none',
                                font: 'inherit',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                color: t.accent,
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                '&:hover': { textDecoration: 'underline' },
                            }}
                        >
                            {I18n.t('Show history')}
                            <ArrowForward style={{ fontSize: 18 }} />
                        </Box>
                    }
                />
                <RecentBackups
                    t={t}
                    entries={this.state.history.slice(0, RECENT_BACKUPS)}
                    alive={this.state.myAlive}
                    isFloatComma={!!this.socket.systemConfig?.common.isFloatComma}
                    busyIndex={this.state.downloadIndex}
                    onDownload={(entry, index) => void this.onDownloadRecent(entry, index)}
                    onRestore={entry => void this.onRestoreRecent(entry)}
                    onLog={(entry, index) =>
                        this.setState({
                            showLogs: { fileName: entry.name || '', timestamp: entry.timestamp || 0, index },
                        })
                    }
                />
            </>
        );
    }

    renderRestore(t: DashboardTokens): React.JSX.Element {
        return (
            <>
                <SectionHeader
                    t={t}
                    icon={<SettingsBackupRestore fontSize="inherit" />}
                    title={I18n.t('Restore')}
                />
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 12,
                    }}
                >
                    <SourceSelect
                        t={t}
                        value={this.state.backupSource}
                        data={this.state.native}
                        onChange={backupSource => {
                            window.localStorage.setItem('BackItUp.backupSource', backupSource);
                            this.setState({ backupSource });
                        }}
                    />
                    <ActionTile
                        t={t}
                        icon={<Search fontSize="inherit" />}
                        hoverEffect="wiggle"
                        label={I18n.t('Get list')}
                        disabled={!this.state.myAlive}
                        onClick={() => this.setState({ showGetBackups: true })}
                    />
                    <ActionTile
                        t={t}
                        icon={<IconUpload fontSize="inherit" />}
                        label={I18n.t('Upload Backup File')}
                        onClick={() => this.setState({ showUploadBackup: true })}
                    />
                </div>
            </>
        );
    }

    renderDialogs(): React.JSX.Element {
        return (
            <>
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
                        backupSource={this.state.showGetBackups === 'local' ? 'local' : this.state.backupSource}
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
                        onShowBackups={() => this.setState({ showUploadBackup: false, showGetBackups: 'local' })}
                        socket={this.socket}
                        themeType={this.derivedThemeType}
                        themeBreakpoints={this.state.theme.breakpoints.down}
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
                {this.state.showUploadSettings ? (
                    <UploadSettings
                        onClose={() => this.setState({ showUploadSettings: false })}
                        socket={this.socket}
                        themeType={this.derivedThemeType}
                        adapterName={this.adapterName}
                        instance={this.instance}
                    />
                ) : null}
            </>
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

        const t = getTokens(this.isDark());

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <CssBaseline />
                    <ScrollbarStyles theme={this.state.theme} />
                    <div
                        className="App"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            background: this.state.theme.palette.background.default,
                            color: t.text,
                        }}
                    >
                        {this.renderHeader(t)}
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                overflow: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: { xs: '10px 10px 16px', sm: '14px 20px 20px' },
                            }}
                        >
                            {/* the blocks fade in one after another when the tab opens */}
                            <Box sx={revealSx(0)}>{this.renderHero()}</Box>
                            <Spacer />
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
                                    gap: '14px',
                                    marginTop: '14px',
                                    ...revealSx(1),
                                }}
                            >
                                {this.renderStorageOptions(t)}
                                {this.renderBackupOptions(t)}
                            </Box>
                            <Spacer />
                            <Box sx={revealSx(2)}>{this.renderActions(t)}</Box>
                            <Spacer />
                            <Box sx={revealSx(3)}>{this.renderRecentBackups(t)}</Box>
                            <Spacer />
                            <Box sx={revealSx(4)}>{this.renderRestore(t)}</Box>
                            {this.renderError()}
                        </Box>
                    </div>
                    {this.renderDialogs()}
                    {this.renderToast()}
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
