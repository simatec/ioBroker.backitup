import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { I18n, Message } from '@iobroker/adapter-react-v5';
import {
    Button, Checkbox, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, LinearProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';

const styles = {
    paper: {
        height: 'calc(100% - 64px)',
    },
    fullHeight: {
        height: '100%',
        '& .MuiInputBase-root': {
            height: '100%',
        },
    },
    textTime: {
        display: 'inline-block',
        width: 95,
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
    textSource: {
        display: 'inline-block',
        width: 100,
        textAlign: 'left',
    },
    text: {
        display: 'inline-block',
    },
    textLine: {
        whiteSpace: 'nowrap',
    },
};

class Restore extends Component {
    constructor(props) {
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
        let downloadPanel = false;
        let isStopped = false;
        const messages = [];
        if (!NO_RESTART.find(text => this.props.fileName.includes(text))) {
            isStopped = true;

            if (WITH_DOWNLOAD.includes(this.props.location)) {
                messages[0] = { text: I18n.t('Confirm with "Restore" and the download begins. Please wait until the download is finished!'), number: true };
                messages[1] = { text: I18n.t('After download ioBroker will be restarted during restore.'), number: true };
                downloadPanel = true;
            } else {
                messages[0] = { text: I18n.t('ioBroker will be restarted during restore.'), number: false };
            }

            messages.push({ text: I18n.t('After confirmation, a new tab opens with the Restore Log.'), number: false });
            messages.push({ text: I18n.t('If the tab does not open, please deactivate your popup blocker.'), number: false });
        } else if (downloadPanel) {
            messages[0] = { text: I18n.t('Confirm with "Restore" and the download begins. Please wait until the download is finished!'), number: true };
            messages[1] = { text: I18n.t('After the download, the restore begins without restarting ioBroker.'), number: true };
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
            downloadPanel,
            messages,
            showRestoreDialog: false,
            restoreProcess: {
                done: false,
                log: [],
                startFinish: '',   // [Restore], [Restart], [Finish]
                restoreStatus: '', // '', 'Restore completed successfully!! Starting iobroker... Please wait!',
                                   // 'Restore was canceled!! If ioBroker does not start automatically, please start it manually'
                statusColor: '',   // '', '#7fff00', 'red'
            },
        };
        this.lastExecutionLine = '';
        this.textRef = React.createRef();
        this.retries = 0;
    }

    async pollStatus() {
        if (!this.state.showRestoreDialog) {
            return;
        }

        try {
            await fetch(`${window.location.protocol}//${window.location.hostname}:8091/status.json`, { mode: 'no-cors'})
                .then(response => response.json())
                .then(data => {
                    console.log(data.logWebIF.split('\n'));
                    const restoreProcess = JSON.parse(JSON.stringify(this.state.restoreProcess));
                    if (typeof data.logWebIF === 'string') {
                        restoreProcess.log = data.logWebIF.split('\n');
                    }
                    restoreProcess.startFinish = data.startFinish;
                    restoreProcess.restoreStatus = data.restoreStatus ? I18n.t(data.restoreStatus) : '';
                    restoreProcess.statusColor = data.statusColor;
                    if (restoreProcess.restoreStatus === '[Finish]') {
                        clearInterval(this.polling);
                        this.polling = null;
                        restoreProcess.done = true;
                    }

                    this.setState({ restoreProcess });
                })
                .catch(e => {
                    console.warn(`Cannot get _status: ${e}`);
                    this.retries++;
                    if (this.retries > 10) {
                        clearInterval(this.polling);
                        this.polling = null;
                        this.setState({
                            restoreProcess: {
                                done: true,
                                log: [],
                                startFinish: '[Finish]', // [Restore], [Restart], [Finish]
                                restoreStatus: I18n.t('Cannot get status'),
                                statusColor: 'red',   // '', '#7fff00', 'red'
                            },
                        });
                    }
                });
        } catch (e) {
            console.warn(`Cannot get status: ${e}`);
            this.retries++;
            if (this.retries > 10) {
                clearInterval(this.polling);
                this.polling = null;
                this.setState({
                    restoreProcess: {
                        done: true,
                        log: [],
                        startFinish: '[Finish]',   // [Restart], [Finish], [Restore]
                        restoreStatus: I18n.t('Cannot get status'), // '', 'Restore completed successfully!! Starting iobroker... Please wait!' ,
                        // 'Restore was canceled!! If ioBroker does not start automatically, please start it manually' ,
                        statusColor: 'red',   // '', '#7fff00', 'red'
                    },
                });
            }
        }
    }

    startPolling(url) {
        this.setState({
            showRestoreDialog: true,
            restoreProcess: {
                log: [],
                done: false,
                startFinish: '',   // [Restart], [Finish], [Restore]
                restoreStatus: I18n.t('Restore is started...'), // '', 'Restore completed successfully!! Starting iobroker... Please wait!' ,
                // 'Restore was canceled!! If ioBroker does not start automatically, please start it manually' ,
                statusColor: '',   // '', '#7fff00', 'red'
            },
        });

        this.retries = 0;
        this.polling = setInterval(() => this.pollStatus(), 1000);
    }

    static getTime() {
        const date = new Date();
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
    }

    onOutput = (id, state) => {
        if (state && state.val && state.val !== this.lastExecutionLine) {
            this.lastExecutionLine = state.val;
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
                } else {
                    executionLog.push({ text: line });
                }
            });

            // scroll down
            if (this.textRef.current && this.textRef.current.scrollTop + this.textRef.current.clientHeight >= this.textRef.current.scrollHeight) {
                setTimeout(() => this.textRef.current.scrollTop = this.textRef.current.scrollHeight, 100);
            }

            this.setState({ executionLog });

            if (state.val.startsWith('[EXIT]')) {
                this.setState({ executing: false });
                const code = state.val.match(/^\[EXIT] ([-\d]+)/);
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
        window.addEventListener('message', this.onMessage, false);
    }

    onMessage = (event) => {
        if (event.data === 'restore-finished') {
            this.setState({ done: true });
        }
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
        this.closeTimeout && clearTimeout(this.closeTimeout);
        this.closeTimeout = null;
        window.removeEventListener('message', this.onMessage, false);
    }

    renderLine(line, i) {
        return <div key={i} className={this.props.classes.textLine}>
            <div className={this.props.classes.textTime}>{line.ts}</div>
            <div className={`${this.props.classes.textLevel} ${line.level ? (this.props.classes[`textLevel-${line.level}`] || '') : ''}`}>{line.level}</div>
            <div className={this.props.classes.textSource}>{line.source}</div>
            <div className={this.props.classes.text}>{line.text}</div>
        </div>;
    }

    renderRestoreLine(line, i) {
        return <div key={i} className={this.props.classes.textLine}>
            <div className={this.props.classes.text} style={{ color: line.startsWith('[ERROR]') ? '#FF0000' : undefined}}>{line}</div>
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
            classes={{ paper: this.props.classes.paper }}
        >
            <DialogTitle
                style={{ color: this.state.restoreProcess.statusColor }}
            >
                {I18n.t(this.state.restoreProcess.startFinish)}
                <span style={{ marginLeft: 10, marginRight: 10 }}>-</span>
                {I18n.t(this.state.restoreProcess.restoreStatus)}
            </DialogTitle>
            <DialogContent style={{ position: 'relative' }}>
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
                        height: 'calc(100% - 16px - 4px)',
                        width: 'calc(100% - 16px)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        marginTop: 4,
                        padding: 8,
                        border: '1px solid grey',
                        borderRadius: 5,
                        overflow: 'auto',
                        backgroundColor: this.props.themeType === 'dark' ? '#111' : '#EEE',
                        boxSizing: 'border-box',
                    }}
                    ref={this.textRef}
                >
                    {this.state.restoreProcess.log.map((line, i) => this.renderRestoreLine(line, i))}
                </div>
            </DialogContent>
            <DialogActions>
                <Button
                    disabled={!this.state.restoreProcess.done}
                    variant="contained"
                    onClick={() => {
                        this.props.onClose();
                        this.setState({ showRestoreDialog: false });
                        // maybe to reload here, as the version of admin could change
                    }}
                    startIcon={<Close />}
                    color="primary"
                >
                    {I18n.t('Close')}
                </Button>
            </DialogActions>
        </Dialog>
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
            } catch (error) {
                this.setState({ error: error.toString(), executing: false });
            }
        });
    }

    renderError() {
        if (!this.state.error) {
            return null;
        }
        return <Message
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
            classes={{ paper: this.props.classes.paper }}
        >
            <DialogTitle>
                {I18n.t('BackItUp restore execution')}
            </DialogTitle>
            <DialogContent style={{ position: 'relative' }}>
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
                        height: 'calc(100% - 16px - 4px)',
                        width: 'calc(100% - 16px)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        marginTop: 4,
                        padding: 8,
                        border: '1px solid grey',
                        borderRadius: 5,
                        overflow: 'auto',
                        backgroundColor: this.props.themeType === 'dark' ? '#111' : '#EEE',
                        boxSizing: 'border-box',
                    }}
                    ref={this.textRef}
                >
                    {this.state.executionLog.map((line, i) => this.renderLine(line, i))}
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
            <DialogActions>
                <FormControlLabel
                    control={<Checkbox
                        disabled={this.state.done}
                        checked={this.state.closeOnReady}
                        onChange={e => this.setState({ closeOnReady: e.target.checked })}
                    />}
                    label={I18n.t('Close on ready')}
                />
                <Button
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
                    color="primary"
                >
                    {I18n.t('Restore')}
                </Button>
                <Button
                    color="grey"
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

Restore.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    adapterName: PropTypes.string.isRequired,
    instance: PropTypes.number.isRequired,
    fileName: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
};

export default withStyles(styles)(Restore);
