import { I18n } from '@iobroker/adapter-react-v5';
import {
    Accordion, AccordionDetails, AccordionSummary, Dialog, DialogContent, DialogTitle, Fab, Table, TableCell, TableRow, Tooltip,
    DialogActions, Button, LinearProgress,
} from '@mui/material';
import { Close, Download, History } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';

function parseSize(bytes) {
    if (bytes > 1024 * 1024 * 512) {
        return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10}${I18n.t('GiB')}`;
    } if (bytes > 1024 * 1024) {
        return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}${I18n.t('MiB')}`;
    } if (bytes > 1024) {
        return `${Math.round((bytes / (1024)) * 10) / 10}${I18n.t('KiB')}`;
    }
    return `${bytes} ${I18n.t('bytes')}`;
}
function parseName(name) {
    const parts = name.split('_');
    if (parseInt(parts[0], 10).toString() !== parts[0]) {
        parts.shift();
    }
    return new Date(
        parts[0],
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2].split('-')[0], 10),
        parseInt(parts[2].split('-')[1], 10),
        parseInt(parts[3], 10),
    ).toLocaleString().replace(/:00$/, '');
}

const GetBackups = props => {
    const [backups, setBackups] = useState(null);
    useEffect(() => {
        setBackups(null);
        if (props.open) {
            props.socket.sendTo(`${props.adapterName}.${props.instance}`, 'list', props.backupSource).then(result => {
                Object.keys(result.data).forEach(location => {
                    Object.keys(result.data[location]).forEach(object => {
                        result.data[location][object].sort((a, b) => (a.name > b.name ? -1 : 1));
                    });
                });
                setBackups(result);
            });
        }
    }, [props.open]);

    return <Dialog
        open={props.open}
        onClose={props.onClose}
        fullWidth
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Backup history')}</DialogTitle>
        <DialogContent>
            {backups ?
                Object.keys(backups.data).map(location =>
                    <Accordion>
                        <AccordionSummary>
                            {I18n.t(location)}
                        </AccordionSummary>
                        <AccordionDetails>
                            {Object.keys(backups.data[location]).map(object =>
                                <Accordion>
                                    <AccordionSummary>
                                        {I18n.t(object)}
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Table>
                                            {backups.data[location][object].map((backup, index) => <TableRow key={index}>
                                                <TableCell style={{ width: '100%' }}>
                                                    {`${I18n.t('Backup time')}: ${parseName(backup.name)
                                                    } | ${I18n.t('filesize')}: ${
                                                        parseSize(backup.size)}`}
                                                </TableCell>
                                                <TableCell>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <Tooltip title={I18n.t('Download Backup File')}>
                                                            <Fab
                                                                size="small"
                                                                onClick={async () => {
                                                                    const data = await props.socket.sendTo(
                                                                        `${props.adapterName}.${props.instance}`,
                                                                        'getFile',
                                                                        { type: location, fileName: backup.path, protocol: window.location.protocol },
                                                                    );
                                                                    const url = `${window.location.protocol}//${window.location.hostname}:${data.listenPort}/${data.fileName ? data.fileName : backup.path.split(/[\\/]/).pop()}`;
                                                                    saveAs(url);
                                                                }}
                                                            >
                                                                <Download />
                                                            </Fab>
                                                        </Tooltip>
                                                        <Tooltip title={I18n.t('Restore Backup File')}>
                                                            <Fab size="small">
                                                                <History />
                                                            </Fab>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
                                            </TableRow>)}
                                        </Table>
                                    </AccordionDetails>
                                </Accordion>)}
                        </AccordionDetails>
                    </Accordion>) : <LinearProgress />}
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

export default GetBackups;
