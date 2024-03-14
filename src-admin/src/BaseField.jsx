import { ConfigGeneric, I18n, Message } from '@iobroker/adapter-react-v5';

class BaseField extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state.message = false;
    }

    fetchCcuConfig = async () => {
        const result = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.hm-rpc.', 'system.adapter.hm-rpc.\u9999'));

        let found = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                if (common.enabled) {
                    const native = result[i].native;
                    this.props.onChange({ ...this.props.data, ccuHost: native.homematicAddress, ccuUsehttps: native.useHttps });
                    this.props.onChange({ ...this.props.data, ccuHost: native.homematicAddress, ccuUsehttps: native.useHttps });
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let j = 0; j < result.length; j++) {
                    const _native = result[j].native;
                    this.props.onChange({ ...this.props.data, ccuHost: _native.homematicAddress, ccuUsehttps: _native.useHttps });
                    this.props.onChange({ ...this.props.data, ccuHost: _native.homematicAddress, ccuUsehttps: _native.useHttps });
                    found = result[j]._id;
                }
            }
        }
        if (found) {
            found = found.substring('system.adapter.'.length);
            this.showMessage(I18n.t('Backitup Information!'), I18n.t('Config taken from %s', found));
        } else {
            this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No config found'));
        }
    };

    checkAdapterInstall = async name => {
        const backitupHost = this.props.common.host;
        const ignore = false;
        let adapterName = name;

        if (name === 'pgsql' || name === 'mysql' || name === 'sqlite') {
            adapterName = 'sql';
        }

        if (!ignore) {
            const res = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', `system.adapter.${adapterName}.`, `system.adapter.${adapterName}.\u9999`));
            if (res && res.length) {
                for (let i = 0; i < res.length; i++) {
                    const common = res[i].common;

                    if (common.host !== backitupHost && (adapterName === 'zigbee' || adapterName === 'esphome' || adapterName === 'zigbee2mqtt' || adapterName === 'node-red' || adapterName === 'yahka' || adapterName === 'jarvis' || adapterName === 'history')) {
                        this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No %s Instance found on this host. Please check your System', adapterName));
                        break;
                    }
                }
            } else if (res.length === 0 && (adapterName === 'zigbee' || adapterName === 'esphome' || adapterName === 'zigbee2mqtt' || adapterName === 'node-red' || adapterName === 'yahka' || adapterName === 'jarvis' || adapterName === 'history')) {
                this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No %s Instance found on this host. Please check your System', adapterName));
            }
        }
    };

    showMessage = (title, text) => {
        this.setState({ message: { title, text } });
    };

    renderMessage() {
        return this.state.message && <Message
            title={this.state.message.title}
            text={this.state.message.text}
            onClose={() => this.setState({ message: false })}
        />;
    }
}

export default BaseField;
