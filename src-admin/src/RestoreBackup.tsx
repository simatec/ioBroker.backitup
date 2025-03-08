import React from 'react';

import { Button, Checkbox, FormControlLabel } from '@mui/material';
import { Search } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';
import {
    ConfigGeneric,
    type ConfigGenericProps,
    type ConfigGenericState,
    type ConfigItemCustom,
} from '@iobroker/json-config';

import GetBackups from './Components/GetBackups';
import SourceSelector from './Components/SourceSelector';
import Restore from './Components/Restore';

type RestoreBackupState = ConfigGenericState & {
    backupSource: string;
    connectType: string;
    showGetBackups: boolean;
    showRestore: { location: string; object: string; fileName: string } | null;
    restoreIfWait: number;
};

class RestoreBackup extends ConfigGeneric<ConfigGenericProps, RestoreBackupState> {
    constructor(props: ConfigGenericProps) {
        super(props);
        this.state = {
            ...this.state,
            backupSource: window.localStorage.getItem('BackItUp.backupSource') || 'local',
            connectType: this.props.data.connectType,
            showGetBackups: false,
            showRestore: null,
            restoreIfWait: 5000,
        };
    }

    renderItem(): React.JSX.Element {
        return (
            <div
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
                <SourceSelector
                    value={this.state.backupSource}
                    data={this.props.data}
                    onChange={backupSource => {
                        window.localStorage.setItem('BackItUp.backupSource', backupSource);
                        this.setState({ backupSource });
                    }}
                />
                <Button
                    style={{ marginTop: 16 }}
                    onClick={() => this.setState({ showGetBackups: true })}
                    disabled={!this.props.alive}
                    variant="contained"
                    color="primary"
                    endIcon={<Search />}
                >
                    {I18n.t('Get list')}
                </Button>
                <FormControlLabel
                    control={
                        <Checkbox
                            value={this.props.data.startAllRestore}
                            onChange={e =>
                                this.props.onChange({ ...this.props.data, startAllRestore: e.target.checked })
                            }
                        />
                    }
                    label={I18n.t('Start all adapter after restore')}
                />
                {this.state.showGetBackups ? (
                    <GetBackups
                        onClose={() => this.setState({ showGetBackups: false })}
                        onRestore={(location, object, fileName) =>
                            this.setState({ showRestore: { location, object, fileName }, showGetBackups: false })
                        }
                        socket={this.props.oContext.socket}
                        themeType={this.props.oContext.themeType}
                        themeBreakpoints={this.props.oContext.theme.breakpoints.down}
                        adapterName={this.props.oContext.adapterName}
                        instance={this.props.oContext.instance}
                        backupSource={this.state.backupSource}
                        connectType={this.props.data.connectType}
                        allowDownload={(this.props.schema as ConfigItemCustom).allowDownload}
                    />
                ) : null}
                {this.state.showRestore ? (
                    <Restore
                        alive={this.props.alive}
                        location={this.state.showRestore.location}
                        fileName={this.state.showRestore.fileName}
                        onClose={() => this.setState({ showRestore: null })}
                        socket={this.props.oContext.socket}
                        themeType={this.props.oContext.themeType}
                        adapterName={this.props.oContext.adapterName}
                        instance={this.props.oContext.instance}
                        restoreIfWait={this.state.restoreIfWait}
                    />
                ) : null}
            </div>
        );
    }
}

export default RestoreBackup;
