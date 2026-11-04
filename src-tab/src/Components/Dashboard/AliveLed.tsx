import React, { useEffect, useState } from 'react';

import { Tooltip } from '@mui/material';

import { type AdminConnection, I18n, IconStatusLed } from '@iobroker/gui-components';

/**
 * Status LED of the adapter instance: green while it runs, red when not. It pulses on every alive update.
 * It subscribes on its own, so the heartbeat does not render the whole tab again.
 *
 * @param props properties
 * @param props.socket connection
 * @param props.instanceId e.g. `backitup.0`
 * @param props.alive the instance runs
 */
export default function AliveLed(props: {
    socket: AdminConnection;
    instanceId: string;
    alive: boolean;
}): React.JSX.Element {
    const [beat, setBeat] = useState<number | null>(null);

    useEffect(() => {
        const id = `system.adapter.${props.instanceId}.alive`;
        const onChange = (_id: string, state: ioBroker.State | null | undefined): void => setBeat(state?.ts ?? null);
        void props.socket.subscribeState(id, onChange);
        return () => props.socket.unsubscribeState(id, onChange);
    }, [props.socket, props.instanceId]);

    return (
        <Tooltip
            title={I18n.t(props.alive ? 'Instance is running' : 'Instance is not running')}
            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
        >
            <span style={{ display: 'inline-flex' }}>
                <IconStatusLed
                    color={props.alive ? 'green' : 'red'}
                    beat={props.alive ? beat : null}
                    fontSize={18}
                    ariaLabel={I18n.t(props.alive ? 'Instance is running' : 'Instance is not running')}
                />
            </span>
        </Tooltip>
    );
}
