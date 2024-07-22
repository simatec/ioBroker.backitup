import { useEffect, useState } from 'react';

import {
    Dialog,
    DialogContent,
    DialogTitle,
    Table, TableCell, TableHead, TableRow,
    DialogActions, Button, TableBody,
} from '@mui/material';

import { Close, FormatListBulleted } from '@mui/icons-material';

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
        <DialogTitle>
            <FormatListBulleted style={{ width: 24, height: 24, margin: '0 10px -4px 0' }} />
            {I18n.t('Backup history')}
        </DialogTitle>
        <DialogContent>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>{I18n.t('Backup time')}</TableCell>
                        <TableCell>{I18n.t('Type')}</TableCell>
                        <TableCell>{I18n.t('Name')}</TableCell>
                        <TableCell>{I18n.t('Source type')}</TableCell>
                        <TableCell>{I18n.t('File size')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {backupHistory.map((entry, index) => <TableRow key={index}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.type}</TableCell>
                        <TableCell>{entry.name}</TableCell>
                        <TableCell>{typeof entry.storage === 'object' ? entry.storage.join(', ') : entry.storage}</TableCell>
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
                color={props.themeType === 'dark' ? 'primary' : 'grey'}
            >
                {I18n.t('Close')}
            </Button>
        </DialogActions>
    </Dialog>;
};

export default BackupHistory;
