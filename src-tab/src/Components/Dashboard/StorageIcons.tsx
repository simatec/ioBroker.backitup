import React from 'react';

import { FolderOutlined } from '@mui/icons-material';
import { IconFolder } from '@iobroker/gui-components';
import { FaDropbox, FaNetworkWired, FaServer } from 'react-icons/fa';
import { DiOnedrive } from 'react-icons/di';
import { SiNextcloud } from 'react-icons/si';

/** Google Drive logo in its own colors */
function GoogleDriveIcon(props: { size: number }): React.JSX.Element {
    return (
        <svg
            width={props.size}
            height={props.size}
            viewBox="0 0 87.3 78"
            aria-hidden="true"
        >
            <path
                d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
                fill="#0066da"
            />
            <path
                d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
                fill="#00ac47"
            />
            <path
                d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
                fill="#ea4335"
            />
            <path
                d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
                fill="#00832d"
            />
            <path
                d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
                fill="#2684fc"
            />
            <path
                d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
                fill="#ffba00"
            />
        </svg>
    );
}

/**
 * Icon of a storage target.
 *
 * @param props properties
 * @param props.type one of local, cifs, ftp, dropbox, onedrive, googledrive, webdav
 * @param props.size edge length in pixels
 * @param props.open for a collapsible group: the local folder opens and closes with it
 */
export function StorageIcon(props: { type: string; size?: number; open?: boolean }): React.JSX.Element | null {
    const size = props.size || 24;
    switch (props.type) {
        case 'googledrive':
            return <GoogleDriveIcon size={size} />;
        case 'dropbox':
            return (
                <FaDropbox
                    size={size}
                    color="#0061FF"
                />
            );
        case 'onedrive':
            return (
                <DiOnedrive
                    size={size + 4}
                    color="#0A78D4"
                />
            );
        case 'webdav':
            return (
                <SiNextcloud
                    size={size}
                    color="#1A8FE3"
                />
            );
        case 'ftp':
            return (
                <FaServer
                    size={size - 2}
                    color="#64748B"
                />
            );
        case 'cifs':
        case 'nas / copy':
            return (
                <FaNetworkWired
                    size={size - 2}
                    color="#64748B"
                />
            );
        case 'local':
            return props.open === undefined ? (
                <FolderOutlined style={{ fontSize: size, color: '#F2B53A' }} />
            ) : (
                <IconFolder
                    open={props.open}
                    fontSize={size}
                    style={{ color: '#F2B53A' }}
                />
            );
        default:
            return null;
    }
}
