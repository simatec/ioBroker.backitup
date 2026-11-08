import React, { useEffect, useState, type JSX } from 'react';

import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    IconButton,
    Tooltip,
    useMediaQuery,
} from '@mui/material';
import { BugReport, Close, FormatListBulleted, RouterOutlined, StorageOutlined } from '@mui/icons-material';

import { type AdminConnection, I18n, type ThemeType } from '@iobroker/gui-components';
import type { Breakpoint } from '@mui/system';

import { formatHistorySize, type HistorySize } from './historySize';
import { getTokens, type DashboardTokens } from './Dashboard/tokens';
import { DialogHeader, dialogSx } from './Dashboard/DialogParts';
import { DashboardCard, Pill, StatusMark } from './Dashboard/Parts';
import { StorageIcon } from './Dashboard/StorageIcons';
import { TYPE_LABELS } from './Dashboard/RecentBackups';

interface BackupHistoryProps {
    themeBreakpoints: (key: Breakpoint | number) => string;
    themeType: ThemeType;
    adapterName: string;
    instance: number;
    socket: AdminConnection;
    onClose: () => void;
    onLogs: (name: string, timestamp: number, index: number) => void;
}

/** One entry of the state history.json */
type HistoryEntry = {
    date: string;
    type: string;
    name: string;
    storage: string | string[];
    error?: string;
    timestamp: number;
} & HistorySize;

/**
 * The adapter writes the storages as translated labels ("Dropbox", "NAS / Copy", "Only stored locally", ...).
 * Finds the icon type for such a label; everything unknown is the local directory.
 *
 * @param label storage label of the history entry
 */
function storageType(label: string): string {
    const text = label.toLowerCase();
    if (text.includes('dropbox')) {
        return 'dropbox';
    }
    if (text.includes('onedrive')) {
        return 'onedrive';
    }
    if (text.includes('google')) {
        return 'googledrive';
    }
    if (text.includes('webdav')) {
        return 'webdav';
    }
    if (text.includes('ftp')) {
        return 'ftp';
    }
    if (text.includes('nas')) {
        return 'cifs';
    }
    return 'local';
}

/** Small column title above the list */
function ColumnTitle(props: {
    t: DashboardTokens;
    children: React.ReactNode;
    align?: 'right' | 'center';
}): JSX.Element {
    return (
        <span
            style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: props.t.textMuted,
                textAlign: props.align,
                whiteSpace: 'nowrap',
            }}
        >
            {props.children}
        </span>
    );
}

/**
 * Columns of the list. Header and rows are subgrids of one grid, so the `auto` columns (result, size, log)
 * get the same width in every row - also when a column title is wider than its content.
 */
const COLUMNS = {
    xs: '22px minmax(0, 1fr) auto',
    md: '22px minmax(200px, 2fr) minmax(130px, 1fr) auto minmax(120px, 1fr) auto auto',
};

export default function BackupHistory(props: BackupHistoryProps): JSX.Element {
    const fullScreen = useMediaQuery(props.themeBreakpoints('sm'));
    const t = getTokens(props.themeType === 'dark');
    const isFloatComma = !!props.socket.systemConfig?.common.isFloatComma;
    const [history, setHistory] = useState<HistoryEntry[] | null>(null);

    useEffect(() => {
        void props.socket
            .getState(`${props.adapterName}.${props.instance}.history.json`)
            .then(state => {
                try {
                    setHistory(state?.val ? JSON.parse(state.val as string) : []);
                } catch {
                    setHistory([]);
                }
            })
            .catch(() => setHistory([]));
    }, [props.socket, props.adapterName, props.instance]);

    const renderRow = (entry: HistoryEntry, index: number, count: number): JSX.Element => {
        const ok = !entry.error || entry.error === 'none';
        const TypeIcon = entry.type === 'ccu' ? RouterOutlined : StorageOutlined;
        const typeLabel = I18n.t(TYPE_LABELS[entry.type] || entry.type);
        const storages = Array.isArray(entry.storage) ? entry.storage : entry.storage ? [entry.storage] : [];
        const size = formatHistorySize(entry, isFloatComma);

        return (
            <Box
                key={`${entry.timestamp || entry.date}_${entry.name}_${index}`}
                sx={{
                    gridColumn: '1 / -1',
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                    alignItems: 'center',
                    minHeight: 52,
                    padding: '6px 0',
                    borderBottom: index < count - 1 ? `1px solid ${t.rowDivider}` : 'none',
                    color: t.text,
                }}
            >
                <StatusMark
                    ok={ok}
                    t={t}
                />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{entry.date}</div>
                    <div
                        style={{
                            fontSize: '0.76rem',
                            color: t.textMuted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 1,
                        }}
                        title={entry.name}
                    >
                        {entry.name}
                    </div>
                    {/* on small screens type, storage and size go into one line below the name */}
                    <Box
                        sx={{
                            display: { xs: 'flex', md: 'none' },
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '4px 10px',
                            marginTop: '4px',
                            fontSize: '0.78rem',
                            color: t.textSecondary,
                        }}
                    >
                        <span>{typeLabel}</span>
                        <span>·</span>
                        <span>{storages.join(', ')}</span>
                        <span>·</span>
                        <span>{size}</span>
                        {ok ? null : (
                            <Pill
                                color={t.error}
                                background={t.errorBg}
                                border={t.errorBorder}
                                title={entry.error}
                            >
                                {I18n.t('Failed')}
                            </Pill>
                        )}
                    </Box>
                </div>
                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: 0,
                        fontSize: '0.88rem',
                    }}
                >
                    <TypeIcon style={{ fontSize: 18, color: t.textSecondary, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeLabel}
                    </span>
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                    {ok ? (
                        <Pill
                            color={t.success}
                            background={t.successBg}
                            border={t.successBorder}
                        >
                            {I18n.t('Successful')}
                        </Pill>
                    ) : (
                        <Pill
                            color={t.error}
                            background={t.errorBg}
                            border={t.errorBorder}
                            title={entry.error}
                        >
                            {I18n.t('Failed')}
                        </Pill>
                    )}
                </Box>
                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        flexDirection: 'column',
                        gap: '4px',
                        minWidth: 0,
                        fontSize: '0.88rem',
                    }}
                >
                    {storages.map(storage => (
                        <span
                            key={storage}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
                        >
                            <span style={{ display: 'flex', width: 20, justifyContent: 'center', flexShrink: 0 }}>
                                <StorageIcon
                                    type={storageType(storage)}
                                    size={16}
                                />
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {storage}
                            </span>
                        </span>
                    ))}
                </Box>
                <Box
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        fontSize: '0.88rem',
                        color: t.textSecondary,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {size}
                </Box>
                <Tooltip
                    title={I18n.t('Open Backup Log')}
                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                >
                    <IconButton
                        size="small"
                        onClick={() => props.onLogs(entry.name, entry.timestamp, index)}
                        aria-label={I18n.t('Open Backup Log')}
                        sx={{
                            justifySelf: 'center',
                            width: 36,
                            height: 36,
                            borderRadius: '10px',
                            color: t.accent,
                            border: `1px solid ${t.iconBoxBorder}`,
                            '&:hover': { borderColor: t.accent, background: t.iconBoxBg },
                        }}
                    >
                        <BugReport fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        );
    };

    let content: React.ReactNode;
    if (!history) {
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
    } else if (!history.length) {
        content = (
            <DashboardCard t={t}>
                <div style={{ padding: 22, textAlign: 'center', color: t.textMuted }}>{I18n.t('No backups yet')}</div>
            </DashboardCard>
        );
    } else {
        content = (
            <DashboardCard
                t={t}
                style={{ padding: fullScreen ? '2px 12px' : '4px 16px' }}
            >
                <Box sx={{ display: 'grid', gridTemplateColumns: COLUMNS, columnGap: '14px' }}>
                    <Box
                        sx={{
                            gridColumn: '1 / -1',
                            display: { xs: 'none', md: 'grid' },
                            gridTemplateColumns: 'subgrid',
                            alignItems: 'center',
                            padding: '10px 0 8px',
                            borderBottom: `1px solid ${t.divider}`,
                        }}
                    >
                        <span />
                        <ColumnTitle t={t}>{I18n.t('Backup time')}</ColumnTitle>
                        <ColumnTitle t={t}>{I18n.t('Type')}</ColumnTitle>
                        <span />
                        <ColumnTitle t={t}>{I18n.t('Source type')}</ColumnTitle>
                        <ColumnTitle
                            t={t}
                            align="right"
                        >
                            {I18n.t('File size')}
                        </ColumnTitle>
                        <ColumnTitle
                            t={t}
                            align="center"
                        >
                            {I18n.t('Log')}
                        </ColumnTitle>
                    </Box>
                    {history.map((entry, index) => renderRow(entry, index, history.length))}
                </Box>
            </DashboardCard>
        );
    }

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
            sx={dialogSx(t, fullScreen)}
        >
            <DialogHeader
                t={t}
                compact={fullScreen}
                icon={<FormatListBulleted fontSize="inherit" />}
                title={I18n.t('Backup history')}
                onClose={props.onClose}
            />
            <div
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: fullScreen ? '14px 10px' : '18px 24px',
                }}
            >
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
