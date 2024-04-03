import { ConfigGeneric, I18n, Message } from '@iobroker/adapter-react-v5';

class BaseField extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state.message = false;
    }

    isConfigFilled(type) {
        if (type === 'ccu') {
            return !!this.props.data.ccuHost && !!this.props.data.ccuEnabled;
        }
        if (type === 'mySql') {
            return !!this.props.data.mySqlUser && !!this.props.data.mySqlEnabled;
        }
        if (type === 'sqlite') {
            return !!this.props.data.sqlitePath && !!this.props.data.sqliteEnabled;
        }
        if (type === 'pgSql') {
            return !!this.props.data.pgSqlUser && !!this.props.data.pgSqlEnabled;
        }
        if (type === 'influxDB') {
            return !!this.props.data.influxDBName && !!this.props.data.influxDBEnabled;
        }
        if (type === 'history') {
            return !!this.props.data.historyPath && !!this.props.data.historyEnabled;
        }
        this.showMessage(I18n.t('Backitup Warning!'), I18n.t('Unknown config type %s', type));
        return false;
    }

    fetchConfig = async (type, isInitial) => {
        if (type === 'ccu') {
            await this.fetchCcuConfig(isInitial);
        } else if (type === 'mySql') {
            await this.fetchMySqlConfig(isInitial);
        } else if (type === 'sqlite') {
            await this.fetchSqliteConfig(isInitial);
        } else if (type === 'pgSql') {
            await this.fetchPgSqlConfig(isInitial);
        } else if (type === 'influxDB') {
            await this.fetchInfluxDBConfig(isInitial);
        } else if (type === 'history') {
            await this.fetchHistoryConfig(isInitial);
        } else {
            this.showMessage(I18n.t('Backitup Warning!'), I18n.t('Unknown config type %s', type));
        }
    };

    async fetchCcuConfig(isInitial) {
        const result = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.hm-rpc.', 'system.adapter.hm-rpc.\u9999'));

        let found = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                if (common.enabled) {
                    const native = result[i].native;
                    this.props.onChange({ ...this.props.data, ccuHost: native.homematicAddress, ccuUsehttps: native.useHttps });
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let j = 0; j < result.length; j++) {
                    const _native = result[j].native;
                    this.props.onChange({ ...this.props.data, ccuHost: _native.homematicAddress, ccuUsehttps: _native.useHttps });
                    found = result[j]._id;
                }
            }
        }
        if (found) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('Backitup Information!'), I18n.t('Config taken from %s', found));
        } else {
            !isInitial && this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No config found'));
        }
    }

    async fetchMySqlConfig(isInitial) {
        const result = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.sql.', 'system.adapter.sql.\u9999'));

        let found = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native.dbtype === 'mysql') {
                    this.props.onChange({
                        ...this.props.data,
                        mySqlUser: native.user,
                        mySqlPassword: native.password,
                        mySqlHost: native.host,
                        mySqlPort: native.port === '0' ? 3306 : native.port || 3306,
                        mySqlName: native.dbname,
                    });
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let j = 0; j < result.length; j++) {
                    const _native = result[j].native;
                    if (_native.dbtype === 'mysql') {
                        this.props.onChange({
                            ...this.props.data,
                            mySqlUser: _native.user,
                            mySqlPassword: _native.password,
                            mySqlHost: _native.host,
                            mySqlPort: _native.port === '0' ? 3306 : _native.port || 3306,
                            mySqlName: _native.dbname,
                        });
                        found = result[j]._id;
                        break;
                    }
                }
            }
        }
        if (found) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('Backitup Information!'), I18n.t('Config taken from %s', found));
        } else {
            !isInitial && this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No config found'));
        }
    }

    async fetchSqliteConfig(isInitial) {
        const result = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.sql.', 'system.adapter.sql.\u9999'));
        let found = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native && native.dbtype === 'sqlite' && native.fileName) {
                    const pathLength = native.fileName.split('/');
                    this.props.onChange({
                        ...this.props.data,
                        sqlitePath: pathLength > 1 ? native.fileName : `/opt/iobroker/iobroker-data/sqlite/${native.fileName}`,
                    });
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let j = 0; j < result.length; j++) {
                    const _native = result[j].native;
                    if (_native && _native.dbtype === 'sqlite' && _native.fileName) {
                        const pathLength = _native.fileName.split('/');
                        this.props.onChange({
                            ...this.props.data,
                            sqlitePath: pathLength > 1 ? _native.fileName : `/opt/iobroker/iobroker-data/sqlite/${_native.fileName}`,
                        });
                        found = result[j]._id;
                        break;
                    }
                }
            }
        }
        if (found) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('Backitup Information!'), I18n.t('Config taken from %s', found));
        } else {
            !isInitial && this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No config found'));
        }
    }

    async fetchPgSqlConfig(isInitial) {
        const result = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.sql.', 'system.adapter.sql.\u9999'));

        let found = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native.dbtype === 'postgresql') {
                    this.props.onChange({
                        ...this.props.data,
                        pgSqlUser: native.user,
                        pgSqlPassword: native.password,
                        pgSqlHost: native.host,
                        pgSqlPort: native.port === '0' ? 5432 : native.port || 5432,
                        pgSqlName: native.dbname,
                    });
                    found = result[i]._id;

                    break;
                }
            }
            if (!found) {
                for (let j = 0; j < result.length; j++) {
                    const _native = result[j].native;
                    if (_native.dbtype === 'postgresql') {
                        this.props.onChange({
                            ...this.props.data,
                            pgSqlUser: _native.user,
                            pgSqlPassword: _native.password,
                            pgSqlHost: _native.host,
                            pgSqlPort: _native.port === '0' ? 5432 : _native.port || 5432,
                            pgSqlName: _native.dbname,
                        });
                        found = result[j]._id;
                        break;
                    }
                }
            }
        }

        if (found) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('Backitup Information!'), I18n.t('Config taken from %s', found));
        } else {
            !isInitial && this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No config found'));
        }
    }

    async fetchInfluxDBConfig(isInitial) {
        const result = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.influxdb.', 'system.adapter.influxdb.\u9999'));
        let found = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled) {
                    const settings = {
                        influxDBHost: native.host,
                        influxDBVersion: native.dbversion,
                        influxDBProtocol: native.protocol,
                        influxDBName: native.dbname,
                    };
                    if (native.port && native.dbversion && native.dbversion === '2.x') {
                        settings.influxDBPort = native.port;
                    }
                    this.props.onChange({
                        ...this.props.data,
                        settings,
                    });

                    found = result[i]._id;
                    break;
                }
            }
            if (!found && result.length && result[0].native) {
                const _native = result[0].native;
                const settings = {
                    influxDBHost: _native.host,
                    influxDBVersion: _native.dbversion,
                    influxDBProtocol: _native.protocol,
                    influxDBName: _native.dbname,
                };
                if (_native.port && _native.dbversion && _native.dbversion === '2.x') {
                    settings.influxDBPort = _native.port;
                }
                this.props.onChange({
                    ...this.props.data,
                    settings,
                });
                found = result[0]._id;
            }
        }
        if (found) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('Backitup Information!'), I18n.t('Config taken from %s', found));
        } else {
            !isInitial && this.showMessage(I18n.t('Backitup Warning!'), I18n.t('No config found'));
        }
    }

    async fetchHistoryConfig(isInitial) {
        const result = Object.values(await this.props.socket.getObjectViewCustom('system', 'instance', 'system.adapter.history.', 'system.adapter.history.\u9999'));
        let storeDir = '';
        let found = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled) {
                    this.props.onChange({
                        ...this.props.data,
                        historyPath: native.storeDir && !native.storeDir.startsWith('/opt/iobroker/backups') ? native.storeDir : '/opt/iobroker/iobroker-data/history',
                    });
                    storeDir = native.storeDir;
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let j = 0; j < result.length; j++) {
                    const _native = result[j].native;
                    this.props.onChange({
                        ...this.props.data,
                        historyPath: _native.storeDir && !_native.storeDir.startsWith('/opt/iobroker/backups') ? _native.storeDir : '/opt/iobroker/iobroker-data/history',
                    });
                    storeDir = _native.storeDir;
                    found = result[j]._id;
                }
            }
        }

        if (found && !storeDir) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('No storage path of %s is configured.\nThe default path of the history adapter has been set.', found), I18n.t('Backitup Information!'));
        } else if (found && storeDir && storeDir.startsWith('/opt/iobroker/backups')) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('The storage path of %s must not be identical to the path for backups.\nThe default path of the history adapter has been set.\n\nPlease change the path in the history adapter!', found), I18n.t('Backitup Information!'));
        } else if (found && storeDir) {
            found = found.substring('system.adapter.'.length);
            !isInitial && this.showMessage(I18n.t('Config taken from %s', found), I18n.t('Backitup Information!'));
        } else {
            !isInitial && this.showMessage(I18n.t('No config found'), I18n.t('Backitup Warning!'));
        }
    }

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
        return this.state.message ? <Message
            title={this.state.message.title}
            text={this.state.message.text}
            onClose={() => this.setState({ message: false })}
        /> : null;
    }
}

export default BaseField;
