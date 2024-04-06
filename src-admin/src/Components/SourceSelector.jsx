import React, { Component } from 'react';
import {
    FormControl, InputLabel, MenuItem, Select,
} from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

export default class SourceSelector extends Component {
    render() {
        const options = [
            { label: 'Local', value: 'local' },
            { name: 'cifsEnabled', label: `NAS${this.props.data?.connectType ? ` (${this.props.data.connectType})` : ''}`, value: 'cifs' },
            { name: 'ftpEnabled', label: 'FTP', value: 'ftp' },
            { name: 'dropboxEnabled', label: 'Dropbox', value: 'dropbox' },
            { name: 'onedriveEnabled', label: 'OneDrive', value: 'onedrive' },
            { name: 'googledriveEnabled', label: 'Google Drive', value: 'googledrive' },
            { name: 'webdavEnabled', label: 'WebDAV', value: 'webdav' },
        ];

        return <FormControl
            classes={this.props.className}
            fullWidth
            variant="standard"
            style={{
                height: 32,
                marginTop: 6,
                maxWidth: 250,
                ...(this.props.style || {}),
            }}
        >
            <InputLabel>{I18n.t('Backup source')}</InputLabel>
            <Select
                variant="standard"
                value={this.props.value || 'local'}
                onChange={e => this.props.onChange(e.target.value)}
            >
                {options.map(option =>
                    (!option.name || !this.props.data || this.props.data[option.name] ? <MenuItem key={option.value} value={option.value}>
                        {I18n.t(option.label)}
                    </MenuItem> : null))}
            </Select>
        </FormControl>;
    }
}
