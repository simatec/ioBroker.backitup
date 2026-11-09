import React from 'react';

import { Button, Dialog, DialogActions } from '@mui/material';
import { Close, CloudUploadOutlined } from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';

import {
    ConfigGeneric,
    type ConfigGenericProps,
    type ConfigGenericState,
    type ConfigItemCustom,
} from '@iobroker/json-config';

import { getTokens } from './Dashboard/tokens';
import { DialogHeader, dialogSx } from './Dashboard/DialogParts';
import {
    CloseOnReady,
    DIALOG_BUTTON_SX,
    ExecutionLogBox,
    type LogLine,
    RunStatus,
    titleText,
} from './Dashboard/ExecutionLog';

interface BackupNowConfig extends ConfigItemCustom {
    variant: 'contained' | 'outlined' | 'text';
    backUpType: 'iobroker' | 'ccu';
}

export interface BackupNowButtonProps {
    onClick: () => void;
    disabled: boolean;
    executing: boolean;
    label: string;
}

interface BackupNowProps extends ConfigGenericProps {
    style?: React.CSSProperties;
    className?: string;
    schema: BackupNowConfig;
    color: 'primary' | 'secondary' | 'grey';
    /** Draws the start control instead of the default button. The execution dialog stays the same. */
    renderButton?: (props: BackupNowButtonProps) => React.ReactNode;
}

interface BackupNowState extends ConfigGenericState {
    executing: boolean;
    executionDialog: boolean;
    executionLog: LogLine[];
    closeOnReady: boolean;
    isFullScreen: boolean;
    /** exit code of the last run, null while it runs */
    exitCode: string | null;
    /** label of the button that started the run */
    runLabel: string;
}

class BackupNow extends ConfigGeneric<BackupNowProps, BackupNowState> {
    private lastExecutionLine: string;
    private readonly textRef: React.RefObject<HTMLDivElement | null>;
    private closeTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(props: BackupNowProps) {
        super(props);
        this.state = {
            ...this.state,
            executing: false,
            executionDialog: false,
            executionLog: [],
            closeOnReady: false,
            isFullScreen: false,
            exitCode: null,
            runLabel: '',
        };
        this.lastExecutionLine = '';
        this.textRef = React.createRef();
    }

    static getTime(): string {
        const date = new Date();
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
    }

    onOutput = (_id: string, state: ioBroker.State | null | undefined): void => {
        if (state?.val && state.val !== this.lastExecutionLine) {
            this.lastExecutionLine = state.val as string;
            const executionLog = [...this.state.executionLog];
            const lines = (state.val || '').toString().replace(/\n$/, '').split('\n');
            const now = BackupNow.getTime();
            lines.forEach(line => {
                line = line.trim();
                if (!line) {
                    // return;
                }
                const parts = line.match(/^\[(\w+)] \[(\w+)] - (.*)/);
                if (parts) {
                    executionLog.push({
                        level: parts[1],
                        source: parts[2],
                        ts: now,
                        text: parts[3],
                    });
                } else if (state.val!.toString().startsWith('[EXIT]')) {
                    const code = state.val!.toString().match(/^\[EXIT] ([-\d]+)/);
                    executionLog.push({
                        level: code?.[1] === '0' ? 'INFO' : 'WARN',
                        source: 'gui',
                        ts: now,
                        text:
                            code?.[1] === '0'
                                ? I18n.t('The backup was successfully created!')
                                : I18n.t('The backup could not be created completely!'),
                    });
                } else {
                    executionLog.push({ text: line });
                }
            });

            // scroll down
            if (
                this.textRef.current &&
                this.textRef.current.scrollTop + this.textRef.current.clientHeight >= this.textRef.current.scrollHeight
            ) {
                setTimeout(() => {
                    if (this.textRef.current) {
                        this.textRef.current.scrollTop = this.textRef.current.scrollHeight;
                    }
                }, 100);
            }

            this.setState({ executionLog });

            if (state.val.toString().startsWith('[EXIT]')) {
                const code = state.val.toString().match(/^\[EXIT] ([-\d]+)/);
                this.setState({ executing: false, exitCode: code ? code[1] : '0' });
                if (this.state.closeOnReady && (!code || code[1] === '0')) {
                    this.closeTimeout ||= setTimeout(() => {
                        this.closeTimeout = null;
                        this.setState({ executionDialog: false });
                    }, 1500);
                }
            }
        }
    };

    async componentDidMount(): Promise<void> {
        // super.componentDidMount();
        await this.props.oContext.socket.subscribeState(
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.oneClick.${this.props.schema.backUpType}`,
            this.onEnabled,
        );
        await this.props.oContext.socket.subscribeState(
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.output.line`,
            this.onOutput,
        );
        this.updateFullScreenMode();
        window.addEventListener('resize', this.updateFullScreenMode);
    }

    onEnabled = (id: string, state: ioBroker.State | null | undefined): void => {
        if (
            id ===
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.oneClick.${this.props.schema.backUpType}`
        ) {
            if (!!state?.val !== this.state.executing) {
                this.setState({ executing: !!state?.val });
            }
        }
    };

    componentWillUnmount(): void {
        super.componentWillUnmount();
        this.props.oContext.socket.unsubscribeState(
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.oneClick.${this.props.schema.backUpType}`,
            this.onEnabled,
        );
        this.props.oContext.socket.unsubscribeState(
            `${this.props.oContext.adapterName}.${this.props.oContext.instance}.output.line`,
            this.onOutput,
        );
        this.closeTimeout && clearTimeout(this.closeTimeout);
        this.closeTimeout = null;
        window.removeEventListener('resize', this.updateFullScreenMode);
    }

    updateFullScreenMode = (): void => {
        const isFullScreen = window.matchMedia('(max-width: 600px)').matches;
        this.setState({ isFullScreen });
    };

    renderExecutionDialog(): React.JSX.Element | null {
        if (!this.state.executionDialog) {
            return null;
        }
        const t = getTokens(this.props.oContext.themeType === 'dark');
        const compact = this.state.isFullScreen;
        const close = (): void => this.setState({ executionDialog: false });
        const ok = this.state.exitCode === '0';

        return (
            <Dialog
                open={!0}
                onClose={close}
                maxWidth="lg"
                fullWidth
                fullScreen={compact}
                sx={dialogSx(t, compact)}
                slotProps={{ paper: { style: { height: compact ? undefined : 'calc(100% - 64px)' } } }}
            >
                <DialogHeader
                    t={t}
                    compact={compact}
                    icon={<CloudUploadOutlined fontSize="inherit" />}
                    title={titleText('BackItUp execution:')}
                    subtitle={this.state.runLabel || undefined}
                    onClose={close}
                />
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                        padding: compact ? '14px 10px' : '18px 24px',
                    }}
                >
                    <RunStatus
                        t={t}
                        state={
                            this.state.executing || this.state.exitCode === null ? 'running' : ok ? 'success' : 'error'
                        }
                        text={
                            this.state.executing || this.state.exitCode === null
                                ? I18n.t('Backup is running...')
                                : ok
                                  ? I18n.t('The backup was successfully created!')
                                  : I18n.t('The backup could not be created completely!')
                        }
                    />
                    <ExecutionLogBox
                        t={t}
                        lines={this.state.executionLog}
                        compact={compact}
                        boxRef={this.textRef}
                    />
                </div>
                <DialogActions
                    sx={{
                        gap: 1,
                        flexWrap: 'wrap',
                        padding: compact ? '10px 14px' : '12px 24px 18px',
                        borderTop: `1px solid ${t.divider}`,
                    }}
                >
                    <CloseOnReady
                        t={t}
                        checked={this.state.closeOnReady}
                        disabled={!this.state.executing}
                        onChange={closeOnReady => this.setState({ closeOnReady })}
                    />
                    <Button
                        variant="contained"
                        onClick={close}
                        startIcon={<Close />}
                        sx={DIALOG_BUTTON_SX}
                    >
                        {I18n.t('Close')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    onStart = (): void =>
        this.setState(
            {
                executionDialog: true,
                exitCode: null,
                runLabel: this.getLabel(),
                executionLog: [
                    {
                        ts: BackupNow.getTime(),
                        level: 'INFO',
                        text: I18n.t('starting Backup...'),
                        source: 'gui',
                    },
                ],
                executing: true,
            },
            async () => {
                this.lastExecutionLine = '';
                await this.props.oContext.socket.setState(
                    `${this.props.oContext.adapterName}.${this.props.oContext.instance}.oneClick.${this.props.schema.backUpType}`,
                    true,
                );
            },
        );

    getLabel(): string {
        return this.props.schema.label
            ? typeof this.props.schema.label === 'object'
                ? this.props.schema.label[I18n.getLanguage()] || this.props.schema.label.en
                : I18n.t(this.props.schema.label)
            : I18n.t('Backup now');
    }

    renderItem(): React.JSX.Element {
        const disabled = !this.props.alive || this.state.executing;
        const label = this.getLabel();

        return (
            <>
                {this.props.renderButton ? (
                    this.props.renderButton({
                        onClick: this.onStart,
                        disabled,
                        executing: this.state.executing,
                        label,
                    })
                ) : (
                    <Button
                        disabled={disabled}
                        onClick={this.onStart}
                        className={this.props.className}
                        color={this.props.color}
                        variant="contained"
                        style={this.props.style}
                        endIcon={<CloudUploadOutlined />}
                    >
                        {label}
                    </Button>
                )}
                {this.renderExecutionDialog()}
            </>
        );
    }

    render(): React.JSX.Element {
        return this.renderItem();
    }
}

export default BackupNow;
