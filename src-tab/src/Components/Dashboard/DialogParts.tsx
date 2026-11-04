import React from 'react';

import { IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';

import type { DashboardTokens } from './tokens';
import { IconBox } from './Parts';

/**
 * Readable text of an error from the adapter or the browser.
 *
 * @param e error, message or answer object
 */
export function errorText(e: unknown): string {
    if (e instanceof Error) {
        return e.message;
    }
    return typeof e === 'string' ? e : JSON.stringify(e);
}

/**
 * `sx` of a dialog in the dashboard style: page colored paper with rounded corners.
 *
 * @param t colors
 * @param fullScreen dialog covers the whole screen (mobile)
 */
export function dialogSx(t: DashboardTokens, fullScreen: boolean): Record<string, unknown> {
    return {
        '& .MuiDialog-paper': {
            background: t.dark ? '#0E1623' : t.page,
            backgroundImage: 'none',
            color: t.text,
            borderRadius: fullScreen ? 0 : '18px',
            border: fullScreen ? 'none' : `1px solid ${t.cardBorder}`,
        },
    };
}

/** Title row of a dialog: icon tile, title with subtitle and a close button */
export function DialogHeader(props: {
    t: DashboardTokens;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onClose: () => void;
    closeDisabled?: boolean;
    compact?: boolean;
    /** Buttons left of the close button */
    actions?: React.ReactNode;
}): React.JSX.Element {
    const { t } = props;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: props.compact ? 12 : 16,
                padding: props.compact ? '14px 14px 12px' : '20px 24px 16px',
                borderBottom: `1px solid ${t.divider}`,
            }}
        >
            <IconBox
                t={t}
                size={props.compact ? 42 : 48}
            >
                {props.icon}
            </IconBox>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: props.compact ? '1.1rem' : '1.25rem', fontWeight: 700, lineHeight: 1.25 }}>
                    {props.title}
                </div>
                {props.subtitle ? (
                    <div style={{ fontSize: '0.9rem', color: t.textSecondary, marginTop: 2 }}>{props.subtitle}</div>
                ) : null}
            </div>
            {props.actions}
            <IconButton
                onClick={props.onClose}
                disabled={props.closeDisabled}
                sx={{ color: t.textSecondary }}
                aria-label={I18n.t('Close')}
            >
                <Close />
            </IconButton>
        </div>
    );
}
