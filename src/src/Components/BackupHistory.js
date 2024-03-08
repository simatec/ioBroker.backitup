import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    Table, TableCell, TableHead, TableRow,
} from '@mui/material';
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
    }, [props.open]);

    return <Dialog
        open={props.open}
        onClose={props.onClose}
        fullWidth
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Backup history')}</DialogTitle>
        <DialogContent>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>{I18n.t('Backup time')}</TableCell>
                        <TableCell>{I18n.t('Type')}</TableCell>
                        <TableCell>{I18n.t('Name')}</TableCell>
                        <TableCell>{I18n.t('Source type')}</TableCell>
                        <TableCell>{I18n.t('Filesize')}</TableCell>
                    </TableRow>
                </TableHead>
                {backupHistory.map((entry, index) => <TableRow key={index}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{entry.type}</TableCell>
                    <TableCell>{entry.name}</TableCell>
                    <TableCell>{entry.storage}</TableCell>
                    <TableCell>{entry.filesize}</TableCell>
                </TableRow>)}
            </Table>
        </DialogContent>
    </Dialog>;
};

export default BackupHistory;
