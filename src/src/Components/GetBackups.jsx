import { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import {
    Accordion, AccordionDetails, AccordionSummary, Dialog,
    DialogContent, DialogTitle, Fab, Table,
    TableCell, TableRow, Tooltip,
    DialogActions, Button, LinearProgress, TableBody,
} from '@mui/material';
import {
    Close,
    Download,
    History,
    ExpandMore,
    Save,
} from '@mui/icons-material';

import {
    FaDropbox,
    FaNetworkWired,
    FaGoogleDrive,
} from 'react-icons/fa';
import {
    DiOnedrive,
    DiRedis,
    DiMysql,
    DiPostgresql,
    DiSqllite,
} from 'react-icons/di';
import {
    SiNodered,
    SiEsphome,
    SiZigbee,
    SiGrafana,
    SiInfluxdb,
    SiNextcloud,
} from 'react-icons/si';
import { I18n } from '@iobroker/adapter-react-v5';

import CCU from '../assets/ccu.png';
import ioBrokerIcon from '../assets/iobroker.png';
import historyIcon from '../assets/history.png';
import zigbee2mqttIcon from '../assets/zigbee2mqtt.png';
import javascriptIcon from '../assets/javascript.png';
import jarvisIcon from '../assets/jarvis.png';
import yahkaIcon from '../assets/yahka.png';

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

const ICONS = {
    local: Save,
    cifs: FaDropbox,
    dropbox: FaDropbox,
    ftp: FaNetworkWired,
    googledrive: FaGoogleDrive,
    onedrive: DiOnedrive,
    webdav: SiNextcloud,
    iobroker: ioBrokerIcon,
    historyDB: historyIcon,
    ccu: CCU,
    javascripts: javascriptIcon,
    nodered: SiNodered,
    influxDB: SiInfluxdb,
    zigbee: SiZigbee,
    zigbee2mqtt: zigbee2mqttIcon,
    grafana: SiGrafana,
    esphome: SiEsphome,
    jarvis: jarvisIcon,
    redis: DiRedis,
    mysql: DiMysql,
    sqlite: DiSqllite,
    pgsql: DiPostgresql,
    yahka: yahkaIcon,
};

function getIcon(type) {
    if (!ICONS[type]) {
        return null;
    }
    if (typeof ICONS[type] === 'object' || typeof ICONS[type] === 'function') {
        const OwnIcon = ICONS[type];
        return <OwnIcon style={{ width: 24, height: 24, marginRight: 8 }} />;
    }
    return <img src={ICONS[type]} style={{ width: 24, height: 24, marginRight: 8 }} alt={type} />;
}

const GetBackups = props => {
    const [backups, setBackups] = useState(null);
    const [expanded, setExpanded] = useState([]);

    useEffect(() => {
        let _expanded = window.localStorage.getItem('BackupExpanded');
        try {
            _expanded = JSON.parse(_expanded);
        } catch {
            _expanded = [];
        }
        setExpanded(_expanded || []);
        setBackups(null);
        props.socket.sendTo(`${props.adapterName}.${props.instance}`, 'list', props.backupSource)
            .then(result => {
                Object.keys(result.data)
                    .forEach(location =>
                        Object.keys(result.data[location])
                            .forEach(object =>
                                result.data[location][object].sort((a, b) => (a.name.replace(/^iobroker_/, '') > b.name.replace(/^iobroker_/, '') ? -1 : 1))));

                setBackups(result);
            });
    }, []);

    return <Dialog
        open={!0}
        onClose={props.onClose}
        fullWidth
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Backup history')}</DialogTitle>
        <span
            style={{
                fontWeight: 400,
                fontSize: 16,
                padding: '0px 24px',
                flex: '0 0 auto'
            }}
        >
            {I18n.t('Please select a backup from the list!').toUpperCase()}
        </span>
        <DialogContent>
            {backups ? Object.keys(backups.data).map(location =>
                <Accordion
                    key={location}
                    expanded={expanded.includes(location)}
                    onChange={() => {
                        const _expanded = [...expanded];
                        const pos = _expanded.indexOf(location);
                        if (pos === -1) {
                            _expanded.push(location);
                            _expanded.sort();
                        } else {
                            _expanded.splice(pos, 1);
                        }
                        window.localStorage.setItem('BackupExpanded', JSON.stringify(_expanded));
                        setExpanded(_expanded);
                    }}
                    style={{
                        backgroundColor: props.themeType ? 'rgba(10, 10, 10, 0.05)' : 'rgba(250, 250, 250, 0.05)',
                    }}
                >
                    <AccordionSummary expandIcon={<ExpandMore />}>
                        {getIcon(location)}
                        <span style={{ fontWeight: 'bold', fontSize: 16 }}>{I18n.t(location).toUpperCase()}</span>
                    </AccordionSummary>
                    <AccordionDetails>
                        {Object.keys(backups.data[location]).map(object =>
                            <Accordion
                                key={object}
                                expanded={expanded.includes(object)}
                                onChange={() => {
                                    const _expanded = [...expanded];
                                    const pos = _expanded.indexOf(object);
                                    if (pos === -1) {
                                        _expanded.push(object);
                                        _expanded.sort();
                                    } else {
                                        _expanded.splice(pos, 1);
                                    }
                                    window.localStorage.setItem('BackupExpanded', JSON.stringify(_expanded));
                                    setExpanded(_expanded);
                                }}
                            >
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    {getIcon(object.split('.').shift())}
                                    <span style={{ fontWeight: 'bold', fontSize: 14 }}>{I18n.t(object).toUpperCase()}</span>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Table size="small">
                                        <TableBody>
                                            {backups.data[location][object].map((backup, index) => <TableRow key={index}>
                                                <TableCell style={{ width: 200, whiteSpace: 'nowrap', paddingRight: 0 }}>
                                                    {I18n.t('Backup time')}
                                                    :
                                                    <span style={{ marginLeft: 8 }}>{parseName(backup.name)}</span>
                                                </TableCell>
                                                <TableCell style={{ width: 'calc(100% - 320px)', whiteSpace: 'nowrap', paddingleft: 0 }}>
                                                    <span style={{ marginRight: 8 }}>|</span>
                                                    {I18n.t('File size')}
                                                    :
                                                    <span style={{ marginLeft: 8 }}>{parseSize(backup.size)}</span>
                                                </TableCell>
                                                <TableCell style={{ width: 88 }}>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        {props.allowDownload ? <Tooltip title={I18n.t('Download Backup File')}>
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
                                                        </Tooltip> : null}
                                                        <Tooltip title={I18n.t('Restore Backup File')}>
                                                            <Fab size="small" onClick={() => props.onRestore(location, object, backup.path)}>
                                                                <History />
                                                            </Fab>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
                                            </TableRow>)}
                                        </TableBody>
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
