import React, { useEffect, useState } from 'react';

import { Dialog, DialogContent, DialogTitle, DialogActions, Button, useMediaQuery } from '@mui/material';

import { Close, BugReport } from '@mui/icons-material';

import { type AdminConnection, I18n, type ThemeType } from '@iobroker/adapter-react-v5';
import type { Breakpoint } from '@mui/system';

const styles: Record<string, React.CSSProperties> = {
    paper: {
        height: 'calc(100% - 64px)',
    },
    text: {
        display: 'inline-block',
    },
    textLine: {
        whiteSpace: 'nowrap',
    },
    responseTextLine: {
        whiteSpace: 'pre-wrap',
    },
    responseContent: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
};

function renderLine(line: string, i: number, fullScreen: boolean): React.JSX.Element {
    return (
        <div
            key={i}
            style={{ ...(fullScreen ? styles.responseTextLine : styles.textLine) }}
        >
            <div
                style={{
                    ...styles.text,
                    color: line.startsWith('[ERROR]') ? '#FF0000' : line.startsWith('[WARN]') ? '#ff9100' : undefined,
                }}
            >
                {line}
            </div>
        </div>
    );
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
    };
}

export default function GetLogs(props: GetLogsProps): React.JSX.Element {
    const fullScreen = useMediaQuery(props.themeBreakpoints('sm'));
    const [backupLog, setBackupLog] = useState<string[]>([]);

    useEffect(() => {
        void props.socket
            .sendTo(`${props.adapterName}.${props.instance}`, 'getLog', {
                backupName: props.backupLog.fileName,
                timestamp: props.backupLog.timestamp,
                index: props.backupLog.index,
            })
            .then(result => {
                if (result) {
                    setBackupLog(result.split('\n'));
                } else {
                    setBackupLog([I18n.t('No log is available for this backup')]);
                }
            });
    });

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
            maxWidth="lg"
            fullWidth
            fullScreen={fullScreen}
            sx={{ '& .MuiDialog-paper': styles.paper }}
        >
            <DialogTitle>
                <BugReport style={{ width: 24, height: 24, margin: '0 10px -4px 0' }} />
                {I18n.t('Backup Logs')}
            </DialogTitle>
            <DialogContent style={{ position: 'relative' }}>
                <div
                    style={{
                        height: 'calc(100% - 16px - 4px)',
                        width: 'calc(100% - 16px)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        marginTop: 4,
                        padding: 8,
                        border: '1px solid grey',
                        borderRadius: 5,
                        overflow: 'auto',
                        backgroundColor: props.themeType === 'dark' ? '#111' : '#EEE',
                        boxSizing: 'border-box',
                        ...(fullScreen ? styles.responseContent : undefined),
                    }}
                >
                    {backupLog.map((line, i) => renderLine(line, i, fullScreen))}
                </div>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={props.onClose}
                    startIcon={<Close />}
                    variant="contained"
                    color={props.themeType === 'dark' ? 'primary' : 'grey'}
                >
                    {I18n.t('Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
