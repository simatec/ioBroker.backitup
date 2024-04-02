import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { ConfigGeneric, i18n as I18n } from '@iobroker/adapter-react-v5';
import {
    Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

const styles = () => ({

});

class BackupNow extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            executing: false,
            executionDialog: false,
            executionLog: '',
            lastExecutionLine: '',
            closeOnReady: false,
        };
    }

    onOutput = (id, value)  => {
        if (value && value.val && value.val !== this.state.lastExecutionLine) {
            this.setState({
                executionLog: `${this.state.executionLog + value.val}\n`,
                lastExecutionLine: value.val,
            });
            if (value.val === '[EXIT] 0') {
                this.setState({ executing: false });
                if (this.state.closeOnReady) {
                    this.setState({ executionDialog: false });
                }
            }
        }
    };

    componentDidMount() {
        super.componentDidMount();
        this.props.socket.subscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.output.line`, this.onOutput);
    }

    renderExecutionDialog() {
        return <Dialog
            open={this.state.executionDialog}
            onClose={() => this.setState({ executionDialog: false })}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                {I18n.t('Backitup execution:')}
            </DialogTitle>
            <DialogContent>
                <TextField
                    multiline
                    fullWidth
                    inputProps={{ style: { height: 400 } }}
                    value={this.state.executionLog}
                />
            </DialogContent>
            <DialogActions>
                <FormControlLabel
                    control={
                        <Checkbox
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
        </Dialog>;
    }

    renderItem() {
        return <>
            <Button
                onClick={async () => {
                    this.setState({ executionDialog: true, executionLog: '', executing: true });
                    await this.props.socket.setState(`${this.props.adapterName}.${this.props.instance}.oneClick.ccu`, true);
                }}
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
    onChange: PropTypes.func,
};

export default withStyles(styles)(BackupNow);
