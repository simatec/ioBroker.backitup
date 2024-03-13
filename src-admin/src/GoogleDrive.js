import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import { ConfigGeneric, i18n as I18n } from '@iobroker/adapter-react-v5';
import { Button, MenuItem, TextField } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

const styles = () => ({

});

class GoogleDrive extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state.googleDriveUrl = '';
    }

    renderItem() {
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
                    {I18n.t('Get google drive access')}
                </Button>
            </div>
            {this.state.googleDriveUrl ? <>
                <div>
                    <MenuItem
                        onClick={() => window.open(this.state.googleDriveUrl, '_blank')}
                    >
                        {I18n.t('Open google drive')}
                    </MenuItem>
                </div>
                <div>
                    <TextField
                        label={I18n.t('Enter the code from that page here')}
                        variant="standard"
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
