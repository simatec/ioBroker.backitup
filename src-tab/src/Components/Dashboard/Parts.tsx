import React from 'react';

import { Box, CircularProgress, Fab, Tooltip } from '@mui/material';
import { Check, ChevronRight, Close } from '@mui/icons-material';

import { type DashboardTokens, PRIMARY_TILE } from './tokens';
import { type HoverEffect, hoverEffectSx, NO_MOTION } from './motion';

/** Rounded card used for all blocks below the hero */
export function DashboardCard(props: {
    t: DashboardTokens;
    children: React.ReactNode;
    style?: React.CSSProperties;
}): React.JSX.Element {
    return (
        <Box
            sx={{
                background: props.t.cardBg,
                border: `1px solid ${props.t.cardBorder}`,
                boxShadow: props.t.cardShadow,
                borderRadius: '14px',
                boxSizing: 'border-box',
                minWidth: 0,
            }}
            style={props.style}
        >
            {props.children}
        </Box>
    );
}

/** Square tile with an icon, shown on the left side of a card */
export function IconBox(props: { t: DashboardTokens; children: React.ReactNode; size?: number }): React.JSX.Element {
    const size = props.size || 52;
    return (
        <div
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: props.t.iconBoxBg,
                border: `1px solid ${props.t.iconBoxBorder}`,
                color: props.t.iconBoxColor,
                fontSize: Math.round(size * 0.55),
            }}
        >
            {props.children}
        </div>
    );
}

/** Title of a section with a line below and an optional element on the right side */
export function SectionHeader(props: {
    t: DashboardTokens;
    icon: React.ReactNode;
    title: string;
    right?: React.ReactNode;
}): React.JSX.Element {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 2px 10px 2px',
                margin: '26px 0 14px 0',
                borderBottom: `1px solid ${props.t.divider}`,
            }}
        >
            <span style={{ display: 'flex', color: props.t.accent, fontSize: 26 }}>{props.icon}</span>
            <span
                style={{
                    flex: 1,
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: props.t.text,
                }}
            >
                {props.title}
            </span>
            {props.right}
        </div>
    );
}

/** Small round "ok" mark used in the option list */
export function CheckMark(props: { size?: number; color?: string }): React.JSX.Element {
    const size = props.size || 22;
    return (
        <span
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: props.color || '#2F8BFF',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            <Check style={{ fontSize: Math.round(size * 0.72) }} />
        </span>
    );
}

/** Round red/green status mark used in the backup list */
export function StatusMark(props: { ok: boolean; t: DashboardTokens }): React.JSX.Element {
    const color = props.ok ? (props.t.dark ? '#22C55E' : '#16A34A') : props.t.dark ? '#EF4444' : '#DC2626';
    return (
        <span
            style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: color,
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            {props.ok ? <Check style={{ fontSize: 17 }} /> : <Close style={{ fontSize: 16 }} />}
        </span>
    );
}

/** Pill with a colored border, e.g. "Successful", "Failed" or "Active" */
export function Pill(props: {
    color: string;
    background: string;
    border: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
    large?: boolean;
    title?: string;
    /** Makes the pill a button, with an arrow at the end */
    onClick?: () => void;
}): React.JSX.Element {
    const style: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: props.large ? '5px 16px' : '3px 12px',
        borderRadius: 999,
        fontSize: props.large ? '0.95rem' : '0.82rem',
        fontWeight: 600,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        color: props.color,
        background: props.background,
        border: `1px solid ${props.border}`,
    };
    const pill = props.onClick ? (
        <Box
            component="button"
            type="button"
            onClick={props.onClick}
            style={style}
            sx={{
                font: 'inherit',
                cursor: 'pointer',
                paddingRight: props.large ? '10px !important' : '8px !important',
                transition: 'filter 0.15s ease, transform 0.15s ease',
                '&:hover': { filter: 'brightness(1.25)' },
                '&:hover .bk-pill-arrow': { transform: 'translateX(3px)' },
                '&:focus-visible': { outline: `2px solid ${props.color}`, outlineOffset: 2 },
                '& .bk-pill-arrow': { transition: 'transform 0.15s ease', marginLeft: '-2px' },
                ...NO_MOTION,
            }}
        >
            {props.icon}
            {props.children}
            <ChevronRight
                className="bk-pill-arrow"
                style={{ fontSize: props.large ? 20 : 16 }}
            />
        </Box>
    ) : (
        <span style={style}>
            {props.icon}
            {props.children}
        </span>
    );
    return props.title ? (
        <Tooltip
            title={props.title}
            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
        >
            {pill}
        </Tooltip>
    ) : (
        pill
    );
}

/** Round button in the header */
export function RoundButton(props: {
    t: DashboardTokens;
    title: string;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <Tooltip
            title={props.title}
            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
        >
            <Fab
                size="small"
                onClick={props.onClick}
                sx={{
                    width: 40,
                    height: 40,
                    minHeight: 40,
                    boxShadow: 'none',
                    backgroundColor: props.t.roundButtonBg,
                    color: props.t.roundButtonColor,
                    '&:hover': {
                        backgroundColor: props.t.roundButtonHoverBg,
                        boxShadow: 'none',
                    },
                    '&:active': { boxShadow: 'none' },
                }}
            >
                {props.children}
            </Fab>
        </Tooltip>
    );
}

/**
 * Button of the action grid.
 * `vertical` draws the big tile with the icon above the text, otherwise the icon is on the left
 * and a chevron on the right.
 */
export function ActionTile(props: {
    t: DashboardTokens;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    primary?: boolean;
    busy?: boolean;
    vertical?: boolean;
    title?: string;
    /** How the icon moves when the mouse is over the tile */
    hoverEffect?: HoverEffect;
}): React.JSX.Element {
    const { t } = props;
    const primary = !!props.primary;

    const tile = (
        <Box
            component="button"
            type="button"
            disabled={props.disabled}
            onClick={props.disabled ? undefined : props.onClick}
            sx={{
                appearance: 'none',
                font: 'inherit',
                width: '100%',
                height: '100%',
                minHeight: props.vertical ? 116 : 52,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: props.vertical ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: props.vertical ? 'center' : 'flex-start',
                gap: props.vertical ? '10px' : '14px',
                padding: props.vertical ? '16px 12px' : '0 16px',
                borderRadius: '12px',
                cursor: props.disabled ? 'default' : 'pointer',
                textAlign: props.vertical ? 'center' : 'left',
                fontSize: '0.95rem',
                fontWeight: 600,
                lineHeight: 1.3,
                color: primary ? PRIMARY_TILE.text : t.text,
                background: primary ? PRIMARY_TILE.background : t.tileBg,
                border: `1px solid ${primary ? PRIMARY_TILE.border : t.tileBorder}`,
                boxShadow: primary && !props.disabled ? PRIMARY_TILE.shadow : 'none',
                opacity: props.disabled ? (primary ? 0.55 : 0.45) : 1,
                filter: props.disabled && primary ? 'saturate(0.6)' : undefined,
                transition:
                    'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease',
                '&:hover': props.disabled
                    ? undefined
                    : {
                          transform: 'translateY(-2px)',
                          background: primary ? PRIMARY_TILE.hoverBackground : t.tileHoverBg,
                          borderColor: primary ? PRIMARY_TILE.border : t.tileHoverBorder,
                          boxShadow: primary ? PRIMARY_TILE.shadow : '0 6px 18px rgba(15, 23, 42, 0.22)',
                      },
                '&:focus-visible': {
                    outline: `2px solid ${t.accent}`,
                    outlineOffset: 2,
                },
                ...(props.disabled || props.busy ? null : hoverEffectSx(props.hoverEffect)),
            }}
        >
            <span
                className="bk-tile-icon"
                style={{
                    display: 'flex',
                    color: primary ? PRIMARY_TILE.text : t.tileIcon,
                    fontSize: props.vertical ? 36 : 26,
                }}
            >
                {props.busy ? (
                    <CircularProgress
                        size={props.vertical ? 32 : 22}
                        sx={{ color: primary ? PRIMARY_TILE.text : t.tileIcon }}
                    />
                ) : (
                    props.icon
                )}
            </span>
            <span style={{ flex: props.vertical ? undefined : 1 }}>{props.label}</span>
            {props.vertical ? null : <ChevronRight style={{ opacity: 0.8 }} />}
        </Box>
    );

    return props.title ? (
        <Tooltip
            title={props.title}
            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
        >
            <div style={{ minWidth: 0 }}>{tile}</div>
        </Tooltip>
    ) : (
        tile
    );
}
