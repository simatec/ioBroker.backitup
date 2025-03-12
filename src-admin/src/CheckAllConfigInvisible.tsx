import type { JSX } from 'react';
import { I18n } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';
import type { ConfigGenericProps } from '@iobroker/json-config';
import type { BackitupNative, FileSystemInfo, SystemInfo } from './Components/types';

class CheckAllConfigInvisible extends BaseField {
    private storedAlive: boolean;
    private storedChecked: boolean;

    constructor(props: ConfigGenericProps) {
        super(props);
        this.storedAlive = this.props.alive;
        this.storedChecked = false;
    }

    checkConfiguration(): void {
        if (this.props.alive) {
            void this.props.oContext.socket
                .sendTo(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, 'getSystemInfo', null)
                .then(async (result: SystemInfo) => {
                    let changed = false;
                    if ((result?.systemOS === 'docker' && result.dockerDB === true) || result?.systemOS !== 'docker') {
                        this.props.data._nonSupportDockerDB = false;
                        changed = true;
                    } else if (result?.systemOS === 'docker' && result.dockerDB === false) {
                        this.props.data._nonSupportDockerDB = true;

                        if (this.props.data.influxDBEnabled) {
                            this.props.data.influxDBEnabled = false;
                            changed = true;
                        }
                        if (this.props.data.mySqlEnabled) {
                            this.props.data.mySqlEnabled = false;
                            changed = true;
                        }
                        if (this.props.data.sqliteEnabled) {
                            this.props.data.sqliteEnabled = false;
                            changed = true;
                        }
                        if (this.props.data.pgSqlEnabled) {
                            this.props.data.pgSqlEnabled = false;
                            changed = true;
                        }
                        if (this.props.data.startAllRestore) {
                            this.props.data.startAllRestore = false;
                            changed = true;
                        }

                        changed && this.props.onChange(this.props.data);

                        if (this.props.data.redisType !== 'remote' && this.props.data.redisEnabled) {
                            this.props.data.redisType = 'remote';
                            changed = true;
                        }
                        changed = true;
                    }

                    if (result?.systemOS === 'docker') {
                        changed = true;
                        this.props.data._restoreIfWait = 10000;
                    } else if (result?.systemOS === 'win') {
                        changed = true;
                        this.props.data._restoreIfWait = 18000;
                    }
                    const CONFIGS = ['ccu', 'mySql', 'sqlite', 'pgSql', 'influxDB', 'history'];
                    for (let c = 0; c < CONFIGS.length; c++) {
                        if (!this.isConfigFilled(CONFIGS[c])) {
                            const _result = await this.fetchConfig(CONFIGS[c], this.props.data as BackitupNative).catch(
                                e => console.error(e),
                            );
                            changed = changed || _result!.changed;
                        }
                    }
                });

            if (!this.props.data.cifsEnabled && !this.storedChecked) {
                void this.props.oContext.socket
                    .sendTo(
                        `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
                        'getFileSystemInfo',
                        null,
                    )
                    .then((result: FileSystemInfo) => {
                        if (result?.diskState && result.storage && result.diskFree) {
                            this.storedChecked = true;
                            if (result.diskState === 'warn' && result.storage === 'local') {
                                this.showMessage(
                                    I18n.t(
                                        'On the host only %s MB free space is available! Please check your system!',
                                        result.diskFree,
                                    ),
                                    I18n.t('BackItUp Information!'),
                                );
                            } else if (result.diskState === 'error' && result.storage === 'local') {
                                this.showMessage(
                                    I18n.t(
                                        'On the host only %s MB free space is available! Local backups are currently not possible. Please check your system!',
                                        result.diskFree,
                                    ),
                                    I18n.t('BackItUp Information!'),
                                    'warning',
                                );
                            }
                        }
                    });
            }
        }
    }

    componentDidMount(): void {
        super.componentDidMount();
        if (this.storedAlive) {
            this.checkConfiguration();
        }
    }

    renderItem(): JSX.Element | null {
        if (this.storedAlive !== this.props.alive) {
            this.storedAlive = this.props.alive;
            if (this.storedAlive) {
                this.checkConfiguration();
            }
        }

        return this.renderMessage();
    }
}

export default CheckAllConfigInvisible;
