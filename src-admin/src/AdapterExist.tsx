import React from 'react';

import { Checkbox, FormControlLabel } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';
import type { ConfigItemCustom } from '@iobroker/json-config';

interface ConfigItemCustomAdapterExist extends ConfigItemCustom {
    custom: {
        adapter: string;
        allHosts?: boolean;
        alert?: string;
    };
}

class AdapterExist extends BaseField {
    renderItem(): React.JSX.Element {
        return (
            <>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={
                                ((this.props.schema as ConfigItemCustomAdapterExist).custom.adapter === 'hm-rpc' ||
                                    (this.props.schema as ConfigItemCustomAdapterExist).custom.adapter ===
                                        'javascript' ||
                                    (this.props.schema as ConfigItemCustomAdapterExist).custom.adapter ===
                                        'backitup') &&
                                this.props.data.hostType === 'Slave'
                                    ? false
                                    : this.props.data[this.props.attr!]
                                      ? this.props.data[this.props.attr!]
                                      : false
                            }
                            disabled={
                                (((this.props.schema as ConfigItemCustomAdapterExist).custom.adapter === 'influxdb' ||
                                    (this.props.schema as ConfigItemCustomAdapterExist).custom.adapter === 'sql') &&
                                    this.props.data._nonSupportDockerDB) ||
                                (((this.props.schema as ConfigItemCustomAdapterExist).custom.adapter === 'hm-rpc' ||
                                    (this.props.schema as ConfigItemCustomAdapterExist).custom.adapter ===
                                        'javascript' ||
                                    (this.props.schema as ConfigItemCustomAdapterExist).custom.adapter ===
                                        'backitup') &&
                                    this.props.data.hostType === 'Slave')
                            }
                            onChange={e => {
                                if (e.target.checked) {
                                    if ((this.props.schema as ConfigItemCustomAdapterExist).custom.adapter) {
                                        this.checkAdapterInstall(
                                            (this.props.schema as ConfigItemCustomAdapterExist).custom.adapter,
                                            !!(this.props.schema as ConfigItemCustomAdapterExist).custom.allHosts,
                                        ).catch(err => console.error(err));
                                    } else if ((this.props.schema as ConfigItemCustomAdapterExist).custom.alert) {
                                        this.setState({
                                            message: {
                                                text: I18n.t(
                                                    (this.props.schema as ConfigItemCustomAdapterExist).custom.alert!,
                                                ),
                                                title: I18n.t(
                                                    (this.props.schema as ConfigItemCustomAdapterExist).title,
                                                ),
                                            },
                                        });
                                    }
                                }
                                this.props.onChange({ ...this.props.data, [this.props.attr!]: e.target.checked });
                            }}
                        />
                    }
                    label={I18n.t(
                        ((this.props.schema as ConfigItemCustom).label as string) ||
                            (this.props.schema as ConfigItemCustomAdapterExist).custom.adapter,
                    )}
                />
                {this.renderMessage()}
            </>
        );
    }
}

export default AdapterExist;
