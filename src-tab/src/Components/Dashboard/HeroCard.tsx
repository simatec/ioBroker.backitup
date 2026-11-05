import React from 'react';

import { Box, CircularProgress } from '@mui/material';
import { CalendarMonthOutlined, Schedule } from '@mui/icons-material';

import { I18n, IconResult } from '@iobroker/gui-components';

import { HERO } from './tokens';
import { Pill } from './Parts';
import AnimatedLogo from './AnimatedLogo';
import { NO_MOTION, streak } from './motion';

export interface HeroBackupInfo {
    /** Shown above the values when more than one backup type is active */
    title?: string;
    /** Raw value of history.<type>LastTime */
    lastTime: string | undefined;
    /** Raw value of info.<type>NextTime */
    nextTime: string | undefined;
    /** Human readable schedule, e.g. "Daily, 02:48" */
    interval: string;
    /** The backup runs now (oneClick.<type>) */
    running?: boolean;
    /** Opens the log of the last run - the result pill becomes a button */
    onShowLog?: () => void;
}

/**
 * Splits the raw "last time" state into the time text and the result.
 * The adapter writes "error: <time>" if the backup failed and "No backups yet" before the first run.
 *
 * @param raw value of history.<type>LastTime
 */
export function parseLastTime(raw: string | undefined): { text: string; status: 'ok' | 'error' | 'none' } {
    if (!raw || raw === 'No backups yet' || raw === 'none') {
        return { text: I18n.t('No backups yet'), status: 'none' };
    }
    if (raw.startsWith('error')) {
        return { text: raw.replace(/^error:?\s*/, ''), status: 'error' };
    }
    return { text: raw, status: 'ok' };
}

function formatNextTime(raw: string | undefined): string {
    if (!raw || raw === 'none') {
        return '--';
    }
    return raw;
}

const labelStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: HERO.label,
};

/** Light waves in the lower right corner of the hero card */
/** Waves in the background. While a backup runs, light streaks travel along the lines. */
function Waves(props: { active: boolean }): React.JSX.Element {
    return (
        <Box
            component="svg"
            viewBox="0 0 600 200"
            preserveAspectRatio="none"
            aria-hidden="true"
            sx={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: '62%',
                height: '88%',
                pointerEvents: 'none',
                '& .bk-streak': {
                    strokeDasharray: '90 700',
                    strokeDashoffset: 790,
                    opacity: props.active ? 1 : 0,
                    transition: 'opacity 0.6s ease',
                    animation: props.active ? `${streak} 2.6s linear infinite` : 'none',
                },
                '& .bk-streak2': { animationDelay: '1.3s' },
                '& .bk-streak, & .bk-streak2': NO_MOTION,
            }}
        >
            <defs>
                <linearGradient
                    id="bkHeroWave1"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                >
                    <stop
                        offset="0"
                        stopColor="#1D7BFF"
                        stopOpacity="0"
                    />
                    <stop
                        offset="1"
                        stopColor="#2B8CFF"
                        stopOpacity="0.55"
                    />
                </linearGradient>
                <linearGradient
                    id="bkHeroWave2"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                >
                    <stop
                        offset="0"
                        stopColor="#4AA8FF"
                        stopOpacity="0"
                    />
                    <stop
                        offset="1"
                        stopColor="#63B6FF"
                        stopOpacity="0.45"
                    />
                </linearGradient>
            </defs>
            <path
                d="M0 175 C 160 168, 270 130, 390 96 S 560 26, 600 14 V200 H0 Z"
                fill="url(#bkHeroWave1)"
            />
            <path
                d="M140 200 C 280 178, 390 160, 480 118 S 575 66, 600 56 V200 Z"
                fill="url(#bkHeroWave2)"
            />
            <path
                d="M0 196 C 210 190, 370 160, 600 92"
                fill="none"
                stroke="rgba(170, 220, 255, 0.28)"
                strokeWidth="1.2"
            />
            <path
                d="M60 200 C 250 192, 400 166, 600 120"
                fill="none"
                stroke="rgba(170, 220, 255, 0.16)"
                strokeWidth="1"
            />
            <path
                className="bk-streak"
                d="M0 196 C 210 190, 370 160, 600 92"
                fill="none"
                stroke="rgba(200, 235, 255, 0.85)"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                className="bk-streak bk-streak2"
                d="M60 200 C 250 192, 400 166, 600 120"
                fill="none"
                stroke="rgba(200, 235, 255, 0.6)"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </Box>
    );
}

function VerticalDivider(): React.JSX.Element {
    return (
        <Box
            sx={{
                alignSelf: 'stretch',
                width: '1px',
                background: HERO.divider,
                flexShrink: 0,
                display: { xs: 'none', md: 'block' },
            }}
        />
    );
}

function InfoLine(props: { icon: React.ReactNode; label: string; value: string; upper?: boolean }): React.JSX.Element {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <span style={{ display: 'flex', color: HERO.icon, fontSize: 34, flexShrink: 0 }}>{props.icon}</span>
            <div style={{ minWidth: 0 }}>
                <div style={props.upper ? labelStyle : { fontSize: '0.95rem', color: HERO.label }}>{props.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: HERO.text, marginTop: 2 }}>{props.value}</div>
            </div>
        </div>
    );
}

function BackupRow(props: { info: HeroBackupInfo; index: number; count: number }): React.JSX.Element {
    const last = parseLastTime(props.info.lastTime);

    return (
        <Box
            sx={{
                display: 'flex',
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                alignItems: 'center',
                gap: { xs: '18px', md: '40px' },
                flex: 1,
                minWidth: 0,
                pt: props.index > 0 ? '16px' : 0,
                pb: props.index < props.count - 1 ? '16px' : 0,
                borderTop: props.index > 0 ? `1px solid ${HERO.divider}` : 'none',
            }}
        >
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                {props.info.title ? (
                    <div style={{ ...labelStyle, color: HERO.icon, marginBottom: 4 }}>{props.info.title}</div>
                ) : null}
                <div style={labelStyle}>{I18n.t('Last backup')}</div>
                <div
                    style={{
                        fontSize: 'clamp(1.3rem, 0.9rem + 1.1vw, 2rem)',
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        lineHeight: 1.2,
                        color: HERO.text,
                        margin: '6px 0 12px 0',
                    }}
                >
                    {last.text}
                </div>
                {props.info.running ? (
                    <Pill
                        large
                        color="#D6EBFF"
                        background="rgba(96, 165, 250, 0.2)"
                        border="rgba(147, 197, 253, 0.6)"
                        icon={
                            <CircularProgress
                                size={15}
                                thickness={5}
                                color="inherit"
                            />
                        }
                    >
                        {I18n.t('Backup is running...')}
                    </Pill>
                ) : null}
                {!props.info.running && last.status === 'ok' ? (
                    <Pill
                        large
                        onClick={props.info.onShowLog}
                        title={props.info.onShowLog ? I18n.t('Open Backup Log') : undefined}
                        color={HERO.success}
                        background={HERO.successBg}
                        border={HERO.successBorder}
                        icon={
                            <IconResult
                                type="success"
                                replay={props.info.lastTime}
                                fontSize={18}
                                style={{ color: HERO.success }}
                            />
                        }
                    >
                        {I18n.t('Successful')}
                    </Pill>
                ) : null}
                {!props.info.running && last.status === 'error' ? (
                    <Pill
                        large
                        onClick={props.info.onShowLog}
                        title={props.info.onShowLog ? I18n.t('Open Backup Log') : undefined}
                        color={HERO.error}
                        background={HERO.errorBg}
                        border={HERO.errorBorder}
                        icon={
                            <IconResult
                                type="error"
                                replay={props.info.lastTime}
                                fontSize={18}
                                style={{ color: HERO.error }}
                            />
                        }
                    >
                        {I18n.t('Failed')}
                    </Pill>
                ) : null}
            </div>
            <VerticalDivider />
            <Box
                sx={{
                    flex: '1 1 260px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    position: 'relative',
                }}
            >
                <InfoLine
                    upper
                    icon={<CalendarMonthOutlined fontSize="inherit" />}
                    label={I18n.t('Next backup')}
                    value={formatNextTime(props.info.nextTime)}
                />
                <div style={{ height: 1, background: HERO.divider, maxWidth: 360 }} />
                <InfoLine
                    icon={<Schedule fontSize="inherit" />}
                    label={I18n.t('Interval')}
                    value={props.info.interval}
                />
            </Box>
        </Box>
    );
}

/** Big blue card at the top: logo, last backup with result, next backup and schedule */
export default function HeroCard(props: { rows: HeroBackupInfo[] }): React.JSX.Element {
    const running = props.rows.some(row => row.running);
    return (
        <Box
            sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '16px',
                background: HERO.background,
                border: `1px solid ${HERO.border}`,
                boxShadow: HERO.shadow,
                color: HERO.text,
                padding: { xs: '20px', md: '24px 32px' },
            }}
        >
            <Waves active={running} />
            <Box
                sx={{
                    position: 'relative',
                    display: 'flex',
                    flexWrap: { xs: 'wrap', md: 'nowrap' },
                    alignItems: 'center',
                    gap: { xs: '18px', md: '40px' },
                }}
            >
                <Box
                    sx={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: { xs: 110, md: 220 },
                    }}
                >
                    <AnimatedLogo
                        active={running}
                        style={{
                            width: '100%',
                            maxWidth: 190,
                            filter: 'drop-shadow(0 0 16px rgba(56, 160, 255, 0.55))',
                        }}
                    />
                </Box>
                <VerticalDivider />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    {props.rows.length ? (
                        props.rows.map((info, i) => (
                            <BackupRow
                                key={i}
                                info={info}
                                index={i}
                                count={props.rows.length}
                            />
                        ))
                    ) : (
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: HERO.label }}>
                            {I18n.t('No backup activated')}
                        </div>
                    )}
                </div>
            </Box>
        </Box>
    );
}
