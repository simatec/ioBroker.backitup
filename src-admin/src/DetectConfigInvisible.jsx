import PropTypes from 'prop-types';

import BaseField from './BaseField';

class DetectConfigInvisible extends BaseField {
    async componentDidMount() {
        super.componentDidMount();
        if (!this.isConfigFilled(this.props.schema.adapter)) {
            await this.fetchConfig(this.props.schema.adapter, true);
        }
    }

    renderItem() {
        return this.renderMessage();
    }
}

DetectConfigInvisible.propTypes = {
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

export default DetectConfigInvisible;
