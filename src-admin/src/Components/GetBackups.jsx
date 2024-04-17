import { useEffect, useState } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Dialog,
    DialogContent, DialogTitle, Fab, Table,
    TableCell, TableRow, Tooltip,
    DialogActions, Button, LinearProgress,
} from '@mui/material';
import {
    Close,
    History,
    ExpandMore,
    Save,
} from '@mui/icons-material';

import {
    FaDropbox,
    FaNetworkWired,
    FaGoogleDrive, FaDatabase,
} from 'react-icons/fa';
import {
    DiOnedrive, DiRedis,
} from 'react-icons/di';
import {
    SiNodered,
} from 'react-icons/si';
import { I18n, Confirm } from '@iobroker/adapter-react-v5';

import CCU from '../assets/ccu.png';
import ioBrokerIcon from '../assets/iobroker.png';
import historyIcon from '../assets/history.png';
import javascriptIcon from '../assets/javascript.png';
import influxdbIcon from '../assets/influxdb.png';
import zigbeeIcon from '../assets/zigbee.png';
import grafanaIcon from '../assets/grafana.png';
import zigbee2mqttIcon from '../assets/zigbee2mqtt.png';

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
    webdav: FaDatabase,
    iobroker: ioBrokerIcon,
    redis: DiRedis,
    history: historyIcon,
    ccu: CCU,
    javascripts: javascriptIcon,
    nodered: SiNodered,
    influxDB: influxdbIcon,
    zigbee: zigbeeIcon,
    zigbee2mqtt: zigbee2mqttIcon,
    grafana: grafanaIcon,
};

function getIcon(type) {
    if (!ICONS[type]) {
        return null;
    }
    if (typeof ICONS[type] === 'object') {
        const OwnIcon = ICONS[type];
        return <OwnIcon style={{ width: 24, height: 24, marginRight: 8 }} />;
    }
    return <img src={ICONS[type]} style={{ width: 24, height: 24, marginRight: 8 }} alt={type} />;
}

function doRestore(socket, data) {
/*    if (downloadPanel) {
        $('.cloudRestore').show();
    } else {
        $('.cloudRestore').hide();
    }

    $('.do-list').addClass('disabled');
    $('#tab-restore').find('.do-restore').addClass('disabled').hide();
    $('#tab-restore').find('.do-download').addClass('disabled').hide();

    var name = file.split('/').pop().split('_')[0];
    showDialog(name !== '' ? 'restore' : '', isStopped);
    showToast(null, _('Restore started'));
    let theme;
    try {
        theme = currentTheme();
    } catch (e) {
        // Ignore
    }

    sendTo(null, 'restore', { type: type, fileName: file, currentTheme: theme || 'none', currentProtocol: location.protocol, stopIOB: isStopped }, function (result) {
        if (!result || result.error) {
            showError('Error: ' + JSON.stringify(result.error));
        } else {
            console.log('Restore finish!')
            if (isStopped) {
                var restoreURL = `${location.protocol}//${location.hostname}:8091/backitup-restore.html`;
                console.log('Restore Url: ' + restoreURL);
                setTimeout(() => window.open(restoreURL, '_self'), restoreIfWait);
                //setTimeout(() => $('<a href="' + restoreURL + '">&nbsp;</a>')[0].click(), restoreIfWait);
            }

            if (downloadPanel) {
                $('.cloudRestore').hide();
                downloadPanel = false;
            }
        }
        $('.do-list').removeClass('disabled');
        $('#tab-restore').find('.do-restore').removeClass('disabled').show();
        $('#tab-restore').find('.do-download').removeClass('disabled').show();
    });
 */
}

const GetBackups = props => {
    const [backups, setBackups] = useState(null);
    const [expanded, setExpanded] = useState([]);
    const [confirm, setConfirm] = useState(null);

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
                Object.keys(result.data).forEach(location => {
                    Object.keys(result.data[location]).forEach(object => {
                        result.data[location][object].sort((a, b) => (a.name > b.name ? -1 : 1));
                    });
                });
                setBackups(result);
            });
    }, []);

    const confirmDialog = confirm ? <Confirm
        open={!0}
        title={I18n.t()}
        text={I18n.t()}
        ok={I18n.t('Restore')}
        onClose={ok => {
            if (ok) {
                doRestore();
            }
            setConfirm(null);
        }}
    /> : null;

    return <Dialog
        open={!0}
        onClose={props.onClose}
        fullWidth
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Backup history')}</DialogTitle>
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
                                    {getIcon(object)}
                                    <span style={{ fontWeight: 'bold', fontSize: 14 }}>{I18n.t(object).toUpperCase()}</span>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Table size="small">
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
                                                    <Tooltip title={I18n.t('Restore Backup File')}>
                                                        <Fab
                                                            size="small"
                                                            onClick={() => {
                                                                let message = I18n.t('ioBroker will be restarted during restore.');
                                                                message += '\n\n';
                                                                message += I18n.t('Confirm with \"OK\".');
                                                                let showDownload = false;
                                                                if (location === 'dropbox' || location === 'onedrive' || location === 'googledrive' || location === 'ftp' || location === 'webdav') {
                                                                    message = I18n.t('1. Confirm with "OK" and the download begins. Please wait until the download is finished!\n\n2. After the download ioBroker will be restarted during restore.');
                                                                    showDownload = true;
                                                                }
                                                                var isStopped = false;
                                                                const STOPPED = [
                                                                    'grafana',
                                                                    'jarvis',
                                                                    'javascripts',
                                                                    'mysql',
                                                                    'sqlite',
                                                                    'influxDB',
                                                                    'pgsql',
                                                                    'zigbee',
                                                                    'esphome',
                                                                    'zigbee2mqtt',
                                                                    'nodered',
                                                                    'yahka',
                                                                    'historyDB',
                                                                ];
                                                                if (STOPPED.includes(object)) {
                                                                    isStopped = true;
                                                                } else {
                                                                    if (showDownload) {
                                                                        message = I18n.t('1. Confirm with "OK" and the download begins. Please wait until the download is finished!');
                                                                        message += '\n\n';
                                                                        message += I18n.t('2. After the download, the restore begins without restarting ioBroker.');
                                                                    } else {
                                                                        message = I18n.t('ioBroker will not be restarted for this restore.\n\nConfirm with \"OK\".');
                                                                    }
                                                                }
                                                                if (isStopped) {
                                                                    message += I18n.t('After confirmation, a new tab opens with the Restore Log.');
                                                                    message += '\n\n\n';
                                                                    message += I18n.t('If the tab does not open, please deactivate your popup blocker.');
                                                                }
                                                                setConfirm({ location, object, backup, message });
                                                            }}
                                                        >
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
        {confirmDialog}
    </Dialog>;
};

export default GetBackups;
