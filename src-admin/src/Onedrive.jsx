import React from 'react';
import PropTypes from 'prop-types';

import { Button, TextField } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

import { ConfigGeneric, i18n as I18n } from '@iobroker/adapter-react-v5';

class Onedrive extends ConfigGeneric {
    renderItem() {
        return <div style={{ width: '100%', margin: '0 0 1rem 0' }}>
            <div style={{ width: '100%', margin: '0 0 1rem 0' }} >
                <span 
                    hidden={this.state.onedriveUrl}
                >
                    {`${I18n.t('Onedrive refresh token: ')}`} 
                    {I18n.t(
                        this.state.onedriveState === 'Present' || this.props.data.onedriveAccessJson ?
                            'Present' :
                            'Not present',
                    )}
                </span>
            </div>
            <Button
                disabled={this.state.onedriveUrl || !this.props.alive || this.state.running}
                endIcon={<CloudUpload />}
                variant="contained"
                onClick={() => this.setState({ running: true }, async () => {
                    const result = await this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'authOnedrive', null);
                    this.setState({ onedriveUrl: result.url, running: false });
                })}
            >
                {I18n.t(
                    this.props.data.onedriveAccessJson ?
                        'Renew Onedrive Access' :
                        'Get Onedrive Access',
                )}
            </Button>
            {this.state.onedriveUrl ? <>
                <div style={{ width: '100%', margin: '1rem 0 1rem 0' }}>
                    {`${I18n.t('Authorize this app by visiting this url: ')}`}
                    <br/>
                    <a
                        target="_blank"
                        href={this.state.onedriveUrl}
                        rel="noreferrer"
                    >
                        {this.state.onedriveUrl}
                    </a>
                </div>
                <TextField
                    label={I18n.t('Enter the code from that page here')}
                    variant="standard"
                    onChange={e => this.setState({ code: e.target.value })}
                    fullWidth
                />
                <Button
                    style={{ margin: '1rem 0 1rem 0' }}
                    disabled={!this.state.onedriveUrl || !this.props.alive || this.state.running}
                    endIcon={<CloudUpload />}
                    variant="contained"
                    onClick={() => this.setState({ running: true }, async () => {
                        const result = await this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'authOnedrive', { code: this.state.code });
                        this.props.onChange({ ...this.props.data, onedriveAccessJson: result.json })
                        this.setState({ onedriveState: result.done ? 'Present' : 'Not present', running: false, onedriveUrl: null, });
                    })}
                >
                {I18n.t('Submit')}
                </Button>
            </> : null}
        </div>;
    }
}

Onedrive.propTypes = {
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

export default Onedrive;
