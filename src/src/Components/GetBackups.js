import { I18n } from '@iobroker/adapter-react-v5';
import {
    Accordion, AccordionDetails, AccordionSummary, Dialog, DialogContent, DialogTitle,
} from '@mui/material';
import { useEffect, useState } from 'react';

function parseSize(bytes) {
    if (bytes > 1024 * 1024 * 512) {
        return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10}GiB`;
    } if (bytes > 1024 * 1024) {
        return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MiB`;
    } if (bytes > 1024) {
        return `${Math.round((bytes / (1024)) * 10) / 10}KiB`;
    }
    return `${bytes} bytes`;
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
        props.socket.sendTo(`${props.adapterName}.${props.instance}`, 'list', 'local').then(result => {
            setBackups(result);
        });
    }, [props.open]);

    if (!backups) return null;

    return <Dialog
        open={props.open}
        onClose={props.onClose}
        fullWidth
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Backup history')}</DialogTitle>
        <DialogContent>
            {Object.keys(backups.data).map(location =>
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
                                    {backups.data[location][object].map((backup, index) => <div key={index}>
                                        {parseName(backup.name)}
                                        {' - '}
                                        {parseSize(backup.size)}
                                    </div>)}
                                </AccordionDetails>
                            </Accordion>)}
                    </AccordionDetails>
                </Accordion>)}
        </DialogContent>
    </Dialog>;
};

export default GetBackups;
