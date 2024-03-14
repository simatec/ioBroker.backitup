import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import { ConfigGeneric, i18n as I18n, Message } from '@iobroker/adapter-react-v5';
import { Button, Checkbox, FormControlLabel } from '@mui/material';
import BaseField from './BaseField';

const styles = () => ({

});

class AdapterExist extends BaseField {
    constructor(props) {
        super(props);
        this.state.message = false;
    }

    renderItem() {
        console.log(this.props.common);
        return <>
            <FormControlLabel
                control={<Checkbox
                    onChange={async () => {
                        this.checkAdapterInstall('influxdb');
                    }}
                />}
                label={I18n.t('Adapter exist')}
            />
            {this.renderMessage()}
        </>;
    }
}

AdapterExist.propTypes = {
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

export default withStyles(styles)(AdapterExist);
