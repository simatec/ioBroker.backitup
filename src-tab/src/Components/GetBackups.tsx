import React, { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    IconButton,
    Tooltip,
    useMediaQuery,
} from '@mui/material';
import { Close, ExpandMore, FileDownloadOutlined, Search, SettingsBackupRestore } from '@mui/icons-material';

import { DiRedis, DiMysql, DiPostgresql, DiSqllite } from 'react-icons/di';
import { SiNodered, SiEsphome, SiZigbee, SiGrafana, SiInfluxdb } from 'react-icons/si';
import { type AdminConnection, I18n, IconRefresh, type ThemeType } from '@iobroker/gui-components';

import CCU from '../assets/ccu.png';
import ioBrokerIcon from '../assets/iobroker.png';
import historyIcon from '../assets/history.png';
import zigbee2mqttIcon from '../assets/zigbee2mqtt.png';
import javascriptIcon from '../assets/javascript.png';
import jarvisIcon from '../assets/jarvis.png';
import yahkaIcon from '../assets/yahka.png';
import type { Breakpoint } from '@mui/system';

import { getTokens, type DashboardTokens } from './Dashboard/tokens';
import { DashboardCard } from './Dashboard/Parts';
import { DialogHeader, dialogSx, errorText } from './Dashboard/DialogParts';
import { StorageIcon } from './Dashboard/StorageIcons';

interface BackupFile {
    name: string;
    size: number;
    path: string;
}

type BackupList = Record<string, Record<string, BackupFile[]>>;

function formatSize(bytes: number): string {
    if (bytes > 1024 * 1024 * 512) {
        return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10} ${I18n.t('GiB')}`;
    }
    if (bytes > 1024 * 1024) {
        return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} ${I18n.t('MiB')}`;
    }
    if (bytes > 1024) {
        return `${Math.round((bytes / 1024) * 10) / 10} ${I18n.t('KiB')}`;
    }
    return `${bytes} ${I18n.t('bytes')}`;
}

/**
 * Time of a backup from its file name, e.g. `iobroker_2026_11_04-02_48_10_backupiobroker.tar.gz`.
 *
 * @param name file name
 * @returns null if the name does not hold a date
 */
function parseDate(name: string): Date | null {
    const parts = name.split('_');
    if (parseInt(parts[0], 10).toString() !== parts[0]) {
        parts.shift();
    }
    if (parts.length < 4 || !parts[2].includes('-')) {
        return null;
    }
    const date = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2].split('-')[0], 10),
        parseInt(parts[2].split('-')[1], 10),
        parseInt(parts[3], 10),
    );
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date | null, fallback: string, short?: boolean): string {
    if (!date) {
        return fallback;
    }
    try {
        return date.toLocaleString(I18n.getLanguage(), {
            day: '2-digit',
            month: short ? 'short' : 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return date.toLocaleString();
    }
}

/** Icons of the backup types: a component or an image */
const TYPE_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }> | string> = {
    iobroker: ioBrokerIcon,
    historyDB: historyIcon,
    ccu: CCU,
    homematic: CCU,
    javascripts: javascriptIcon,
    nodered: SiNodered,
    influxDB: SiInfluxdb,
    zigbee: SiZigbee,
    zigbee2mqtt: zigbee2mqttIcon,
    grafana: SiGrafana,
    esphome: SiEsphome,
    jarvis: jarvisIcon,
    redis: DiRedis,
    'redis-remote': DiRedis,
    mysql: DiMysql,
    sqlite: DiSqllite,
    pgsql: DiPostgresql,
    yahka: yahkaIcon,
};

const TYPE_LABELS: Record<string, string> = {
    iobroker: 'ioBroker',
    historyDB: 'History',
    ccu: 'Homematic CCU',
    homematic: 'Homematic CCU',
    javascripts: 'JavaScript',
    nodered: 'Node-RED',
    influxDB: 'InfluxDB',
    zigbee: 'Zigbee',
    zigbee2mqtt: 'Zigbee2MQTT',
    grafana: 'Grafana',
    esphome: 'ESPHome',
    jarvis: 'Jarvis',
    redis: 'Redis',
    'redis-remote': 'Redis (remote)',
    mysql: 'MySQL',
    sqlite: 'SQLite',
    pgsql: 'PostgreSQL',
    yahka: 'Yahka',
};

const STORAGE_LABELS: Record<string, string> = {
    cifs: 'NAS',
    'nas / copy': 'NAS',
    ftp: 'FTP',
    dropbox: 'Dropbox',
    onedrive: 'OneDrive',
    googledrive: 'Google Drive',
    webdav: 'WebDAV',
};

function TypeIcon(props: { type: string }): React.JSX.Element {
    const Icon = TYPE_ICONS[props.type.split('.')[0]];
    const box: React.CSSProperties = {
        width: 22,
        height: 22,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };
    if (!Icon) {
        return <span style={box} />;
    }
    if (typeof Icon === 'string') {
        return (
            <span style={box}>
                <img
                    src={Icon}
                    alt=""
                    style={{ width: 22, height: 22, display: 'block' }}
                />
            </span>
        );
    }
    return (
        <span style={box}>
            <Icon style={{ width: 20, height: 20, display: 'block' }} />
        </span>
    );
}

/** e.g. "Zigbee · 0" for the type key `zigbee.0` */
function typeLabel(type: string): string {
    const [base, ...rest] = type.split('.');
    const label = TYPE_LABELS[base] || base;
    return rest.length ? `${label} · ${rest.join('.')}` : label;
}

function storageLabel(location: string, connectType: string): string {
    const label = location === 'local' ? I18n.t('Local') : STORAGE_LABELS[location] || location;
    return (location === 'cifs' || location === 'nas / copy') && connectType ? `${label} (${connectType})` : label;
}

function CountBadge(props: { t: DashboardTokens; count: number }): React.JSX.Element {
    return (
        <span
            style={{
                minWidth: 24,
                padding: '1px 8px',
                borderRadius: 999,
                fontSize: '0.78rem',
                fontWeight: 600,
                lineHeight: 1.5,
                textAlign: 'center',
                color: props.t.textSecondary,
                background: props.t.iconBoxBg,
                border: `1px solid ${props.t.iconBoxBorder}`,
            }}
        >
            {props.count}
        </span>
    );
}

/** Clickable header of a collapsible group. Icon, text and badge are centered on one line. */
function GroupHeader(props: {
    t: DashboardTokens;
    icon: React.ReactNode;
    label: string;
    count: number;
    open: boolean;
    onToggle: () => void;
    level: 1 | 2;
}): React.JSX.Element {
    const { t } = props;
    return (
        <Box
            component="button"
            type="button"
            onClick={props.onToggle}
            aria-expanded={props.open}
            sx={{
                appearance: 'none',
                border: 0,
                background: 'none',
                font: 'inherit',
                color: t.text,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                padding: props.level === 1 ? '14px 18px' : '10px 18px',
                borderRadius: props.level === 1 ? '14px' : 0,
                '&:hover': { background: t.rowHover },
                '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: -2 },
            }}
        >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28 }}>
                {props.icon}
            </span>
            <span
                style={{
                    fontSize: props.level === 1 ? '1.05rem' : '0.95rem',
                    fontWeight: props.level === 1 ? 700 : 600,
                    lineHeight: 1.3,
                }}
            >
                {props.label}
            </span>
            <CountBadge
                t={t}
                count={props.count}
            />
            <span style={{ flex: 1 }} />
            <ExpandMore
                style={{
                    color: t.textSecondary,
                    transition: 'transform 0.2s ease',
                    transform: props.open ? 'rotate(180deg)' : 'none',
                }}
            />
        </Box>
    );
}

interface GetBackupsProps {
    themeBreakpoints: (key: Breakpoint | number) => string;
    themeType: ThemeType;
    onClose: () => void;
    onRestore: (location: string, object: string, path: string) => void;
    allowDownload: boolean;
    backupSource: string;
    connectType: string;
    adapterName: string;
    instance: number;
    socket: AdminConnection;
}

const COLLAPSED_KEY = 'BackItUp.collapsedBackups';

function readCollapsed(): string[] {
    try {
        const list = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

export default function GetBackups(props: GetBackupsProps): React.JSX.Element {
    const fullScreen = useMediaQuery(props.themeBreakpoints('sm'));
    const t = getTokens(props.themeType === 'dark');
    const [backups, setBackups] = useState<BackupList | null>(null);
    const [loading, setLoading] = useState(true);
    /** Every increment loads the list again */
    const [reloadCount, setReloadCount] = useState(0);
    const [listError, setListError] = useState('');
    const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
    const [busyPath, setBusyPath] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        props.socket
            .sendTo(`${props.adapterName}.${props.instance}`, 'list', props.backupSource)
            .then((result: { error?: string | null; data?: BackupList } | null): void => {
                const data = result?.data || {};
                // newest first
                Object.values(data).forEach(location =>
                    Object.values(location).forEach(files =>
                        files.sort((a, b) => {
                            const da = parseDate(a.name)?.getTime() || 0;
                            const db = parseDate(b.name)?.getTime() || 0;
                            return db - da || (a.name > b.name ? -1 : 1);
                        }),
                    ),
                );
                setListError(result?.error ? errorText(result.error) : '');
                setBackups(data);
                setLoading(false);
            })
            .catch((e: unknown) => {
                setListError(errorText(e));
                setBackups(old => old || {});
                setLoading(false);
            });
    }, [props.socket, props.adapterName, props.instance, props.backupSource, reloadCount]);

    const reload = (): void => {
        setLoading(true);
        setReloadCount(count => count + 1);
    };

    const toggle = (key: string): void => {
        const list = collapsed.includes(key) ? collapsed.filter(k => k !== key) : [...collapsed, key];
        try {
            window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(list));
        } catch {
            // ignore
        }
        setCollapsed(list);
    };

    const download = async (location: string, backup: BackupFile): Promise<void> => {
        setBusyPath(backup.path);
        setMessage('');
        try {
            const data: { fileName?: string; listenPort?: number; error?: unknown } | null = await props.socket.sendTo(
                `${props.adapterName}.${props.instance}`,
                'getFile',
                {
                    type: location,
                    fileName: backup.path,
                    protocol: window.location.protocol,
                },
            );
            if (!data?.listenPort) {
                setMessage(`${I18n.t('Error')}: ${data?.error ? errorText(data.error) : backup.name}`);
                return;
            }
            saveAs(
                `${window.location.protocol}//${window.location.hostname}:${data.listenPort}/${encodeURIComponent(data.fileName || backup.path.split(/[\\/]/).pop() || '')}`,
            );
        } catch (e) {
            setMessage(`${I18n.t('Error')}: ${errorText(e)}`);
        } finally {
            setBusyPath(null);
        }
    };

    const locations = backups ? Object.keys(backups).filter(l => Object.keys(backups[l] || {}).length) : [];

    const renderRow = (location: string, object: string, backup: BackupFile, index: number): React.JSX.Element => {
        const busy = busyPath === backup.path;
        return (
            <Box
                key={backup.path}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1fr) 100px auto' },
                    alignItems: 'center',
                    columnGap: '16px',
                    padding: { xs: '10px 12px 10px 16px', sm: '10px 18px 10px 58px' },
                    borderTop: `1px solid ${t.rowDivider}`,
                    '&:hover': { background: t.rowHover },
                }}
            >
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, minWidth: 0 }}
                    >
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: t.text }}>
                            {formatDate(parseDate(backup.name), backup.name, fullScreen)}
                        </span>
                        {index === 0 ? (
                            <span
                                style={{
                                    padding: '1px 8px',
                                    borderRadius: 999,
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    lineHeight: 1.5,
                                    color: t.accent,
                                    border: `1px solid ${t.iconBoxBorder}`,
                                    background: t.iconBoxBg,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {I18n.t('Latest')}
                            </span>
                        ) : null}
                    </div>
                    <div
                        style={{
                            fontSize: '0.78rem',
                            color: t.textMuted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 2,
                        }}
                        title={backup.name}
                    >
                        {fullScreen ? `${formatSize(backup.size)} · ${backup.name}` : backup.name}
                    </div>
                </div>
                <Box
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        fontSize: '0.9rem',
                        color: t.textSecondary,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {formatSize(backup.size)}
                </Box>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {props.allowDownload ? (
                        <Tooltip
                            title={I18n.t('Download Backup File')}
                            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                        >
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={!!busyPath}
                                    onClick={() => void download(location, backup)}
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '10px',
                                        color: t.text,
                                        border: `1px solid ${t.tileBorder}`,
                                        '&:hover': { borderColor: t.tileHoverBorder, background: t.rowHover },
                                    }}
                                >
                                    {busy ? <CircularProgress size={18} /> : <FileDownloadOutlined fontSize="small" />}
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : null}
                    <Tooltip
                        title={I18n.t('Restore Backup File')}
                        slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                    >
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={!!busyPath}
                            onClick={() => props.onRestore(location, object, backup.path)}
                            startIcon={fullScreen ? undefined : <SettingsBackupRestore />}
                            sx={{
                                height: 36,
                                minWidth: fullScreen ? 36 : undefined,
                                px: fullScreen ? 0 : '14px',
                                borderRadius: '10px',
                                textTransform: 'none',
                                fontWeight: 600,
                                color: t.accent,
                                borderColor: t.iconBoxBorder,
                                '&:hover': { borderColor: t.accent, background: t.iconBoxBg },
                            }}
                        >
                            {fullScreen ? <SettingsBackupRestore fontSize="small" /> : I18n.t('Restore')}
                        </Button>
                    </Tooltip>
                </div>
            </Box>
        );
    };

    let content: React.ReactNode;
    if (!backups) {
        content = (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                    padding: '48px 0',
                    color: t.textSecondary,
                }}
            >
                <CircularProgress size={34} />
                {I18n.t('Loading backups...')}
            </div>
        );
    } else if (!locations.length) {
        content = (
            <div style={{ padding: '48px 0', textAlign: 'center', color: t.textMuted }}>
                {I18n.t('No backups found')}
            </div>
        );
    } else {
        content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {locations.map(location => {
                    const objects = Object.keys(backups[location]).filter(o => backups[location][o]?.length);
                    const total = objects.reduce((sum, o) => sum + backups[location][o].length, 0);
                    const locationOpen = !collapsed.includes(location);
                    return (
                        <DashboardCard
                            key={location}
                            t={t}
                        >
                            <GroupHeader
                                t={t}
                                level={1}
                                icon={
                                    <StorageIcon
                                        type={location}
                                        size={22}
                                        open={locationOpen}
                                    />
                                }
                                label={storageLabel(location, props.connectType)}
                                count={total}
                                open={locationOpen}
                                onToggle={() => toggle(location)}
                            />
                            <Collapse
                                in={locationOpen}
                                unmountOnExit
                            >
                                {objects.map(object => {
                                    const key = `${location}/${object}`;
                                    const open = !collapsed.includes(key);
                                    return (
                                        <div
                                            key={object}
                                            style={{ borderTop: `1px solid ${t.rowDivider}` }}
                                        >
                                            <GroupHeader
                                                t={t}
                                                level={2}
                                                icon={<TypeIcon type={object} />}
                                                label={typeLabel(object)}
                                                count={backups[location][object].length}
                                                open={open}
                                                onToggle={() => toggle(key)}
                                            />
                                            <Collapse
                                                in={open}
                                                unmountOnExit
                                            >
                                                {backups[location][object].map((backup, i) =>
                                                    renderRow(location, object, backup, i),
                                                )}
                                            </Collapse>
                                        </div>
                                    );
                                })}
                            </Collapse>
                        </DashboardCard>
                    );
                })}
            </div>
        );
    }

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
            fullWidth
            fullScreen={fullScreen}
            maxWidth="md"
            sx={dialogSx(t, fullScreen)}
        >
            <DialogHeader
                t={t}
                compact={fullScreen}
                icon={<Search fontSize="inherit" />}
                title={I18n.t('Select backup')}
                subtitle={I18n.t('Choose a backup to download or restore.')}
                onClose={props.onClose}
                actions={
                    <Tooltip
                        title={I18n.t('Reload list')}
                        slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                    >
                        <span>
                            <IconButton
                                onClick={reload}
                                disabled={loading}
                                sx={{ color: t.textSecondary }}
                                aria-label={I18n.t('Reload list')}
                            >
                                <IconRefresh loading={loading} />
                            </IconButton>
                        </span>
                    </Tooltip>
                }
            />
            <div
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: fullScreen ? '14px 10px' : '18px 24px',
                }}
            >
                {listError ? (
                    <Alert
                        severity="warning"
                        sx={{ mb: 2 }}
                    >
                        {listError}
                    </Alert>
                ) : null}
                {message ? (
                    <Alert
                        severity="error"
                        sx={{ mb: 2 }}
                        onClose={() => setMessage('')}
                    >
                        {message}
                    </Alert>
                ) : null}
                {content}
            </div>
            <DialogActions
                sx={{
                    padding: fullScreen ? '10px 14px' : '12px 24px 18px',
                    borderTop: `1px solid ${t.divider}`,
                }}
            >
                <Button
                    onClick={props.onClose}
                    startIcon={<Close />}
                    variant="contained"
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, px: 2.5 }}
                >
                    {I18n.t('Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
