import React, { useState } from 'react';

import { Box, Menu, MenuItem } from '@mui/material';
import { Check, ExpandMore } from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';

import { type DashboardTokens } from './tokens';
import { StorageIcon } from './StorageIcons';
import { NO_MOTION } from './motion';

const SOURCES: { name?: string; value: string; label: string }[] = [
    { value: 'local', label: 'Local' },
    { name: 'cifsEnabled', value: 'cifs', label: 'NAS' },
    { name: 'ftpEnabled', value: 'ftp', label: 'FTP' },
    { name: 'dropboxEnabled', value: 'dropbox', label: 'Dropbox' },
    { name: 'onedriveEnabled', value: 'onedrive', label: 'OneDrive' },
    { name: 'googledriveEnabled', value: 'googledrive', label: 'Google Drive' },
    { name: 'webdavEnabled', value: 'webdav', label: 'WebDAV' },
];

/**
 * Selection of the backup source for the restore, styled like the tiles of the dashboard.
 * Only the sources that are enabled in the configuration are offered.
 */
export default function SourceSelect(props: {
    t: DashboardTokens;
    value: string;
    /** Instance configuration: <storage>Enabled and connectType */
    data: Record<string, any>;
    onChange: (value: string) => void;
}): React.JSX.Element {
    const { t } = props;
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const open = !!anchor;

    const options = SOURCES.filter(option => !option.name || props.data[option.name]).map(option => ({
        ...option,
        label:
            option.value === 'cifs' && props.data.connectType
                ? `NAS (${props.data.connectType})`
                : I18n.t(option.label),
    }));
    const value = props.value || 'local';
    const selected = options.find(option => option.value === value) || options[0];

    return (
        <>
            <Box
                component="button"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={(e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
                sx={{
                    appearance: 'none',
                    font: 'inherit',
                    width: '100%',
                    height: '100%',
                    minHeight: 44,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '0 12px 0 14px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: t.text,
                    background: open ? t.tileHoverBg : t.tileBg,
                    border: `1px solid ${open ? t.tileHoverBorder : t.tileBorder}`,
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                    '&:hover': {
                        background: t.tileHoverBg,
                        borderColor: t.tileHoverBorder,
                    },
                    '&:focus-visible': {
                        outline: `2px solid ${t.accent}`,
                        outlineOffset: 2,
                    },
                }}
            >
                <span style={{ display: 'flex', width: 24, justifyContent: 'center', flexShrink: 0 }}>
                    <StorageIcon
                        type={selected.value}
                        size={20}
                    />
                </span>
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                    <span
                        style={{
                            display: 'block',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            color: t.textMuted,
                        }}
                    >
                        {I18n.t('Source type')}
                    </span>
                    <span
                        style={{
                            display: 'block',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {selected.label}
                    </span>
                </span>
                <Box
                    component="span"
                    sx={{
                        display: 'flex',
                        color: t.textSecondary,
                        transition: 'transform 0.2s ease',
                        transform: open ? 'rotate(180deg)' : 'none',
                        ...NO_MOTION,
                    }}
                >
                    <ExpandMore />
                </Box>
            </Box>
            <Menu
                open={open}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: '6px',
                            minWidth: anchor?.offsetWidth,
                            borderRadius: '12px',
                            background: t.menuBg,
                            border: `1px solid ${t.cardBorder}`,
                            boxShadow: t.menuShadow,
                            backgroundImage: 'none',
                        },
                    },
                    list: {
                        role: 'listbox',
                        sx: { padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' },
                    },
                }}
            >
                {options.map(option => {
                    const active = option.value === value;
                    return (
                        <MenuItem
                            key={option.value}
                            role="option"
                            aria-selected={active}
                            selected={active}
                            onClick={() => {
                                setAnchor(null);
                                if (!active) {
                                    props.onChange(option.value);
                                }
                            }}
                            sx={{
                                minHeight: 40,
                                gap: '12px',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: active ? 600 : 500,
                                color: active ? t.accent : t.text,
                                '&:hover': { background: t.menuHover },
                                '&.Mui-selected, &.Mui-selected:hover': { background: t.iconBoxBg },
                                '&.Mui-focusVisible': { background: t.menuHover },
                                '&.Mui-selected.Mui-focusVisible': { background: t.iconBoxBg },
                            }}
                        >
                            <span style={{ display: 'flex', width: 24, justifyContent: 'center', flexShrink: 0 }}>
                                <StorageIcon
                                    type={option.value}
                                    size={20}
                                />
                            </span>
                            <span style={{ flex: 1 }}>{option.label}</span>
                            <Check
                                style={{
                                    fontSize: 18,
                                    color: t.accent,
                                    visibility: active ? 'visible' : 'hidden',
                                }}
                            />
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
}
