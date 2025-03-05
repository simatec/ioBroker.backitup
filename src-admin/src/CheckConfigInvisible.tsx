import PropTypes from 'prop-types';

import BaseField from './BaseField';
import { ConfigItemCustom } from '@iobroker/json-config';
import { BackitupNative } from './Components/types';

class CheckConfigInvisible extends BaseField {
    async componentDidMount() {
        super.componentDidMount();
        if (!this.isConfigFilled((this.props.schema as ConfigItemCustom).adapter)) {
            const data = { ...this.props.data };
            const result = await this.fetchConfig((this.props.schema as ConfigItemCustom).adapter, data as BackitupNative);
            if (result.changed) {
                this.props.onChange(data);
            }
        }
    }

    renderItem() {
        return this.renderMessage();
    }
}

export default CheckConfigInvisible;
