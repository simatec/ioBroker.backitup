import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
    Button, Checkbox, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, LinearProgress,
} from '@mui/material';

import { Close, SettingsBackupRestore } from '@mui/icons-material';

import { I18n, DialogError, AdminConnection, ThemeType } from '@iobroker/adapter-react-v5';
import { ExecutionLine } from './types';

const styles: any = {
    paper: {
        height: 'calc(100% - 64px)',
    },
    textTime: {
        display: 'inline-block',
        width: 95,
    },
    responseTextTime: {
        display: 'inline-block',
        width: 70,
    },
    textLevel: {
        display: 'inline-block',
        width: 50,
    },
    'textLevel-ERROR': {
        color: 'red',
    },
    'textLevel-WARN': {
        color: 'orange',
    },
    'textLevel-INFO': {
        color: '#00b204',
    },
    textSource: {
        display: 'inline-block',
        width: 100,
        textAlign: 'left',
    },
    text: {
        display: 'inline-block',
    },
    responseText: {
        display: 'inline-block',
        wordWrap: 'break-word',
    },
    textLine: {
        whiteSpace: 'nowrap',
    },
    responseTextLine: {
        whiteSpace: 'normal',
    },
    dialogContent: {
        position: 'relative',
        padding: 16,
    },
    logContainer: {
        fontSize: 12,
        fontFamily: 'monospace',
        padding: 8,
        border: '1px solid grey',
        borderRadius: 5,
        overflow: 'auto',
        boxSizing: 'border-box',
        height: 'calc(100% - 16px - 4px)',
        width: 'calc(100% - 16px)',
    },
    responseLogContainer: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 15,
    },
    dialogActions: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
    },
};

interface RestoreProps {
    alive: boolean;
    location: string;
    fileName: string;
    onClose: () => void;
    socket: AdminConnection;
    themeType: ThemeType;
    adapterName: string;
    instance: number;
    restoreIfWait: number;
}

interface RestoreState {
    done: boolean;
    executing: boolean;
    executionLog: ExecutionLine[];
    closeOnReady: boolean;
    isStopped: boolean;
    isFullScreen: boolean;
    messages: { text: string; number: boolean }[];
    showRestoreDialog: boolean;
    restoreProcess: {
        done: boolean;
        log: string[];
        startFinish: string;
        restoreStatus: string;
        statusColor: string;
    };
    error?: string;
}

class Restore extends Component<RestoreProps, RestoreState> {
    lastExecutionLine: string;
    textRef: React.RefObject<HTMLDivElement>;
    textRefRestore: React.RefObject<HTMLDivElement>;
    retries: number;
    polling?: ReturnType<typeof setInterval> | null;
    closeTimeout?: ReturnType<typeof setTimeout> | null;

    constructor(props: RestoreProps) {
        super(props);
        const WITH_DOWNLOAD = [
            'dropbox',
            'onedrive',
            'googledrive',
            'ftp',
            'webdav',
        ];
        const NO_RESTART = [
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
        let isStopped = false;
        const messages = [];
        if (!NO_RESTART.find(text => this.props.fileName.includes(text))) {
            isStopped = true;

            if (WITH_DOWNLOAD.includes(this.props.location)) {
                messages[0] = { text: I18n.t('Confirm with "Restore" and the download begins. Please wait until the download is finished!'), number: true };
                messages[1] = { text: I18n.t('After download ioBroker will be restarted during restore.'), number: true };
            } else {
                messages[0] = { text: I18n.t('ioBroker will be restarted during restore.'), number: false };
            }

            messages.push({ text: I18n.t('After confirmation, a new tab opens with the Restore Log.'), number: false });
            messages.push({ text: I18n.t('If the tab does not open, please deactivate your popup blocker.'), number: false });
        } else {
            messages[0] = { text: I18n.t('ioBroker will not be restarted for this restore type.'), number: false };
            messages[1] = { text: I18n.t('Confirm with "Restore".'), number: false };
        }

        this.state = {
            done: false,
            executing: false,
            executionLog: [],
            closeOnReady: false,
            isStopped,
            isFullScreen: false,
            messages,
            showRestoreDialog: false,
            restoreProcess: {
                done: false,
                log: [],
                startFinish: '',   // [Restore], [Restart], [Finish], [Starting]
                restoreStatus: '', // '', 'Restore completed successfully!! Starting iobroker... Please wait!, Restore was canceled!! If ioBroker does not start automatically, please start it manually'
                statusColor: '',   // '', '#00b204', '#c62828'
            },
        };
        this.lastExecutionLine = '';
        this.textRef = React.createRef();
        this.textRefRestore = React.createRef();
        this.retries = 0;
    }

    async pollStatus() {
        if (!this.state.showRestoreDialog) {
            return;
        }

        try {
            await fetch(`${window.location.protocol}//${window.location.hostname}:8091/status.json`)
                .then(response => response.json())
                .then(data => {
                    const restoreProcess = JSON.parse(JSON.stringify(this.state.restoreProcess));
                    if (typeof data.logWebIF === 'string') {
                        restoreProcess.log = data.logWebIF.split('\n');
                    }
                    restoreProcess.startFinish = data.startFinish;
                    restoreProcess.restoreStatus = data.restoreStatus ? I18n.t(data.restoreStatus) : '';
                    restoreProcess.statusColor = data.statusColor;
                    if (restoreProcess.startFinish === '[Finish]') {
                        clearInterval(this.polling!);
                        this.polling = null;
                        restoreProcess.done = true;
                    }

                    // scroll down
                    if (this.textRefRestore.current && this.textRefRestore.current.scrollTop + this.textRefRestore.current.clientHeight >= this.textRefRestore.current.scrollHeight) {
                        setTimeout(() => this.textRefRestore.current && (this.textRefRestore.current.scrollTop = this.textRefRestore.current.scrollHeight), 100);
                    }

                    this.setState({ restoreProcess });
                })
                .catch(e => {
                    this.retries++;
                    if (this.retries > 15) {
                        console.warn(`Cannot get _status: ${e}`);
                        clearInterval(this.polling!);
                        this.polling = null;
                        this.setState({
                            restoreProcess: {
                                done: true,
                                log: [],
                                startFinish: '[Finish]', // [Restore], [Restart], [Finish], [Starting]
                                restoreStatus: I18n.t('Cannot get status'),
                                statusColor: '#c62828',   // '', '#00b204', '#c62828'
                            },
                        });
                    }
                });
        } catch (e) {
            console.warn(`Cannot get status: ${e}`);
            this.retries++;
            if (this.retries > 15) {
                clearInterval(this.polling!);
                this.polling = null;
                this.setState({
                    restoreProcess: {
                        done: true,
                        log: [],
                        startFinish: '[Finish]',   // [Restart], [Finish], [Restore], [Starting]
                        restoreStatus: I18n.t('Cannot get status'), // '', 'Restore completed successfully!! Starting iobroker... Please wait!' ,
                        // 'Restore was canceled!! If ioBroker does not start automatically, please start it manually' ,
                        statusColor: '#c62828',   // '', '#00b204', '#c62828'
                    },
                });
            }
        }
    }

    startPolling() {
        this.setState({
            showRestoreDialog: true,
            restoreProcess: {
                log: [],
                done: false,
                startFinish: '[Starting]',   // [Restart], [Finish], [Restore], [Starting]
                restoreStatus: '', // '', 'Restore completed successfully!! Starting iobroker... Please wait!' ,
                // 'Restore was canceled!! If ioBroker does not start automatically, please start it manually' ,
                statusColor: '',   // '', '#00b204', '#c62828'
            },
        });

        this.retries = 0;
        this.polling = setInterval(() => this.pollStatus(), 1000);
    }

    static getTime() {
        const date = new Date();
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
    }

    onOutput = (id: string, state: ioBroker.State | null | undefined) => {
        if (state && state.val && state.val !== this.lastExecutionLine) {
            this.lastExecutionLine = state.val as string;
            const executionLog = [...this.state.executionLog];
            const lines = (state.val || '').toString().replace(/\n$/, '').split('\n');
            const now = Restore.getTime();
            lines.forEach(line => {
                line = line.trim();
                if (!line) {
                    // return;
                }
                const parts = line.match(/^\[(\w+)] \[(\w+)] - (.*)/);
                if (parts) {
                    executionLog.push({
                        level: parts[1],
                        source: parts[2],
                        ts: now,
                        text: parts[3],
                    });
                } else if ((state.val as string).startsWith('[EXIT]')) {
                    const code = (state.val as string).match(/^\[EXIT] ([-\d]+)/);
                    executionLog.push({
                        level: code![1] === '0' ? 'INFO' : 'ERROR',
                        source: 'gui',
                        ts: now,
                        text: code![1] === '0' ? I18n.t('Restore completed successfully!') : I18n.t('Restore was canceled!'),
                    });
                } else {
                    executionLog.push({ text: line });
                }
            });

            // scroll down
            if (this.textRef.current && this.textRef.current.scrollTop + this.textRef.current.clientHeight >= this.textRef.current.scrollHeight) {
                setTimeout(() => this.textRef.current!.scrollTop = this.textRef.current!.scrollHeight, 100);
            }

            this.setState({ executionLog });

            if ((state.val as string).startsWith('[EXIT]')) {
                this.setState({ executing: false });
                const code = (state.val as string).match(/^\[EXIT] ([-\d]+)/);
                if (this.state.closeOnReady && (!code || code[1] === '0')) {
                    this.closeTimeout = this.closeTimeout || setTimeout(() => {
                        this.closeTimeout = null;
                        this.props.onClose();
                    }, 1500);
                }
            }
        }
    };

    async componentDidMount() {
        await this.props.socket.subscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
        this.updateFullScreenMode();
        window.addEventListener('resize', this.updateFullScreenMode);
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
        this.closeTimeout && clearTimeout(this.closeTimeout);
        this.closeTimeout = null;
        window.removeEventListener('resize', this.updateFullScreenMode);
    }

    updateFullScreenMode = () => {
        const isFullScreen = window.matchMedia('(max-width: 600px)').matches;
        this.setState({ isFullScreen });
    };

    static renderLine(line: ExecutionLine, i: number, isFullScreen: boolean) {
        return <div key={i} style={{ ...isFullScreen ? styles.responseTextLine : styles.textLine }}>
            <div style={{ ...styles.textTime, ...(line.level ? (styles[`textLevel-${line.level}`] || {}) : {}) }}>{line.ts}</div>
            <div style={{ ...styles.textLevel, ...(line.level ? (styles[`textLevel-${line.level}`] || {}) : {}) }}>{line.level}</div>
            <div style={{ ...styles.textSource, ...(line.level ? (styles[`textLevel-${line.level}`] || {}) : {}) }}>{line.source}</div>
            <div style={{ ...(isFullScreen ? styles.responseText : styles.text), ...(line.level ? (styles[`textLevel-${line.level}`] || {}) : {}) }}>{line.text}</div>
        </div>;
    }

    static renderRestoreLine(line: string, i: number, isFullScreen: boolean) {
        return <div key={i} style={{ ...isFullScreen ? styles.responseTextLine : styles.textLine }}>
            {!line.includes('Restore completed successfully!!') ?
                <div style={{ ...(isFullScreen ? styles.responseText : styles.text), color: line.startsWith('[ERROR]') ? '#FF0000' : line.includes('Restore completed successfully') ? '#00b204' : undefined }}>{line}</div> :
                <div
                    style={{
                        ...(isFullScreen ? styles.responseText : styles.text),
                        color: line.includes('Restore completed successfully!!') ? '#00b204' : undefined,
                    }}
                >
                    {I18n.t('After the restart, all adapters are installed. Please be patient.\nDepending on the system, it may take some time until all adapters are available again.')}
                </div>}
        </div>;
    }

    renderRestoreDialog() {
        if (!this.state.showRestoreDialog) {
            return null;
        }
        return <Dialog
            open={!0}
            onClose={() => { this.state.restoreProcess.done && this.setState({ showRestoreDialog: false }); }}
            maxWidth="lg"
            fullWidth
            fullScreen={this.state.isFullScreen}
            sx={{ '& .MuiDialog-paper': styles.paper }}
        >
            <DialogTitle
                style={{ color: this.state.restoreProcess.statusColor }}
            >
                <SettingsBackupRestore style={{ width: 24, height: 24, margin: '0 10px -4px 0' }} />
                {I18n.t(this.state.restoreProcess.startFinish)}
                {this.state.restoreProcess.restoreStatus ? <span style={{ marginLeft: 10, marginRight: 10 }}>-</span> : null}
                {I18n.t(this.state.restoreProcess.restoreStatus) || '...'}
            </DialogTitle>
            <DialogContent style={styles.dialogContent}>
                {!this.state.restoreProcess.done ?
                    <LinearProgress
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 24,
                            width: 'calc(100% - 64px)',
                        }}
                    /> : <div style={{ height: 4, width: 'calc(100% - 64px)' }} />}
                <div
                    style={{
                        ...styles.logContainer,
                        ...(this.state.isFullScreen ? styles.responseLogContainer : undefined),
                        backgroundColor: this.props.themeType === 'dark' ? '#111' : '#EEE',
                    }}
                    ref={this.textRefRestore}
                >
                    {this.state.restoreProcess.log.map((line, i) => Restore.renderRestoreLine(line, i, this.state.isFullScreen))}
                </div>
            </DialogContent>
            <DialogActions style={{ ...(this.state.isFullScreen ? styles.dialogActions : undefined) }}>
                <Button
                    disabled={!this.state.restoreProcess.done}
                    variant="contained"
                    onClick={() => {
                        this.props.onClose();
                        this.setState({ showRestoreDialog: false });
                        // maybe to reload here, as the version of admin could change
                    }}
                    startIcon={<Close />}
                    color={this.props.themeType === 'dark' ? 'primary' : 'grey'}
                >
                    {I18n.t('Close')}
                </Button>
            </DialogActions>
        </Dialog>;
    }

    doRestore() {
        this.setState({
            executing: true,
            done: false,
        }, async () => {
            try {
                const result = await this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'restore', {
                    type: this.props.location,
                    fileName: this.props.fileName,
                    currentTheme: this.props.themeType === 'dark' ? 'react-dark' : 'none',
                    currentProtocol: window.location.protocol,
                    stopIOB: this.state.isStopped,
                });
                if (!result || result.error) {
                    this.setState({ error: JSON.stringify(result.error), executing: false });
                } else if (this.state.isStopped) {
                    setTimeout(() => this.startPolling(), this.props.restoreIfWait || 5000);
                } else {
                    this.setState({ done: true, executing: false });
                }
            } catch (error: any) {
                this.setState({ error: error.toString(), executing: false });
            }
        });
    }

    renderError() {
        if (!this.state.error) {
            return null;
        }
        return <DialogError
            text={this.state.error}
            title={I18n.t('Error')}
            onClose={() => this.setState({ error: '' })}
        />;
    }

    render() {
        return <Dialog
            open={!0}
            onClose={() => !this.state.executing && this.props.onClose()}
            maxWidth="lg"
            fullWidth
            fullScreen={this.state.isFullScreen}
            sx={{ '& .MuiDialog-paper': styles.paper }}
        >
            <DialogTitle>
                <SettingsBackupRestore style={{ width: 24, height: 24, margin: '0 10px -4px 0' }} />
                {I18n.t('BackItUp restore execution')}
            </DialogTitle>
            <DialogContent style={styles.dialogContent}>
                {this.state.executing ?
                    <LinearProgress
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 24,
                            width: 'calc(100% - 64px)',
                        }}
                    /> : <div style={{ height: 4, width: 'calc(100% - 64px)' }} />}
                {this.state.executing || this.state.done ? <div
                    style={{
                        ...styles.logContainer,
                        ...(this.state.isFullScreen ? styles.responseLogContainer : undefined),
                        backgroundColor: this.props.themeType === 'dark' ? '#111' : '#EEE',
                    }}
                    ref={this.textRef}
                >
                    {this.state.executionLog.map((line, i) => Restore.renderLine(line, i, this.state.isFullScreen))}
                </div> : null}
                {!this.state.executing && !this.state.done ? <div>
                    <ul>
                        {this.state.messages.map((message, i) => <li key={i}>
                            {message.number ? `${i + 1}. ` : null}
                            <span style={{ fontSize: 'medium' }}>{message.text}</span>
                        </li>)}
                    </ul>
                </div> : null}
            </DialogContent>
            <DialogActions style={{ ...(this.state.isFullScreen ? styles.dialogActions : undefined) }}>
                <FormControlLabel
                    control={<Checkbox
                        disabled={this.state.done}
                        checked={this.state.closeOnReady}
                        onChange={e => this.setState({ closeOnReady: e.target.checked })}
                    />}
                    label={I18n.t('Close on ready')}
                />
                <Button
                    style={{ marginTop: this.state.isFullScreen ? 10 : 0 }}
                    variant="contained"
                    disabled={this.state.executing || this.state.done}
                    onClick={() => this.setState({
                        executionLog: [{
                            ts: Restore.getTime(),
                            level: 'INFO',
                            text: 'starting Restore...',
                            source: 'gui',
                        }],
                    }, () => this.doRestore())}
                    color={this.props.themeType === 'dark' ? 'primary' : 'grey'}
                >
                    {I18n.t('Restore')}
                </Button>
                <Button
                    style={{ marginTop: this.state.isFullScreen ? 10 : 0 }}
                    color={this.props.themeType === 'dark' ? 'primary' : 'grey'}
                    variant="contained"
                    disabled={this.state.executing}
                    onClick={() => this.props.onClose()}
                >
                    {this.state.done ? I18n.t('Close') : I18n.t('Cancel')}
                </Button>
            </DialogActions>
            {this.renderError()}
            {this.renderRestoreDialog()}
        </Dialog>;
    }
}

export default Restore;
