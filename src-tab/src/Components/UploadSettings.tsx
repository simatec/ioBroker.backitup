import React, { useState } from 'react';
import { type FileRejection, useDropzone } from 'react-dropzone';

import { Alert, Box, Button, Dialog, DialogActions, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { Check, Close, DataObjectOutlined, FileDownloadOutlined, InfoOutlined } from '@mui/icons-material';

import { type AdminConnection, I18n, IconResult, type ThemeType, Utils } from '@iobroker/gui-components';

import { getTokens } from './Dashboard/tokens';
import { DialogHeader, dialogSx, errorText } from './Dashboard/DialogParts';
import { DashboardCard, IconBox } from './Dashboard/Parts';
import { DIALOG_BUTTON_SX } from './Dashboard/ExecutionLog';
import { float, NO_MOTION, ripple } from './Dashboard/motion';

interface UploadSettingsProps {
    onClose: () => void;
    disabled?: boolean;
    themeType: ThemeType;
    instruction?: string;
    maxSize?: number;
    adapterName: string;
    instance: number;
    socket: AdminConnection;
}

export default function UploadSettings(props: UploadSettingsProps): React.JSX.Element {
    const fullScreen = useMediaQuery('(max-width: 600px)');
    const t = getTokens(props.themeType === 'dark');
    const [file, setFile] = useState<{ name: string; data: string } | null>(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const [uploaded, setUploaded] = useState(false);

    const onDrop = (acceptedFiles: File[], fileRejections: FileRejection[]): void => {
        setError('');
        if (acceptedFiles?.length) {
            const reader = new FileReader();
            const name = acceptedFiles[0].name;
            reader.onload = evt =>
                setFile({ name, data: typeof evt.target?.result === 'string' ? evt.target.result : '' });
            reader.onerror = () => setError(`${I18n.t('Error')}: ${String(reader.error)}`);
            reader.readAsText(acceptedFiles[0]);
        }
        if (fileRejections?.length) {
            const err = fileRejections[0].errors[0];
            if (err.code === 'file-too-large') {
                setError(I18n.t('File too large'));
            } else if (err.code === 'file-invalid-type') {
                setError(I18n.t('Invalid file type'));
            } else if (err.code === 'too-many-files') {
                setError(I18n.t('Please select only one file'));
            } else {
                setError(`${I18n.t('Error')}: ${err.message}`);
            }
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        maxSize: props.maxSize || undefined,
        disabled: props.disabled || working,
        accept: {
            'application/json': ['.json'],
        },
    });

    const apply = async (): Promise<void> => {
        if (!file) {
            return;
        }
        let newObj: ioBroker.InstanceObject;
        try {
            newObj = JSON.parse(file.data);
        } catch (e) {
            setError(`${I18n.t('Cannot parse JSON')}: ${errorText(e)}`);
            return;
        }
        if (!newObj?.native || typeof newObj.native !== 'object') {
            setError(`${I18n.t('Cannot parse JSON')}: native`);
            return;
        }
        setWorking(true);
        try {
            const obj = await props.socket.getObject(`system.adapter.${props.adapterName}.${props.instance}`);
            if (obj) {
                obj.native = newObj.native;
                await props.socket.setObject(obj._id, obj);
                setUploaded(true);
                setTimeout(props.onClose, 3000);
            }
        } catch (e) {
            setError(`${I18n.t('Error')}: ${errorText(e)}`);
        } finally {
            setWorking(false);
        }
    };

    const renderDropzone = (): React.JSX.Element => (
        <Box
            {...getRootProps()}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: fullScreen ? '32px 16px' : '40px 24px',
                borderRadius: '16px',
                border: `2px dashed ${isDragActive ? t.accent : t.tileBorder}`,
                background: isDragActive ? t.iconBoxBg : t.cardBg,
                textAlign: 'center',
                cursor: props.disabled ? 'default' : 'pointer',
                outline: 'none',
                transition: 'border-color 0.15s ease, background 0.15s ease',
                '&:hover': props.disabled ? undefined : { borderColor: t.tileHoverBorder },
                '&:focus-visible': { borderColor: t.accent },
            }}
        >
            <input {...getInputProps()} />
            <Box
                component="span"
                sx={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: t.accent,
                    background: t.iconBoxBg,
                    border: `1px solid ${t.iconBoxBorder}`,
                    '--bk-ripple': t.dark ? 'rgba(75, 155, 250, 0.45)' : 'rgba(11, 107, 224, 0.3)',
                    animation: isDragActive
                        ? `${float} 1.4s ease-in-out infinite, ${ripple} 1.2s ease-out infinite`
                        : 'none',
                    ...NO_MOTION,
                }}
            >
                <FileDownloadOutlined style={{ fontSize: 38 }} />
            </Box>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>
                {props.instruction ||
                    (isDragActive
                        ? I18n.t('Drop the file here ...')
                        : I18n.t('Drag and drop a configuration file here'))}
            </div>
            <div style={{ fontSize: '0.85rem', color: t.textMuted }}>{I18n.t('or')}</div>
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 18px',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: '0.92rem',
                    color: t.accent,
                    background: t.iconBoxBg,
                    border: `1px solid ${t.iconBoxBorder}`,
                }}
            >
                <DataObjectOutlined style={{ fontSize: 20 }} />
                {I18n.t('Choose file')}
            </span>
            <div style={{ fontSize: '0.8rem', color: t.textMuted, marginTop: 4 }}>
                .json
                {props.maxSize ? ` · ${I18n.t('(Maximal file size is %s)', Utils.formatBytes(props.maxSize))}` : ''}
            </div>
        </Box>
    );

    const renderFile = (selected: { name: string; data: string }): React.JSX.Element => (
        <DashboardCard
            t={t}
            style={{ padding: '16px 18px' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <IconBox
                    t={t}
                    size={46}
                >
                    <DataObjectOutlined fontSize="inherit" />
                </IconBox>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={selected.name}
                    >
                        {selected.name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: t.textMuted, marginTop: 2 }}>
                        {Utils.formatBytes(selected.data.length)}
                    </div>
                </div>
                {working ? null : (
                    <Tooltip
                        title={I18n.t('Choose another file')}
                        slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                    >
                        <IconButton
                            onClick={() => {
                                setFile(null);
                                setError('');
                            }}
                            sx={{ color: t.textSecondary }}
                        >
                            <Close />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
        </DashboardCard>
    );

    const renderDone = (): React.JSX.Element => (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                padding: '24px 8px 8px',
                textAlign: 'center',
            }}
        >
            <IconResult
                type="success"
                fontSize={68}
                style={{ color: t.success }}
            />
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>
                {I18n.t('Configuration restored successfully. The popup will close automatically')}
            </div>
            {file ? <div style={{ color: t.textSecondary }}>{file.name}</div> : null}
        </div>
    );

    let body: React.JSX.Element;
    if (uploaded) {
        body = renderDone();
    } else if (file) {
        body = renderFile(file);
    } else {
        body = renderDropzone();
    }

    return (
        <Dialog
            open={!0}
            onClose={() => !working && props.onClose()}
            fullWidth
            fullScreen={fullScreen}
            maxWidth="sm"
            sx={dialogSx(t, fullScreen)}
        >
            <DialogHeader
                t={t}
                compact={fullScreen}
                icon={<FileDownloadOutlined fontSize="inherit" />}
                title={I18n.t('Restore BackItUp settings')}
                subtitle={I18n.t('Load a saved BackItUp configuration file (.json).')}
                onClose={props.onClose}
                closeDisabled={working}
            />
            <div style={{ flex: 1, overflow: 'auto', padding: fullScreen ? '16px 14px' : '20px 24px' }}>
                {body}
                {error ? (
                    <Alert
                        severity="error"
                        sx={{ mt: 2 }}
                        onClose={working ? undefined : () => setError('')}
                    >
                        {error}
                    </Alert>
                ) : null}
                {uploaded ? null : (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            marginTop: 16,
                            fontSize: '0.85rem',
                            color: t.textSecondary,
                        }}
                    >
                        <InfoOutlined style={{ fontSize: 20, color: t.accent, flexShrink: 0 }} />
                        <span style={{ lineHeight: '20px' }}>
                            {I18n.t(
                                'The settings of this instance are replaced by the file. The instance restarts afterwards.',
                            )}
                        </span>
                    </div>
                )}
            </div>
            <DialogActions
                sx={{
                    gap: 1,
                    padding: fullScreen ? '10px 14px' : '12px 24px 18px',
                    borderTop: `1px solid ${t.divider}`,
                }}
            >
                {uploaded ? (
                    <Button
                        variant="contained"
                        onClick={props.onClose}
                        startIcon={<Close />}
                        sx={DIALOG_BUTTON_SX}
                    >
                        {I18n.t('Close')}
                    </Button>
                ) : (
                    <>
                        <Button
                            variant="outlined"
                            disabled={working}
                            onClick={props.onClose}
                            sx={{ ...DIALOG_BUTTON_SX, color: t.textSecondary, borderColor: t.tileBorder }}
                        >
                            {I18n.t('Cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            disabled={!file || working || props.disabled}
                            onClick={() => void apply()}
                            startIcon={<Check />}
                            sx={DIALOG_BUTTON_SX}
                        >
                            {I18n.t('Apply')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
