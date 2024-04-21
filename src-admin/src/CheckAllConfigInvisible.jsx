import PropTypes from 'prop-types';
import { I18n } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';

class CheckAllConfigInvisible extends BaseField {
    constructor(props) {
        super(props);
        this.storedAlive = this.props.alive;
        this.storedChecked = false;
    }

    checkConfiguration() {
        if (this.props.alive && !this.storedChecked) {
            this.storedChecked = true;
            this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getFileSystemInfo', null)
                .then(result => {
                    if (result?.diskState && result.storage && result.diskFree) {
                        if (result.diskState === 'warn' && result.storage === 'local') {
                            this.showMessage(I18n.t('On the host only %s MB free space is available! Please check your system!', result.diskFree), I18n.t('BackItUp Information!'));
                        } else if (result.diskState === 'error' && result.storage === 'local') {
                            this.showMessage(I18n.t('On the host only %s MB free space is available! Local backups are currently not possible. \n\nPlease check your system!', result.diskFree), I18n.t('BackItUp Information!'), 'warning');
                        }
                    }
                });
            this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getSystemInfo', null)
                .then(async result => {
                    const data = { ...this.props.data };
                    let changed = false;
                    if (result?.systemOS === 'docker' && result.dockerDB === false) {
                        if (data.redisType !== 'remote' && data.redisEnabled) {
                            data.redisType = 'remote';
                            changed = true;
                        }
                    }

                    if (result?.systemOS === 'docker') {
                        changed = true;
                        data._restoreIfWait = 10000;
                    } else if (result?.systemOS === 'win') {
                        changed = true;
                        data._restoreIfWait = 18000;
                    }
                    const CONFIGS = ['ccu', 'mySql', 'sqlite', 'pgSql', 'influxDB', 'history'];
                    for (let c = 0; c < CONFIGS.length; c++) {
                        if (!this.isConfigFilled(CONFIGS[c])) {
                            const _result = await this.fetchConfig(CONFIGS[c], data)
                                .catch(e => this.showError(e));
                            changed = changed || _result.changed;
                        }
                    }

                    changed && this.props.onChange(data);
                });
        }
    }

    async componentDidMount() {
        super.componentDidMount();
        this.checkDisk();
    }

    renderItem() {
        if (this.storedAlive !== this.props.alive) {
            this.storedAlive = this.props.alive;
            if (this.storedAlive) {
                this.checkConfiguration();
            }
        }

        return this.renderMessage();
    }
}

CheckAllConfigInvisible.propTypes = {
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

export default CheckAllConfigInvisible;
