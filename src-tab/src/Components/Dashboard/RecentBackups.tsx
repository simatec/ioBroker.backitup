import React, { useEffect, useState } from 'react';

import { Box, CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import {
    BugReport,
    FileDownloadOutlined,
    MoreHoriz,
    RouterOutlined,
    SettingsBackupRestore,
    StorageOutlined,
} from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';

import { type DashboardTokens } from './tokens';
import { DashboardCard, Pill, StatusMark } from './Parts';
import { flash, NO_MOTION, slideIn } from './motion';
import { isDownloadOnlyBackup } from '../downloadOnly';
import { formatHistorySize } from '../historySize';

/**
 * Row that slides in and lights up once, if it appears while the tab is open (a new backup).
 * Rows of the first render stay calm: `live` is read only when the row mounts.
 */
function NewRow(props: { live: boolean; color: string; children: React.ReactNode }): React.JSX.Element {
    const [fresh] = useState(props.live);
    return (
        <Box
            sx={
                fresh
                    ? {
                          '--bk-flash': props.color,
                          borderRadius: '10px',
                          animation: `${slideIn} 0.5s ease-out, ${flash} 2.6s ease-out`,
                          ...NO_MOTION,
                      }
                    : undefined
            }
        >
            {props.children}
        </Box>
    );
}

/** One entry of the state history.json */
export interface HistoryEntry {
    date: string;
    name?: string;
    type: string;
    storage: string | string[];
    filesize: string | null;
    /** exact size in bytes; missing in entries of older versions */
    filesizeBytes?: number;
    error: string;
    timestamp?: number;
}

export const TYPE_LABELS: Record<string, string> = {
    iobroker: 'ioBroker',
    ccu: 'Homematic CCU backup',
};

interface RecentBackupsProps {
    t: DashboardTokens;
    entries: HistoryEntry[];
    alive: boolean;
    isFloatComma: boolean;
    /** Index of the entry whose download is being prepared */
    busyIndex: number | null;
    onDownload: (entry: HistoryEntry, index: number) => void;
    onRestore: (entry: HistoryEntry, index: number) => void;
    onLog: (entry: HistoryEntry, index: number) => void;
}

export default function RecentBackups(props: RecentBackupsProps): React.JSX.Element {
    const { t } = props;
    const [menu, setMenu] = useState<{ anchor: HTMLElement; index: number } | null>(null);
    /** Set shortly after the first entries are shown: rows that appear later are new backups */
    const [live, setLive] = useState(false);
    const hasEntries = props.entries.length > 0;

    useEffect(() => {
        if (!hasEntries || live) {
            return;
        }
        const timer = setTimeout(() => setLive(true), 800);
        return () => clearTimeout(timer);
    }, [hasEntries, live]);

    if (!props.entries.length) {
        return (
            <DashboardCard t={t}>
                <div style={{ padding: '14px', textAlign: 'center', color: t.textMuted }}>
                    {I18n.t('No backups yet')}
                </div>
            </DashboardCard>
        );
    }

    const menuEntry = menu ? props.entries[menu.index] : null;
    /** Backups of other systems (CCU, remote Redis, remote Zigbee2MQTT) can be downloaded, but not restored */
    const downloadOnly = menuEntry?.type === 'ccu' || isDownloadOnlyBackup(menuEntry?.name);

    return (
        <DashboardCard
            t={t}
            style={{ padding: '2px 14px' }}
        >
            {props.entries.map((entry, index) => {
                const ok = !entry.error || entry.error === 'none';
                const TypeIcon = entry.type === 'ccu' ? RouterOutlined : StorageOutlined;

                return (
                    <NewRow
                        key={`${entry.timestamp || entry.date}_${entry.name}`}
                        live={live}
                        color={ok ? t.successBg : t.errorBg}
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '22px minmax(0, 1fr) 34px 34px',
                                    md: '22px minmax(160px, 1.6fr) minmax(120px, 1fr) minmax(110px, auto) minmax(80px, 0.7fr) 34px 34px',
                                },
                                alignItems: 'center',
                                columnGap: '14px',
                                minHeight: 40,
                                padding: '2px 0',
                                borderBottom: index < props.entries.length - 1 ? `1px solid ${t.rowDivider}` : 'none',
                                color: t.text,
                            }}
                        >
                            <StatusMark
                                ok={ok}
                                t={t}
                            />
                            <Box
                                component="span"
                                sx={{
                                    fontSize: '0.88rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: { xs: 'normal', md: 'nowrap' },
                                }}
                                title={entry.name}
                            >
                                {entry.date}
                            </Box>
                            <Box
                                sx={{
                                    display: { xs: 'none', md: 'flex' },
                                    alignItems: 'center',
                                    gap: '8px',
                                    minWidth: 0,
                                    fontSize: '0.88rem',
                                }}
                            >
                                <TypeIcon style={{ fontSize: 18, color: t.textSecondary }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {I18n.t(TYPE_LABELS[entry.type] || entry.type)}
                                </span>
                            </Box>
                            <Box
                                component="span"
                                sx={{ display: { xs: 'none', md: 'block' } }}
                            >
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
                                    display: { xs: 'none', md: 'block' },
                                    fontSize: '0.88rem',
                                    textAlign: 'right',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {formatHistorySize(entry, props.isFloatComma)}
                            </Box>
                            <Tooltip
                                title={I18n.t('Download Backup File')}
                                slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                            >
                                <span>
                                    <IconButton
                                        size="small"
                                        disabled={!props.alive || !entry.name || props.busyIndex !== null}
                                        onClick={() => props.onDownload(entry, index)}
                                        sx={{ color: t.text }}
                                    >
                                        {props.busyIndex === index ? (
                                            <CircularProgress size={18} />
                                        ) : (
                                            <FileDownloadOutlined fontSize="small" />
                                        )}
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <IconButton
                                size="small"
                                onClick={e => setMenu({ anchor: e.currentTarget, index })}
                                sx={{ color: t.text }}
                            >
                                <MoreHoriz fontSize="small" />
                            </IconButton>
                        </Box>
                    </NewRow>
                );
            })}
            <Menu
                open={!!menu}
                anchorEl={menu?.anchor}
                onClose={() => setMenu(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => {
                        if (menu && menuEntry) {
                            props.onLog(menuEntry, menu.index);
                        }
                        setMenu(null);
                    }}
                >
                    <ListItemIcon>
                        <BugReport fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{I18n.t('Open Backup Log')}</ListItemText>
                </MenuItem>
                <MenuItem
                    disabled={!props.alive || !menuEntry?.name || downloadOnly}
                    onClick={() => {
                        if (menu && menuEntry) {
                            props.onRestore(menuEntry, menu.index);
                        }
                        setMenu(null);
                    }}
                >
                    <ListItemIcon>
                        <SettingsBackupRestore fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        secondary={
                            downloadOnly
                                ? I18n.t(
                                      'This backup cannot be restored by BackItUp. Please restore it in the system it comes from.',
                                  )
                                : undefined
                        }
                    >
                        {I18n.t('Restore Backup File')}
                    </ListItemText>
                </MenuItem>
            </Menu>
        </DashboardCard>
    );
}
