import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import {
    Button,
    CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
} from '@mui/material';

import { Close, FolderZip, Upload } from '@mui/icons-material';

import { I18n, Utils } from '@iobroker/adapter-react-v5';

const UploadBackup = props => {
    const [fileName, setFileName] = useState('');
    const [fileData, setFileData] = useState(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const [uploaded, setUploaded] = useState(false);

    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        if (acceptedFiles?.length) {
            setWorking(true);
            error && setError('');
            const reader = new FileReader();
            setFileName(acceptedFiles[0].name);

            reader.onload = async evt => {
                setWorking(false);
                setFileData(evt.target.result);
            };

            reader.readAsDataURL(acceptedFiles[0]);
        }
        if (fileRejections?.length) {
            fileRejections[0].errors.forEach(err => {
                if (err.code === 'file-too-large') {
                    setError(I18n.t('File too large'));
                } else if (err.code === 'file-invalid-type') {
                    setError(I18n.t('Invalid file type'));
                } else {
                    setError(`Error: ${err.message}`);
                }
                setTimeout(() => error && setError(''), 3000);
            });
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        maxSize: props.maxSize || undefined,
        accept: {
            'application/x-gzip': ['.tar.gz'],
        },
    });

    return <Dialog
        open={!0}
        onClose={props.onClose}
        fullWidth
        maxWidth="lg"
    >
        <DialogTitle>{I18n.t('Upload Backup File')}</DialogTitle>
        <DialogContent>
            <div
                {...getRootProps()}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: 200,
                    borderRadius: 4,
                    boxSizing: 'border-box',
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    borderColor: isDragActive ? (props.themeType === 'dark' ? 'lightgreen' : 'green') : 'inherit',
                }}
            >
                {error ? <div style={{ color: '#a90000' }}>{error}</div> : null}
                {uploaded ? <div style={{ color: 'green' }}>{I18n.t('Upload completed successfully. The popup will close automatically')}</div> : null}
                {props.disabled || working ? null : <input {...getInputProps()} />}
                {working ? <CircularProgress /> :
                    <p
                        style={{
                            textAlign: 'center',
                            color: isDragActive ? (props.themeType === 'dark' ? 'lightgreen' : 'green') : 'inherit',
                        }}
                    >
                        {fileName ? <>
                            <div>{fileName}</div>
                            {fileName.endsWith('.tar.gz') ? <FolderZip /> : null}
                            {fileData ? <div style={{ fontSize: 10, opacity: 0.5 }}>
                        (
                                {Utils.formatBytes(fileData.length)}
                        )
                            </div> : null}
                        </> : (props.instruction || `${I18n.t('Drop the file here ...')} ${props.maxSize ? I18n.t('(Maximal file size is %s)', Utils.formatBytes(props.maxSize)) : ''}`)}
                    </p>}
            </div>
        </DialogContent>
        <DialogActions>
            {fileData && <Button
                onClick={async () => {
                    try {
                        const result = await props.socket.sendTo(`${props.adapterName}.${props.instance}`, 'uploadFile', { protocol: window.location.protocol });
                        let formData = new FormData();

                        formData.append('files', fileData);

                        await fetch(`${window.location.protocol}//${window.location.hostname}:${result.listenPort}`, {
                            method: 'POST',
                            body: formData,
                        });
                        setUploaded(true);
                        setTimeout(() => props.onClose, 5000);

                        await props.socket.sendTo(`${props.adapterName}.${props.instance}`, 'serverClose', { downloadFinish: false, uploadFinish: true });
                    } catch (e) {
                        setError(e);
                        setTimeout(() => props.onClose, 5000);
                    }
                }}
                color="primary"
                variant="contained"
                startIcon={<Upload />}
            >
                {I18n.t('Backup Upload')}
            </Button>}
            <Button
                onClick={props.onClose}
                color="grey"
                variant="contained"
                startIcon={<Close />}
            >
                {I18n.t('Cancel')}
            </Button>
        </DialogActions>
    </Dialog>;
};

UploadBackup.propTypes = {
    onClose: PropTypes.func,
    disabled: PropTypes.bool,
    themeType: PropTypes.string,
    instruction: PropTypes.string,
    maxSize: PropTypes.number,
};

export default UploadBackup;
