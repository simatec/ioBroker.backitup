import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { ConfigGeneric, I18n } from '@iobroker/adapter-react-v5';
import {
    Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

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
        margin: '0.2rem 0 0 0.8rem',
        textAlign: 'left',
    },
    text: {
        display: 'inline-block',
    },
};

const DEBUGLOG = `Start Backup`;
class BackupNow extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            executing: false,
            executionDialog: false,
            executionLog: [],
            closeOnReady: false,
        };
        this.lastExecutionLine = '';
        this.textRef = React.createRef();
    }

    onOutput = (id, state)  => {
        if (state && state.val && state.val !== this.lastExecutionLine) {
            this.lastExecutionLine = state.val;
            const executionLog = [...this.state.executionLog];
            executionLog.push(state.val);

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
    }

    renderLine(line, i) {
        const parts = line.match(/^\[(\w+)] \[(\w+)] - (.*)/);
        if (parts) {
            return <div key={i}>
                <div className={`${this.props.classes.textLevel} ${this.props.classes[`textLevel-${parts[1]}`]}`}>{parts[1]}</div>
                <div className={this.props.classes.textSource}>{parts[2]}</div>
                <div className={this.props.classes.text}>{parts[3]}</div>
            </div>;
        }
        return <div key={i}>
            <div className={this.props.classes.textLevel} />
            <div className={this.props.classes.textSource} />
            <div className={this.props.classes.text}>{line}</div>
        </div>;
    }

    renderExecutionDialog() {
        return this.state.executionDialog ? <Dialog
            open={!0}
            onClose={() => this.setState({ executionDialog: false })}
            maxWidth="lg"
            fullWidth
            classes={{ paper: this.props.classes.paper }}
        >
            <DialogTitle>
                {I18n.t('BackItUp execution:')}
            </DialogTitle>
            <DialogContent style={{ position: 'relative' }}>
                {this.state.executing ?
                    <LinearProgress
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 24,
                            width: 'calc(100% - 48px)',
                        }}
                    /> : null}
                <div
                    style={{
                        height: 'calc(100% - 16px - 4px)',
                        width: 'calc(100% - 16px)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        marginTop: 4,
                        padding: 8,
                    }}
                    ref={this.textRef}
                >
                    {this.state.executionLog.map((line, i) => this.renderLine(line, i))}
                </div>
            </DialogContent>
            <DialogActions>
                <FormControlLabel
                    control={
                        <Checkbox
                            disabled={!this.state.executing}
                            checked={this.state.closeOnReady}
                            onChange={e => this.setState({ closeOnReady: e.target.checked })}
                        />
                    }
                    label={I18n.t('close on ready')}
                />
                <Button
                    variant="contained"
                    onClick={() => this.setState({ executionDialog: false })}
                >
                    {I18n.t('Close')}
                </Button>
            </DialogActions>
        </Dialog> : null;
    }

    renderItem() {
        return <>
            <Button
                disabled={!this.props.alive || this.state.executing}
                onClick={() => this.setState({ executionDialog: true, executionLog: DEBUGLOG.split('\n'), executing: true }, async () => {
                    this.lastExecutionLine = '';
                    await this.props.socket.setState(`${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`, true);
                })}
                className={this.props.className}
                color={this.props.color}
                variant="contained"
                style={this.props.style}
                endIcon={<CloudUpload />}
            >
                {this.props.schema.label ? I18n.t(this.props.schema.label) : I18n.t('backup now')}
            </Button>
            {this.renderExecutionDialog()}
        </>;
    }
}

BackupNow.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    style: PropTypes.object,
    schema: PropTypes.object,
    onError: PropTypes.func,
};

export default withStyles(styles)(BackupNow);
