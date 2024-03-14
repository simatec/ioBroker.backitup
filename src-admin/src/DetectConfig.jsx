import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import { ConfigGeneric, i18n as I18n } from '@iobroker/adapter-react-v5';
import { Button } from '@mui/material';
import { Search } from '@mui/icons-material';
import BaseField from './BaseField';

const styles = () => ({

});

class DetectConfig extends BaseField {
    renderItem() {
        return <>
            <Button
                variant="contained"
                endIcon={<Search />}
                onClick={async () => {
                    this.fetchCcuConfig();
                }}
            >
                {I18n.t('Detect config')}
            </Button>
            {this.renderMessage()}
        </>;
    }
}

DetectConfig.propTypes = {
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

export default withStyles(styles)(DetectConfig);
