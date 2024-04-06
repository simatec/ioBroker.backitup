import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { Button, Checkbox, FormControlLabel } from '@mui/material';
import { Search } from '@mui/icons-material';

import { ConfigGeneric, I18n } from '@iobroker/adapter-react-v5';

import GetBackups from './Components/GetBackups';
import SourceSelector from './Components/SourceSelector';

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
        width: 70,
        marginRight: 8,
        textAlign: 'right',
    },
    text: {
        display: 'inline-block',
    },
};

class RestoreBackup extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            backupSource: window.localStorage.getItem('BackItUp.backupSource') || 'local',
            showGetBackups: false,
        };
    }

    renderItem() {
        return <div style={{ width: '100%', display: 'flex' }}>
            <SourceSelector
                value={this.state.backupSource}
                data={this.props.data}
                onChange={backupSource => {
                    window.localStorage.setItem('BackItUp.backupSource', backupSource);
                    this.setState({ backupSource });
                }}
            />
            <Button
                style={{ marginTop: 16 }}
                onClick={() => this.setState({ showGetBackups: true })}
                disabled={!this.props.alive}
                variant="contained"
                color="grey"
                endIcon={<Search />}
            >
                {I18n.t('Get backups')}
            </Button>
            <FormControlLabel
                control={<Checkbox
                    value={this.props.data.startAllRestore}
                    onChange={e =>
                        this.props.onChange({ ...this.props.data, startAllRestore: e.target.checked })}
                />}
                label={I18n.t('Start all adapter after restore')}
            />
            {this.state.showGetBackups ? <GetBackups
                onClose={() => this.setState({ showGetBackups: false })}
                socket={this.props.socket}
                themeType={this.props.themeType}
                adapterName={this.props.adapterName}
                instance={this.props.instance}
                backupSource={this.state.backupSource}
                allowDownload={this.props.schema.allowDownload}
            /> : null}
        </div>;
    }
}

RestoreBackup.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    style: PropTypes.object,
    schema: PropTypes.object,
    onError: PropTypes.func,
};

export default withStyles(styles)(RestoreBackup);
