import React from 'react';
import PropTypes from 'prop-types';

import {
    Button,
    Table,
    TableCell,
    TableHead,
    TableRow,
} from '@mui/material';

import { Search, Add } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';

class Table extends BaseField {
    componentDidMount() {
        super.componentDidMount();
        // decode pass
    }

    renderItem() {
        return <>
            <Table size="dence">
                variant="contained"
                endIcon={<Search />}
                onClick={async () => {
                    const data = { ...this.props.data };
                    const result = await this.fetchConfig(this.props.schema.adapter, false, data);
                    if (result.found) {
                        if (result.changed) {
                            this.showMessage(I18n.t('BackItUp Information!'), result.message || I18n.t('Config taken from %s', result.found.substring('system.adapter.'.length)));
                            this.props.onChange(data);
                        } else {
                            this.showMessage(I18n.t('BackItUp Information!'), result.message || I18n.t('Config found in %s, but nothing changed', result.found.substring('system.adapter.'.length)));
                        }
                    } else {
                        this.showMessage(I18n.t('BackItUp Warning!'), I18n.t('No config found'), 'warning');
                    }
                }}
            >
                {I18n.t('Detect config')}
            </Table>
            {this.renderMessage()}
        </>;
    }
}

Table.propTypes = {
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

export default Table;
