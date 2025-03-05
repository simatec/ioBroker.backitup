import React from 'react';
import PropTypes from 'prop-types';

import { Checkbox, FormControlLabel } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';
import { ConfigItemCustom } from '@iobroker/json-config';

class AdapterExist extends BaseField {
    renderItem() {
        return <>
            <FormControlLabel
                control={<Checkbox
                    checked={(((this.props.schema as ConfigItemCustom).adapter === 'hm-rpc' || (this.props.schema as ConfigItemCustom).adapter === 'javascript' || (this.props.schema as ConfigItemCustom).adapter === 'backitup') && this.props.data.hostType === 'Slave') ? false : this.props.data[this.props.attr!] ? this.props.data[this.props.attr!] : false}
                    disabled={
                        (((this.props.schema as ConfigItemCustom).adapter === 'influxdb' || (this.props.schema as ConfigItemCustom).adapter === 'sql') && this.props.data._nonSupportDockerDB) ||
                        (((this.props.schema as ConfigItemCustom).adapter === 'hm-rpc' || (this.props.schema as ConfigItemCustom).adapter === 'javascript' || (this.props.schema as ConfigItemCustom).adapter === 'backitup') && this.props.data.hostType === 'Slave')
                    }
                    onChange={async e => {
                        if (e.target.checked) {
                            if ((this.props.schema as ConfigItemCustom).adapter) {
                                this.checkAdapterInstall((this.props.schema as ConfigItemCustom).adapter, (this.props.schema as ConfigItemCustom).allHosts)
                                    .catch(err => console.error(err));
                            } else if ((this.props.schema as ConfigItemCustom).alert) {
                                this.setState({ message: { text: I18n.t((this.props.schema as ConfigItemCustom).alert), title: I18n.t((this.props.schema as ConfigItemCustom).title) } });
                            }
                        }
                        this.props.onChange({ ...this.props.data, [this.props.attr!]: e.target.checked });
                    }}
                />}
                label={I18n.t((this.props.schema as ConfigItemCustom).label || (this.props.schema as ConfigItemCustom).adapter)}
            />
            {this.renderMessage()}
        </>;
    }
}

export default AdapterExist;
