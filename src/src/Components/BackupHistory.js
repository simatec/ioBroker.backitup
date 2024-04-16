import { useEffect, useState } from 'react';

import {
    Dialog,
    DialogContent,
    DialogTitle,
    Table, TableCell, TableHead, TableRow,
    DialogActions, Button, TableBody,
} from '@mui/material';

import { Close } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';

const BackupHistory = props => {
    const [backupHistory, setBackupHistory] = useState([]);
    useEffect(() => {
        props.socket.getState(`${props.adapterName}.${props.instance}.history.json`)
            .then(state => {
                if (state) {
                    setBackupHistory(JSON.parse(state.val));
                }
            });
    }, []);

    return <Dialog
        open={!0}
        onClose={props.onClose}
        fullWidth
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Backup history')}</DialogTitle>
        <DialogContent>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>{I18n.t('backup time')}</TableCell>
                        <TableCell>{I18n.t('Type')}</TableCell>
                        <TableCell>{I18n.t('name')}</TableCell>
                        <TableCell>{I18n.t('source type')}</TableCell>
                        <TableCell>{I18n.t('filesize')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {backupHistory.map((entry, index) => <TableRow key={index}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.type}</TableCell>
                        <TableCell>{entry.name}</TableCell>
                        <TableCell>{entry.storage}</TableCell>
                        <TableCell>{entry.filesize}</TableCell>
                    </TableRow>)}
                </TableBody>
            </Table>
        </DialogContent>
        <DialogActions>
            <Button
                onClick={props.onClose}
                startIcon={<Close />}
                variant="contained"
                color="grey"
            >
                {I18n.t('Close')}
            </Button>
        </DialogActions>
    </Dialog>;
};

export default BackupHistory;
