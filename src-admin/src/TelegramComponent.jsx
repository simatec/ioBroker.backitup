import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, IconButton } from '@mui/material';
import { Delete as IconDelete } from '@mui/icons-material';
// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import {ConfigGeneric, Confirm, i18n as I18n} from '@iobroker/adapter-react-v5';

const styles = () => ({
    table: {
        minWidth: 400
    },
    header: {
        fontSize: 16,
        fontWeight: 'bold'
    }
});

class TelegramComponent extends ConfigGeneric {
    constructor(props) {
        super(props);
        this.state = {
            alive: false,
            initialized: false,
            users: [],
            confirm: null,
        };
    }

    componentDidMount() {
        super.componentDidMount();

        this.props.socket.getState(`system.adapter.telegram.${this.props.instance}.alive`)
            .then(async state => {
                if (state && state.val) {
                    this.setState({ alive: true }, () => this.readData());
                } else {
                    this.setState({ alive: false });
                }

                await this.props.socket.subscribeState(`system.adapter.telegram.${this.props.instance}.alive`, this.onAliveChanged);
            });
    }

    readData() {
        this.props.socket.sendTo(`telegram.${this.props.instance}`, 'adminuser', null)
            .then(obj => {  // get admin user
                const users = [];
                for (const id in obj) {
                    const names = [];
                    obj[id].userName  && names.push(obj[id].userName);
                    obj[id].firstName && names.push(obj[id].firstName);
                    users.push({
                        id,
                        names: names.join(' / '),
                        sysMessages: obj[id].sysMessages,
                    });
                }
                this.setState({ users, initialized: true });
            });
    }

    async componentWillUnmount() {
        await this.props.socket.unsubscribeState(`system.adapter.telegram.${this.props.instance}.alive`, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        const alive = state ? state.val : false;
        if (alive !== this.state.alive) {
            this.setState({ alive }, () => {
                if (alive && !this.state.initialized) {
                    this.readData();
                }
            });
        }
    };

    onSysMessageChange(id) {
        const pos = this.state.users.findIndex(item => item.id === id);
        if (pos !== -1) {
            const checked = !this.state.users[pos].sysMessages;

            this.props.socket.sendTo(`telegram.${this.props.instance}`, 'systemMessages', { itemId: id, checked })
                .then(obj => {
                    if (obj === id) {
                        const users = JSON.parse(JSON.stringify(this.state.users));
                        const pos = users.findIndex(item => item.id === id);
                        if (pos !== -1) {
                            users[pos].sysMessages = checked;
                            this.setState({ users });
                        }
                    }
                });
        }
    }

    onDelete(id) {
        this.props.socket.sendTo(`telegram.${this.props.instance}`, 'delUser', id)
            .then(obj => {
                if (obj === id) {
                    const users = JSON.parse(JSON.stringify(this.state.users));
                    const pos = users.findIndex(item => item.id === id);
                    if (pos !== -1) {
                        users.splice(pos, 1);
                        this.setState({ users });
                    }
                }
            });
    }

    renderConfirmDialog() {
        if (this.state.confirm) {
            return <Confirm onClose={result => {
                const id = this.state.confirm;
                this.setState({ confirm: null }, () => result && this.onDelete(id));
            }}/>;
        } else {
            return null;
        }
    }

    renderItem() {
        if (!this.state.alive && !this.state.initialized) {
            return <div>{I18n.t('custom_telegram_not_alive')}</div>;
        } else if (!this.state.initialized) {
            return <LinearProgress />;
        } else {
            return <div style={{ width: '100%'}}>
                <h4>{I18n.t('custom_telegram_title')}</h4>
                <TableContainer component={Paper} style={{ width: '100%' }}>
                    <Table style={{ width: '100%' }} size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{I18n.t('custom_telegram_id')}</TableCell>
                                <TableCell>{I18n.t('custom_telegram_name')}</TableCell>
                                <TableCell>{I18n.t('custom_telegram_sys_messages')}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {this.state.users.map(user => <TableRow
                                key={user.id}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                                <TableCell component="th" scope="row">{user.id}</TableCell>
                                <TableCell>{user.names}</TableCell>
                                <TableCell><Checkbox disabled={!this.state.alive} checked={!!user.sysMessages} onClick={() => this.onSysMessageChange(user.id)} /></TableCell>
                                <TableCell><IconButton disabled={!this.state.alive} onClick={() => this.setState({ confirm: user.id })} ><IconDelete /></IconButton></TableCell>
                            </TableRow>)}
                        </TableBody>
                    </Table>
                </TableContainer>
                {this.renderConfirmDialog()}
            </div>;
        }
    }
}

TelegramComponent.propTypes = {
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

export default withStyles(styles)(TelegramComponent);