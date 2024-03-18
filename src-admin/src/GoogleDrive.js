import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { ConfigGeneric, i18n as I18n } from '@iobroker/adapter-react-v5';
import { Button, TextField } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

const styles = () => ({

});

class GoogleDrive extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state.googleDriveUrl = '';
    }

    async componentDidMount() {
        super.componentDidMount();
        const object = await this.props.socket.getObject(`system.adapter.${this.props.adapterName}.${this.props.instance}`);
        if (object && object.native) {
            this.setState({ native: object.native });
        }
    }

    renderItem() {
        if (!this.state.native) {
            return null;
        }
        return <div>
            <div>
                <Button
                    endIcon={<CloudUpload />}
                    variant="contained"
                    onClick={async () => {
                        const result = await this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'authGoogleDrive');
                        this.setState({ googleDriveUrl: result.url });
                    }}
                >
                    {I18n.t(
                        this.state.native.googledriveAccessTokens ?
                            'Renew google drive access' :
                            'Get google drive access',
                    )}
                </Button>
            </div>
            {this.state.googleDriveUrl ? <>
                <div>
                    {`${I18n.t('Authorize this app by visiting this url')}: `}
                    <a
                        target="_blank"
                        href={this.state.googleDriveUrl}
                        rel="noreferrer"
                    >
                        {this.state.googleDriveUrl}
                    </a>
                </div>
                <div>
                    <TextField
                        label={I18n.t('Enter the code from that page here')}
                        variant="standard"
                        value={this.props.data.googledriveAccessTokens || ''}
                        onChange={e => this.props.onChange({ ...this.props.data, googledriveAccessTokens: e.target.value })}
                        fullWidth
                    />
                </div>
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

export default withStyles(styles)(GoogleDrive);
