import React from 'react';
import PropTypes from 'prop-types';

import {
    Button, Checkbox, Dialog,
    DialogActions, DialogContent,
    DialogTitle, FormControlLabel, LinearProgress,
} from '@mui/material';
import { CloudUploadOutlined } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';

import { ConfigGeneric } from '@iobroker/json-config';

const styles = {
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

class BackupNow extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            executing: false,
            executionDialog: false,
            executionLog: [],
            closeOnReady: false,
            styles,
            isFullScreen: false,
        };
        this.lastExecutionLine = '';
        this.textRef = React.createRef();
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
            const now = BackupNow.getTime();
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
                } else if (state.val.startsWith('[EXIT]')) {
                    const code = state.val.match(/^\[EXIT] ([-\d]+)/);
                    executionLog.push({
                        level: code[1] === '0' ? 'INFO' : 'WARN',
                        source: 'gui',
                        ts: now,
                        text: code[1] === '0' ? I18n.t('The backup was successfully created!') : I18n.t('The backup could not be created completely!'),
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
        super.componentDidMount();
        await this.props.socket.subscribeState(`${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`, this.onEnabled);
        await this.props.socket.subscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
        this.updateFullScreenMode();
        window.addEventListener('resize', this.updateFullScreenMode);
    }

    onEnabled = (id, state) => {
        if (id === `${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`) {
            if (!!state?.val !== this.state.executing) {
                this.setState({ executing: !!state?.val });
            }
        }
    };

    componentWillUnmount() {
        super.componentWillUnmount();
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`, this.onEnabled);
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
        this.closeTimeout && clearTimeout(this.closeTimeout);
        this.closeTimeout = null;
        window.removeEventListener('resize', this.updateFullScreenMode);
    }

    updateFullScreenMode = () => {
        const isFullScreen = window.matchMedia('(max-width: 600px)').matches;
        this.setState({ isFullScreen });
    };

    renderLine(line, i) {
        return <div key={i} style={{ ...this.state.isFullScreen ? this.state.styles.responseTextLine : this.state.styles.textLine }}>
            <div style={{ ...this.state.styles.textTime, ...(line.level ? this.state.styles[`textLevel-${line.level}`] : undefined) }}>
                {line.ts}
            </div>
            <div style={{ ...this.state.styles.textLevel, ...(line.level ? this.state.styles[`textLevel-${line.level}`] : undefined) }}>
                {line.level}
            </div>
            <div style={{ ...this.state.styles.textSource, ...(line.level ? this.state.styles[`textLevel-${line.level}`] : undefined) }}>
                {line.source}
            </div>
            <div style={{ ...(this.state.isFullScreen ? this.state.styles.responseText : this.state.styles.text), ...(line.level ? this.state.styles[`textLevel-${line.level}`] : undefined) }}>
                {line.text}
            </div>
        </div>;
    }

    renderExecutionDialog() {
        return this.state.executionDialog ? (
            <Dialog
                open={!0}
                onClose={() => this.setState({ executionDialog: false })}
                maxWidth="lg"
                fullWidth
                fullScreen={this.state.isFullScreen}
                sx={{ '& .MuiDialog-paper': this.state.styles.paper }}
            >
                <DialogTitle>
                    <CloudUploadOutlined style={{ width: 24, height: 24, margin: '0 10px -4px 0' }} />
                    {I18n.t('BackItUp execution:')}
                </DialogTitle>
                <DialogContent style={this.state.styles.dialogContent}>
                    {this.state.executing ? (
                        <LinearProgress
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 24,
                                width: 'calc(100% - 64px)',
                            }}
                        />
                    ) : (
                        <div style={{ height: 4, width: 'calc(100% - 64px)' }} />
                    )}
                    <div
                        style={{
                            ...this.state.styles.logContainer,
                            ...(this.state.isFullScreen ? this.state.styles.responseLogContainer : undefined),
                            backgroundColor: this.props.themeType === 'dark' ? '#111' : '#EEE',
                        }}
                        ref={this.textRef}
                    >
                        {this.state.executionLog.map((line, i) => this.renderLine(line, i))}
                    </div>
                </DialogContent>
                <DialogActions style={{ ...(this.state.isFullScreen ? this.state.styles.dialogActions : undefined) }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                disabled={!this.state.executing}
                                checked={this.state.closeOnReady}
                                onChange={e => this.setState({ closeOnReady: e.target.checked })}
                            />
                        }
                        label={I18n.t('Close on ready')}
                    />
                    <Button
                        variant="contained"
                        color={this.props.color}
                        onClick={() => this.setState({ executionDialog: false })}
                    >
                        {I18n.t('Close')}
                    </Button>
                </DialogActions>
            </Dialog>
        ) : null;
    }

    renderItem() {
        return (
            <>
                <Button
                    disabled={!this.props.alive || this.state.executing}
                    onClick={() => this.setState({
                        executionDialog: true,
                        executionLog: [{
                            ts: BackupNow.getTime(),
                            level: 'INFO',
                            text: I18n.t('starting Backup...'),
                            source: 'gui',
                        }],
                        executing: true,
                    }, async () => {
                        this.lastExecutionLine = '';
                        await this.props.socket.setState(`${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`, true);
                    })}
                    className={this.props.className}
                    color={this.props.color}
                    variant="contained"
                    style={this.props.style}
                    endIcon={<CloudUploadOutlined />}
                >
                    {this.props.schema.label ? I18n.t(this.props.schema.label) : I18n.t('Backup now')}
                </Button>
                {this.renderExecutionDialog()}
            </>
        );
    }
}

BackupNow.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    style: PropTypes.object,
    className: PropTypes.string,
    schema: PropTypes.object,
    onError: PropTypes.func,
};

export default BackupNow;
