import PropTypes from 'prop-types';

import BaseField from './BaseField';

class CheckConfigInvisible extends BaseField {
    async componentDidMount() {
        super.componentDidMount();
        if (!this.isConfigFilled(this.props.schema.adapter)) {
            const data = { ...this.props.data };
            const result = await this.fetchConfig(this.props.schema.adapter, data);
            if (result.changed) {
                this.props.onChange(data);
            }
        }
    }

    renderItem() {
        return this.renderMessage();
    }
}

CheckConfigInvisible.propTypes = {
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

export default CheckConfigInvisible;
