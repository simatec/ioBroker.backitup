import React from 'react';

import { Button, TextField } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';

declare global {
    interface Window {
        attachEvent: Window['addEventListener'];
        detachEvent: Window['removeEventListener'];
    }
}

export interface AccessTokens {
    access_token: string;
    expires_in: number;
    access_token_expires_on: string;
    ext_expires_in: number;
    token_type: 'Bearer';
    scope: string;
    refresh_token: string;
}

type DropBoxState = ConfigGenericState & {
    url: string;
    accessTokens: string;
    success: boolean;
    blocked: boolean;
    running: boolean;
};

class DropBox extends ConfigGeneric<ConfigGenericProps, DropBoxState> {
    authWindow?: WindowProxy | null;

    async componentDidMount(): Promise<void> {
        super.componentDidMount();
        if (window.addEventListener) {
            window.addEventListener('message', this.onMessage as any, false);
        } else {
            window.attachEvent('onmessage', this.onMessage as any, false);
        }

        await this.props.oContext.socket.subscribeState(
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.info.dropboxTokens`,
            this.onTokensUpdated,
        );

        // read tokens
        const tokens = await this.props.oContext.socket.getState(
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.info.dropboxTokens`,
        );
        if (tokens) {
            const accessTokens: AccessTokens = JSON.parse(tokens.val as string);
            if (new Date(accessTokens.access_token_expires_on).getTime() > Date.now()) {
                this.setState({ accessTokens: tokens.val as string });
            }
        }
    }

    onTokensUpdated = (_id: string, state: ioBroker.State | null | undefined): void => {
        if (state?.val) {
            const accessTokens: AccessTokens = JSON.parse(state.val as string);
            if (new Date(accessTokens.access_token_expires_on).getTime() > Date.now()) {
                if (this.state.accessTokens !== state.val) {
                    this.setState({ accessTokens: state.val as string });
                }
                return;
            }
        }
        this.setState({ accessTokens: '' });
    };

    componentWillUnmount(): void {
        super.componentWillUnmount();
        if (window.removeEventListener) {
            window.removeEventListener('message', this.onMessage as any, false);
        } else {
            window.detachEvent('onmessage', this.onMessage as any, false);
        }
        this.props.oContext.socket.unsubscribeState(
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.info.dropboxTokens`,
            this.onTokensUpdated,
        );
    }

    saveToken(accessTokens: string): void {
        try {
            if (accessTokens && !accessTokens.startsWith('{')) {
                // convert base64 to string
                accessTokens = atob(accessTokens);
            }

            const accessTokensParsed: AccessTokens = JSON.parse(accessTokens);
            if (accessTokensParsed.access_token && accessTokensParsed.refresh_token && accessTokensParsed.expires_in) {
                // Give 10 seconds to user to copy the token
                accessTokensParsed.access_token_expires_on ||= new Date(
                    Date.now() + accessTokensParsed.expires_in * 1000,
                ).toISOString();

                this.props.oContext.socket
                    .setState(
                        `${this.props.oContext.adapterName}.${this.props.oContext.instance}.info.dropboxTokens`,
                        JSON.stringify(accessTokensParsed),
                        true,
                    )
                    .catch(e => console.log(`Error occurred: ${e}`));
            }
        } catch (e) {
            // ignore
            console.log(e);
        }
    }

    onMessage = (event: MessageEvent): void => {
        if (event.origin !== 'https://oauth2.iobroker.in') {
            return;
        }
        if (
            (typeof event.data === 'string' && event.data.startsWith('dropbox-authentication:')) ||
            (typeof (event as any).message === 'string' && (event as any).message.startsWith('dropbox-authentication:'))
        ) {
            const parts = (event.data || (event as any).message).split(':');
            if (parts[1] === 'success') {
                this.setState({ url: '', accessTokens: parts[2], success: true }, () =>
                    this.saveToken(this.state.accessTokens),
                );

                this.authWindow?.postMessage('close', event.origin);
                this.authWindow = null;
            } else {
                this.props.onError && this.props.onError(parts[2]);
            }
        }
    };

    onOpenUrl(): void {
        this.authWindow = window.open(this.state.url, 'ioBrokerDropBoxAuth');
        if (!this.authWindow || this.authWindow.closed || typeof this.authWindow.closed === 'undefined') {
            this.setState({ blocked: true });
        }
    }

    renderItem(): React.JSX.Element {
        let validTill = '';
        if (this.state.accessTokens) {
            try {
                const accessTokensParsed: AccessTokens = JSON.parse(this.state.accessTokens);
                validTill = new Date(accessTokensParsed.access_token_expires_on).toLocaleString();
            } catch {
                // ignore
            }
        }

        return (
            <div style={{ width: '100%', margin: '0 0 1rem 0' }}>
                <Button
                    disabled={!!this.state.url || !this.props.alive || this.state.running}
                    endIcon={<CloudUpload />}
                    variant="contained"
                    onClick={() =>
                        this.setState({ running: true }, async () => {
                            const result = await this.props.oContext.socket.sendTo(
                                `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
                                'authDropbox',
                            );
                            this.setState({ url: result.url, running: false }, () => this.onOpenUrl());
                        })
                    }
                >
                    {I18n.t(this.state.accessTokens ? 'Renew DropBox Access' : 'Get DropBox Access')}
                </Button>
                {this.state.blocked ? (
                    <div style={{ color: 'red', fontSize: 16, marginTop: 20 }}>
                        {I18n.t('Please allow popups in your browser for this page!')}
                    </div>
                ) : null}
                {this.state.accessTokens ? (
                    <div style={{ color: 'green', fontSize: 16, marginTop: 20 }}>
                        {this.props.alive
                            ? I18n.t(
                                  'Successfully authorized. Token valid till %s and will be automatically renewed.',
                                  validTill,
                              )
                            : I18n.t(
                                  'Successfully authorized. Token valid till %s but it can expire as the instance is not running.',
                                  validTill,
                              )}
                    </div>
                ) : null}
                {this.state.url ? (
                    <>
                        <div style={{ width: '100%', margin: '1rem 0 1rem 0' }}>
                            <span
                                style={{ marginRight: 4 }}
                            >{`${I18n.t('Authorize this app by visiting this url:')}`}</span>
                            <br />
                            <a
                                target="_blank"
                                href={this.state.url}
                                rel="noreferrer"
                            >
                                {this.state.url}
                            </a>
                        </div>
                        <TextField
                            value={this.state.accessTokens}
                            label={I18n.t('Enter the code from that page here')}
                            variant="standard"
                            onChange={e => {
                                let accessTokens = e.target.value;
                                if (accessTokens && !accessTokens.startsWith('{')) {
                                    // convert base64 to string
                                    accessTokens = atob(accessTokens);
                                }
                                try {
                                    const accessTokensParsed: AccessTokens = JSON.parse(accessTokens);
                                    if (accessTokensParsed.access_token) {
                                        accessTokensParsed.access_token_expires_on = new Date(
                                            Date.now() + (accessTokensParsed.expires_in - 10) * 1000,
                                        ).toISOString();
                                        this.setState({ accessTokens: JSON.stringify(accessTokensParsed) }, () =>
                                            this.saveToken(this.state.accessTokens),
                                        );
                                    }
                                } catch {
                                    // ignore
                                }
                            }}
                            fullWidth
                        />
                    </>
                ) : null}
            </div>
        );
    }
}

export default DropBox;
