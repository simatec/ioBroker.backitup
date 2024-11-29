import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import { Close, FolderZip, UploadOutlined } from '@mui/icons-material';

import { I18n, Utils } from '@iobroker/adapter-react-v5';

const UploadBackup = props => {
    const [fileName, setFileName] = useState('');
    const [fileData, setFileData] = useState(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const [uploaded, setUploaded] = useState(false);

    const onDrop = useCallback(
        (acceptedFiles, fileRejections) => {
            if (acceptedFiles?.length) {
                error && setError('');
                setFileName(acceptedFiles[0].name);
                setFileData(acceptedFiles[0]);
            } else if (fileRejections?.length) {
                fileRejections[0].errors.forEach(err => {
                    if (err.code === 'file-too-large') {
                        setError(I18n.t('File too large'));
                    } else if (err.code === 'file-invalid-type') {
                        setError(I18n.t('Invalid file type'));
                    } else {
                        setError(`${I18n.t('Error')}: ${err.message}`);
                    }
                    setTimeout(() => error && setError(''), 3000);
                });
            }
        },
        [error, setError, setFileName, setFileData],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        maxSize: props.maxSize || undefined,
        accept: {
            'application/x-gzip': ['.tar.gz'],
        },
    });

    const uploadProps = working || uploaded ? {} : getRootProps();

    return (
        <Dialog
            open={!0}
            onClose={() => !working && props.onClose()}
            fullWidth
            maxWidth="lg"
        >
            <DialogTitle>{I18n.t('Upload Backup File')}</DialogTitle>
            <DialogContent>
                <div
                    {...uploadProps}
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
                    {uploaded ? (
                        <div style={{ color: 'green' }}>
                            {I18n.t('Upload completed successfully. The popup will close automatically')}
                        </div>
                    ) : null}
                    {(props.disabled && !uploaded) || (working && !uploaded) ? null : <input {...getInputProps()} />}
                    {working ? (
                        <CircularProgress />
                    ) : (
                        <p
                            style={{
                                textAlign: 'center',
                                color: isDragActive ? (props.themeType === 'dark' ? 'lightgreen' : 'green') : 'inherit',
                            }}
                        >
                            {fileName ? (
                                <>
                                    <div>{fileName && !uploaded && !uploaded ? fileName : null}</div>
                                    {fileName.endsWith('.tar.gz') && !uploaded ? <FolderZip /> : null}
                                    {fileData && !uploaded ? (
                                        <div style={{ fontSize: 10, opacity: 0.5 }}>
                                            ({Utils.formatBytes(fileData.size)})
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                props.instruction ||
                                `${I18n.t('Drop the file here ...')} ${props.maxSize ? I18n.t('(Maximal file size is %s)', Utils.formatBytes(props.maxSize)) : ''}`
                            )}
                        </p>
                    )}
                </div>
            </DialogContent>
            <DialogActions>
                {fileData && (
                    <Button
                        disabled={working || uploaded || props.disabled}
                        onClick={async () => {
                            try {
                                // start server
                                const result = await props.socket.sendTo(
                                    `${props.adapterName}.${props.instance}`,
                                    'uploadFile',
                                    { protocol: window.location.protocol },
                                );
                                if (!result || result.error) {
                                    setError(`${I18n.t('Error')}: ${result.error}`);
                                } else {
                                    setWorking(true);
                                    const formData = new FormData();

                                    formData.append('files', fileData);

                                    await fetch(
                                        `${window.location.protocol}//${window.location.hostname}:${result.listenPort}`,
                                        {
                                            method: 'POST',
                                            body: formData,
                                        },
                                    );
                                    setUploaded(true);

                                    const closeResult = await props.socket.sendTo(
                                        `${props.adapterName}.${props.instance}`,
                                        'serverClose',
                                        {
                                            downloadFinish: false,
                                            uploadFinish: true,
                                        },
                                    );
                                    if (closeResult?.serverClose) {
                                        console.log('Upload-Server closed');
                                    }
                                    setWorking(false);
                                    setTimeout(props.onClose, 5000);
                                }
                            } catch (e) {
                                setWorking(false);
                                setError(e);
                                setTimeout(props.onClose, 5000);
                            }
                        }}
                        color="primary"
                        variant="contained"
                        startIcon={<UploadOutlined />}
                    >
                        {I18n.t('Backup Upload')}
                    </Button>
                )}
                <Button
                    disabled={working}
                    onClick={props.onClose}
                    color={props.themeType === 'dark' ? 'primary' : 'grey'}
                    variant="contained"
                    startIcon={<Close />}
                >
                    {I18n.t('Cancel')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

UploadBackup.propTypes = {
    onClose: PropTypes.func,
    disabled: PropTypes.bool,
    themeType: PropTypes.string,
    instruction: PropTypes.string,
    maxSize: PropTypes.number,
};

export default UploadBackup;
