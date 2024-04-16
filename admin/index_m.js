// ioBroker.backitup - Copyright (c) by simatec
// Please visit https://github.com/simatec/ioBroker.backitup for licence-agreement and further information

//Settings
var $dialogCommand = null;
var $dialogDownload = null;
var $output = null;
var $dialogCommandProgress;
var lastMessage = '';
var restoreIfWait = 5000;
var storageTyp = '';

var oldJavascriptsEnabled;
var oldZigbeeEnabled;
var oldZigbee2MQTTEnabled;
var oldesphomeEnabled;
var oldNoderedEnabled;
var oldJarvisEnabled;
var oldHistoryEnabled;
var oldYahkaEnabled;

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

function initDialogDownload() {
    $dialogDownload = $('#dialog-download');
    if (!$dialogDownload.data('inited')) {
        $dialogDownload.data('inited', true);
        $dialogDownload.modal({
            dismissible: false
        });
    }
    $dialogDownload.modal('open');
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
            !isInitial && showMessage(_('Config taken from %s', found), _('BackItUp Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('BackItUp Warning!'), 'info');
        }
    });
}
function fetchSqliteConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.sql.', endkey: 'system.adapter.sql.\u9999', include_docs: true }, function (err, res) {
        var found = false;
        if (res && res.rows && res.rows.length) {
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[0].value.common;
                var native = res.rows[i].value.native;
                if (common.enabled && native && native.dbtype === 'sqlite' && native.fileName) {
                    const pathLenght = native.fileName.split('/');
                    $('#sqlitePath').val(pathLenght > 1 ? native.fileName : `/opt/iobroker/iobroker-data/sqlite/${native.fileName}`).trigger('change');
                    var id = res.rows[i].value.
                        found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    if (_native && _native.dbtype === 'sqlite' && _native.fileName) {
                        const pathLenght = _native.fileName.split('/');
                    $('#sqlitePath').val(pathLenght > 1 ? _native.fileName : `/opt/iobroker/iobroker-data/sqlite/${_native.fileName}`).trigger('change');
                        found = res.rows[j].value._id;
                        break;
                    }
                }
            }
        }
        if (found) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('BackItUp Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('BackItUp Warning!'), 'info');
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
            !isInitial && showMessage(_('Config taken from %s', found), _('BackItUp Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('BackItUp Warning!'), 'info');
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
                    $('#influxDBVersion').val(native.dbversion).trigger('change');
                    $('#influxDBVersion').select();
                    $('#influxDBProtocol').val(native.protocol).trigger('change');
                    $('#influxDBProtocol').select();
                    $('#influxDBName').val(native.dbname).trigger('change');

                    if (native.port && native.dbversion && native.dbversion == '2.x') {
                        $('#influxDBPort').val(native.port).trigger('change');
                    }

                    var id = res.rows[i].value.
                        found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    $('#influxDBHost').val(_native.host).trigger('change');
                    $('#influxDBVersion').val(_native.dbversion).trigger('change');
                    $('#influxDBVersion').select();
                    $('#influxDBProtocol').val(_native.protocol).trigger('change');
                    $('#influxDBProtocol').select();
                    $('#influxDBName').val(_native.dbname).trigger('change');

                    if (_native.port && _native.dbversion && _native.dbversion == '2.x') {
                        $('#influxDBPort').val(_native.port).trigger('change');
                    }

                    found = res.rows[j].value._id;
                    break;
                }
            }
        }
        if (found) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('BackItUp Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('BackItUp Warning!'), 'info');
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
            !isInitial && showMessage(_('Config taken from %s', found), _('BackItUp Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('BackItUp Warning!'), 'info');
        }
    });
}
function fetchHistoryConfig(isInitial) {
    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.history.', endkey: 'system.adapter.history.\u9999', include_docs: true }, function (err, res) {
        let storeDir = '';
        if (res && res.rows && res.rows.length) {
            var found = false;
            for (var i = 0; i < res.rows.length; i++) {
                var common = res.rows[i].value.common;
                if (common.enabled) {
                    var native = res.rows[i].value.native;
                    $('#historyPath').val(native.storeDir != '' && !native.storeDir.startsWith('/opt/iobroker/backups') ? native.storeDir : '/opt/iobroker/iobroker-data/history').trigger('change');
                    storeDir = native.storeDir;
                    found = res.rows[i].value._id;
                    break;
                }
            }
            if (!found) {
                for (var j = 0; j < res.rows.length; j++) {
                    var _native = res.rows[j].value.native;
                    $('#historyPath').val(_native.storeDir != '' && !_native.storeDir.startsWith('/opt/iobroker/backups') ? _native.storeDir : '/opt/iobroker/iobroker-data/history').trigger('change');
                    storeDir = _native.storeDir;
                    found = res.rows[j].value._id;
                }
            }
        }

        if (found && storeDir == '') {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('<br/><br/>No storage path of %s is configured.<br/>The default path of the history adapter has been set.', found), _('BackItUp Information!'), 'info');
        } else if (found && storeDir !== '' && storeDir.startsWith('/opt/iobroker/backups')) {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('<br/><br/>The storage path of %s must not be identical to the path for backups.<br/>The default path of the history adapter has been set.<br/><br/>Please change the path in the history adapter!', found), _('BackItUp Information!'), 'info');
        } else if (found && storeDir !== '') {
            M.updateTextFields();
            found = found.substring('system.adapter.'.length);
            !isInitial && showMessage(_('Config taken from %s', found), _('BackItUp Information!'), 'info');
        } else {
            !isInitial && showMessage(_('No config found'), _('BackItUp Warning!'), 'info');
        }
    });
}

var ignoreMessage = [];

function cleanIgnoreMessage(name) {
    for (const i in ignoreMessage) {
        if (ignoreMessage[i] == name) {
            ignoreMessage.splice(i, 1);
            break;
        }
    }
}

function checkAdapterInstall(name, backitupHost) {
    var ignore = false;
    var adapterName = name;

    if (name == 'pgsql' || name == 'mysql' || name == 'sqlite') {
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

                    if (common.host !== backitupHost && (adapterName == 'zigbee' || adapterName == 'esphome' || adapterName == 'zigbee2mqtt' || adapterName == 'node-red' || adapterName == 'yahka' || adapterName == 'jarvis' || adapterName == 'history')) {
                        showMessage(_("No %s Instance found on this host. Please check your System", adapterName), _('BackItUp Warning!'), 'info');
                        ignoreMessage.push(name);
                        break;
                    }
                }
            } else if (res.rows.length == 0 && (adapterName == 'zigbee' || adapterName == 'esphome' || adapterName == 'zigbee2mqtt' || adapterName == 'node-red' || adapterName == 'yahka' || adapterName == 'jarvis' || adapterName == 'history')) {
                showMessage(_("No %s Instance found on this host. Please check your System", adapterName), _('BackItUp Warning!'), 'info');
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

    $('.timepicker').timepicker({
        twelveHour: false
    });

    oldJavascriptsEnabled = settings.javascriptsEnabled;
    oldZigbeeEnabled = settings.zigbeeEnabled;
    oldesphomeEnabled = settings.esphomeEnabled;
    oldZigbee2MQTTEnabled = settings.zigbee2mqttEnabled;
    oldNoderedEnabled = settings.noderedEnabled;
    oldJarvisEnabled = settings.jarvisEnabled;
    oldHistoryEnabled = settings.historyEnabled;
    oldYahkaEnabled = settings.yahkaEnabled;

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
            if (id === 'mySqlPassword' || id === 'pgSqlPassword' || id === 'webdavPassword' || id === 'ccuPassword' || id === 'ftpPassword' || id === 'cifsPassword' || id === 'grafanaPassword' || id === 'redisPassword') {
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

    sendTo(null, 'getFileSystemInfo', null, function (obj) {
        if (obj && obj.diskState && obj.storage && obj.diskFree) {

            if (obj.diskState === 'warn' && obj.storage === 'local') {
                showMessage(_('<br/><br/><br/> On the host only %s MB free space is available! Please check your system!', obj.diskFree), _('BackItUp Information!'), 'info');
            } else if (obj.diskState === 'error' && obj.storage === 'local') {
                showMessage(_('<br/><br/><br/> On the host only %s MB free space is available! Local backups are currently not possible. <br/><br/>Please check your system!', obj.diskFree), _('BackItUp Information!'), 'warning');
            }
        }
    });

    sendTo(null, 'getSystemInfo', null, function (obj) {
        if (obj && obj.systemOS === 'docker' && obj.dockerDB === false) {
            var $influxDBEnabled = $('#influxDBEnabled');
            var $mySqlEnabled = $('#mySqlEnabled');
            var $sqliteEnabled = $('#sqliteEnabled');
            var $pgSqlEnabled = $('#pgSqlEnabled');
            var $startAllRestore = $('#startAllRestore');

            $('#influxDBEnabled').prop('checked', false);
            $('#mySqlEnabled').prop('checked', false);
            $('#sqliteEnabled').prop('checked', false);
            $('#pgSqlEnabled').prop('checked', false);
            $('#startAllRestore').prop('checked', false);

            $('#influxDBEnabled').prop('disabled', true);
            $('#mySqlEnabled').prop('disabled', true);
            $('#sqliteEnabled').prop('disabled', true);
            $('#pgSqlEnabled').prop('disabled', true);
            $('#startAllRestore').prop('disabled', true);

            $influxDBEnabled.addClass('disabled');
            $mySqlEnabled.addClass('disabled');
            $sqliteEnabled.addClass('disabled');
            $pgSqlEnabled.addClass('disabled');
            $startAllRestore.addClass('disabled');

            // enable only Redis Remote Backup
            $('.redisDocker').hide();
            $('.redisRemote').show();
            $('.redisLocal').hide();

            if ($('#redisType').val() != 'remote' && $('#redisEnabled').prop('checked')) {
                $('#redisType').val('remote').trigger('change');
                $('#redisType').select();
            }
        }

        if (obj && obj.systemOS === 'docker') {
            restoreIfWait = 10000;
        } else if (obj && obj.systemOS === 'win') {
            restoreIfWait = 18000;
        }
    });

    ccuEvents = settings.ccuEvents || [];
    influxDBEvents = settings.influxDBEvents || [];
    mySqlEvents = settings.mySqlEvents || [];
    pgSqlEvents = settings.pgSqlEvents || [];

    if (pgSqlEvents && pgSqlEvents.length) {
        for (var i = 0; i < pgSqlEvents.length; i++) {
            var val = pgSqlEvents[i].pass ? pgSqlEvents[i].pass : '';
            pgSqlEvents[i].pass = val ? decrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
        }
    }

    if (mySqlEvents && mySqlEvents.length) {
        for (var i = 0; i < mySqlEvents.length; i++) {
            var val = mySqlEvents[i].pass ? mySqlEvents[i].pass : '';
            mySqlEvents[i].pass = val ? decrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
        }
    }

    if (ccuEvents && ccuEvents.length) {
        for (var i = 0; i < ccuEvents.length; i++) {
            var val = ccuEvents[i].pass ? ccuEvents[i].pass : '';
            ccuEvents[i].pass = val ? decrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
        }
    }

    values2table('ccuEvents', ccuEvents, onChange);
    values2table('influxDBEvents', influxDBEvents, onChange, tableOnReady);
    values2table('mySqlEvents', mySqlEvents, onChange);
    values2table('pgSqlEvents', pgSqlEvents, onChange);

    $('#ccuAdded').on('click', function () {
        var devices = table2values('ccuEvents');
        var id = 0;
        for (var i = 0; i < devices.length; i++) {
            id++;
        }
        setTimeout(function () {
            $('#ccuEvents .values-input[data-name="nameSuffix"][data-index="' + id + '"]').val(`CCU-${id + 1}`).trigger('change');
        }, 250);
    });

    $('#influxDBAdded').on('click', function () {
        var devices = table2values('influxDBEvents');
        var id = 0;
        for (var i = 0; i < devices.length; i++) {
            id++;
        }
        setTimeout(function () {
            $('#influxDBEvents .values-input[data-name="port"][data-index="' + id + '"]').val(8088).trigger('change');
            $('#influxDBEvents .values-input[data-name="nameSuffix"][data-index="' + id + '"]').val(`influxDB-${id + 1}`).trigger('change');
            $('#influxDBEvents .values-input[data-name="protocol"][data-index="' + id + '"]').val('http').trigger('change');
            $('#influxDBEvents .values-input[data-name="dbversion"][data-index="' + id + '"]').val('1.x').trigger('change');
        }, 250);
    });

    function tableOnReady() {
        $('#influxDBEvents .table-values-div .table-values .values-input[data-name="dbversion"]').on('change', function () {
            let id = $(this).data('index');
            var dbversion = $('#influxDBEvents .values-input[data-name="dbversion"][data-index="' + id + '"]').val();

            if (dbversion == '1.x') {
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').prop('disabled', true).trigger('change');
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').addClass('hiddenToken').trigger('change');
                $('#influxDBEvents .values-input[data-name="port"][data-index="' + id + '"]').val(8088).trigger('change');
            } else {
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').prop('disabled', false).trigger('change');
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').removeClass('hiddenToken').trigger('change');
                $('#influxDBEvents .values-input[data-name="port"][data-index="' + id + '"]').val(8086).trigger('change');
            }
        });

        var devices = table2values('influxDBEvents');
        id = 0;

        for (var i = 0; i < devices.length; i++) {
            var dbversion = $('#influxDBEvents .values-input[data-name="dbversion"][data-index="' + id + '"]').val();

            if (dbversion == '1.x') {
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').prop('disabled', true).trigger('change');
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').addClass('hiddenToken').trigger('change');
            } else {
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').prop('disabled', false).trigger('change');
                $('#influxDBEvents .values-input[data-name="token"][data-index="' + id + '"]').removeClass('hiddenToken').trigger('change');
            }
            id++;
        }
    }

    $('#mySqlAdded').on('click', function () {
        var devices = table2values('mySqlEvents');
        var id = 0;
        for (var i = 0; i < devices.length; i++) {
            id++;
        }
        setTimeout(function () {
            $('#mySqlEvents .values-input[data-name="port"][data-index="' + id + '"]').val(3306).trigger('change');
            $('#mySqlEvents .values-input[data-name="nameSuffix"][data-index="' + id + '"]').val(`mySqlDB-${id + 1}`).trigger('change');
        }, 250);
    });

    $('#pgSqlAdded').on('click', function () {
        var devices = table2values('pgSqlEvents');
        var id = 0;
        for (var i = 0; i < devices.length; i++) {
            id++;
        }
        setTimeout(function () {
            $('#pgSqlEvents .values-input[data-name="port"][data-index="' + id + '"]').val(5432).trigger('change');
            $('#pgSqlEvents .values-input[data-name="nameSuffix"][data-index="' + id + '"]').val(`pgSqlDB-${id + 1}`).trigger('change');
        }, 250);
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
            if (settings.ftpEnabled === false && settings.dropboxEnabled === false && settings.onedriveEnabled === false && settings.cifsEnabled === false && settings.googledriveEnabled === false && settings.webdavEnabled === false) {
                showMessage(_("<br/><br/>According to the BackItUp settings, backups are currently stored in the same local file system that is the source of the backup can be accessed more. <br/> <br/>It is recommended to use an external storage space as a backup target."), _('BackItUp Information!'), 'info');
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
                                password: $('#webdavPassword').val(),
                                signedCertificates: $('#webdavSignedCertificates').prop('checked') ? true : false
                            }
                        }, function (response) {
                            $('#testWebDAV').removeClass('disabled');
                            if (response.error) {
                                showError('Error: ' + response.error);
                            } else {
                                showMessage(_('The connection to the WebDAV server was established successfully.'), _('BackItUp Information!'), 'info');
                            }
                        });
                    }
                });
            });

            $('.do-list').removeClass('disabled').on('click', function () {
                $('.do-list').addClass('disabled');
                $('#tab-restore').find('.root').html('');
                $('.doRestore').hide();
                $('.search-ready').hide();
                $('.search-error').hide();
                $('.progress-search').show();
                console.log('Restore Type: ' + $('#restoreSource').val());
                sendTo(null, 'list', $('#restoreSource').val(), function (result) {
                    $('.do-list').removeClass('disabled');
                    console.log(result);
                    if (result && result.error) {
                        $('.progress-search').hide();
                        $('.search-error').show();
                        showError(JSON.stringify(result.error));
                    }
                    if (result && result.data) {
                        $('.progress-search').hide();
                        $('.search-ready').show();
                        var text = '';
                        var data = result.data;
                        console.log(data);
                        for (var type in data) {
                            if (!data.hasOwnProperty(type)) continue;

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
                                case 'onedrive':
                                    storageTyp = 'Onedrive';
                                    break;
                                case 'ftp':
                                    storageTyp = 'FTP';
                                    break;
                                case 'googledrive':
                                    storageTyp = 'Google Drive';
                                    break;
                            }

                            text += `<li><div class="collapsible-header top"><i class="material-icons">expand_more</i><h6>${_(storageTyp)}</h6></div>`;
                            text += `<ul class="collapsible-body collection head">`;
                            for (var storage in data[type]) {
                                if (data[type].hasOwnProperty(storage)) {
                                    text += `<ul class="collapsible"><li><div class="collapsible-header"><i class="material-icons">expand_more</i><h6>${storage.toUpperCase()}</h6></div>`;
                                    text += `<ul class="collapsible-body collection">`;
                                    for (var i = data[type][storage].length - 1; i >= 0; i--) {
                                        text += `<li title="${_('source type')}: ${_(storageTyp)}\n${_('Type')}: ${storage.charAt(0).toUpperCase() + storage.slice(1)}\n${_('backup time')}: ${getName(data[type][storage][i].name)}\n${_('filesize')}: ${getSize(data[type][storage][i].size)}\n\n${_('name')}:\n${data[type][storage][i].name}" class="collection-item">`;
                                        text += `<div>${_('backup time')}: ${getName(data[type][storage][i].name)} | ${_('filesize')}: ${getSize(data[type][storage][i].size)}`;
                                        text += `<a class="btn-floating secondary-content do-restore" style="height: 32.4px!important; width: 32.4px!important;" title="${_('Restore Backup File')}" data-file="${data[type][storage][i].path}" data-type="${type}"><i style="line-height: 32.4px;" class="material-icons">restore</i></a>`;
                                        text += `<a class="btn-floating secondary-content do-download" style="height: 32.4px!important; width: 32.4px!important;" title="${_('Download Backup File')}" data-file="${data[type][storage][i].path}" data-type="${type}"><i style="line-height: 32.4px;" class="material-icons">file_download</i></a>`;
                                        text += `</div></li>`;
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

                            var message = _('<br/><br/>ioBroker will be restarted during restore.<br/><br/>Confirm with \"OK\".');
                            var downloadPanel = false;
                            if ($('#restoreSource').val() === 'dropbox' || $('#restoreSource').val() === 'onedrive' || $('#restoreSource').val() === 'googledrive' || $('#restoreSource').val() === 'ftp' || $('#restoreSource').val() === 'webdav') {
                                message = _('<br/><br/>1. Confirm with "OK" and the download begins. Please wait until the download is finished!<br/><br/>2. After download ioBroker will be restarted during restore.');
                                downloadPanel = true;
                            }
                            var isStopped = false;
                            if (file.search('grafana') == -1 &&
                                file.search('jarvis') == -1 &&
                                file.search('javascripts') == -1 &&
                                file.search('mysql') == -1 &&
                                file.search('sqlite') == -1 &&
                                file.search('influxDB') == -1 &&
                                file.search('pgsql') == -1 &&
                                file.search('zigbee') == -1 &&
                                file.search('esphome') == -1 &&
                                file.search('zigbee2mqtt') == -1 &&
                                file.search('nodered') == -1 &&
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

                                    $('.do-list').addClass('disabled');
                                    $('#tab-restore').find('.do-restore').addClass('disabled').hide();
                                    $('#tab-restore').find('.do-download').addClass('disabled').hide();

                                    var name = file.split('/').pop().split('_')[0];
                                    showDialog(name !== '' ? 'restore' : '', isStopped);
                                    showToast(null, _('Restore started'));
                                    let theme;
                                    try {
                                        theme = currentTheme();
                                    } catch (e) {
                                        // Ignore
                                    }

                                    sendTo(null, 'restore', { type: type, fileName: file, currentTheme: theme || 'none', currentProtocol: location.protocol, stopIOB: isStopped }, function (result) {
                                        if (!result || result.error) {
                                            showError('Error: ' + JSON.stringify(result.error));
                                        } else {
                                            console.log('Restore finish!')
                                            if (isStopped) {
                                                var restoreURL = `${location.protocol}//${location.hostname}:8091/backitup-restore.html`;
                                                console.log('Restore Url: ' + restoreURL);
                                                setTimeout(() => window.open(restoreURL, '_self'), restoreIfWait);
                                                //setTimeout(() => $('<a href="' + restoreURL + '">&nbsp;</a>')[0].click(), restoreIfWait);
                                            }

                                            if (downloadPanel) {
                                                $('.cloudRestore').hide();
                                                downloadPanel = false;
                                            }
                                        }
                                        $('.do-list').removeClass('disabled');
                                        $('#tab-restore').find('.do-restore').removeClass('disabled').show();
                                        $('#tab-restore').find('.do-download').removeClass('disabled').show();
                                    });
                                }
                            });
                        });

                        $tabRestore.find('.do-download').on('click', function () {
                            var type = $(this).data('type');
                            var file = $(this).data('file');

                            type = type == 'nas / copy' ? 'cifs' : type;

                            $('.downloadFinish').hide();
                            $('.downloadError').hide();
                            $('.downloadProgress').show();
                            $('.do-list').addClass('disabled');
                            $('#tab-restore').find('.do-restore').addClass('disabled').hide();
                            $('#tab-restore').find('.do-download').addClass('disabled').hide();
                            $('#backupDownload_name').text(` "${file.split(/[\\/]/).pop()}" `);
                            $('#backupDownload_source').text(_(storageTyp));

                            initDialogDownload();

                            sendTo(null, 'getFile', { type: type, fileName: file, protocol: location.protocol }, function (result) {
                                if (!result || result.error) {
                                    $dialogDownload.modal('close');
                                    showError('<br/><br/>Error:<br/><br/>' + JSON.stringify(result.error));
                                } else {
                                    console.log('Download finish!')

                                    const downloadLink = document.createElement('a');
                                    downloadLink.setAttribute('href', `${location.protocol}//${location.hostname}:${result.listenPort}/${result.fileName ? result.fileName : file.split(/[\\/]/).pop()}`);

                                    downloadLink.style.display = 'none';
                                    document.body.appendChild(downloadLink);

                                    try {
                                        downloadLink.download = file.split(/[\\/]/).pop();
                                        downloadLink.click();
                                        document.body.removeChild(downloadLink);
                                    } catch (e) {
                                        console.error(`Cannot access download: ${e}`);
                                        window.alert(_('Unfortunately your browser does not support this feature'));
                                        $('.downloadProgress').hide();
                                        $('.downloadError').show();
                                    }

                                    sendTo(null, 'serverClose', { downloadFinish: true }, function (result) {
                                        if (result && result.serverClose) {
                                            $('.downloadProgress').hide();
                                            $('.downloadFinish').show();
                                            setTimeout(() => $dialogDownload.modal('close'), 5000);
                                        }
                                    });
                                }
                                $('.do-list').removeClass('disabled');
                                $('#tab-restore').find('.do-restore').removeClass('disabled').show();
                                $('#tab-restore').find('.do-download').removeClass('disabled').show();
                            });
                        });
                    }
                });
            });

            // Dropbox Settings
            $('.get-dropbox-json').removeClass('disabled').on('click', function () {
                $('.get-dropbox-json').addClass('disabled');
                sendTo(null, 'authDropbox', null, function (obj) {
                    if (obj && obj.url && obj.code_challenge) {
                        const url = `${obj.url}&code_challenge=${obj.code_challenge}`;

                        $('.get-dropbox-json').addClass('disabled');
                        $('.get-dropbox-json').hide();
                        $('.get-dropbox-url').show();
                        $('.get-dropbox-code').show();
                        $('#get-dropbox-url').text(url).attr('href', url);
                        $('.get-dropbox-submit').show();

                        if ($('#dropboxCodeChallenge').val() !== obj.code_challenge) {
                            $('#dropboxCodeChallenge').val(obj.code_challenge);
                            onChange();
                        }
                    } else {
                        return showError(_('No Userdata entered'));
                    }
                });
            });

            $('.get-dropbox-submit').on('click', function () {
                var code = $('#get-dropbox-code').val();
                var codeChallenge = $('#dropboxCodeChallenge').val();

                if (!code || !codeChallenge) {
                    return showError(_('No code entered'));
                }

                $('.get-dropbox-submit').addClass('disabled');

                sendTo(null, 'authDropbox', { code: code, codeChallenge: codeChallenge }, function (obj) {
                    $('.get-dropbox-json').removeClass('disabled');
                    if (obj && obj.done) {
                        if ($('#dropboxAccessJson').val() !== obj.json) {
                            $('#dropboxAccessJson').val(obj.json);
                            onChange();
                        }

                        $('.get-dropbox-code').hide();
                        $('.get-dropbox-url').hide();
                        $('.get-dropbox-json').show();
                        $('.get-dropbox-json span').text(_('Renew Dropbox Access'));
                        $('#dropboxAccessJson_span').text(_('Present'));
                    } else if (obj && obj.error && obj.error.message) {
                        showError(obj.error.message);
                    } else {
                        showError(_('No answer'));
                    }
                });
            });

            // Onedrive Settings
            $('.get-onedrive-json').removeClass('disabled').on('click', function () {
                $('.get-onedrive-json').addClass('disabled');
                sendTo(null, 'authOnedrive', null, function (obj) {
                    if (obj && obj.url) {
                        const url = `${obj.url}`;

                        $('.get-onedrive-json').addClass('disabled');
                        $('.get-onedrive-json').hide();
                        $('.get-onedrive-url').show();
                        $('.get-onedrive-code').show();
                        $('#get-onedrive-url').text(url).attr('href', url);
                        $('.get-onedrive-submit').show();
                    } else {
                        return showError(_('No Userdata entered'));
                    }
                });
            });

            $('.get-onedrive-submit').on('click', function () {
                var code = $('#get-onedrive-code').val();


                if (!code) {
                    return showError(_('No code entered'));
                }

                $('.get-onedrive-submit').addClass('disabled');

                sendTo(null, 'authOnedrive', { code: code }, function (obj) {
                    $('.get-onedrive-json').removeClass('disabled');
                    if (obj && obj.done) {
                        if ($('#onedriveAccessJson').val() !== obj.json) {
                            $('#onedriveAccessJson').val(obj.json);
                            onChange();
                        }

                        $('.get-onedrive-code').hide();
                        $('.get-onedrive-url').hide();
                        $('.get-onedrive-json').show();
                        $('.get-onedrive-json span').text(_('Renew Onedrive Access'));
                        $('#onedriveAccessJson_span').text(_('Present'));
                    } else if (obj && obj.error && obj.error.message) {
                        showError(obj.error.message);
                    } else {
                        showError(_('No answer'));
                    }
                });
            });

            // GoogleDrive Settings
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
                        $('#googledriveAccessTokens').val('');
                        $('#googledriveAccessTokens_label').text(_('Enter the code from that page here'));
                    } else if (obj.error) {
                        showError(obj.error);
                    } else {
                        showError(_('No answer'));
                    }
                });
            });
        } else {
            $('.do-backup').addClass('disabled');
            $('.do-list').addClass('disabled');
            $('.get-googledrive-json').addClass('disabled');
            $('.get-dropbox-json').addClass('disabled');
            $('.get-onedrive-json').addClass('disabled');
        }
    });

    if (settings.dropboxAccessJson) {
        $('#dropboxAccessJson_span').text(_('Present'));
        $('.get-dropbox-json span').text(_('Renew Dropbox Access'));
    } else {
        $('#dropboxAccessJson_span').text(_('Not present'));
    }

    if (settings.onedriveAccessJson) {
        $('#onedriveAccessJson_span').text(_('Present'));
        $('.get-onedrive-json span').text(_('Renew Onedrive Access'));
    } else {
        $('#onedriveAccessJson_span').text(_('Not present'));
    }

    if (settings.googledriveAccessTokens) {
        $('#googledriveAccessJson_span').text(_('Present'));
        $('.get-googledrive-json span').text(_('Renew Google Drive Access'));
        $('.get-googledrive-code').show();
        $('#googledriveAccessTokens_label').text(_('Access token'));
    } else {
        $('#googledriveAccessJson_span').text(_('Not present'));
        $('.get-googledrive-code').hide();
    }

    showHideSettings(settings);
    onChange(false);
    M.updateTextFields();  // function Materialize.updateTextFields(); to reinitialize all the Materialize labels on the page if you are dynamically adding inputs.
    getAdapterInstances('telegram', function (instances) {
        fillInstances('telegramInstance', instances, settings['telegramInstance'], 'telegram');
    });
    getAdapterInstances('backitup', function (instances) {
        fillSlaveInstances('slaveInstance', instances, settings['slaveInstance'], 'backitup');
    });
    getAdapterInstances('whatsapp-cmb', function (instances) {
        fillInstances('whatsappInstance', instances, settings['whatsappInstance'], 'whatsapp-cmb');
    });

    getAdapterInstances('gotify', function (instances) {
        fillInstances('gotifyInstance', instances, settings['gotifyInstance'], 'gotify');
    });

    getAdapterInstances('signal-cmb', function (instances) {
        fillInstances('signalInstance', instances, settings['signalInstance'], 'signal-cmb');
    });

    getAdapterInstances('matrix-org', function (instances) {
        fillInstances('matrixInstance', instances, settings['matrixInstance'], 'matrix-org');
    });

    getAdapterInstances('email', function (instances) {
        fillInstances('emailInstance', instances, settings['emailInstance'], 'email');
    });

    getAdapterInstances('pushover', function (instances) {
        fillInstances('pushoverInstance', instances, settings['pushoverInstance'], 'pushover');
    });

    getAdapterInstances('discord', function (instances) {
        fillInstances('discordInstance', instances, settings['discordInstance'], 'discord');
    });

    if ($('#ccuEnabled').prop('checked') && !settings.ccuHost) {
        fetchCcuConfig(true);
    }
    if ($('#historyEnabled').prop('checked') && !settings.historyPath) {
        fetchHistoryConfig(true);
    }
    if ($('#cEnabled').prop('checked') && !settings.mySqlUser) {
        fetchMySqlConfig(true)
    }
    if ($('#sqliteEnabled').prop('checked') && !settings.sqlitePath) {
        fetchSqliteConfig(true)
    }
    if ($('#pgSqlEnabled').prop('checked') && !settings.pgSqlUser) {
        fetchPgSqlConfig(true)
    }
    if ($('#influxDBEnabled').prop('checked') && !settings.influxDBName) {
        fetchInfluxDBConfig(true)
    }

    $('.detect-mysql').on('click', function () { fetchMySqlConfig() });
    $('.detect-sqlite').on('click', function () { fetchSqliteConfig() });
    $('.detect-pgsql').on('click', function () { fetchPgSqlConfig() });
    $('.detect-influxDB').on('click', function () { fetchInfluxDBConfig() });
    $('.detect-ccu').on('click', function () { fetchCcuConfig() });
    $('.detect-history').on('click', function () { fetchHistoryConfig() });

    sendTo(null, 'getTelegramUser', { config: { instance: settings.telegramInstance } }, function (obj) {
        fillTelegramUser(settings['telegramUser'], obj, settings.telegramInstance)
    });

    fillDiscordTarget(settings['discordTarget'], settings.discordInstance);

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

function fillDiscordTarget(id, discordInst) {
    if (discordInst !== null) {
        sendTo(discordInst, 'getNotificationTargets', {}, function (targetList) {
            var $sel = $('#discordTarget');
            $sel.html('');
            if (Array.isArray(targetList)) {
                for (const i in targetList) {
                    $('#discordTarget').append('<option value="' + targetList[i].value + '"' + (id === targetList[i].value ? ' selected' : '') + '>' + targetList[i].label + '</option>');
                }
            }
            $sel.select();
        });
    } else {
        var $sel = $('#discordTarget');
        $sel.html('<option value="">' + _('none') + '</option>');
        $sel.select();
    }
}

function fillInstances(id, arr, val, name) {
    var $sel = $('#' + id);
    $sel.html('<option value="">' + _('none') + '</option>');
    for (var i = 0; i < arr.length; i++) {
        var _id = arr[i]._id.replace('system.adapter.', '');
        $sel.append('<option value="' + _id + '"' + (_id === val ? ' selected' : '') + '>' + _id + '</option>');
    }
    $sel.select();
}

function fillSlaveInstances(id, arr, val, name) {
    var $sel = $('#' + id);
    $sel.html('');
    var instances = [];
    for (var i = 0; i < arr.length; i++) {
        var _id = arr[i]._id.replace('system.adapter.', '');
        if (_id != ('backitup.' + instance)) {
            instances.push(_id);
        }
    }
    for (var j in instances) {
        $sel.append('<option value="' + instances[j] + '"' + (val.indexOf(instances[j]) != -1 ? ' selected' : '') + '>' + instances[j] + '</option>');
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
            if (id === 'mySqlPassword' || id === 'pgSqlPassword' || id === 'webdavPassword' || id === 'ccuPassword' || id === 'ftpPassword' || id === 'cifsPassword' || id === 'grafanaPassword' || id === 'redisPassword') {
                val = val ? encrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
            }
            obj[id] = val;
        }
    });
    // Get edited tables
    obj.ccuEvents = table2values('ccuEvents');
    if (obj.ccuEvents && obj.ccuEvents.length) {
        for (var i = 0; i < obj.ccuEvents.length; i++) {
            var val = obj.ccuEvents[i].pass ? obj.ccuEvents[i].pass : '';
            obj.ccuEvents[i].pass = val ? encrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
        }
    }

    obj.influxDBEvents = table2values('influxDBEvents');

    obj.mySqlEvents = table2values('mySqlEvents');
    if (obj.mySqlEvents && obj.mySqlEvents.length) {
        for (var i = 0; i < obj.mySqlEvents.length; i++) {
            var val = obj.mySqlEvents[i].pass ? obj.mySqlEvents[i].pass : '';
            obj.mySqlEvents[i].pass = val ? encrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
        }
    }

    obj.pgSqlEvents = table2values('pgSqlEvents');
    if (obj.pgSqlEvents && obj.pgSqlEvents.length) {
        for (var i = 0; i < obj.pgSqlEvents.length; i++) {
            var val = obj.pgSqlEvents[i].pass ? obj.pgSqlEvents[i].pass : '';
            obj.pgSqlEvents[i].pass = val ? encrypt((typeof systemConfig !== 'undefined' && systemConfig.native && systemConfig.native.secret) || 'Zgfr56gFe87jJOM', val) : '';
        }
    }

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
    if ($('#wakeOnLAN').prop('checked') && $('#wolExtra').prop('checked')) {
        $('.wolExtended').show();
    } else {
        $('.wolExtended').hide();
    }

    if ($('#dropboxOwnDir').prop('checked')) {
        $('.dropbox-extra').show();
        $('.dropbox-standard').hide();
    } else {
        $('.dropbox-extra').hide();
        $('.dropbox-standard').show();
    }

    if ($('#onedriveOwnDir').prop('checked')) {
        $('.onedrive-extra').show();
        $('.onedrive-standard').hide();
    } else {
        $('.onedrive-extra').hide();
        $('.onedrive-standard').show();
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

    if ($('#sqliteEnabled').prop('checked')) {
        $('.tab-sqlite').show();
    } else {
        $('.tab-sqlite').hide();
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

    var _multiCCU = $('#ccuMulti').prop('checked');
    if (_multiCCU) {
        $('.multiCCU').hide();
        $('.singleCCU').show();
    } else {
        $('.multiCCU').show();
        $('.singleCCU').hide();
    }

    var _multiMySql = $('#mySqlMulti').prop('checked');
    if (_multiMySql) {
        $('.multiMySql').hide();
        $('.singleMySql').show();
    } else {
        $('.multiMySql').show();
        $('.singleMySql').hide();
    }

    var _multiPGSql = $('#pgSqlMulti').prop('checked');
    if (_multiPGSql) {
        $('.multiPgSql').hide();
        $('.singlePgSql').show();
    } else {
        $('.multiPgSql').show();
        $('.singlePgSql').hide();
    }

    $('#connectType').on('change', function () {
        if ($(this).val() === 'NFS') {
            $('.nfs').hide();
            $('.mountExpert').hide();
            $('.copy').show();
            $('.noExpert').show();
            if ($('#cifsOwnDir').prop('checked')) {
                $('.cifs-extra').show();
                $('.cifs-standard').hide();
            } else {
                $('.cifs-extra').hide();
                $('.cifs-standard').show();
            }
        } else if ($(this).val() === 'CIFS') {
            $('.mountExpert').hide();
            $('.nfs').show();
            $('.copy').show();
            $('.noExpert').show();
            if ($('#cifsOwnDir').prop('checked')) {
                $('.cifs-extra').show();
                $('.cifs-standard').hide();
            } else {
                $('.cifs-extra').hide();
                $('.cifs-standard').show();
            }
        } else if ($(this).val() === 'Copy') {
            $('.mountExpert').hide();
            $('.nfs').hide();
            $('.copy').hide();
            $('.noExpert').show();
            if ($('#cifsOwnDir').prop('checked')) {
                $('.cifs-extra').show();
                $('.cifs-standard').hide();
            } else {
                $('.cifs-extra').hide();
                $('.cifs-standard').show();
            }
        } else if ($(this).val() === 'Expert') {
            $('.mountExpert').show();
            $('.nfs').hide();
            $('.copy').hide();
            $('.cifs-extra').hide();
            $('.cifs-standard').hide();
            $('.noExpert').hide();

        }
    }).trigger('change');

    var _multiInfluxDB = $('#influxDBMulti').prop('checked');
    if (_multiInfluxDB) {
        $('.multiInfluxDB').hide();
        $('.influxRemote').hide();
        $('.singleInfluxDB').show();
        $('.detect-influxDB').addClass('disabled');
    } else {
        $('.multiInfluxDB').show();
        $('.influxRemote').show();
        $('.singleInfluxDB').hide();
        $('.detect-influxDB').removeClass('disabled');
    }

    $('#influxDBType').on('change', function () {
        if ($(this).val() === 'remote' && !_multiInfluxDB) {
            $('.influxRemote').show();
            $('.influxLocal').hide();
            $('.influxDBTable').removeClass('influxShowLocal');
        } else if ($(this).val() === 'local' && !_multiInfluxDB) {
            $('.influxRemote').hide();
            $('.influxLocal').show();
            $('.influxDBTable').addClass('influxShowLocal');
        } else if ($(this).val() === 'remote' && _multiInfluxDB) {
            $('.influxRemote').hide();
            $('.influxDBTable').removeClass('influxShowLocal');
        } else if ($(this).val() === 'local' && _multiInfluxDB) {
            $('.influxRemote').hide();
            $('.influxDBTable').addClass('influxShowLocal');
        }
    }).trigger('change');

    $('#influxDBVersion').on('change', function () {
        if ($(this).val() === '1.x' && !_multiInfluxDB) {
            $('.db2x').hide();
        } else if ($(this).val() === '2.x' && !_multiInfluxDB) {
            $('.db2x').show();
        } else if (_multiInfluxDB) {
            $('.db2x').hide();
        }
    }).trigger('change');

    $('#redisType').on('change', function () {
        if ($(this).val() === 'remote') {
            $('.redisRemote').show();
            $('.redisLocal').hide();
        } else if ($(this).val() === 'local') {
            $('.redisRemote').hide();
            $('.redisLocal').show();
        }
    }).trigger('change');

    $('#hostType').on('change', function () {
        if ($(this).val() === 'Master') {
            $('.slaveInst').show();
        } else {
            $('.slaveInst').hide();
        }
        if ($(this).val() === 'Slave') {
            $('#minimalEnabled').prop('checked', false);
            $('#minimalEnabled').addClass('disabled');
            $('#minimalEnabled').prop('disabled', true);
            $('.tab-iobroker-backup').hide();

            $('#ccuEnabled').prop('checked', false);
            $('#ccuEnabled').addClass('disabled');
            $('#ccuEnabled').prop('disabled', true);
            $('.tab-ccu-backup').hide();

            $('#javascriptsEnabled').prop('checked', false);
            $('#javascriptsEnabled').addClass('disabled');
            $('#javascriptsEnabled').prop('disabled', true);

            $('.slaveSuffix').show();
            if (settings.slaveNameSuffix == '') {
                $('#slaveNameSuffix').val('slave-' + instance).trigger('change');
                M.updateTextFields();
            }
        } else {
            $('#minimalEnabled').removeClass('disabled');
            $('#minimalEnabled').prop('disabled', false);

            $('#ccuEnabled').removeClass('disabled');
            $('#ccuEnabled').prop('disabled', false);

            $('#javascriptsEnabled').removeClass('disabled');
            $('#javascriptsEnabled').prop('disabled', false);

            $('.slaveSuffix').hide();
        }
    }).trigger('change');

    $('#restoreSource').on('change', function () {
        $('.doRestore').hide();
    }).trigger('change');

    $('#notificationsType').on('change', function () {
        if ($(this).val() === 'Telegram') {
            $('.email').hide();
            $('.pushover').hide();
            $('.whatsapp').hide();
            $('.gotify').hide();
            $('.signal').hide();
            $('.matrix').hide();
            $('.discord').hide();
            $('.telegram').show();
        } else if ($(this).val() === 'E-Mail') {
            $('.telegram').hide();
            $('.pushover').hide();
            $('.whatsapp').hide();
            $('.gotify').hide();
            $('.signal').hide();
            $('.matrix').hide();
            $('.discord').hide();
            $('.email').show();
        } else if ($(this).val() === 'Pushover') {
            $('.telegram').hide();
            $('.email').hide();
            $('.whatsapp').hide();
            $('.gotify').hide();
            $('.signal').hide();
            $('.matrix').hide();
            $('.discord').hide();
            $('.pushover').show();
        } else if ($(this).val() === 'WhatsApp') {
            $('.telegram').hide();
            $('.email').hide();
            $('.gotify').hide();
            $('.pushover').hide();
            $('.signal').hide();
            $('.matrix').hide();
            $('.discord').hide();
            $('.whatsapp').show();
        } else if ($(this).val() === 'Signal') {
            $('.telegram').hide();
            $('.email').hide();
            $('.gotify').hide();
            $('.pushover').hide();
            $('.whatsapp').hide();
            $('.matrix').hide();
            $('.discord').hide();
            $('.signal').show();
        } else if ($(this).val() === 'Matrix') {
            $('.telegram').hide();
            $('.email').hide();
            $('.gotify').hide();
            $('.pushover').hide();
            $('.whatsapp').hide();
            $('.signal').hide();
            $('.discord').hide();
            $('.matrix').show();
        } else if ($(this).val() === 'Discord') {
            $('.telegram').hide();
            $('.email').hide();
            $('.gotify').hide();
            $('.pushover').hide();
            $('.whatsapp').hide();
            $('.signal').hide();
            $('.matrix').hide();
            $('.discord').show();
        } else if ($(this).val() === 'Gotify') {
            $('.telegram').hide();
            $('.email').hide();
            $('.discord').hide();
            $('.pushover').hide();
            $('.whatsapp').hide();
            $('.signal').hide();
            $('.matrix').hide();
            $('.gotify').show();
        }
    }).trigger('change');

    $('#dropboxTokenType').on('change', function () {
        if ($(this).val() === 'default') {
            $('.dropbox-sl').show();
            $('.dropbox-ll').hide();
        } else if ($(this).val() === 'custom') {
            $('.dropbox-ll').show();
            $('.dropbox-sl').hide();
        }
    }).trigger('change');

    if ($('#restoreTab').prop('checked')) {
        $('.tab-restore').show();
    } else {
        $('.tab-restore').hide();
    }
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
    if ($('#sqliteEnabled').prop('checked')) {
        checkAdapterInstall('sqlite', common.host);
        $('.tab-sqlite').show();
    } else {
        $('.tab-sqlite').hide();
        cleanIgnoreMessage('sqlite');
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
        if (!oldHistoryEnabled) {
            checkAdapterInstall('history', common.host);
        }
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
    if ($('#onedriveEnabled').prop('checked')) {
        $('.tab-onedrive').show();
    } else {
        $('.tab-onedrive').hide();
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
    if ($('#zigbee2mqttEnabled').prop('checked')) {
        $('.tab-zigbee2mqtt').show();
    } else {
        $('.tab-zigbee2mqtt').hide();
    }
    if ($('#ccuUsehttps').prop('checked')) {
        $('.ccuCert').show();
    } else {
        $('.ccuCert').hide();
    }
    if ($('#ftpSecure').prop('checked')) {
        $('.ftpCert').show();
    } else {
        $('.ftpCert').hide();
    }
    $('#grafanaProtocol').on('change', function () {
        if ($(this).val() === 'https') {
            $('.grafanaCert').show();
        } else if ($(this).val() === 'http') {
            $('.grafanaCert').hide();
        }
    }).trigger('change');

    if ($('#javascriptsEnabled').prop('checked') && !oldJavascriptsEnabled) {
        showMessage(_("<br/><br/>The JavaScript Adapter scripts are already saved in the ioBroker backup.<br/><br/>This option is just an additional option to be able to restore the scripts individually if necessary."), _('BackItUp Information!'), 'info');
        oldJavascriptsEnabled = true;
    }
    if ($('#zigbeeEnabled').prop('checked')) {
        if (!oldZigbeeEnabled) {
            checkAdapterInstall('zigbee', common.host);
        }
    } else {
        cleanIgnoreMessage('zigbee');
    }
    if ($('#esphomeEnabled').prop('checked')) {
        if (!oldesphomeEnabled) {
            checkAdapterInstall('esphome', common.host);
        }
    } else {
        cleanIgnoreMessage('esphome');
    }
    if ($('#zigbee2mqttEnabled').prop('checked')) {
        if (!oldZigbee2MQTTEnabled) {
            checkAdapterInstall('zigbee2mqtt', common.host);
        }
    } else {
        cleanIgnoreMessage('zigbee2mqtt');
    }
    if ($('#noderedEnabled').prop('checked')) {
        if (!oldNoderedEnabled) {
            checkAdapterInstall('node-red', common.host);
        }
    } else {
        cleanIgnoreMessage('nodered');
    }
    if ($('#yahkaEnabled').prop('checked')) {
        if (!oldYahkaEnabled) {
            checkAdapterInstall('yahka', common.host);
        }
    } else {
        cleanIgnoreMessage('yahka');
    }
    if ($('#jarvisEnabled').prop('checked')) {
        if (!oldJarvisEnabled) {
            checkAdapterInstall('jarvis', common.host);
        }
    } else {
        cleanIgnoreMessage('jarvis');
    }
    if ($('#iobrokerCron').prop('checked')) {
        $('.ownIobrokerTime').hide();
        $('.ownIobrokerCron').show();
    } else {
        $('.ownIobrokerTime').show();
        $('.ownIobrokerCron').hide();
    }
    if ($('#ccuCron').prop('checked')) {
        $('.ownCCUTime').hide();
        $('.ownCCUCron').show();
    } else {
        $('.ownCCUTime').show();
        $('.ownCCUCron').hide();
    }
    $('#telegramInstance').on('change', function () {
        var telegramInst = $(this).val();
        if (telegramInst && telegramInst.length >= 10) {
            sendTo(null, 'getTelegramUser', { config: { instance: $(this).val() } }, function (obj) {
                fillTelegramUser(settings['telegramUser'], obj, telegramInst);
            });
        } else {
            fillTelegramUser(settings['telegramUser'], null, null);
        }
    }).trigger('change');

    $('#discordInstance').on('change', function () {
        var discordInst = $(this).val();
        if (discordInst && discordInst.length >= 9) {
            fillDiscordTarget(settings['discordTarget'], discordInst);
        } else {
            fillDiscordTarget(settings['discordTarget'], null);
        }
    }).trigger('change');

    $('.cloudRestore').hide();
}
