import React from 'react';
import PropTypes from 'prop-types';

import {
    FormControl, FormHelperText, InputLabel,
    MenuItem, Select, TextField,
} from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';
import { ConfigGeneric, ConfigGenericProps, ConfigItemCustom } from '@iobroker/json-config';

import BaseField, { BaseFieldState } from './BaseField';

type InstanceState = BaseFieldState & {
    instances: { value: string; label: string }[];
    instance: string;
    target: string;
    targets: { value: string; label: string }[];
}

class Instance extends BaseField<ConfigGenericProps, InstanceState> {
    instanceRead?: string | null;

    async componentDidMount() {
        super.componentDidMount();
        const instance = ConfigGeneric.getValue(this.props.data, this.props.attr!);
        const target = ConfigGeneric.getValue(this.props.data, (this.props.schema as ConfigItemCustom).adapter === 'telegram' ? 'telegramUser' : 'discordTarget');
        const result = Object.values(await this.props.oContext.socket.getObjectViewCustom(
            'system',
            'instance',
            `system.adapter.${(this.props.schema as ConfigItemCustom).adapter}.`,
            `system.adapter.${(this.props.schema as ConfigItemCustom).adapter}.\u9999`,
        ));

        const instances = result.map(item => ({ value: item._id.substring('system.adapter.'.length), label: item._id.substring('system.adapter.'.length) }));
        instances.unshift({ value: '_', label: 'none' });

        this.setState({ instances, instance, target }, () => {
            this.readTargets();
        });
    }

    async fillTelegramUser() {
        if (this.state.instance?.startsWith('telegram.')) {
            if (this.instanceRead !== this.state.instance) {
                let useUserName = false;
                const obj = await this.props.oContext.socket.getObject(`system.adapter.${this.state.instance}`);
                if (obj && obj.native) {
                    useUserName = obj.native.useUsername;
                }
                const state = await this.props.oContext.socket.getState(`${this.state.instance}.communicate.users`);
                const userListStr: string = state?.val as string;
                const targets = [{ value: 'allTelegramUsers', label: 'All Receiver' }];

                if (userListStr) {
                    this.instanceRead = this.state.target;
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
        if (this.state.instance?.startsWith('discord.')) {
            if (this.instanceRead !== this.state.instance) {
                const alive = await this.props.oContext.socket.getState(`system.adapter.${this.state.instance}.alive`);
                if (alive?.val) {
                    const targetList = await this.props.oContext.socket.sendTo(this.state.instance, 'getNotificationTargets', {});
                    if (Array.isArray(targetList)) {
                        this.instanceRead = this.state.instance;
                        const targets = [{ value: '_', label: 'none' }];
                        for (const i in targetList) {
                            targets.push({ value: targetList[i].value, label: targetList[i].label });
                        }
                        this.setState({ targets });
                    }
                }
            }
        } else {
            const targets = [{ value: '_', label: 'none' }];
            this.setState({ targets });
            if (this.props.data.discordTarget) {
                setTimeout(() => this.props.onChange({ ...this.props.data, discordTarget: '' }), 50);
            }
        }
    }

    async readTargets() {
        if ((this.props.schema as ConfigItemCustom).adapter === 'telegram') {
            await this.fillTelegramUser();
        } else if ((this.props.schema as ConfigItemCustom).adapter === 'discord') {
            await this.fillDiscordTarget();
        }
    }

    renderItem() {
        const itemInstance = this.state.instances?.find(it => it.value === (this.state.instance || ''));
        const itemTarget = this.state.targets?.find(it => it.value === (this.state.target || ''));

        return <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 12,
                justifyContent: 'space-evenly',
                alignContent: 'center',
                justifyItems: 'stretch',
                gridAutoRows: '1fr',
            }}
        >
            {this.state.instances ? <FormControl style={{ width: '100%', marginRight: 10 }} variant="standard">
                <InputLabel>{I18n.t((this.props.schema as ConfigItemCustom).label as string)}</InputLabel>
                <Select
                    variant="standard"
                    value={this.state.instance || '_'}
                    renderValue={() => this.getText(itemInstance?.label!, itemInstance?.label !== 'none')}
                    onChange={e => this.setState({ instance: e.target.value === '_' ? '' : e.target.value }, () => {
                        this.readTargets();
                        this.onChange(this.props.attr!, this.state.instance);
                    })}
                >
                    {this.state.instances.map((it, i) => <MenuItem key={i} value={it.value}>
                        {this.getText(it.label, it?.label !== 'none')}
                    </MenuItem>)}
                </Select>
                {(this.props.schema as ConfigItemCustom).help ? <FormHelperText>{this.renderHelp((this.props.schema as ConfigItemCustom).help!, (this.props.schema as ConfigItemCustom).helpLink!, (this.props.schema as ConfigItemCustom).noTranslation!)}</FormHelperText> : null}
            </FormControl> : null}

            {this.state.targets && ((this.props.schema as ConfigItemCustom).adapter === 'telegram' || (this.props.schema as ConfigItemCustom).adapter === 'discord') ? <FormControl variant="standard">
                <InputLabel>{I18n.t((this.props.schema as ConfigItemCustom).adapter === 'telegram' ? 'Telegram receiver' : 'Discord receiver')}</InputLabel>
                <Select
                    disabled={!this.state.instance}
                    variant="standard"
                    value={this.state.target || '_'}
                    renderValue={() => this.getText(itemTarget?.label!, itemTarget?.label !== 'none')}
                    onChange={e => this.setState({ target: e.target.value === '_' ? '' : e.target.value }, () =>
                        this.onChange((this.props.schema as ConfigItemCustom).adapter === 'telegram' ? 'telegramUser' : 'discordTarget', this.state.target))}
                >
                    {this.state.targets.map((it, i) => <MenuItem key={i} value={it.value}>
                        {this.getText(it.label, it?.label !== 'none')}
                    </MenuItem>)}
                </Select>
                {(this.props.schema as ConfigItemCustom).help ? <FormHelperText>{this.renderHelp((this.props.schema as ConfigItemCustom).help!, (this.props.schema as ConfigItemCustom).helpLink!, (this.props.schema as ConfigItemCustom).noTranslation!)}</FormHelperText> : null}
            </FormControl> : (this.props.schema as ConfigItemCustom).adapter === 'telegram' || (this.props.schema as ConfigItemCustom).adapter === 'discord' ? <TextField
                variant="standard"
                disabled={!this.state.instance}
                label={I18n.t((this.props.schema as ConfigItemCustom).adapter === 'telegram' ? 'Telegram receiver' : 'Discord receiver')}
                value={this.state.target}
                onChange={e => this.setState({ target: e.target.value }, () =>
                    this.onChange((this.props.schema as ConfigItemCustom).adapter === 'telegram' ? 'telegramUser' : 'discordTarget', this.state.target))}
            /> : null}
        </div>;
    }
}

export default Instance;
