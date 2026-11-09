import React, { Component } from 'react';

import { Alert, Button, Dialog, DialogActions } from '@mui/material';

import {
    Close,
    FolderZipOutlined,
    InfoOutlined,
    RestartAlt,
    SettingsBackupRestore,
    WarningAmberOutlined,
} from '@mui/icons-material';

import { I18n, DialogError, type AdminConnection, type ThemeType } from '@iobroker/gui-components';
import type { ExecutionLine } from './types';

import { getTokens, type DashboardTokens } from './Dashboard/tokens';
import { DialogHeader, dialogSx } from './Dashboard/DialogParts';
import { DashboardCard, IconBox } from './Dashboard/Parts';
import { StorageIcon } from './Dashboard/StorageIcons';
import {
    CloseOnReady,
    DIALOG_BUTTON_SX,
    ExecutionLogBox,
    type RunState,
    RunStatus,
    titleText,
} from './Dashboard/ExecutionLog';

/** Names of the storages as the list files them */
const LOCATION_LABELS: Record<string, string> = {
    local: 'Local',
    'nas / copy': 'NAS',
    cifs: 'NAS',
    ftp: 'FTP',
    dropbox: 'Dropbox',
    onedrive: 'OneDrive',
    googledrive: 'Google Drive',
    webdav: 'WebDAV',
};

interface RestoreProps {
    alive: boolean;
    location: string;
    fileName: string;
    onClose: () => void;
    socket: AdminConnection;
    themeType: ThemeType;
    adapterName: string;
    instance: number;
    restoreIfWait: number;
}

interface RestoreState {
    done: boolean;
    executing: boolean;
    executionLog: ExecutionLine[];
    closeOnReady: boolean;
    isStopped: boolean;
    isFullScreen: boolean;
    messages: { text: string; number: boolean }[];
    showRestoreDialog: boolean;
    restoreProcess: {
        done: boolean;
        log: string[];
        startFinish: string;
        restoreStatus: string;
        statusColor: string;
    };
    error?: string;
    /** exit code of the restore without restart, null while it runs */
    exitCode: string | null;
}

/**
 * Hints for an InfluxDB restore. 1.x restores a database (`influxd restore -portable -db`), 2.x a
 * bucket (`influx restore --bucket`); both fail when the target already exists or the program
 * (`influxd` / `influx`) is missing on the ioBroker host.
 *
 * @param version InfluxDB version of the backup; both variants are listed when it is unknown
 */
function influxDBMessages(version?: string): { text: string; number: boolean }[] {
    const messages = [{ text: I18n.t('The InfluxDB adapter must be stopped before the restore.'), number: false }];
    if (version !== '2.x') {
        messages.push({
            text: I18n.t(
                'InfluxDB 1.x: The database to be restored must not exist. Delete it after stopping the InfluxDB adapter.',
            ),
            number: false,
        });
        messages.push({
            text: I18n.t(
                'InfluxDB 1.x: The program "influxd" must be installed on the ioBroker host, or its path must be entered in the InfluxDB settings of BackItUp.',
            ),
            number: false,
        });
    }
    if (version !== '1.x') {
        messages.push({
            text: I18n.t(
                'InfluxDB 2.x: The bucket to be restored must not exist. Delete it after stopping the InfluxDB adapter.',
            ),
            number: false,
        });
        messages.push({
            text: I18n.t(
                'InfluxDB 2.x: The command line tool "influx" must be installed on the ioBroker host, or its path must be entered in the InfluxDB settings of BackItUp.',
            ),
            number: false,
        });
    }
    return messages;
}

class Restore extends Component<RestoreProps, RestoreState> {
    lastExecutionLine: string;
    textRef: React.RefObject<HTMLDivElement | null>;
    textRefRestore: React.RefObject<HTMLDivElement | null>;
    retries: number;
    polling?: ReturnType<typeof setInterval> | null;
    closeTimeout?: ReturnType<typeof setTimeout> | null;

    constructor(props: RestoreProps) {
        super(props);
        const WITH_DOWNLOAD = ['dropbox', 'onedrive', 'googledrive', 'ftp', 'webdav'];
        const NO_RESTART = [
            'grafana',
            'jarvis',
            'javascripts',
            'mysql',
            'sqlite',
            'influxDB',
            'pgsql',
            'zigbee',
            'esphome',
            'zigbee2mqtt',
            'nodered',
            'yahka',
            'historyDB',
        ];
        let isStopped = false;
        const messages = [];
        if (!NO_RESTART.find(text => this.props.fileName.includes(text))) {
            isStopped = true;

            if (WITH_DOWNLOAD.includes(this.props.location)) {
                messages[0] = {
                    text: I18n.t(
                        'Confirm with "Restore" and the download begins. Please wait until the download is finished!',
                    ),
                    number: true,
                };
                messages[1] = {
                    text: I18n.t('After download ioBroker will be restarted during restore.'),
                    number: true,
                };
            } else {
                messages[0] = { text: I18n.t('ioBroker will be restarted during restore.'), number: false };
            }

            messages.push({ text: I18n.t('After confirmation, a new tab opens with the Restore Log.'), number: false });
            messages.push({
                text: I18n.t('If the tab does not open, please deactivate your popup blocker.'),
                number: false,
            });
        } else {
            messages[0] = { text: I18n.t('ioBroker will not be restarted for this restore type.'), number: false };
            if (this.props.fileName.includes('influxDB')) {
                // Both variants until componentDidMount has read which InfluxDB version applies
                messages.push(...influxDBMessages());
            }
            messages.push({ text: I18n.t('Confirm with "Restore".'), number: false });
        }

        this.state = {
            done: false,
            executing: false,
            executionLog: [],
            closeOnReady: false,
            isStopped,
            isFullScreen: false,
            messages,
            showRestoreDialog: false,
            exitCode: null,
            restoreProcess: {
                done: false,
                log: [],
                startFinish: '', // [Restore], [Restart], [Finish], [Starting]
                restoreStatus: '', // '', 'Restore completed successfully!! Starting iobroker... Please wait!, Restore was canceled!! If ioBroker does not start automatically, please start it manually'
                statusColor: '', // '', '#00b204', '#c62828'
            },
        };
        this.lastExecutionLine = '';
        this.textRef = React.createRef();
        this.textRefRestore = React.createRef();
        this.retries = 0;
    }

    async pollStatus(): Promise<void> {
        if (!this.state.showRestoreDialog) {
            return;
        }

        try {
            await fetch(`${window.location.protocol}//${window.location.hostname}:8091/status.json`)
                .then(response => response.json())
                .then(data => {
                    const restoreProcess: {
                        done: boolean;
                        log: string[];
                        startFinish: string;
                        restoreStatus: string;
                        statusColor: string;
                    } = JSON.parse(JSON.stringify(this.state.restoreProcess));
                    if (typeof data.logWebIF === 'string') {
                        restoreProcess.log = data.logWebIF.split('\n');
                    }
                    restoreProcess.startFinish = data.startFinish;
                    restoreProcess.restoreStatus = data.restoreStatus ? I18n.t(data.restoreStatus) : '';
                    restoreProcess.statusColor = data.statusColor;
                    if (restoreProcess.startFinish === '[Finish]') {
                        clearInterval(this.polling!);
                        this.polling = null;
                        restoreProcess.done = true;
                    }

                    // scroll down
                    if (
                        this.textRefRestore.current &&
                        this.textRefRestore.current.scrollTop + this.textRefRestore.current.clientHeight >=
                            this.textRefRestore.current.scrollHeight
                    ) {
                        setTimeout(
                            () =>
                                this.textRefRestore.current &&
                                (this.textRefRestore.current.scrollTop = this.textRefRestore.current.scrollHeight),
                            100,
                        );
                    }

                    this.setState({ restoreProcess });
                })
                .catch(e => {
                    this.retries++;
                    if (this.retries > 15) {
                        console.warn(`Cannot get _status: ${e}`);
                        clearInterval(this.polling!);
                        this.polling = null;
                        this.setState({
                            restoreProcess: {
                                done: true,
                                log: [],
                                startFinish: '[Finish]', // [Restore], [Restart], [Finish], [Starting]
                                restoreStatus: I18n.t('Cannot get status'),
                                statusColor: '#c62828', // '', '#00b204', '#c62828'
                            },
                        });
                    }
                });
        } catch (e) {
            console.warn(`Cannot get status: ${e}`);
            this.retries++;
            if (this.retries > 15) {
                clearInterval(this.polling!);
                this.polling = null;
                this.setState({
                    restoreProcess: {
                        done: true,
                        log: [],
                        startFinish: '[Finish]', // [Restart], [Finish], [Restore], [Starting]
                        restoreStatus: I18n.t('Cannot get status'), // '', 'Restore completed successfully!! Starting iobroker... Please wait!' ,
                        // 'Restore was canceled!! If ioBroker does not start automatically, please start it manually' ,
                        statusColor: '#c62828', // '', '#00b204', '#c62828'
                    },
                });
            }
        }
    }

    startPolling(): void {
        this.setState({
            showRestoreDialog: true,
            restoreProcess: {
                log: [],
                done: false,
                startFinish: '[Starting]', // [Restart], [Finish], [Restore], [Starting]
                restoreStatus: '', // '', 'Restore completed successfully!! Starting iobroker... Please wait!' ,
                // 'Restore was canceled!! If ioBroker does not start automatically, please start it manually' ,
                statusColor: '', // '', '#00b204', '#c62828'
            },
        });

        this.retries = 0;
        this.polling = setInterval(() => this.pollStatus(), 1000);
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
            const now = Restore.getTime();
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
                } else if ((state.val as string).startsWith('[EXIT]')) {
                    const code = (state.val as string).match(/^\[EXIT] ([-\d]+)/);
                    executionLog.push({
                        level: code![1] === '0' ? 'INFO' : 'ERROR',
                        source: 'gui',
                        ts: now,
                        text:
                            code![1] === '0'
                                ? I18n.t('Restore completed successfully!')
                                : I18n.t('Restore was canceled!'),
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
                setTimeout(() => (this.textRef.current!.scrollTop = this.textRef.current!.scrollHeight), 100);
            }

            this.setState({ executionLog });

            if ((state.val as string).startsWith('[EXIT]')) {
                const code = (state.val as string).match(/^\[EXIT] ([-\d]+)/);
                this.setState({ executing: false, exitCode: code ? code[1] : '0' });
                if (this.state.closeOnReady && (!code || code[1] === '0')) {
                    this.closeTimeout =
                        this.closeTimeout ||
                        setTimeout(() => {
                            this.closeTimeout = null;
                            this.props.onClose();
                        }, 1500);
                }
            }
        }
    };

    async componentDidMount(): Promise<void> {
        await this.props.socket.subscribeState(
            `${this.props.adapterName}.${this.props.instance}.output.line`,
            this.onOutput,
        );
        this.updateFullScreenMode();
        window.addEventListener('resize', this.updateFullScreenMode);
        await this.updateInfluxDBMessages();
    }

    /**
     * Narrows the InfluxDB hints to the version of the backup: the configured one, or in multi mode
     * the one of the target whose name suffix is part of the file name.
     */
    async updateInfluxDBMessages(): Promise<void> {
        if (!this.props.fileName.includes('influxDB') || this.state.isStopped) {
            return;
        }
        try {
            const obj = await this.props.socket.getObject(
                `system.adapter.${this.props.adapterName}.${this.props.instance}`,
            );
            const native = obj?.native as
                | {
                      influxDBVersion?: string;
                      influxDBMulti?: boolean;
                      influxDBEvents?: { nameSuffix?: string; dbversion?: string }[];
                  }
                | undefined;
            let version = native?.influxDBVersion;
            if (native?.influxDBMulti) {
                version = (native.influxDBEvents || []).find(
                    event => event.nameSuffix && this.props.fileName.includes(`_${event.nameSuffix}_backupiobroker`),
                )?.dbversion;
            }
            const messages = this.state.messages;
            this.setState({
                messages: [messages[0], ...influxDBMessages(version), messages[messages.length - 1]],
            });
        } catch {
            // keep both variants
        }
    }

    componentWillUnmount(): void {
        this.props.socket.unsubscribeState(
            `${this.props.adapterName}.${this.props.instance}.output.line`,
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

    /** The lines of the restore web server, with the long final message replaced by a hint */
    getRestoreLog(): string[] {
        return this.state.restoreProcess.log.map(line =>
            line.includes('Restore completed successfully!!')
                ? I18n.t(
                      'After the restart, all adapters are installed. Please be patient.\nDepending on the system, it may take some time until all adapters are available again.',
                  )
                : line,
        );
    }

    renderRestoreDialog(t: DashboardTokens): React.JSX.Element | null {
        if (!this.state.showRestoreDialog) {
            return null;
        }
        const process = this.state.restoreProcess;
        const compact = this.state.isFullScreen;
        // the restore web server reports the result as a color
        const state: RunState = !process.done
            ? 'running'
            : process.statusColor === '#00b204'
              ? 'success'
              : process.statusColor
                ? 'error'
                : 'success';
        const phase = process.startFinish ? I18n.t(process.startFinish).replace(/^\[|\]$/g, '') : '';
        const close = (): void => {
            this.props.onClose();
            this.setState({ showRestoreDialog: false });
            // maybe to reload here, as the version of admin could change
        };

        return (
            <Dialog
                open={!0}
                onClose={() => process.done && close()}
                maxWidth="lg"
                fullWidth
                fullScreen={compact}
                sx={dialogSx(t, compact)}
                slotProps={{ paper: { style: { height: compact ? undefined : 'calc(100% - 64px)' } } }}
            >
                <DialogHeader
                    t={t}
                    compact={compact}
                    icon={<RestartAlt fontSize="inherit" />}
                    title={titleText('BackItUp restore execution')}
                    subtitle={this.props.fileName.split(/[\\/]/).pop()}
                    onClose={close}
                    closeDisabled={!process.done}
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
                        state={state}
                        text={
                            process.restoreStatus ||
                            (phase ? `${phase} ...` : I18n.t('The ioBroker is currently being restored'))
                        }
                        detail={process.restoreStatus && phase ? phase : undefined}
                    />
                    <ExecutionLogBox
                        t={t}
                        lines={this.getRestoreLog()}
                        compact={compact}
                        boxRef={this.textRefRestore}
                    />
                </div>
                <DialogActions
                    sx={{
                        padding: compact ? '10px 14px' : '12px 24px 18px',
                        borderTop: `1px solid ${t.divider}`,
                    }}
                >
                    <Button
                        disabled={!process.done}
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

    /** What is restored and from where */
    renderFileCard(t: DashboardTokens): React.JSX.Element {
        const name = this.props.fileName.split(/[\\/]/).pop() || this.props.fileName;
        const location = this.props.location === 'nas / copy' ? 'cifs' : this.props.location;
        return (
            <DashboardCard
                t={t}
                style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}
            >
                <IconBox
                    t={t}
                    size={44}
                >
                    <FolderZipOutlined fontSize="inherit" />
                </IconBox>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={name}
                    >
                        {name}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 4,
                            fontSize: '0.85rem',
                            color: t.textSecondary,
                        }}
                    >
                        <StorageIcon
                            type={location}
                            size={16}
                        />
                        {I18n.t(LOCATION_LABELS[this.props.location] || this.props.location)}
                    </div>
                </div>
            </DashboardCard>
        );
    }

    /** Hints before the restore starts */
    renderHints(t: DashboardTokens): React.JSX.Element {
        // the first hint (restart or not) goes on top, unless it is the first of numbered steps
        const first = this.state.messages[0] && !this.state.messages[0].number ? this.state.messages[0] : null;
        const rest = first ? this.state.messages.slice(1) : this.state.messages;
        const offset = first ? 2 : 1;
        return (
            <>
                {first ? (
                    <Alert
                        severity={this.state.isStopped ? 'warning' : 'info'}
                        icon={this.state.isStopped ? <WarningAmberOutlined /> : <InfoOutlined />}
                        sx={{ flexShrink: 0, borderRadius: '12px' }}
                    >
                        {first.text}
                    </Alert>
                ) : null}
                {rest.length ? (
                    <DashboardCard
                        t={t}
                        style={{ padding: '6px 16px', flexShrink: 0 }}
                    >
                        {rest.map((message, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 12,
                                    padding: '10px 0',
                                    borderBottom: i < rest.length - 1 ? `1px solid ${t.rowDivider}` : 'none',
                                    fontSize: '0.92rem',
                                    lineHeight: '22px',
                                }}
                            >
                                {message.number ? (
                                    <span
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: t.accent,
                                            background: t.iconBoxBg,
                                            border: `1px solid ${t.iconBoxBorder}`,
                                        }}
                                    >
                                        {i + offset}
                                    </span>
                                ) : (
                                    <InfoOutlined
                                        style={{ fontSize: 20, color: t.accent, flexShrink: 0, marginTop: 1 }}
                                    />
                                )}
                                <span>{message.text}</span>
                            </div>
                        ))}
                    </DashboardCard>
                ) : null}
            </>
        );
    }

    doRestore(): void {
        this.setState(
            {
                executing: true,
                done: false,
            },
            async () => {
                try {
                    const result = await this.props.socket.sendTo(
                        `${this.props.adapterName}.${this.props.instance}`,
                        'restore',
                        {
                            type: this.props.location,
                            fileName: this.props.fileName,
                            currentTheme: this.props.themeType === 'dark' ? 'react-dark' : 'none',
                            currentProtocol: window.location.protocol,
                            stopIOB: this.state.isStopped,
                        },
                    );
                    if (!result || result.error) {
                        this.setState({ error: JSON.stringify(result.error), executing: false });
                    } else if (this.state.isStopped) {
                        setTimeout(() => this.startPolling(), this.props.restoreIfWait || 5000);
                    } else {
                        this.setState({ done: true, executing: false });
                    }
                } catch (error: any) {
                    this.setState({ error: error.toString(), executing: false });
                }
            },
        );
    }

    renderError(): React.JSX.Element | null {
        if (!this.state.error) {
            return null;
        }
        return (
            <DialogError
                text={this.state.error}
                title={I18n.t('Error')}
                onClose={() => this.setState({ error: '' })}
            />
        );
    }

    render(): React.JSX.Element {
        const t = getTokens(this.props.themeType === 'dark');
        const compact = this.state.isFullScreen;
        const started = this.state.executing || this.state.done;
        const ok = this.state.exitCode === '0';
        const running = this.state.executing || (this.state.done && this.state.exitCode === null);

        return (
            <Dialog
                open={!0}
                onClose={() => !this.state.executing && this.props.onClose()}
                maxWidth={started ? 'lg' : 'md'}
                fullWidth
                fullScreen={compact}
                sx={dialogSx(t, compact)}
                slotProps={{ paper: { style: { height: started && !compact ? 'calc(100% - 64px)' : undefined } } }}
            >
                <DialogHeader
                    t={t}
                    compact={compact}
                    icon={<SettingsBackupRestore fontSize="inherit" />}
                    title={titleText('BackItUp restore execution')}
                    subtitle={started ? this.props.fileName.split(/[\\/]/).pop() : undefined}
                    onClose={() => this.props.onClose()}
                    closeDisabled={this.state.executing}
                />
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflow: started ? undefined : 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                        padding: compact ? '14px 10px' : '18px 24px',
                    }}
                >
                    {started ? (
                        <>
                            <RunStatus
                                t={t}
                                state={running ? 'running' : ok ? 'success' : 'error'}
                                text={
                                    running
                                        ? I18n.t('The ioBroker is currently being restored')
                                        : ok
                                          ? I18n.t('Restore completed successfully!')
                                          : I18n.t('Restore was canceled!')
                                }
                            />
                            <ExecutionLogBox
                                t={t}
                                lines={this.state.executionLog}
                                compact={compact}
                                boxRef={this.textRef}
                            />
                        </>
                    ) : (
                        <>
                            {this.renderFileCard(t)}
                            {this.renderHints(t)}
                        </>
                    )}
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
                        disabled={this.state.done}
                        onChange={closeOnReady => this.setState({ closeOnReady })}
                    />
                    <Button
                        variant="outlined"
                        disabled={this.state.executing}
                        onClick={() => this.props.onClose()}
                        sx={{ ...DIALOG_BUTTON_SX, color: t.textSecondary, borderColor: t.tileBorder }}
                    >
                        {this.state.done ? I18n.t('Close') : I18n.t('Cancel')}
                    </Button>
                    {started ? null : (
                        <Button
                            variant="contained"
                            startIcon={<SettingsBackupRestore />}
                            onClick={() =>
                                this.setState(
                                    {
                                        exitCode: null,
                                        executionLog: [
                                            {
                                                ts: Restore.getTime(),
                                                level: 'INFO',
                                                text: 'starting Restore...',
                                                source: 'gui',
                                            },
                                        ],
                                    },
                                    () => this.doRestore(),
                                )
                            }
                            sx={DIALOG_BUTTON_SX}
                        >
                            {I18n.t('Restore')}
                        </Button>
                    )}
                </DialogActions>
                {this.renderError()}
                {this.renderRestoreDialog(t)}
            </Dialog>
        );
    }
}

export default Restore;
