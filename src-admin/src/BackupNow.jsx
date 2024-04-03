import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { ConfigGeneric, I18n } from '@iobroker/adapter-react-v5';
import {
    Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, TextField,
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
        }
    },
};

class BackupNow extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            executing: false,
            executionDialog: false,
            executionLog: '',
            closeOnReady: false,
        };
        this.lastExecutionLine = '';
    }

    onOutput = (id, state)  => {
        if (state && state.val && state.val !== this.lastExecutionLine) {
            this.lastExecutionLine = state.val;
            this.setState({ executionLog: `${this.state.executionLog + state.val}\n` });
            if (state.val.startsWith('[EXIT]')) {
                this.setState({ executing: false });
                const code = state.val.match(/^\[EXIT] ([-\d]+)/);
                if (this.state.closeOnReady && (!code || code[1] === '0')) {
                    setTimeout(() => this.setState({ executionDialog: false }), 1500);
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
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`, this.onEnabled);
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
    }

    renderExecutionDialog() {
        return this.state.executionDialog ? <Dialog
            open={!0}
            onClose={() => this.setState({ executionDialog: false })}
            maxWidth="md"
            fullWidth
            classes={{ paper: this.props.classes.paper }}
        >
            <DialogTitle>
                {I18n.t('Backitup execution:')}
            </DialogTitle>
            <DialogContent>
                {this.state.executing ? <LinearProgress style={{ position: 'absolute', top: 0, left: 0, width: '100%' }} /> : null}
                <TextField
                    multiline
                    fullWidth
                    style={{ height: '100%', minHeight: 150 }}
                    classes={{ root: this.props.classes.fullHeight }}
                    value={this.state.executionLog}
                />
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
                    label={I18n.t('Close on ready')}
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
                onClick={() =>
                    this.setState({ executionDialog: true, executionLog: '', executing: true }, async () => {
                        this.lastExecutionLine = '';
                        await this.props.socket.setState(`${this.props.adapterName}.${this.props.instance}.oneClick.${this.props.schema.backUpType}`, true);
                    })
                }
                variant="contained"
                endIcon={<CloudUpload />}
            >
                {I18n.t('Backup now')}
            </Button>
            {this.renderExecutionDialog()}
        </>;
    }
}

BackupNow.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    themeName: PropTypes.string,
    style: PropTypes.object,
    className: PropTypes.string,
    data: PropTypes.object.isRequired,
    attr: PropTypes.string,
    schema: PropTypes.object,
    onError: PropTypes.func,
};

export default withStyles(styles)(BackupNow);
