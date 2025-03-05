import React from 'react';
import PropTypes from 'prop-types';

import { Button, TextField } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';
import { ConfigGeneric, ConfigGenericProps, ConfigGenericState } from '@iobroker/json-config';

declare global {
    interface Window {
        attachEvent: Window['addEventListener'];
        detachEvent: Window['removeEventListener'];
    }
}

type GoogleDriveState = ConfigGenericState & {
    googleDriveUrl: string;
    googledriveAccessTokens: string;
    success: boolean;
    blocked: boolean;
    running: boolean;
}

class GoogleDrive extends ConfigGeneric<ConfigGenericProps, GoogleDriveState> {
    googleAuthWindow?: WindowProxy | null;

    componentDidMount() {
        super.componentDidMount();
        (window.addEventListener || window.attachEvent)(window.addEventListener! ? 'message' : 'onmessage', this.onMessage as any, false);
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        (window.removeEventListener || window.detachEvent)(window.removeEventListener! ? 'message' : 'onmessage', this.onMessage as any, false);
    }

    onMessage = (event: MessageEvent) => {
        if (event.origin !== 'https://googleauth.iobroker.in') {
            return;
        }
        if ((typeof event.data === 'string' && event.data.startsWith('google-authentication:')) ||
            (typeof (event as any).message === 'string' && (event as any).message.startsWith('google-authentication:'))
        ) {
            const parts = (event.data || (event as any).message).split(':');
            if (parts[1] === 'success') {
                this.setState({ googleDriveUrl: '', googledriveAccessTokens: parts[2], success: true }, () =>
                    this.props.onChange({ ...this.props.data, googledriveAccessTokens: this.state.googledriveAccessTokens }));

                this.googleAuthWindow?.postMessage('close', event.origin);
                this.googleAuthWindow = null;
            } else {
                this.props.onError && this.props.onError(parts[2]);
            }
        }
    };

    onOpenUrl() {
        this.googleAuthWindow = window.open(this.state.googleDriveUrl, 'ioBrokerGoogleAuth');
        if (!this.googleAuthWindow || this.googleAuthWindow.closed || typeof this.googleAuthWindow.closed === 'undefined') {
            this.setState({ blocked: true });
        }
    }

    renderItem() {
        return <div style={{ width: '100%', margin: '0 0 1rem 0' }}>
            <Button
                disabled={!!this.state.googleDriveUrl || !this.props.alive || this.state.running}
                endIcon={<CloudUpload />}
                variant="contained"
                onClick={() => this.setState({ running: true }, async () => {
                    const result = await this.props.oContext.socket.sendTo(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, 'authGoogleDrive', { url: `${window.location.protocol}//${window.location.host}${window.location.pathname}` });
                    this.setState({ googleDriveUrl: result.url, running: false }, () => this.onOpenUrl());
                })}
            >
                {I18n.t(
                    this.props.data.googledriveAccessTokens ?
                        'Renew Google Drive Access' :
                        'Get Google Drive Access',
                )}
            </Button>
            {this.state.blocked ? <div style={{ color: 'red', fontSize: 16, marginTop: 20 }}>
                {I18n.t('Please allow popups in your browser for this page!')}
            </div> : null}
            {this.state.success && this.props.originalData?.googledriveAccessTokens !== this.state.googledriveAccessTokens ?
                <div style={{ color: 'green', fontSize: 16, marginTop: 20 }}>
                    {I18n.t('Successfully authorized. Now please be sure, the configuration is saved.')}
                </div> : null}
            {this.state.success && this.props.originalData?.googledriveAccessTokens === this.state.googledriveAccessTokens ?
                <div
                    style={{
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: 16,
                        marginTop: 20,
                    }}
                >
                    {I18n.t('Successfully authorized!')}
                </div> : null}
            {!this.state.success && this.props.data.googledriveAccessTokens ?
                <div
                    style={{
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: 16,
                        marginTop: 20,
                    }}
                >
                    {I18n.t('Authorization token exists')}
                </div> : null}
            {this.state.googleDriveUrl ? <>
                <div style={{ width: '100%', margin: '1rem 0 1rem 0' }}>
                    <span style={{ marginRight: 4 }}>{`${I18n.t('Authorize this app by visiting this url:')}`}</span>
                    <br />
                    <a
                        target="_blank"
                        href={this.state.googleDriveUrl}
                        rel="noreferrer"
                    >
                        {this.state.googleDriveUrl}
                    </a>
                </div>
                <TextField
                    value={this.state.googledriveAccessTokens}
                    label={I18n.t('Enter the code from that page here')}
                    variant="standard"
                    onChange={e => {
                        this.setState({ googledriveAccessTokens: e.target.value }, () =>
                            this.props.onChange({ ...this.props.data, googledriveAccessTokens: this.state.googledriveAccessTokens }));
                    }}
                    fullWidth
                />
            </> : null}
        </div>;
    }
}

export default GoogleDrive;
