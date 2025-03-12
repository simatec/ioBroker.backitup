import React from 'react';

import { Button } from '@mui/material';

import { Search } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';
import type { ConfigItemCustom } from '@iobroker/json-config';
import type { BackitupNative } from './Components/types';

class DetectConfig extends BaseField {
    renderItem(): React.JSX.Element {
        return (
            <>
                <Button
                    variant="contained"
                    endIcon={<Search />}
                    onClick={async () => {
                        const data = { ...this.props.data };
                        const result = await this.fetchConfig(
                            (this.props.schema as ConfigItemCustom).adapter,
                            data as BackitupNative,
                        );
                        if (result.found) {
                            if (result.changed) {
                                this.showMessage(
                                    I18n.t('BackItUp Information!'),
                                    result.message ||
                                        I18n.t(
                                            'Config taken from %s',
                                            (result.found as string).substring('system.adapter.'.length),
                                        ),
                                );
                                this.props.onChange(data);
                            } else {
                                this.showMessage(
                                    I18n.t('BackItUp Information!'),
                                    result.message ||
                                        I18n.t(
                                            'Config found in %s, but nothing changed',
                                            (result.found as string).substring('system.adapter.'.length),
                                        ),
                                );
                            }
                        } else {
                            this.showMessage(I18n.t('BackItUp Warning!'), I18n.t('No config found'), 'warning');
                        }
                    }}
                >
                    {I18n.t('Detect config')}
                </Button>
                {this.renderMessage()}
            </>
        );
    }
}

export default DetectConfig;
