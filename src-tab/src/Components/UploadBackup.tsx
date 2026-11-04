import React, { useState } from 'react';
import { type FileError, type FileRejection, useDropzone } from 'react-dropzone';

import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    IconButton,
    LinearProgress,
    Tooltip,
    useMediaQuery,
} from '@mui/material';
import type { Breakpoint } from '@mui/system';

import { Close, CloudUploadOutlined, FolderZipOutlined, InfoOutlined, UploadOutlined } from '@mui/icons-material';

import { type AdminConnection, I18n, IconResult, IconUpload, type ThemeType, Utils } from '@iobroker/gui-components';

import { getTokens } from './Dashboard/tokens';
import { DashboardCard, IconBox } from './Dashboard/Parts';
import { DialogHeader, dialogSx, errorText } from './Dashboard/DialogParts';
import { float, NO_MOTION, ripple } from './Dashboard/motion';

interface UploadBackupProps {
    onClose: () => void;
    /** Opens the list of local backups, offered after a successful upload */
    onShowBackups?: () => void;
    disabled?: boolean;
    themeType: ThemeType;
    themeBreakpoints: (key: Breakpoint | number) => string;
    instruction?: string;
    maxSize?: number;
    adapterName: string;
    instance: number;
    socket: AdminConnection;
}

/** Only `*.tar.gz` - a `.gz` mime type alone would also let plain `.gz` files through */
function validateName(file: File): FileError | null {
    return file.name.toLowerCase().endsWith('.tar.gz')
        ? null
        : { code: 'file-invalid-type', message: I18n.t('Invalid file type') };
}

/**
 * Posts the file to the upload server of the adapter. Unlike `fetch`, XHR reports the upload progress.
 *
 * @param url address of the upload server
 * @param file file to send
 * @param onProgress called with 0..1
 */
function postFile(url: string, file: File, onProgress: (progress: number) => void): Promise<{ fileName?: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(`HTTP ${xhr.status} ${xhr.statusText}`));
                return;
            }
            try {
                resolve(JSON.parse(xhr.responseText) as { fileName?: string });
            } catch {
                resolve({});
            }
        };
        xhr.onerror = () => reject(new Error(I18n.t('Cannot reach the upload server')));
        const formData = new FormData();
        formData.append('files', file);
        xhr.send(formData);
    });
}

export default function UploadBackup(props: UploadBackupProps): React.JSX.Element {
    const fullScreen = useMediaQuery(props.themeBreakpoints('sm'));
    const t = getTokens(props.themeType === 'dark');
    const [file, setFile] = useState<File | null>(null);
    const [working, setWorking] = useState(false);
    /** 0..1 while sending, 1 while the adapter checks the file */
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [uploaded, setUploaded] = useState(false);
    const [storedAs, setStoredAs] = useState('');

    const onDrop = (acceptedFiles: File[], fileRejections: FileRejection[]): void => {
        if (acceptedFiles?.length) {
            setError('');
            setFile(acceptedFiles[0]);
        } else if (fileRejections?.length) {
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
        multiple: false,
        maxSize: props.maxSize || undefined,
        validator: validateName,
        disabled: props.disabled || working || uploaded,
    });

    const upload = async (): Promise<void> => {
        if (!file) {
            return;
        }
        setError('');
        setWorking(true);
        setProgress(0);
        try {
            // starts the upload server of the adapter
            const result: { listenPort?: number; error?: unknown; e?: unknown } | null = await props.socket.sendTo(
                `${props.adapterName}.${props.instance}`,
                'uploadFile',
                { protocol: window.location.protocol },
            );
            if (!result?.listenPort) {
                throw new Error(
                    result?.error || result?.e
                        ? errorText(result.error || result.e)
                        : I18n.t('Cannot reach the upload server'),
                );
            }
            const answer = await postFile(
                `${window.location.protocol}//${window.location.hostname}:${result.listenPort}`,
                file,
                setProgress,
            );
            // A plain ioBroker backup with an unknown name is stored under a new one
            if (answer.fileName && answer.fileName !== file.name) {
                setStoredAs(answer.fileName);
            }
            setUploaded(true);

            await props.socket
                .sendTo(`${props.adapterName}.${props.instance}`, 'serverClose', {
                    downloadFinish: false,
                    uploadFinish: true,
                })
                .catch(() => null);
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
            {/* while a file is dragged over the zone, the cloud floats and sends out rings */}
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
                <CloudUploadOutlined style={{ fontSize: 38 }} />
            </Box>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>
                {props.instruction ||
                    (isDragActive ? I18n.t('Drop the file here ...') : I18n.t('Drag and drop a backup file here'))}
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
                <FolderZipOutlined style={{ fontSize: 20 }} />
                {I18n.t('Choose file')}
            </span>
            <div style={{ fontSize: '0.8rem', color: t.textMuted, marginTop: 4 }}>
                .tar.gz
                {props.maxSize ? ` · ${I18n.t('(Maximal file size is %s)', Utils.formatBytes(props.maxSize))}` : ''}
            </div>
        </Box>
    );

    const renderFile = (selected: File): React.JSX.Element => (
        <DashboardCard
            t={t}
            style={{ padding: '16px 18px' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <IconBox
                    t={t}
                    size={46}
                >
                    <FolderZipOutlined fontSize="inherit" />
                </IconBox>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                        title={selected.name}
                    >
                        {selected.name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: t.textMuted, marginTop: 2 }}>
                        {Utils.formatBytes(selected.size)}
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
            {working ? (
                <div style={{ marginTop: 16 }}>
                    <LinearProgress
                        variant={progress < 1 ? 'determinate' : 'indeterminate'}
                        value={Math.round(progress * 100)}
                        sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: t.rowDivider,
                            '& .MuiLinearProgress-bar': { borderRadius: 4 },
                        }}
                    />
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 8,
                            fontSize: '0.82rem',
                            color: t.textSecondary,
                        }}
                    >
                        <span>{progress < 1 ? I18n.t('Uploading...') : I18n.t('Checking backup...')}</span>
                        {progress < 1 ? <span>{Math.round(progress * 100)} %</span> : null}
                    </div>
                </div>
            ) : null}
        </DashboardCard>
    );

    const renderDone = (selected: File): React.JSX.Element => (
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
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>{I18n.t('Upload completed')}</div>
            <div
                style={{
                    color: t.textSecondary,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
                title={selected.name}
            >
                {selected.name} · {Utils.formatBytes(selected.size)}
            </div>
            {storedAs ? (
                <Alert
                    severity="info"
                    sx={{ mt: 1, textAlign: 'left', overflowWrap: 'anywhere' }}
                >
                    {I18n.t('ioBroker backup detected, stored as %s', storedAs)}
                </Alert>
            ) : null}
        </div>
    );

    let body: React.JSX.Element;
    if (uploaded && file) {
        body = renderDone(file);
    } else if (file) {
        body = renderFile(file);
    } else {
        body = renderDropzone();
    }

    const buttonSx = { borderRadius: '10px', textTransform: 'none', fontWeight: 600, px: 2.5 } as const;

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
                icon={<UploadOutlined fontSize="inherit" />}
                title={I18n.t('Upload Backup File')}
                subtitle={I18n.t('Upload a backup file to restore it afterwards.')}
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
                            {I18n.t('BackItUp backups and plain ioBroker backups (iobroker backup) are supported.')}
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
                    <>
                        {props.onShowBackups ? (
                            <Button
                                variant="outlined"
                                onClick={props.onShowBackups}
                                sx={buttonSx}
                            >
                                {I18n.t('Show backups')}
                            </Button>
                        ) : null}
                        <Button
                            variant="contained"
                            onClick={props.onClose}
                            startIcon={<Close />}
                            sx={buttonSx}
                        >
                            {I18n.t('Close')}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="outlined"
                            disabled={working}
                            onClick={props.onClose}
                            sx={{ ...buttonSx, color: t.textSecondary, borderColor: t.tileBorder }}
                        >
                            {I18n.t('Cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            disabled={!file || working || props.disabled}
                            onClick={() => void upload()}
                            startIcon={<IconUpload uploading={working} />}
                            sx={buttonSx}
                        >
                            {I18n.t('Upload')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
