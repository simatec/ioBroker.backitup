import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import { Check, Close, Source } from '@mui/icons-material';

import { I18n, Utils } from '@iobroker/adapter-react-v5';

const UploadSettings = props => {
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

            reader.readAsText(acceptedFiles[0]);
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
                // hide error after 3 seconds
                setTimeout(() => error && setError(''), 3000);
            });
        }
    });

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        maxSize: props.maxSize || undefined,
        accept: {
            'application/json': ['.json'],
        },
    });

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
            fullWidth
            maxWidth="lg"
        >
            <DialogTitle>{I18n.t('Restore BackItUp settings')}</DialogTitle>
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
                    {uploaded ? (
                        <div style={{ color: 'green' }}>
                            {I18n.t('Configuration restored successfully. The popup will close automatically')}
                        </div>
                    ) : null}
                    {props.disabled || working ? null : <input {...getInputProps()} />}
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
                                    <div>{fileName}</div>
                                    {fileName.endsWith('.json') ? <Source /> : null}
                                    {fileData ? (
                                        <div style={{ fontSize: 10, opacity: 0.5 }}>
                                            ({Utils.formatBytes(fileData.length)})
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
                        onClick={async () => {
                            try {
                                const obj = await props.socket.getObject(
                                    `system.adapter.${props.adapterName}.${props.instance}`,
                                );
                                try {
                                    const newObj = JSON.parse(fileData);
                                    obj.native = newObj.native;
                                    props.socket.setObject(obj._id, obj);
                                    setUploaded(true);
                                    setTimeout(props.onClose, 3000);
                                } catch (e) {
                                    setError(I18n.t('Cannot parse JSON'));
                                    setTimeout(() => error && setError(''), 5000);
                                }
                            } catch (e) {
                                setError(e);
                                setTimeout(props.onClose, 5000);
                            }
                        }}
                        color="primary"
                        variant="contained"
                        startIcon={<Check />}
                    >
                        {I18n.t('Apply')}
                    </Button>
                )}
                <Button
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

UploadSettings.propTypes = {
    onClose: PropTypes.func,
    disabled: PropTypes.bool,
    themeType: PropTypes.string,
    instruction: PropTypes.string,
    maxSize: PropTypes.number,
};

export default UploadSettings;
