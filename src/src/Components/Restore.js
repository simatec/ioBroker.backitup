import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import {I18n, Message} from '@iobroker/adapter-react-v5';
import {
    Button, Checkbox, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, LinearProgress,
} from '@mui/material';

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
        width: 85,
    },
    textLevel: {
        display: 'inline-block',
        width: 40,
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
        };
        this.lastExecutionLine = '';
        this.textRef = React.createRef();
    }

    static getTime() {
        const date = new Date();
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
    }

    onOutput = (id, state)  => {
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
                        this.setState({ executionDialog: false });
                    }, 1500);
                }
            }
        }
    };

    async componentDidMount() {
        await this.props.socket.subscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
    }

    onEnabled = (id, state) => {
        if (id === `${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`) {
            if (!!state?.val !== this.state.executing) {
                this.setState({ executing: !!state?.val });
            }
        }
    };

    componentWillUnmount() {
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
        this.closeTimeout && clearTimeout(this.closeTimeout);
        this.closeTimeout = null;
    }

    renderLine(line, i) {
        return <div key={i} className={this.props.classes.textLine}>
            <div className={this.props.classes.textTime}>{line.ts}</div>
            <div className={`${this.props.classes.textLevel} ${line.level ? (this.props.classes[`textLevel-${line.level}`] || '') : ''}`}>{line.level}</div>
            <div className={this.props.classes.textSource}>{line.source}</div>
            <div className={this.props.classes.text}>{line.text}</div>
        </div>;
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
                    const restoreURL = `${window.location.protocol}//${window.location.hostname}:8091/backitup-restore.html`;
                    setTimeout(() => window.open(restoreURL, '_self'), this.props.restoreIfWait || 5000);
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
                {I18n.t('BackItUp restore execution:')}
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
                            <span>{message.text}</span>
                        </li>)}
                    </ul>
                </div>: null}
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
                    onClick={() => this.doRestore()}
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
        </Dialog>;
    }
}

Restore.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    onError: PropTypes.func,
    adapterName: PropTypes.string.isRequired,
    instance: PropTypes.number.isRequired,
    file: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
};

export default withStyles(styles)(Restore);
