// Backitup - Copyright (c) by simatec
// Please visit https://github.com/simatec/ioBroker.backitup for licence-agreement and further information

//Settings
var $dialogCommand = null;
var $output = null;
var $dialogCommandProgress;
var lastMessage = '';


function initDialog() {
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
    if (!settings) return;
    $('.value').each(function () {
        var $key = $(this);
        var id = $key.attr('id');
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id]).on('change', function () {
                showHideSettings(settings);
                onChange(false);
            });
        } else {

            var val = settings[id];
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(val).on('change', function () {
                onChange(false);
            }).on('keyup', function () {
                onChange(false);
            });
        }
    });
    console.log('current theme: ' + currentTheme());
    
    sendTo(null, 'getSystemInfo', null, function (obj) {
        if (obj == 'docker') {
            var $startAllRestore = $('#startAllRestore');
            $startAllRestore.addClass('disabled');

            $('#startAllRestore').prop('checked', false);
            $('#startAllRestore').prop('disabled', true);
        }
    });

    fillBackupOptions(settings);
    fillStorageOptions(settings);
    backupInfo(settings);
    fillStorageSelect(settings)

    getIsAdapterAlive(function (isAlive) {
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
                initDialogRestore();
                $('.doRestore').hide();
                $('.progress-search').show();
                $('.do-list').addClass('disabled');
                $('.doRestore').find('.root').html('');
                console.log('Restore Type: ' + $('#restoreSource').val());
                sendTo(null, 'list', $('#restoreSource').val(), function (result) {
                    $('.do-list').removeClass('disabled');
                    console.log(result);
                    if (result && result.error) {
                        $('.progress-search').hide();
                        showError(JSON.stringify(result.error));
                    }
                    if (result && result.data) {
                        $('.progress-search').hide();
                        var text = '';
                        var data = result.data;
                        console.log(data);
                        for (var type in data) {
                            if (!data.hasOwnProperty(type)) continue;

                            var storageTyp = '';
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
                            text += '<ul class="collapsible-body collection head">';
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
                        $('.doRestore').show();
                        var $tabAdmin = $('.doRestore');
                        $tabAdmin
                            .find('.root')
                            .html(text);
                        $tabAdmin.find('.collapsible').collapsible();

                        var expandHeader = M.Collapsible.getInstance($('.collapsible'));
                        expandHeader.open();

                        $tabAdmin.find('.do-restore').on('click', function () {
                            var type = $(this).data('type');
                            var file = $(this).data('file');
                            var name = file.split('/').pop().split('_')[0];

                            var message = _('<br/><br/>ioBroker will be restarted during restore.<br/><br/>Confirm with \"OK\".');
                            var downloadPanel = false;
                            if ($('#restoreSource').val() === 'dropbox' || $('#restoreSource').val() === 'googledrive' || $('#restoreSource').val() === 'webdav' || $('#restoreSource').val() === 'ftp') {
                                message = _('<br/><br/>1. Confirm with "OK" and the download begins. Please wait until the download is finished!<br/><br/>2. After download ioBroker will be restarted during restore.');
                                downloadPanel = true;
                            }
                            var isStopped = false;
                            if (file.search('grafana') == -1 &&
                                file.search('jarvis') == -1 &&
                                file.search('javascripts') == -1 &&
                                file.search('mysql') == -1 &&
                                file.search('influxDB') == -1 &&
                                file.search('pgsql') == -1 &&
                                file.search('zigbee') == -1 &&
                                file.search('yahka') == -1 &&
                                file.search('historyDB') == -1) {
                                isStopped = true;
                            } else {
                                if (downloadPanel) {
                                    message = _('<br/><br/>1. Confirm with "OK" and the download begins. Please wait until the download is finished!<br/><br/>2. After the download, the restore begins without restarting ioBroker.');
                                } else {
                                    message = _('<br/><br/>ioBroker will not be restarted for this restore.<br/><br/>Confirm with \"OK\".');
                                }
                            }
                            if (isStopped) {
                                message += _('<br/><br/><br/><b>After confirmation, a new tab opens with the Restore Log.</b><br/><b>If the tab does not open, please deactivate your popup blocker.</b>')
                            }
                            confirmMessage(name !== '' ? message : _('Ready'), _('Are you sure?'), null, [_('Cancel'), _('OK')], function (result) {
                                if (result === 1) {
                                    if (downloadPanel) {
                                        $('.cloudRestore').show();
                                    } else {
                                        $('.cloudRestore').hide();
                                    }

                                    $('#dialog-restore-show').modal('close');
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
                                                var link = "http://" + location.hostname + ":8091/backitup-restore.html";
                                                // Log Window for Restore Interface
                                                setTimeout(function () {
                                                    $('<a href="' + link + '" target="_blank">&nbsp;</a>')[0].click();
                                                    //window.open(link, '_blank');
                                                }, 5000);
                                            }
                                            if (downloadPanel) {
                                                $('.cloudRestore').hide();
                                                downloadPanel = false;
                                            }
                                        }
                                        $('.do-list').removeClass('disabled');
                                        $('.doRestore').find('.do-restore').removeClass('disabled').show();
                                        //$('#dialog-restore-show').show();
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

    socket.emit('getState', adapter + '.' + instance + '.history.json', function (err, state) {
        if (state && state.val) {
            fillBackupJSON(JSON.parse(state.val));
        }
    });
    socket.on('stateChange', function (id, state) {
        if (id === 'backitup.' + instance + '.history.iobrokerLastTime') {
            if (state && state.val) {
                backupInfo(settings);
            }
        } else if (id === 'backitup.' + instance + '.history.ccuLastTime') {
            if (state && state.val) {
                backupInfo(settings);
            }
        } else if (id === 'backitup.' + instance + '.history.json') {
            if (state && state.val) {
                fillBackupJSON(JSON.parse(state.val));
            }
        }
    });

    $('.detect-backups').on('click', function () { initDialogBackups(); });

    showHideSettings(settings);
    onChange(false);

    setTimeout(() => {
        $('.load').hide();
        $('.loadFinish').fadeIn();
    }, 200);

    M.updateTextFields();  // function Materialize.updateTextFields(); to reinitialize all the Materialize labels on the page if you are dynamically adding inputs.

    initDialog();
}

function backupInfo(settings) {
    var text = '';
    socket.emit('getState', adapter + '.' + instance + '.history.iobrokerLastTime', function (err, state) {
        if (state && state.val && settings.minimalEnabled) {
            text += `<li class="next-last-backups"><b>${_('Last iobroker Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
        }
        socket.emit('getState', adapter + '.' + instance + '.history.ccuLastTime', function (err, state) {
            if (state && state.val && settings.ccuEnabled) {
                text += `<li class="next-last-backups"><b>${_('Last CCU Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
            }
            socket.emit('getState', adapter + '.' + instance + '.info.iobrokerNextTime', function (err, state) {
                if (state && state.val && settings.minimalEnabled) {
                    text += `<li class="next-last-backups"><b>${_('Next iobroker Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
                }
                socket.emit('getState', adapter + '.' + instance + '.info.ccuNextTime', function (err, state) {
                    if (state && state.val && settings.ccuEnabled) {
                        text += `<li class="next-last-backups"><b>${_('Next CCU Backup: ')}<br/></b><span class="system-info">${state.val}</span></li>`;
                    }
                    var $backups = $('.card-content-text');
                    $backups
                        .find('.fillBackups')
                        .html(text);
                });
            });
        });
    });
}

function fillBackupJSON(lastBackups) {
    var text = '';
    text += '<thead><tr style="background-color:#3399CC; color:#fff"><th>' + _('backup time') + '</th><th>' + _('Type') + '</th><th>' + _('name') + '</th><th>' + _('source type') + '</th><th>' + _('filesize') + '</th></tr></thead><tbody style="font-size:0.8rem">';
    if (lastBackups.length > 0) {
        for (var i in lastBackups) {
            text += `<tr><td>${lastBackups[i].date}</td><td>${lastBackups[i].type}</td><td>${lastBackups[i].name}</td><td>${lastBackups[i].storage}</td><td>${lastBackups[i].filesize}</td></tr>`;
        }
    }
    text += '</tbody>';
    var $popupBackups = $('.table-values-div');
    $popupBackups
        .find('.fillBackups')
        .html(text);
}

function initDialogBackups() {
    var $dialogBackups = $('#dialog-backups-show');
    if (!$dialogBackups.data('inited')) {
        $dialogBackups.data('inited', true);
        $dialogBackups.modal({
            dismissible: false
        });

        $dialogBackups.find('.detect-backups').on('click', function () {
            $dialogBackups = $('#dialog-backups-show');
        });
    }
    $dialogBackups.modal('open');
}

function initDialogRestore() {
    var $dialogRestore = $('#dialog-restore-show');
    if (!$dialogRestore.data('inited')) {
        $dialogRestore.data('inited', true);
        $dialogRestore.modal({
            dismissible: false
        });

        $dialogRestore.find('.do-list').on('click', function () {
            $dialogRestore = $('#dialog-restore-show');
        });
    }
    $dialogRestore.modal('open');
}

function fillBackupOptions(settings) {
    var _options = [];
    if (settings.jarvisEnabled) _options.push(_('Jarvis Backup'));
    if (settings.minimalEnabled) _options.push(_('ioBroker'));
    if (settings.ccuEnabled) _options.push(_('Homematic CCU backup'));
    if (settings.redisEnabled) _options.push(_('Save Redis state'));
    if (settings.javascriptsEnabled) _options.push(_('Javascripts Backup'));
    if (settings.zigbeeEnabled) _options.push(_('Save Zigbee database'));
    if (settings.yahkaEnabled) _options.push(_('Yahka (Homekit) Backup'));
    if (settings.historyEnabled) _options.push(_('Save History Data'));
    if (settings.influxDBEnabled) _options.push(_('InfluxDB Backup'));
    if (settings.mySqlEnabled) _options.push(_('MySql Backup'));
    if (settings.grafanaEnabled) _options.push(_('Grafana Backup'));
    var text = '';
    for (var i = 0; i < _options.length; i++) {
        text += `<li>${_options[i]}</li>`;
    }
    var $backupOptions = $('.card-content-text');
    $backupOptions
        .find('.fillBackupOptions')
        .html(text);
}

function fillStorageSelect(settings) {
    var selectName = [];
    var selectsetting = [];
    if (settings.cifsEnabled) selectName.push(_(`NAS (${_(settings.connectType)})`)), selectsetting.push('cifs');
    if (settings.ftpEnabled) selectName.push(_('FTP')), selectsetting.push('ftp');
    if (settings.dropboxEnabled) selectName.push(_('Dropbox')), selectsetting.push('dropbox');
    if (settings.googledriveEnabled) selectName.push(_('Google Drive')), selectsetting.push('googledrive');
    if (settings.webdavEnabled) selectName.push(_('WebDAV')), selectsetting.push('webdav');

    var id = settings.restoreSource
    var $sel = $('#restoreSource');
    $sel.html('<option value="local"' + (id === 'local' ? ' selected translate' : 'translate') + '>Local</option>');
    for (var i = 0; i < selectName.length; i++) {
        $('#restoreSource').append('<option value="' + selectsetting[i] + '"' + (id === selectsetting[i] ? ' selected translate' : 'translate') + '>' + selectName[i] + '</option>');
    }
    $sel.select();
}

function fillStorageOptions(settings) {
    var _options = [];
    if (settings.cifsEnabled) _options.push(_(`NAS (${settings.connectType})`));
    if (settings.ftpEnabled) _options.push(_('FTP'));
    if (settings.dropboxEnabled) _options.push(_('Dropbox'));
    if (settings.googledriveEnabled) _options.push(_('Google Drive'));
    if (settings.webdavEnabled) _options.push(_('WebDAV'));

    var text = '';
    for (var i = 0; i < _options.length; i++) {
        text += `<li>${_options[i]}</li>`;
    }
    var $storageOptions = $('.card-content-text');
    $storageOptions
        .find('.fillStorageOptions')
        .html(text);
}

function showHideSettings(settings) {
    if (settings.ccuEnabled) {
        $('.ccuBackup').show();
    } else {
        $('.ccuBackup').hide();
    }
    $('#restoreSource').on('change', function () {
        $('.doRestore').hide();
    }).trigger('change');

    $('.cloudRestore').hide();
}