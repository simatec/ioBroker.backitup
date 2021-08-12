// Backitup - Copyright (c) by simatec
// Please visit https://github.com/simatec/ioBroker.backitup for licence-agreement and further information

//Settings
var $dialogCommand = null;
var $output = null;
var $dialogCommandProgress;
var lastMessage = '';
function encrypt(key, value) {
    var result = '';
    for (var i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}
function decrypt(key, value) {
    var result = '';
    for (var i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function fetchMySqlConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.sql.', endkey: 'system.adapter.sql.\u9999', include_docs: true }, function (err, res) {
        var found = false;
        if (res && res.rows && res.rows.length) {
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[0].value.common;
                var native = res.rows[i].value.native;
                if (common.enabled && native.dbtype === 'mysql') {
                    $('#mySqlUser').val(native.user).trigger('change');
                    $('#mySqlPassword').val(native.password).trigger('change');
                    $('#mySqlHost').val(native.host).trigger('change');
                    $('#mySqlPort').val(native.port === '0' ? 3306 : native.port || 3306).trigger('change');
                    $('#mySqlName').val(native.dbname).trigger('change');
                    var id = res.rows[i].value.
                        found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    if (_native.dbtype === 'mysql') {
                        $('#mySqlUser').val(_native.user).trigger('change');
                        $('#mySqlPassword').val(_native.password).trigger('change');
                        $('#mySqlHost').val(_native.host).trigger('change');
                        $('#mySqlName').val(_native.dbname).trigger('change');
                        $('#mySqlPort').val(_native.port === '0' ? 3306 : native.port || 3306).trigger('change');
                        found = res.rows[j].value._id;
                        break;
                    }
                }
            }
        }
        if (found) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('Backitup Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('Backitup Warning!'), 'info');
        }
    });
}
function fetchPgSqlConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.sql.', endkey: 'system.adapter.sql.\u9999', include_docs: true }, function (err, res) {
        var found = false;
        if (res && res.rows && res.rows.length) {
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[0].value.common;
                var native = res.rows[i].value.native;
                if (common.enabled && native.dbtype === 'postgresql') {
                    $('#pgSqlUser').val(native.user).trigger('change');
                    $('#pgSqlPassword').val(native.password).trigger('change');
                    $('#pgSqlHost').val(native.host).trigger('change');
                    $('#pgSqlPort').val(native.port === '0' ? 5432 : native.port || 5432).trigger('change');
                    $('#pgSqlName').val(native.dbname).trigger('change');
                    var id = res.rows[i].value.
                        found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    if (_native.dbtype === 'postgresql') {
                        $('#pgSqlUser').val(_native.user).trigger('change');
                        $('#pgSqlPassword').val(_native.password).trigger('change');
                        $('#pgSqlHost').val(_native.host).trigger('change');
                        $('#pgSqlName').val(_native.dbname).trigger('change');
                        $('#pgSqlPort').val(_native.port === '0' ? 5432 : native.port || 5432).trigger('change');
                        found = res.rows[j].value._id;
                        break;
                    }
                }
            }
        }
        if (found) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('Backitup Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('Backitup Warning!'), 'info');
        }
    });
}
function fetchInfluxDBConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.influxdb.', endkey: 'system.adapter.influxdb.\u9999', include_docs: true }, function (err, res) {
        var found = false;
        if (res && res.rows && res.rows.length) {
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[0].value.common;
                var native = res.rows[i].value.native;
                if (common.enabled) {
                    $('#influxDBHost').val(native.host).trigger('change');
                    //$('#influxDBPort').val(native.port === '8086' ? 8086 : 8088 || 8088).trigger('change');
                    $('#influxDBName').val(native.dbname).trigger('change');
                    var id = res.rows[i].value.
                        found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    $('#influxDBHost').val(_native.host).trigger('change');
                    $('#influxDBName').val(_native.dbname).trigger('change');
                    //$('#influxDBPort').val(_native.port === '0' ? 8088 : native.port || 8088).trigger('change');
                    found = res.rows[j].value._id;
                    break;
                }
            }
        }
        if (found) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('Backitup Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('Backitup Warning!'), 'info');
        }
    });
}
function fetchCcuConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.hm-rpc.', endkey: 'system.adapter.hm-rpc.\u9999', include_docs: true }, function (err, res) {
        if (res && res.rows && res.rows.length) {
            var found = false;
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[i].value.common;
                if (common.enabled) {
                    var native = res.rows[i].value.native;
                    $('#ccuHost').val(native.homematicAddress).trigger('change');
                    $('#ccuUsehttps').prop('checked', native.useHttps);
                    found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    $('#ccuHost').val(_native.homematicAddress).trigger('change');
                    $('#ccuUsehttps').prop('checked', _native.useHttps);
                    found = res.rows[j].value._id;
                }
            }
        }
        if (found) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('Backitup Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('Backitup Warning!'), 'info');
        }
    });
}
function fetchHistoryConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.history.', endkey: 'system.adapter.history.\u9999', include_docs: true }, function (err, res) {
        if (res && res.rows && res.rows.length) {
            var found = false;
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[i].value.common;
                if (common.enabled) {
                    var native = res.rows[i].value.native;
                    $('#historyPath').val(native.storeDir).trigger('change');
                    found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    $('#historyPath').val(_native.storeDir).trigger('change');
                    found = res.rows[j].value._id;
                }
            }
        }
        if (found && native.storeDir == '' && _native.storeDir == '') {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('No Config found from %s', found), _('Backitup Information!'), 'info');
        } else if (found && (native.storeDir !== '' || _native.storeDir !== '')) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('Backitup Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('Backitup Warning!'), 'info');
        }
    });
}
function fetchJavascriptsConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.javascript.', endkey: 'system.adapter.javascript.\u9999', include_docs: true }, function (err, res) {
        let javaScriptPth;
        if (res && res.rows && res.rows.length) {
            var found = false;
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[i].value.common;
                if (common.enabled) {
                    var native = res.rows[i].value.native;
                    $('#javascriptsPath').val(native.mirrorPath).trigger('change');
                    javaScriptPth = native.mirrorPath;
                    found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    $('#javascriptsPath').val(_native.mirrorPath).trigger('change');
                    javaScriptPth = _native.mirrorPath;
                    found = res.rows[j].value._id;
                }
            }
        }
        if (found && javaScriptPth !== '') {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('Backitup Information!'), 'info');
        } else {
            !isInitial && showMessage(_("No config found. Please check the settings in the Javascript adapter"), _('Backitup Warning!'), 'info');
        }
    });
}
let ignoreMessage = [];

function cleanIgnoreMessage(name) {
    for (const i in ignoreMessage) {
        if (ignoreMessage[i] == name) {
            ignoreMessage.splice(i, 1);
            break;
        }
    }
}

function checkAdapterInstall(name, backitupHost) {
    let ignore = false;
    let adapterName = name;

    if (name == 'pgsql' || name == 'mysql') {
        adapterName = 'sql';
    }
    for (const i in ignoreMessage) {
        if (ignoreMessage[i] == name) {
            ignore = true;
            break;
        }
    }
    if (!ignore) {
        socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.' + adapterName + '.', endkey: 'system.adapter.' + adapterName + '.\u9999', include_docs: true }, function (err, res) {
            if (res && res.rows && res.rows.length) {
                for (var i = 0; i < res.rows.length; i++) {
                    var common = res.rows[i].value.common;
                    if (common.host !== backitupHost && (adapterName == 'zigbee' || adapterName == 'jarvis' || adapterName == 'history' || adapterName == 'javascript')) {
                        showMessage(_("No %s Instance found on this host. Please check your System", adapterName), _('Backitup Warning!'), 'info');
                        ignoreMessage.push(name);
                        break;
                    }
                }
            } else {
                showMessage(_("No %s Instance found. Please check your System", adapterName), _('Backitup Warning!'), 'info');
                ignoreMessage.push(name);
            }
        });
    }
}

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
    if (settings.redisEnabled === undefined) {
        settings.redisEnabled = adapter.config.backupRedis;
    }
    if (settings.cifsMount === 'CIFS') {
        settings.cifsMount = '';
    }
    $('.value').each(function () {
        var $key = $(this);
        var id = $key.attr('id');
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id]).on('change', function () {
                showHideSettings(settings);
                onChange();
            });
        } else {
            var val = settings[id];
            if (id === 'mySqlPassword' || id === 'pgSqlPassword' || id === 'webdavPassword' || id === 'ccuPassword' || id === 'ftpPassword' || id === 'cifsPassword' || id === 'grafanaPassword') {
                val = val ? decrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
            }
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(val).on('change', function () {
                onChange();
            }).on('keyup', function () {
                onChange();
            });
        }
    });
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
                    if (id === 'backitup.' + instance + '.oneClick.total') {
                        if (state && state.val) {
                            $('.btn-total').addClass('disabled');
                        } else {
                            $('.btn-total').removeClass('disabled');
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

            $('#testWebDAV').on('click', function () {
                getIsAdapterAlive(function (isAlive) {
                    if (!isAlive) {
                        showToast(null, _('Start or enable adapter first'));
                    } else {
                        $('#testWebDAV').addClass('disabled');
                        sendTo(null, 'testWebDAV', {
                            config: {
                                host: $('#webdavURL').val(),
                                username: $('#webdavUsername').val(),
                                password: $('#webdavPassword').val()
                            }
                        }, function (response) {
                            $('#testWebDAV').removeClass('disabled');
                            if (response.error) {
                                showError('Error: ' + response.error);
                            } else {
                                showMessage(_('The connection to the WebDAV server was established successfully.'), _('Backitup Information!'), 'info');
                            }
                        });
                    }
                });
            });

            $('.do-list').removeClass('disabled').on('click', function () {
                /*
                if (changed) {
                    showMessage(_('Save the configuration first'));
                    return;
                }
                */
                $('.do-list').addClass('disabled');
                $('#tab-restore').find('.root').html('');
                $('.doRestore').hide();
                $('.progress-search').show();
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

                            //text += '<li><div class="collapsible-header top">' + _(storageTyp) + '</div>';
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
                        $('.doRestore').show();
                        var $tabRestore = $('#tab-restore');
                        $tabRestore
                            .find('.root')
                            .html(text);
                        $tabRestore.find('.collapsible').collapsible();
                        $tabRestore.find('.do-restore').on('click', function () {
                            var type = $(this).data('type');
                            var file = $(this).data('file');
                            var name = file.split('/').pop().split('_')[0];

                            let message = ('<br/><br/>ioBroker will be restarted during restore.<br/><br/>Confirm with \"OK\".');
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
                                    message = ('<br/><br/>ioBroker will not be restarted for this restore.<br/><br/>Confirm with \"OK\".');
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
                                    $('#tab-restore').find('.do-restore').addClass('disabled').hide();

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
                                            //var name = file.split('/').pop().split('_')[0];
                                            //showDialog(name !== '' ? 'restore' : '', isStopped);
                                            //showToast(null, _('Restore started'));

                                            if (downloadPanel) {
                                                $('.cloudRestore').hide();
                                                downloadPanel = false;
                                            }
                                        }
                                        $('.do-list').removeClass('disabled');
                                        $('#tab-restore').find('.do-restore').removeClass('disabled').show();
                                    });
                                }
                            });
                        });
                    }
                });
            });

            $('.get-googledrive-json').removeClass('disabled').on('click', function () {
                $('.get-googledrive-json').addClass('disabled');
                sendTo(null, 'authGoogleDrive', null, function (obj) {
                    $('.get-googledrive-json').removeClass('disabled');
                    if (obj && obj.url) {
                        $('.get-googledrive-json').hide();
                        $('.get-googledrive-url').show();
                        $('.get-googledrive-code').show();
                        $('#get-googledrive-url').text(obj.url).attr('href', obj.url);
                        $('.get-googledrive-submit').show();
                    } else if (obj.error) {
                        showError(obj.error);
                    } else {
                        showError(_('No answer'));
                    }
                });
                $('.get-googledrive-submit').on('click', function () {
                    var code = $('#get-googledrive-code').val();
                    if (!code) {
                        return showError(_('No code entered'));
                    }
                    $('.get-googledrive-submit').addClass('disabled');
                    sendTo(null, 'authGoogleDrive', { code: code }, function (obj) {
                        $('.get-googledrive-submit').removeClass('disabled');
                        if (obj && obj.done) {
                            if ($('#googledriveAccessJson').val() !== obj.json) {
                                $('#googledriveAccessJson').val(obj.json);
                                onChange();
                            }

                            $('.get-googledrive-code').hide();
                            $('.get-googledrive-url').hide();
                            $('.get-googledrive-json').show();
                            $('.get-googledrive-json span').text(_('Renew Google Drive Access'));
                            $('#googledriveAccessJson_span').text(_('Present'));
                        } else if (obj && obj.error) {
                            showError(obj.error);
                        } else {
                            showError(_('No answer'));
                        }
                    });
                });
            });
        } else {
            $('.do-backup').addClass('disabled');
            $('.do-list').addClass('disabled');
            $('.get-googledrive-json').addClass('disabled');
        }
    });

    if (settings.googledriveAccessJson) {
        $('#googledriveAccessJson_span').text(_('Present'));
        $('.get-googledrive-json span').text(_('Renew Google Drive Access'));
    } else {
        $('#googledriveAccessJson_span').text(_('Not present'));
    }

    showHideSettings(settings);
    onChange(false);
    M.updateTextFields();  // function Materialize.updateTextFields(); to reinitialize all the Materialize labels on the page if you are dynamically adding inputs.
    getAdapterInstances('telegram', function (instances) {
        fillInstances('telegramInstance', instances, settings['telegramInstance']);
    });
    getAdapterInstances('whatsapp-cmb', function (instances) {
        fillInstances('whatsappInstance', instances, settings['whatsappInstance']);
    });

    getAdapterInstances('email', function (instances) {
        fillInstances('emailInstance', instances, settings['emailInstance']);
    });

    getAdapterInstances('pushover', function (instances) {
        fillInstances('pushoverInstance', instances, settings['pushoverInstance']);
    });

    if ($('#ccuEnabled').prop('checked') && !settings.ccuHost) {
        fetchCcuConfig(true);
    }
    if ($('#historyEnabled').prop('checked') && !settings.historyPath) {
        fetchHistoryConfig(true);
    }
    if ($('#javascriptsEnabled').prop('checked') && !settings.javascriptsPath) {
        fetchJavascriptsConfig(true);
    }
    if ($('#mySqlEnabled').prop('checked') && !settings.mySqlUser) {
        fetchMySqlConfig(true)
    }
    if ($('#pgSqlEnabled').prop('checked') && !settings.pgSqlUser) {
        fetchPgSqlConfig(true)
    }
    if ($('#influxDBEnabled').prop('checked') && !settings.influxDBName) {
        fetchInfluxDBConfig(true)
    }

    $('.detect-mysql').on('click', function () { fetchMySqlConfig() });
    $('.detect-pgsql').on('click', function () { fetchPgSqlConfig() });
    $('.detect-influxDB').on('click', function () { fetchInfluxDBConfig() });
    $('.detect-ccu').on('click', function () { fetchCcuConfig() });
    $('.detect-history').on('click', function () { fetchHistoryConfig() });
    $('.detect-javascripts').on('click', function () { fetchJavascriptsConfig() });

    sendTo(null, 'getTelegramUser', { config: { instance: settings.telegramInstance } }, function (obj) {
        fillTelegramUser(settings['telegramUser'], obj, settings.telegramInstance)
    });

    $('.timepicker').timepicker({
        "twelveHour": false
    });

    initDialog();
}

function fillTelegramUser(id, str, telegramInst) {
    var useUserName = false;

    if (telegramInst !== null) {
        socket.emit('getObject', `system.adapter.${telegramInst}`, function (err, obj) {
            if (obj && obj.native) {
                var native = obj.native;
                useUserName = native.useUsername;
            }
            var $sel = $('#telegramUser');
            $sel.html('<option value="allTelegramUsers">' + _('All Receiver') + '</option>');
            const userList = JSON.parse(str);
            if (useUserName) {
                for (const i in userList) {
                    $('#telegramUser').append('<option value="' + userList[i].userName + '"' + (id === userList[i].userName ? ' selected' : '') + '>' + userList[i].userName + '</option>');
                }
            } else {
                for (const i in userList) {
                    $('#telegramUser').append('<option value="' + userList[i].firstName + '"' + (id === userList[i].firstName ? ' selected' : '') + '>' + userList[i].firstName + '</option>');
                }
            }
            $sel.select();
        });
    } else {
        var $sel = $('#telegramUser');
        $sel.html('<option value="none">' + _('none') + '</option>');
        $sel.select();
    }
}

function fillInstances(id, arr, val) {
    var $sel = $('#' + id);
    $sel.html('<option value="">' + _('none') + '</option>');
    for (var i = 0; i < arr.length; i++) {
        var _id = arr[i]._id.replace('system.adapter.', '');
        // Take first value
        //            if (!val) val = _id;
        $sel.append('<option value="' + _id + '"' + (_id === val ? ' selected' : '') + '>' + _id + '</option>');
    }
    $sel.select();
}
function save(callback) {
    var obj = {};
    $('.value').each(function () {
        var $this = $(this);
        var id = $this.attr('id');
        if ($this.attr('type') === 'checkbox') {
            obj[id] = $this.prop('checked');
        } else {
            var val = $this.val();
            if (id === 'mySqlPassword' || id === 'pgSqlPassword' || id === 'webdavPassword' || id === 'ccuPassword' || id === 'ftpPassword' || id === 'cifsPassword' || id === 'grafanaPassword') {
                val = val ? encrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
            }
            obj[id] = val;
        }
    });
    callback(obj);
    
}
function showHideSettings(settings) {
    if ($('#ftpEnabled').prop('checked')) {
        $('.ftp').show();
        if ($('#ftpOwnDir').prop('checked')) {
            $('.ftp-extra').show();
            $('.ftp-standard').hide();
        } else {
            $('.ftp-extra').hide();
            $('.ftp-standard').show();
        }
    } else {
        $('.ftp').hide();
    }
    if ($('#cifsEnabled').prop('checked')) {
        $('.cifs').show();
        if ($('#cifsOwnDir').prop('checked')) {
            $('.cifs-extra').show();
            $('.cifs-standard').hide();
        } else {
            $('.cifs-extra').hide();
            $('.cifs-standard').show();
        }
    } else {
        $('.cifs').hide();
    }

    if ($('#wakeOnLAN').prop('checked')) {
        $('.wol').show();
    } else {
        $('.wol').hide();
    }

    if ($('#dropboxOwnDir').prop('checked')) {
        $('.dropbox-extra').show();
        $('.dropbox-standard').hide();
    } else {
        $('.dropbox-extra').hide();
        $('.dropbox-standard').show();
    }
    if ($('#webdavOwnDir').prop('checked')) {
        $('.webDAV-extra').show();
        $('.webDAV-standard').hide();
    } else {
        $('.webDAV-extra').hide();
        $('.webDAV-standard').show();
    }
    if ($('#googledriveOwnDir').prop('checked')) {
        $('.googledrive-extra').show();
        $('.googledrive-standard').hide();
    } else {
        $('.googledrive-extra').hide();
        $('.googledrive-standard').show();
    }
    if ($('#redisEnabled').prop('checked')) {
        $('.redis_path').show();
    } else {
        $('.redis_path').hide();
    }
    if ($('#historyEnabled').prop('checked')) {
        $('.history_path').show();
    } else {
        $('.history_path').hide();
    }
    if ($('#javascriptsEnabled').prop('checked')) {
        $('.javascripts_path').show();
    } else {
        $('.javascripts_path').hide();
    }
    if ($('#telegramEnabled').prop('checked')) {
        $('.telegram_inst').show();
    } else {
        $('.telegram_inst').hide();
    }
    if ($('#minimalEnabled').prop('checked')) {
        $('.tab-iobroker-backup').show();
    } else {
        $('.tab-iobroker-backup').hide();
    }
    if ($('#ccuEnabled').prop('checked')) {
        $('.tab-ccu-backup').show();
    } else {
        $('.tab-ccu-backup').hide();
    }
    if ($('#mySqlEnabled').prop('checked')) {
        $('.mysql').show();
    } else {
        $('.mysql').hide();
    }
    if ($('#pgSqlEnabled').prop('checked')) {
        $('.pgsql').show();
    } else {
        $('.pgsql').hide();
    }
    if ($('#influxDBEnabled').prop('checked')) {
        $('.influxDB').show();
    } else {
        $('.influxDB').hide();
    }
    var minimal = $('#minimalEnabled').prop('checked');
    if (minimal) {
        $('.minimal').show();
    } else {
        $('.minimal').hide();
    }
    var total = $('#totalEnabled').prop('checked');
    if (total) {
        $('.total').show();
    } else {
        $('.total').hide();
    }
    $('#connectType').on('change', function () {
        if ($(this).val() === 'NFS') {
            $('.nfs').hide();
            $('.copy').show();
        } else if ($(this).val() === 'CIFS') {
            $('.nfs').show();
            $('.copy').show();
        } else if ($(this).val() === 'Copy') {
            $('.nfs').hide();
            $('.copy').hide();
        }
    }).trigger('change');

    $('#influxDBType').on('change', function () {
        if ($(this).val() === 'remote') {
            $('.influxRemote').show();
            $('.influxLocal').hide();
        } else if ($(this).val() === 'local') {
            $('.influxRemote').hide();
            $('.influxLocal').show();
        }
    }).trigger('change');

    $('#restoreSource').on('change', function () {
            $('.doRestore').hide();
    }).trigger('change');

    $('#notificationsType').on('change', function () {
        if ($(this).val() === 'Telegram') {
            $('.email').hide();
            $('.pushover').hide();
            $('.telegram').show();
            $('.whatsapp').hide();
        } else if ($(this).val() === 'E-Mail') {
            $('.email').show();
            $('.telegram').hide();
            $('.pushover').hide();
            $('.whatsapp').hide();
        } else if ($(this).val() === 'Pushover') {
            $('.pushover').show();
            $('.telegram').hide();
            $('.email').hide();
            $('.whatsapp').hide();
        } else if ($(this).val() === 'WhatsApp') {
            $('.whatsapp').show();
            $('.telegram').hide();
            $('.email').hide();
            $('.pushover').hide();
        }
    }).trigger('change');

    if ($('#notificationEnabled').prop('checked')) {
        $('.tab-notification').show();
    } else {
        $('.tab-notification').hide();
    }
    if ($('#mySqlEnabled').prop('checked')) {
        checkAdapterInstall('mysql', common.host);
        $('.tab-my-sql').show();
    } else {
        $('.tab-my-sql').hide();
        cleanIgnoreMessage('mysql');
    }
    if ($('#pgSqlEnabled').prop('checked')) {
        checkAdapterInstall('pgsql', common.host);
        $('.tab-pg-sql').show();
    } else {
        $('.tab-pg-sql').hide();
        cleanIgnoreMessage('pgsql');
    }
    if ($('#influxDBEnabled').prop('checked')) {
        checkAdapterInstall('influxdb', common.host);
        $('.tab-influxdb').show();
    } else {
        $('.tab-influxDB').hide();
        cleanIgnoreMessage('influxdb');
    }
    if ($('#redisEnabled').prop('checked')) {
        $('.tab-redis').show();
    } else {
        $('.tab-redis').hide();
    }
    if ($('#historyEnabled').prop('checked')) {
        checkAdapterInstall('history', common.host);
        $('.tab-history').show();
    } else {
        $('.tab-history').hide();
        cleanIgnoreMessage('history');
    }
    if ($('#dropboxEnabled').prop('checked')) {
        $('.tab-dropbox').show();
    } else {
        $('.tab-dropbox').hide();
    }
    if ($('#googledriveEnabled').prop('checked')) {
        $('.tab-googledrive').show();
    } else {
        $('.tab-googledrive').hide();
    }
    if ($('#cifsEnabled').prop('checked')) {
        $('.tab-cifs').show();
    } else {
        $('.tab-cifs').hide();
    }
    if ($('#ftpEnabled').prop('checked')) {
        $('.tab-ftp').show();
    } else {
        $('.tab-ftp').hide();
    }
    if ($('#webdavEnabled').prop('checked')) {
        $('.tab-webDAV').show();
    } else {
        $('.tab-webDAV').hide();
    }
    if ($('#grafanaEnabled').prop('checked')) {
        $('.tab-grafana').show();
    } else {
        $('.tab-grafana').hide();
    }
    if ($('#javascriptsEnabled').prop('checked')) {
        checkAdapterInstall('javascript', common.host);
        $('.tab-javascripts').show();
    } else {
        $('.tab-javascripts').hide();
        cleanIgnoreMessage('javascript');
    }
    if ($('#zigbeeEnabled').prop('checked')) {
        checkAdapterInstall('zigbee', common.host);
    } else {
        cleanIgnoreMessage('zigbee');
    }
    if ($('#jarvisEnabled').prop('checked')) {
        checkAdapterInstall('jarvis', common.host);
    } else {
        cleanIgnoreMessage('jarvis');
    }
    $('#telegramInstance').on('change', function () {
        let telegramInst = $(this).val();
        if (telegramInst && telegramInst.length >= 10) {
            sendTo(null, 'getTelegramUser', { config: { instance: $(this).val() } }, function (obj) {
                fillTelegramUser(settings['telegramUser'], obj, telegramInst);
            });
        } else {
            fillTelegramUser(settings['telegramUser'], null, null);
        }
    }).trigger('change');

    $('.cloudRestore').hide();
}