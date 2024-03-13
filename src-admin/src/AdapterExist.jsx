import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import { ConfigGeneric, i18n as I18n } from '@iobroker/adapter-react-v5';
import { Button, Checkbox, FormControlLabel } from '@mui/material';

const styles = () => ({

});

class AdapterExist extends ConfigGeneric {
    renderItem() {
        return <FormControlLabel
            control={<Checkbox
                onChange={async () => {
                    const result = await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.hm-rpc.', 'system.adapter.hm-rpc.\u9999');
                    console.log(result);
                }}
            />}
            label={I18n.t('Adapter exist')}
        />;
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
