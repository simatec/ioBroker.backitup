import React from 'react';
import PropTypes from 'prop-types';

import {
    FormControl, FormHelperText, InputLabel,
    MenuItem, Select, TextField,
} from '@mui/material';

import { I18n, ConfigGeneric } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';

class Instance extends BaseField {
    async componentDidMount() {
        super.componentDidMount();
        const instance = ConfigGeneric.getValue(this.props.data, this.props.attr);
        const target = ConfigGeneric.getValue(this.props.data, this.props.schema.adapter === 'telegram' ? 'telegramUser' : 'discordTarget');
        const result = Object.values(await this.props.socket.getObjectViewCustom(
            'system',
            'instance',
            `system.adapter.${this.props.schema.adapter}.`,
            `system.adapter.${this.props.schema.adapter}.\u9999`,
        ));

        const instances = result.map(item => ({ value: item._id.substring('system.adapter.'.length), label: item._id.substring('system.adapter.'.length) }));
        instances.unshift({ value: '', label: 'none' });

        this.setState({ instances, instance, target }, () => {
            this.readTargets();
        });
    }

    async fillTelegramUser() {
        if (this.state.target?.startsWith('telegram.')) {
            if (this.targetRead !== this.state.target) {
                let useUserName = false;
                const obj = await this.props.socket.getObject(`system.adapter.${this.state.target}`);
                if (obj && obj.native) {
                    useUserName = obj.native.useUsername;
                }
                const state = await this.props.socket.getState(`${this.state.target}.communicate.users`);
                const userListStr = state?.val;
                const targets = [{ value: 'allTelegramUsers', label: 'All Receiver' }];

                if (userListStr) {
                    this.targetRead = this.state.target;
                    const userList = JSON.parse(userListStr);
                    for (const i in userList) {
                        if (useUserName) {
                            targets.push({ value: userList[i].userName, label: userList[i].userName });
                        } else {
                            targets.push({ value: userList[i].firstName, label: userList[i].firstName });
                        }
                    }
                }
                this.setState({ targets });
            }
        } else if (this.props.data.telegramUser !== 'allTelegramUsers') {
            setTimeout(() => this.props.onChange({ ...this.props.data, telegramUser: 'allTelegramUsers' }), 50);
        }
    }

    async fillDiscordTarget() {
        if (this.state.target?.startsWith('discord.')) {
            const alive = await this.props.socket.getState(`system.adapter.${this.state.target}.alive`);
            if (alive?.val) {
                const targetList = await this.props.socket.sendTo(this.state.target, 'getNotificationTargets', {})
                if (Array.isArray(targetList)) {
                    const targets = [{ value: '', label: 'none' }];
                    for (const i in targetList) {
                        targets.push({ value: targetList[i].value, label: targetList[i].label });
                    }
                    this.setState({ targets });
                }
            }
        } else {
            const targets = [{ value: '', label: 'none' }];
            this.setState({ targets });
            if (this.props.data.discordTarget) {
                setTimeout(() => this.props.onChange({ ...this.props.data, discordTarget: '' }), 50);
            }
        }
    }

    async readTargets() {
        if (this.props.schema.adapter === 'telegram') {
            await this.fillTelegramUser();
        } else if (this.props.schema.adapter === 'discord') {
            await this.fillDiscordTarget();
        }
    }

    renderItem() {
        const itemInstance = this.instances.find(it => it.value == this.state.instance); // let "==" be and not ===
        const itemTarget = this.targets.find(it => it.value == this.state.target); // let "==" be and not ===

        return <div style={{ width: '100%' }}>
            {this.state.instances ? <FormControl style={{ width: 'calc(50% - 5px)' }} variant="standard">
                <InputLabel>{I18n.t(this.props.schema.label)}</InputLabel>
                <Select
                    variant="standard"
                    value={this.state.instance || '_'}
                    renderValue={() => this.getText(itemInstance?.label, itemInstance?.label !== 'none')}
                    onChange={e => {
                        this.setState({ instance: e.target.value === '_' ? '' : e.target.value }, () => {
                            this.readTargets();
                            this.onChange(this.props.attr, this.state.value);
                        });
                    }}
                >
                    {this.state.instances.map((it, i) => {
                        return <MenuItem key={i} value={it.value}>
                            {this.getText(it.label, it?.label !== 'none')}
                        </MenuItem>;
                    })}
                </Select>
                {this.props.schema.help ? <FormHelperText>{this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation)}</FormHelperText> : null}
            </FormControl> : null}
            {this.state.targets ? <FormControl style={{ width: 'calc(50% - 5px)' }} variant="standard">
                <InputLabel>{I18n.t(this.props.schema.adapter === 'telegram' ? 'Telegram Receiver' : 'Discord receiver')}</InputLabel>
                <Select
                    disabled={!this.state.instance}
                    variant="standard"
                    value={this.state.target || '_'}
                    renderValue={() => this.getText(itemTarget?.label, itemTarget?.label !== 'none')}
                    onChange={e => {
                        this.setState({ value: e.target.value === '_' ? '' : e.target.value }, () => {
                            this.onChange(this.props.attr, this.state.value);
                        });
                    }}
                >
                    {this.state.targets.map((it, i) => {
                        return <MenuItem key={i} value={it.value}>
                            {this.getText(it.label, item?.label !== 'none')}
                        </MenuItem>;
                    })}
                </Select>
                {this.props.schema.help ? <FormHelperText>{this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation)}</FormHelperText> : null}
            </FormControl> : <TextField
                style={{ width: 'calc(50% - 5px)' }}
                variant="standard"
                disabled={!this.state.instance}
                label={I18n.t(this.props.schema.adapter === 'telegram' ? 'Telegram Receiver' : 'Discord receiver')}
                value={this.state.target}
                onChange={e => {
                    this.setState({ value: e.target.value }, () => {
                        this.onChange(this.props.attr, this.state.value);
                    });
                }}
            />}
        </div>;
    }
}

Instance.propTypes = {
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

export default Instance;
