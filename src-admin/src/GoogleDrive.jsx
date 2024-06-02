import React from 'react';
import PropTypes from 'prop-types';

import { Button, TextField } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

import { ConfigGeneric, i18n as I18n } from '@iobroker/adapter-react-v5';

class GoogleDrive extends ConfigGeneric {
    renderItem() {
        return <div style={{ width: '100%', margin: '0 0 1rem 0' }}>
            <Button
                disabled={this.state.googleDriveUrl || !this.props.alive || this.state.running}
                endIcon={<CloudUpload />}
                variant="contained"
                onClick={() => this.setState({ running: true }, async () => {
                    const result = await this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'authGoogleDrive', null);
                    this.setState({ googleDriveUrl: result.url, running: false });
                })}
            >
                {I18n.t(
                    this.props.data.googledriveAccessTokens ?
                        'Renew Google Drive Access' :
                        'Get Google Drive Access',
                )}
            </Button>
            {this.state.googleDriveUrl ? <>
                <div style={{ width: '100%', margin: '1rem 0 1rem 0' }}>
                    <span style={{ marginRight: 4 }}>{`${I18n.t('Authorize this app by visiting this url:')}`}</span>
                    <br />
                    <a
                        target="_blank"
                        href={this.state.googleDriveUrl}
                        rel="noreferrer"
                    >
                        {this.state.googleDriveUrl}
                    </a>
                </div>
                <TextField
                    label={I18n.t('Enter the code from that page here')}
                    variant="standard"
                    onChange={e => this.props.onChange({ ...this.props.data, googledriveAccessTokens: e.target.value })}
                    fullWidth
                />
            </> : null}
        </div>;
    }
}

GoogleDrive.propTypes = {
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

export default GoogleDrive;
