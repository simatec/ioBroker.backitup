import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import BaseField from './BaseField';

const styles = () => ({

});

class DetectConfigInvisible extends BaseField {
    componentDidMount() {
        super.componentDidMount();
        this.fetchCcuConfig();
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

export default withStyles(styles)(DetectConfigInvisible);
