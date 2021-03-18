// Backitup - Copyright (c) by simatec
// Please visit https://github.com/simatec/ioBroker.backitup for licence-agreement and further information

//Settings
var $dialogCommand = null;
var $output = null;
var $dialogCommandProgress;
var lastMessage = '';

function initDialog() {
    console.log('tab_m: initDialog');
    $dialogCommand = $('#dialog-command');
    $output = $dialogCommand.find('#stdout');
    $dialogCommandProgress = $dialogCommand.find('.progress div');
    $dialogCommand.find('.progress-dont-close input').on('change', function () {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('backitup-close-on-ready', $(this).prop('checked') ? '1' : '0');
        }
    });
    if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem('backitup-close-on-ready') === '0') {
            $dialogCommand.find('.progress-dont-close input').prop('checked', false);
        } else {
            $dialogCommand.find('.progress-dont-close input').prop('checked', true);
        }
    }

    $dialogCommand.modal({
        dismissible: false
    });

    // workaround for materialize checkbox problem
    $dialogCommand.find('input[type="checkbox"]+span').off('click').on('click', function () {
        var $input = $(this).prev();
        // ignore switch
        if ($input.parent().parent().hasClass('switch')) return;
        if (!$input.prop('disabled')) {
            $input.prop('checked', !$input.prop('checked')).trigger('change');
        }
    });
    $dialogCommand.find('.btn').on('click', function () {
        $dialogCommand.modal('close');
    });
}
function showDialog(type, isStopped) {
    console.log('tab_m: showDialog');
    $output.val(_(`Started ${type} ...`));
    $dialogCommand.modal('open');
    $dialogCommand.find('.progress-dont-close').removeClass('disabled');
    $dialogCommandProgress.show();
    if (type === 'restore' && isStopped === true) {
        showToast($dialogCommand, _('ioBroker will be stopped and started again. Please wait'), null, 10000);
    }
    lastMessage = '';
}
function getSize(bytes) {
    console.log('tab_m: getSize');
    if (bytes > 1024 * 1024 * 512) {
        return Math.round(bytes / (1024 * 1024 * 1024) * 10) / 10 + 'GiB';
    } else if (bytes > 1024 * 1024) {
        return Math.round(bytes / (1024 * 1024) * 10) / 10 + 'MiB';
    } else if (bytes > 1024) {
        return Math.round(bytes / (1024) * 10) / 10 + 'KiB';
    } else {
        return bytes + ' bytes';
    }
}
function getName(name) {
    console.log('tab_m: getName');
    var parts = name.split('_');
    if (parseInt(parts[0], 10).toString() !== parts[0]) {
        parts.shift();
    }
    return new Date(
        parts[0],
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2].split('-')[0], 10),
        parseInt(parts[2].split('-')[1], 10),
        parseInt(parts[3], 10)).toLocaleString().replace(/:00$/, '');
}
function load(settings, onChange) {
    console.log('tab_m: load');
    if (!settings) return;
    //showHideSettings(settings);
    /*
    if (settings.redisEnabled === undefined) {
        settings.redisEnabled = adapter.config.backupRedis;
    }
    if (settings.cifsMount === 'CIFS') {
        settings.cifsMount = '';
    }
    */
    $('.value').each(function () {
        var $key = $(this);
        var id = $key.attr('id');
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id]).on('change', function () {
                console.log('tab_m: load checked' + JSON.stringify($key.attr('id')));
                showHideSettings(settings);
                onChange(false);
            });
        } else {
            
            var val = settings[id];
            /*
            if (id === 'mySqlPassword' || id === 'pgSqlPassword' || id === 'webdavPassword' || id === 'ccuPassword' || id === 'ftpPassword' || id === 'cifsPassword' || id === 'grafanaPassword') {
                val = val ? decrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
            }
            */
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(val).on('change', function () {
                console.log('tab_m: load change' + JSON.stringify($key.val(val)));
                onChange(false);
            }).on('keyup', function () {
                console.log('tab_m: load keyup');
                onChange(false);
            });
        }
    });
    
    getIsAdapterAlive(function (isAlive) {
        console.log('tab_m: getIsAdapterAlive');
        if (isAlive || common.enabled) {
            $('.do-backup')
                .removeClass('disabled')
                .on('click', function () {
                    if (changed) {
                        showError(_('Save the configuration first'));
                        return;
                    }
                    var type = $(this).data('type');
                    socket.emit('setState', adapter + '.' + instance + '.oneClick.' + type, {
                        val: true,
                        ack: false
                    }, function (err) {
                        if (!err) {
                            showDialog(type, null);
                            showToast(null, _('Backup started'));
                        } else {
                            showError(err);
                        }
                    });
                }).each(function () {
                    var type = $(this).data('type');
                    var $btn = $(this);
                    socket.emit('getState', adapter + '.' + instance + '.oneClick.' + type, function (err, state) {
                        if (state && state.val) {
                            $btn.addClass('disabled');
                        }
                    });
                });
            socket.on('stateChange', function (id, state) {
                if (id === 'backitup.' + instance + '.oneClick.ccu') {
                    if (state && state.val) {
                        $('.btn-ccu').addClass('disabled');
                    } else {
                        $('.btn-ccu').removeClass('disabled');
                    }
                } else
                    if (id === 'backitup.' + instance + '.oneClick.iobroker') {
                        if (state && state.val) {
                            $('.btn-iobroker').addClass('disabled');
                        } else {
                            $('.btn-iobroker').removeClass('disabled');
                        }
                    } else
                        if (id === 'system.adapter.backitup.' + instance + '.alive') {
                            if (state && state.val) {
                                $('.do-backup').removeClass('disabled');
                            } else {
                                $('.do-backup').addClass('disabled');
                            }
                        } else
                            if (id === 'backitup.' + instance + '.output.line') {
                                if (state && state.val && state.val !== lastMessage) {
                                    lastMessage = state.val;
                                    var text = $output.val();
                                    $output.val(text + '\n' + state.val);
                                    if (state.val.match(/^\[EXIT]/)) {
                                        var code = state.val.match(/^\[EXIT] ([-\d]+)/);
                                        $dialogCommandProgress.hide();
                                        $dialogCommand.find('.progress-dont-close').addClass('disabled');
                                        if ($dialogCommand.find('.progress-dont-close input').prop('checked') &&
                                            (!code || code[1] === '0')) {
                                            setTimeout(function () {
                                                $dialogCommand.modal('close');
                                            }, 1500);
                                        }
                                    }
                                }
                            }
            });
            if (settings.ftpEnabled === false && settings.dropboxEnabled === false && settings.cifsEnabled === false && settings.googledriveEnabled === false && settings.webdavEnabled === false) {
                showMessage(_("<br/><br/>According to the Backitup settings, backups are currently stored in the same local file system that is the source of the backup can be accessed more. <br/> <br/>It is recommended to use an external storage space as a backup target."), _('Backitup Information!'), 'info');
            }
            socket.emit('subscribeStates', 'backitup.' + instance + '.*');
            socket.emit('subscribeStates', 'system.adapter.backitup.' + instance + '.alive');
            socket.on('reconnect', function () {
                socket.emit('subscribeStates', 'backitup.' + instance + '.*');
                socket.emit('subscribeStates', 'system.adapter.backitup.' + instance + '.alive');
            });

            $('.do-list').removeClass('disabled').on('click', function () {
                $('.do-list').addClass('disabled');
                $('.doRestore').find('.root').html('');
                console.log('Restore Type: ' + $('#restoreSource').val());
                sendTo(null, 'list', $('#restoreSource').val(), function (result) {
                    $('.do-list').removeClass('disabled');
                    console.log(result);
                    if (result && result.error) {
                        showError(result.error);
                    }
                    if (result && result.data) {
                        var text = '';
                        var data = result.data;
                        console.log(data);
                        for (var type in data) {
                            if (!data.hasOwnProperty(type)) continue;

                            let storageTyp;
                            // Storage Translate
                            switch (type) {
                                case 'webdav':
                                    storageTyp = 'WebDAV';
                                    break;
                                case 'nas / copy':
                                    storageTyp = 'NAS / Copy';
                                    break;
                                case 'local':
                                    storageTyp = 'Local';
                                    break;
                                case 'dropbox':
                                    storageTyp = 'Dropbox';
                                    break;
                                case 'ftp':
                                    storageTyp = 'FTP';
                                    break;
                                case 'googledrive':
                                    storageTyp = 'Google Drive';
                                    break;
                            }
                            text += '<li><div class="collapsible-header top"><i class="material-icons">expand_more</i><h6>' + _(storageTyp) + '</h6></div>';
                            text += '<ul class="collapsible-body collection">';
                            for (var storage in data[type]) {
                                if (data[type].hasOwnProperty(storage)) {
                                    text += '<ul class="collapsible"><li><div class="collapsible-header"><i class="material-icons">expand_more</i><h6>' + storage.toUpperCase() + '</h6></div>';
                                    text += '<ul class="collapsible-body collection">';
                                    for (var i = data[type][storage].length - 1; i >= 0; i--) {
                                        text += '<li class="collection-item"><div>' + getName(data[type][storage][i].name) + ' <b>>>> ' + data[type][storage][i].name + ' <<<</b> (' + getSize(data[type][storage][i].size) + ')' +
                                            '<a class="secondary-content do-restore" data-file="' + data[type][storage][i].path + '" data-type="' + type + '"><i class="material-icons">restore</i></a>' +
                                            '</div></li>';
                                    }
                                    text += '</ul></li></ul>';
                                }
                            }
                            text += '</ul></li>';
                        }

                        var $tabAdmin = $('.doRestore');
                        $tabAdmin
                            .find('.root')
                            .html(text);
                        $tabAdmin.find('.collapsible').collapsible();
                        $tabAdmin.find('.do-restore').on('click', function () {
                            var type = $(this).data('type');
                            var file = $(this).data('file');
                            var name = file.split('/').pop().split('_')[0];

                            let message = ('ioBroker will be restarted during restore.');
                            let downloadPanel = false;
                            if (settings.restoreSource === 'dropbox' || settings.restoreSource === 'googledrive' || settings.restoreSource === 'webdav' || settings.restoreSource === 'ftp') {
                                message = ('<br/><br/>1. Confirm with "OK" and the download begins. Please wait until the download is finished!<br/><br/>2. After download ioBroker will be restarted during restore.');
                                downloadPanel = true;
                            }
                            let isStopped = false;
                            if (file.search('grafana') == -1 &&
                                file.search('jarvis') == -1 &&
                                file.search('javascripts') == -1 &&
                                file.search('mysql') == -1 &&
                                file.search('influxDB') == -1 &&
                                file.search('pgsql') == -1 &&
                                file.search('zigbee') == -1 &&
                                file.search('historyDB') == -1) {
                                isStopped = true;
                            } else {
                                if (downloadPanel) {
                                    message = ('<br/><br/>1. Confirm with "OK" and the download begins. Please wait until the download is finished!<br/><br/>2. After the download, the restore begins without restarting ioBroker.');
                                } else {
                                    message = ('ioBroker will not be restarted for this restore.');
                                }
                            }
                            confirmMessage(name !== '' ? _(message) : _('Ready'), _('Are you sure?'), null, [_('Cancel'), _('OK')], function (result) {
                                if (result === 1) {
                                    if (downloadPanel) {
                                        $('.cloudRestore').show();
                                    } else {
                                        $('.cloudRestore').hide();
                                    }

                                    $('.do-list').addClass('disabled');
                                    $('.doRestore').find('.do-restore').addClass('disabled').hide();

                                    var name = file.split('/').pop().split('_')[0];
                                    showDialog(name !== '' ? 'restore' : '', isStopped);
                                    showToast(null, _('Restore started'));

                                    sendTo(null, 'restore', { type: type, fileName: file }, function (result) {
                                        if (!result || result.error) {
                                            showError('Error: ' + JSON.stringify(result.error));
                                        } else {
                                            console.log('Restore finish!')
                                            if (isStopped) {
                                                //Create Link for Restore Interface
                                                var link = "http://" + location.hostname + ":8091/backitup-restore";
                                                // Log Window for Restore Interface
                                                setTimeout(function () {
                                                    window.open(link, '_blank');
                                                }, 5000);
                                            }
                                            if (downloadPanel) {
                                                $('.cloudRestore').hide();
                                                downloadPanel = false;
                                            }
                                        }
                                        $('.do-list').removeClass('disabled');
                                        $('.doRestore').find('.do-restore').removeClass('disabled').show();
                                    });
                                }
                            });
                        });
                    }
                });
            });
        } else {
            $('.do-backup').addClass('disabled');
            $('.do-list').addClass('disabled');
        }
    });

    $(document).ready(function () {
        $('select').material_select();
    });
    showHideSettings(settings);
    onChange(false);
    
    Materialize.updateTextFields();  // function Materialize.updateTextFields(); to reinitialize all the Materialize labels on the page if you are dynamically adding inputs.
    
    initDialog();
}

function showHideSettings(settings) {
    console.log('tab_m: showHideSettings');

    if (settings.jarvisEnabled) {
        $('#optionJarvis_i').hide();
        $('#optionJarvis_a').show();
    } else {
        $('#optionJarvis_a').hide();
        $('#optionJarvis_i').show();
    }
    if (settings.minimalEnabled) {
        $('#optionIobroker_a').show();
        $('#optionIobroker_i').hide();
    } else {
        $('#optionIobroker_i').show();
        $('#optionIobroker_a').hide();
    }
    if (settings.ccuEnabled) {
        $('#optionCCU_a').show();
        $('#optionCCU_i').hide();
    } else {
        $('#optionCCU_i').show();
        $('#optionCCU_a').hide();
    }
    if (settings.redisEnabled) {
        $('#optionRedis_a').show();
        $('#optionRedis_i').hide();
    } else {
        $('#optionRedis_i').show();
        $('#optionRedis_a').hide();
    }
    if (settings.javascriptsEnabled) {
        $('#optionJavascripts_a').show();
        $('#optionJavascripts_i').hide();
    } else {
        $('#optionJavascripts_i').show();
        $('#optionJavascripts_a').hide();
    }
    if (settings.zigbeeEnabled) {
        $('#optionZigbee_a').show();
        $('#optionZigbee_i').hide();
    } else {
        $('#optionZigbee_i').show();
        $('#optionZigbee_a').hide();
    }
    if (settings.historyEnabled) {
        $('#optionHistory_a').show();
        $('#optionHistory_i').hide();
    } else {
        $('#optionHistory_i').show();
        $('#optionHistory_a').hide();
    }
    if (settings.influxDBEnabled) {
        $('#optionInfluxdb_a').show();
        $('#optionInfluxdb_i').hide();
    } else {
        $('#optionInfluxdb_i').show();
        $('#optionInfluxdb_a').hide();
    }
    if (settings.mySqlEnabled) {
        $('#optionMySQL_a').show();
        $('#optionMySQL_i').hide();
    } else {
        $('#optionMySQL_i').show();
        $('#optionMySQL_a').hide();
    }
    if (settings.pgSqlEnabled) {
        $('#optionPgSQL_a').show();
        $('#optionPgSQL_i').hide();
    } else {
        $('#optionPgSQL_i').show();
        $('#optionPgSQL_a').hide();
    }
    if (settings.grafanaEnabled) {
        $('#optionGrafana_a').show();
        $('#optionGrafana_i').hide();
    } else {
        $('#optionGrafana_i').show();
        $('#optionGrafana_a').hide();
    }
    if (settings.cifsEnabled) {
        $('#optionNAS_a').show();
        $('#optionNAS_i').hide();
    } else {
        $('#optionNAS_i').show();
        $('#optionNAS_a').hide();
    }
    if (settings.ftpEnabled) {
        $('#optionFTP_a').show();
        $('#optionFTP_i').hide();
    } else {
        $('#optionFTP_i').show();
        $('#optionFTP_a').hide();
    }
    if (settings.dropboxEnabled) {
        $('#optionDropbox_a').show();
        $('#optionDropbox_i').hide();
    } else {
        $('#optionDropbox_i').show();
        $('#optionDropbox_a').hide();
    }
    if (settings.googledriveEnabled) {
        $('#optionGoogleDrive_a').show();
        $('#optionGoogleDrive_i').hide();
    } else {
        $('#optionGoogleDrive_i').show();
        $('#optionGoogleDrive_a').hide();
    }
    if (settings.webdavEnabled) {
        $('#optionWebDAV_a').show();
        $('#optionWebDAV_i').hide();
    } else {
        $('#optionWebDAV_i').show();
        $('#optionWebDAV_a').hide();
    }

    $('.cloudRestore').hide();
    onChange(false);
    Materialize.updateTextFields();
}