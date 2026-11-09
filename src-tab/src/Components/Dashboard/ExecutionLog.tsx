import React from 'react';

import { Box, Checkbox, CircularProgress, FormControlLabel, LinearProgress } from '@mui/material';

import { I18n, IconResult } from '@iobroker/gui-components';

import type { DashboardTokens } from './tokens';

/** One line of the live output (`output.line`) of a backup or restore run */
export interface LogLine {
    level?: string;
    source?: string;
    ts?: string;
    text: string;
}

/** State of a run as the status banner shows it */
export type RunState = 'running' | 'success' | 'error';

/** Buttons in the footer of the dashboard dialogs */
export const DIALOG_BUTTON_SX = { borderRadius: '10px', textTransform: 'none', fontWeight: 600, px: 2.5 } as const;

/**
 * Color of a log level (INFO, WARN, ERROR, DEBUG ...)
 *
 * @param t colors
 * @param level level of the line
 */
export function levelColor(t: DashboardTokens, level: string | undefined): string {
    switch ((level || '').toUpperCase()) {
        case 'ERROR':
            return t.error;
        case 'WARN':
            return t.dark ? '#FBBF24' : '#B45309';
        case 'INFO':
            return t.success;
        default:
            return t.textSecondary;
    }
}

/**
 * Banner above the log: spinner while the run is going, then a green or red result.
 *
 * @param props properties
 * @param props.t colors
 * @param props.state state of the run
 * @param props.text text next to the icon
 * @param props.detail smaller second line
 */
export function RunStatus(props: {
    t: DashboardTokens;
    state: RunState;
    text: string;
    detail?: string;
}): React.JSX.Element {
    const { t, state } = props;
    const color = state === 'success' ? t.success : state === 'error' ? t.error : t.accent;
    const background = state === 'success' ? t.successBg : state === 'error' ? t.errorBg : t.iconBoxBg;
    const border = state === 'success' ? t.successBorder : state === 'error' ? t.errorBorder : t.iconBoxBorder;

    return (
        <div
            style={{
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 12,
                background,
                border: `1px solid ${border}`,
            }}
        >
            <span style={{ display: 'flex', color, flexShrink: 0 }}>
                {state === 'running' ? (
                    <CircularProgress
                        size={22}
                        thickness={5}
                        sx={{ color }}
                    />
                ) : (
                    <IconResult
                        type={state === 'success' ? 'success' : 'error'}
                        fontSize={26}
                        style={{ color }}
                    />
                )}
            </span>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color, whiteSpace: 'pre-line' }}>{props.text}</div>
                {props.detail ? (
                    <div
                        style={{
                            fontSize: '0.85rem',
                            color: t.textSecondary,
                            marginTop: 2,
                            whiteSpace: 'pre-line',
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {props.detail}
                    </div>
                ) : null}
            </div>
            {state === 'running' ? (
                <LinearProgress
                    sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 3,
                        backgroundColor: 'transparent',
                        '& .MuiLinearProgress-bar': { backgroundColor: color },
                    }}
                />
            ) : null}
        </div>
    );
}

/**
 * Live log of a run: time, level, source and text. On small screens the text goes below the meta data.
 *
 * @param props properties
 * @param props.t colors
 * @param props.lines lines to show
 * @param props.compact small screen
 * @param props.boxRef ref of the scroll container (to keep it scrolled to the end)
 * @param props.minHeight minimal height of the box
 */
export function ExecutionLogBox(props: {
    t: DashboardTokens;
    lines: (LogLine | string)[];
    compact?: boolean;
    boxRef?: React.RefObject<HTMLDivElement | null>;
    minHeight?: number;
}): React.JSX.Element {
    const { t, lines, compact, boxRef, minHeight } = props;
    return (
        <Box
            ref={boxRef}
            sx={{
                flex: 1,
                minHeight: minHeight || 160,
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
            {lines.map((entry, i) => {
                if (typeof entry === 'string') {
                    // plain lines of the restore web server, e.g. "[ERROR] ..."
                    const level = entry.match(/^\[(\w+)\]/)?.[1];
                    return (
                        <div
                            key={i}
                            style={{
                                color: level ? levelColor(t, level) : t.text,
                                fontWeight: level === 'ERROR' || level === 'WARN' ? 600 : 400,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                            }}
                        >
                            {entry || ' '}
                        </div>
                    );
                }
                const color = levelColor(t, entry.level);
                const strong = entry.level === 'ERROR' || entry.level === 'WARN';
                return (
                    <div
                        key={i}
                        style={{
                            display: compact ? 'block' : 'flex',
                            gap: 12,
                            padding: compact ? '3px 0' : 0,
                            borderBottom: compact ? `1px solid ${t.rowDivider}` : 'none',
                        }}
                    >
                        {entry.ts || entry.level || entry.source ? (
                            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                                <span style={{ color: t.textMuted, width: 86, flexShrink: 0 }}>{entry.ts}</span>
                                <span style={{ color, fontWeight: 700, width: 44, flexShrink: 0 }}>{entry.level}</span>
                                <span
                                    style={{
                                        color: t.textSecondary,
                                        width: compact ? undefined : 96,
                                        flexShrink: 0,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                    title={entry.source}
                                >
                                    {entry.source}
                                </span>
                            </div>
                        ) : null}
                        <span
                            style={{
                                flex: 1,
                                minWidth: 0,
                                color: entry.level ? color : t.text,
                                fontWeight: strong ? 600 : 400,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                            }}
                        >
                            {entry.text || ' '}
                        </span>
                    </div>
                );
            })}
        </Box>
    );
}

/**
 * "Close on ready" switch in the footer of the run dialogs
 *
 * @param props properties
 * @param props.t colors
 * @param props.checked state
 * @param props.disabled not changeable
 * @param props.onChange new state
 */
export function CloseOnReady(props: {
    t: DashboardTokens;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}): React.JSX.Element {
    return (
        <FormControlLabel
            sx={{
                mr: 'auto',
                ml: 0,
                color: props.t.textSecondary,
                '& .MuiFormControlLabel-label': { fontSize: '0.9rem' },
            }}
            control={
                <Checkbox
                    size="small"
                    disabled={props.disabled}
                    checked={props.checked}
                    onChange={e => props.onChange(e.target.checked)}
                />
            }
            label={I18n.t('Close on ready')}
        />
    );
}

/**
 * Text of a dialog title without a trailing colon (some old translations end with one)
 *
 * @param key translation key
 */
export function titleText(key: string): string {
    return I18n.t(key).replace(/:\s*$/, '');
}
