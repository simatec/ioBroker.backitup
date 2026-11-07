import React, { useEffect, useState } from 'react';

import { Alert, AlertTitle, Box, Button, CircularProgress, Dialog, DialogActions, useMediaQuery } from '@mui/material';
import type { Breakpoint } from '@mui/system';

import { Close, ReceiptLongOutlined } from '@mui/icons-material';

import { type AdminConnection, I18n, IconCopyToClipboard, type ThemeType, Utils } from '@iobroker/gui-components';

import { getTokens } from './Dashboard/tokens';
import { DialogHeader, dialogSx, errorText } from './Dashboard/DialogParts';

type Level = 'error' | 'warn' | 'other';

interface LogEntry {
    level: Level;
    text: string;
}

/**
 * Splits the log into entries. An entry starts with `[DEBUG]`, `[WARN]`, `[ERROR]`... and may span
 * several lines, e.g. an error with its details.
 *
 * @param log text of one run
 */
function parseLog(log: string): LogEntry[] {
    const entries: LogEntry[] = [];
    for (const line of log.split('\n')) {
        if (!line.trim()) {
            continue;
        }
        const match = line.match(/^\[(\w+)\]/);
        if (match || !entries.length) {
            const tag = match?.[1].toUpperCase();
            entries.push({ level: tag === 'ERROR' ? 'error' : tag === 'WARN' ? 'warn' : 'other', text: line });
        } else {
            entries[entries.length - 1].text += `\n${line}`;
        }
    }
    return entries;
}

function formatRunTime(timestamp: number | null | undefined): string {
    if (!timestamp) {
        return '';
    }
    try {
        return new Date(timestamp).toLocaleString(I18n.getLanguage(), {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return new Date(timestamp).toLocaleString();
    }
}

interface GetLogsProps {
    themeBreakpoints: (key: Breakpoint | number) => string;
    themeType: ThemeType;
    onClose: () => void;
    socket: AdminConnection;
    adapterName: string;
    instance: number;
    backupLog: {
        fileName: string;
        timestamp: number;
        index: number;
        /** Instead of a known backup: the last run of this type, also a failed one */
        latest?: 'iobroker' | 'ccu';
        /** The last run failed at this time (as shown in the hero) */
        failedAt?: string;
    };
}

export default function GetLogs(props: GetLogsProps): React.JSX.Element {
    const fullScreen = useMediaQuery(props.themeBreakpoints('sm'));
    const t = getTokens(props.themeType === 'dark');
    /** null while loading */
    const [log, setLog] = useState<string | null>(null);
    const [runTime, setRunTime] = useState<number | null>(props.backupLog.timestamp || null);

    const { fileName, timestamp, index, latest } = props.backupLog;

    useEffect(() => {
        props.socket
            .sendTo(`${props.adapterName}.${props.instance}`, 'getLog', {
                backupName: fileName,
                timestamp,
                index,
                latest,
            })
            .then((result: string | { timestamp: number | null; log: string } | null) => {
                if (result && typeof result === 'object') {
                    setRunTime(result.timestamp);
                    setLog(result.log || I18n.t('No log is available for this backup'));
                } else {
                    setLog(result || I18n.t('No log is available for this backup'));
                }
            })
            .catch((e: unknown) => setLog(`[ERROR] ${errorText(e)}`));
    }, [props.socket, props.adapterName, props.instance, fileName, timestamp, index, latest]);

    const entries = log === null ? [] : parseLog(log);
    const errors = entries.filter(entry => entry.level === 'error');
    const color: Record<Level, string> = {
        error: t.error,
        warn: t.dark ? '#FBBF24' : '#B45309',
        other: t.textSecondary,
    };
    const when = formatRunTime(runTime);
    // Up to 4.0.4 a failed run did not save its log, so the newest one is an older, successful run
    const failedRunMissing = !!props.backupLog.failedAt && log !== null && !errors.length;

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
            maxWidth="lg"
            fullWidth
            fullScreen={fullScreen}
            sx={dialogSx(t, fullScreen)}
            slotProps={{ paper: { style: { height: fullScreen ? undefined : 'calc(100% - 64px)' } } }}
        >
            <DialogHeader
                t={t}
                compact={fullScreen}
                icon={<ReceiptLongOutlined fontSize="inherit" />}
                title={I18n.t('Backup Logs')}
                subtitle={when ? I18n.t('Run of %s', when) : fileName || undefined}
                onClose={props.onClose}
                actions={
                    log ? (
                        <Button
                            onClick={() => Utils.copyToClipboard(log)}
                            startIcon={<IconCopyToClipboard />}
                            sx={{
                                color: t.textSecondary,
                                textTransform: 'none',
                                fontWeight: 600,
                                borderRadius: '10px',
                            }}
                        >
                            {fullScreen ? null : I18n.t('Copy log')}
                        </Button>
                    ) : null
                }
            />
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    padding: fullScreen ? '14px 10px' : '18px 24px',
                }}
            >
                {log === null ? (
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
                    </div>
                ) : null}
                {failedRunMissing ? (
                    <Alert
                        severity="warning"
                        sx={{ flexShrink: 0 }}
                    >
                        <AlertTitle>{I18n.t('No log for the failed run')}</AlertTitle>
                        {I18n.t(
                            'The run of %s stopped before its log was saved. The error message is in the ioBroker log of %s.',
                            props.backupLog.failedAt || '',
                            `${props.adapterName}.${props.instance}`,
                        )}
                        {runTime ? ` ${I18n.t('Below is the last saved run.')}` : null}
                    </Alert>
                ) : null}
                {/* the reason first: the errors of this run */}
                {errors.length ? (
                    <Alert
                        severity="error"
                        sx={{ flexShrink: 0, maxHeight: '35%', overflow: 'auto' }}
                    >
                        <AlertTitle>{I18n.t('Errors in this run')}</AlertTitle>
                        {errors.map((entry, i) => (
                            <div
                                key={i}
                                style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: i ? 6 : 0 }}
                            >
                                {entry.text.replace(/^\[ERROR\]\s*/, '')}
                            </div>
                        ))}
                    </Alert>
                ) : null}
                {log !== null ? (
                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 120,
                            overflow: 'auto',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: `1px solid ${t.cardBorder}`,
                            background: t.dark ? '#08101B' : '#FFFFFF',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                            fontSize: 12.5,
                            lineHeight: 1.55,
                        }}
                    >
                        {entries.map((entry, i) => (
                            <div
                                key={i}
                                style={{
                                    color: color[entry.level],
                                    fontWeight: entry.level === 'other' ? 400 : 600,
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'anywhere',
                                }}
                            >
                                {entry.text}
                            </div>
                        ))}
                    </Box>
                ) : null}
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
