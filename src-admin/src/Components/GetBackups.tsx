import { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import {
    Accordion, AccordionDetails, AccordionSummary, Dialog,
    DialogContent, DialogTitle, Fab, Table,
    TableCell, TableRow, Tooltip,
    DialogActions, Button, LinearProgress, TableBody, useMediaQuery,
    Breakpoints,
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
import { AdminConnection, I18n } from '@iobroker/adapter-react-v5';

import CCU from '../assets/ccu.png';
import ioBrokerIcon from '../assets/iobroker.png';
import historyIcon from '../assets/history.png';
import zigbee2mqttIcon from '../assets/zigbee2mqtt.png';
import javascriptIcon from '../assets/javascript.png';
import jarvisIcon from '../assets/jarvis.png';
import yahkaIcon from '../assets/yahka.png';

function parseSize(bytes: number) {
    if (bytes > 1024 * 1024 * 512) {
        return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10}${I18n.t('GiB')}`;
    } if (bytes > 1024 * 1024) {
        return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}${I18n.t('MiB')}`;
    } if (bytes > 1024) {
        return `${Math.round((bytes / (1024)) * 10) / 10}${I18n.t('KiB')}`;
    }
    return `${bytes} ${I18n.t('bytes')}`;
}
function parseName(name: string) {
    const parts = name.split('_');
    if (parseInt(parts[0], 10).toString() !== parts[0]) {
        parts.shift();
    }
    return new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2].split('-')[0], 10),
        parseInt(parts[2].split('-')[1], 10),
        parseInt(parts[3], 10),
    ).toLocaleString().replace(/:00$/, '');
}

const ICONS: Record<string, React.ComponentType> = {
    local: Save,
    cifs: FaNetworkWired,
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

function getIcon(type: string) {
    if (!ICONS[type]) {
        return null;
    }
    if (typeof ICONS[type] === 'object' || typeof ICONS[type] === 'function') {
        const OwnIcon: any = ICONS[type];
        return <OwnIcon style={{ width: 24, height: 24, marginRight: 8 }} />;
    }
    return <img src={ICONS[type]} style={{ width: 24, height: 24, marginRight: 8 }} alt={type} />;
}

function getLabelByValue(value: string, connectType: string) {
    const STORAGENAME = [
        { label: 'Local', value: 'local' },
        { label: `NAS${connectType ? ` (${connectType})` : ''}`, value: 'nas / copy' },
        { label: 'FTP', value: 'ftp' },
        { label: 'Dropbox', value: 'dropbox' },
        { label: 'OneDrive', value: 'onedrive' },
        { label: 'Google Drive', value: 'googledrive' },
        { label: 'WebDAV', value: 'webdav' },
    ];

    const option = STORAGENAME.find(_option => _option.value === value);
    return option ? option.label : value;
}

interface GetBackupsProps {
    themeBreakpoints: Breakpoints['down'];
    themeType: string;
    onClose: () => void;
    onRestore: (location: string, object: string, fileName: string) => void;
    allowDownload: boolean;
    backupSource: string;
    connectType: string;
    instance: number;
    adapterName: string;
    socket: AdminConnection;
}

interface BackupResult {
    data: Record<string, Record<string, { name: string; path: string; size: number }[]>>;
}

const GetBackups = (props: GetBackupsProps) => {
    const fullScreen = useMediaQuery(props.themeBreakpoints('sm'));
    const [backups, setBackups] = useState<BackupResult | null>(null);
    const [expanded, setExpanded] = useState<string[]>([]);

    useEffect(() => {
        let _expanded: string | string[] = window.localStorage.getItem('BackupExpanded')!;
        try {
            _expanded = JSON.parse(_expanded!);
        } catch {
            _expanded = [];
        }
        setExpanded(_expanded as string[] || []);
        setBackups(null);
        props.socket.sendTo(`${props.adapterName}.${props.instance}`, 'list', props.backupSource)
            .then((result: BackupResult) => {
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
        fullScreen={fullScreen}
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Backup history')}</DialogTitle>
        <span
            style={{
                fontWeight: 400,
                fontSize: 16,
                padding: '0px 24px',
                flex: '0 0 auto',
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
                        <span style={{ fontWeight: 'bold', fontSize: 16 }}>{I18n.t(getLabelByValue(location, props.connectType)).toUpperCase()}</span>
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
                                    {getIcon(object.split('.').shift()!)}
                                    <span style={{ fontWeight: 'bold', fontSize: 14 }}>{I18n.t(object).toUpperCase()}</span>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Table size="small">
                                        <TableBody>
                                            {backups.data[location][object].map((backup, index) => <TableRow key={index} style={{ display: 'flex', flexDirection: fullScreen ? 'column' : 'row' }}>
                                                <TableCell style={{ width: fullScreen ? '100%' : 220, whiteSpace: 'nowrap', padding: fullScreen ? '6px 0' : '16px 16px' }}>
                                                    {I18n.t('Backup time')}
                                                    :
                                                    <span style={{ marginLeft: 8 }}>{parseName(backup.name)}</span>
                                                </TableCell>
                                                <TableCell style={{ width: fullScreen ? '100%' : 'calc(100% - 320px)', whiteSpace: 'nowrap', padding: fullScreen ? '6px 0' : '16px 16px' }}>
                                                    {I18n.t('File size')}
                                                    :
                                                    <span style={{ marginLeft: 8 }}>{parseSize(backup.size)}</span>
                                                </TableCell>
                                                <TableCell style={{ width: fullScreen ? '100%' : 88, borderBottom: fullScreen ? '1px outset rgb(224, 224, 224)' : '1px solid rgb(224, 224, 224)', padding: '6px 0' }}>
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: fullScreen ? 'center' : 'normal' }}>
                                                        {props.allowDownload ? <Tooltip title={I18n.t('Download Backup File')}>
                                                            <Fab
                                                                size="small"
                                                                color={props.themeType === 'dark' ? 'primary' : 'grey' as any}
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
                                                            <Fab size="small" color={props.themeType === 'dark' ? 'primary' : 'grey' as any} onClick={() => props.onRestore(location, object, backup.path)}>
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
                color="primary"
            >
                {I18n.t('Close')}
            </Button>
        </DialogActions>
    </Dialog>;
};

export default GetBackups;
