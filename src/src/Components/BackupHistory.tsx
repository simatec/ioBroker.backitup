import React, { useEffect, useState, type JSX } from 'react';

import {
    Dialog,
    DialogContent,
    DialogTitle,
    Table,
    TableCell,
    TableHead,
    TableRow,
    DialogActions,
    Button,
    TableBody,
    Fab,
    Tooltip,
    useMediaQuery,
} from '@mui/material';

import { Close, FormatListBulleted, BugReport } from '@mui/icons-material';

import { type AdminConnection, I18n, type ThemeType } from '@iobroker/adapter-react-v5';
import type { Breakpoint } from '@mui/system';

interface BackupHistoryProps {
    themeBreakpoints: (key: Breakpoint | number) => string;
    themeType: ThemeType;
    adapterName: string;
    instance: number;
    socket: AdminConnection;
    onClose: () => void;
    onLogs: (name: string, timestamp: number, index: number) => void;
}

const ResponsiveTableCell: React.CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 16px',
    borderBottom: '1px solid #ddd',
    textAlign: 'left',
};

export default function BackupHistory(props: BackupHistoryProps): JSX.Element {
    const fullScreen = useMediaQuery(props.themeBreakpoints('sm'));
    const [backupHistory, setBackupHistory] = useState<
        { date: string; type: string; name: string; storage: string[]; filesize: number; timestamp: number }[]
    >([]);

    useEffect(() => {
        void props.socket.getState(`${props.adapterName}.${props.instance}.history.json`).then(state => {
            if (state) {
                setBackupHistory(JSON.parse(state.val as string));
            }
        });
    });

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
        >
            <DialogTitle>
                <FormatListBulleted style={{ width: 24, height: 24, margin: '0 10px -4px 0' }} />
                {I18n.t('Backup history')}
            </DialogTitle>
            <DialogContent>
                <Table size="small">
                    {!fullScreen ? (
                        <TableHead>
                            <TableRow>
                                <TableCell>{I18n.t('Backup time')}</TableCell>
                                <TableCell>{I18n.t('Type')}</TableCell>
                                <TableCell>{I18n.t('Name')}</TableCell>
                                <TableCell>{I18n.t('Source type')}</TableCell>
                                <TableCell>{I18n.t('File size')}</TableCell>
                                <TableCell>{I18n.t('Log')}</TableCell>
                            </TableRow>
                        </TableHead>
                    ) : null}
                    {!fullScreen ? (
                        <TableBody>
                            {backupHistory.map((entry, index) => (
                                <TableRow key={index}>
                                    <TableCell>{entry.date}</TableCell>
                                    <TableCell>{entry.type}</TableCell>
                                    <TableCell>{entry.name}</TableCell>
                                    <TableCell>
                                        {typeof entry.storage === 'object' ? entry.storage.join(', ') : entry.storage}
                                    </TableCell>
                                    <TableCell>{entry.filesize}</TableCell>
                                    <TableCell>
                                        <Tooltip title={I18n.t('Open Backup Log')}>
                                            <Fab
                                                size="small"
                                                color={props.themeType === 'dark' ? 'primary' : 'info'}
                                                onClick={() => props.onLogs(entry.name, entry.timestamp, index)}
                                            >
                                                <BugReport />
                                            </Fab>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    ) : (
                        <TableBody>
                            {backupHistory.map((entry, index) => (
                                <TableRow key={index}>
                                    <TableCell style={ResponsiveTableCell}>
                                        <strong>{`${I18n.t('Backup time')}: `}</strong>
                                        {entry.date}
                                    </TableCell>
                                    <TableCell style={ResponsiveTableCell}>
                                        <strong>{`${I18n.t('Type')}: `}</strong>
                                        {entry.type}
                                    </TableCell>
                                    <TableCell style={ResponsiveTableCell}>
                                        <strong>{`${I18n.t('Name')}: `}</strong>
                                        {entry.name}
                                    </TableCell>
                                    <TableCell style={ResponsiveTableCell}>
                                        <strong>{`${I18n.t('Source type')}: `}</strong>
                                        {typeof entry.storage === 'object' ? entry.storage.join(', ') : entry.storage}
                                    </TableCell>
                                    <TableCell style={ResponsiveTableCell}>
                                        <strong>{`${I18n.t('File size')}: `}</strong>
                                        {entry.filesize}
                                    </TableCell>
                                    <TableCell
                                        style={{
                                            ...ResponsiveTableCell,
                                            borderBottom: '2px outset rgb(221, 221, 221)',
                                        }}
                                    >
                                        <Tooltip title={I18n.t('Open Backup Log')}>
                                            <Fab
                                                size="small"
                                                color={props.themeType === 'dark' ? 'primary' : 'info'}
                                                onClick={() => props.onLogs(entry.name, entry.timestamp, index)}
                                            >
                                                <BugReport />
                                            </Fab>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    )}
                </Table>
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
