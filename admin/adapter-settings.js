/*global $, location, socket, document, window, io, alert, load, systemDictionary, systemLang, translateAll*/
var path = location.pathname;
var parts = path.split('/');
parts.splice(-3);

const socket = io.connect('/', { path: parts.join('/') + '/socket.io' });
var query = (window.location.search || '').replace(/^\?/, '').replace(/#.*$/, '');
var args = {};
let theme = null;

// parse parameters
query.trim().split('&').filter(function (t) { return t.trim(); }).forEach(function (b, i) {
    const parts = b.split('=');
    if (!i && parts.length === 1 && !isNaN(parseInt(b, 10))) {
        args.instance = parseInt(b, 10);
    }
    var name = parts[0];
    args[name] = parts.length === 2 ? parts[1] : true;

    if (name === 'instance') {
        args.instance = parseInt(args.instance, 10) || 0;
    }

    if (args[name] === 'true') {
        args[name] = true;
    } else if (args[name] === 'false') {
        args[name] = false;
    }
});

var instance = args.instance;

let common = null; // common information of adapter
const host = null; // host object on which the adapter runs
const changed = false;
let systemConfig;
let certs = [];
let adapter = '';
const onChangeSupported = false;
var isMaterialize = true;

const tmp = window.location.pathname.split('/');
adapter = tmp[tmp.length - 2];
const id = 'system.adapter.' + adapter + '.' + instance;

$(document).ready(function () {
    'use strict';
    loadSystemConfig(function () {
        if (typeof translateAll === 'function') translateAll();
        loadSettings(prepareTooltips);
    });
});

function currentTheme() {
    return theme;
}

// Read language settings
function loadSystemConfig(callback) {
    socket.emit('getObject', 'system.config', function (err, res) {
        if (!err && res && res.common) {
            systemLang = res.common.language || systemLang;
            systemConfig = res;
        }
        socket.emit('getObject', 'system.certificates', function (err, res) {
            if (!err && res) {
                if (res.native && res.native.certificates) {
                    certs = [];
                    for (const c in res.native.certificates) {
                        if (res.native.certificates.hasOwnProperty(c) && !res.native.certificates[c]) continue;
                        const _cert = {
                            name: c,
                            type: (res.native.certificates[c].substring(0, '-----BEGIN RSA PRIVATE KEY'.length) === '-----BEGIN RSA PRIVATE KEY' || res.native.certificates[c].substring(0, '-----BEGIN PRIVATE KEY'.length) === '-----BEGIN PRIVATE KEY') ? 'private' : 'public'
                        };
                        if (_cert.type === 'public') {
                            const m = res.native.certificates[c].split('-----END CERTIFICATE-----');
                            let count = 0;
                            for (let _m = 0; _m < m.length; _m++) {
                                if (m[_m].replace(/[\r\n|\r|\n]+/, '').trim()) count++;
                            }
                            if (count > 1) _cert.type = 'chained';
                        }

                        certs.push(_cert);
                    }
                }
            }
            if (callback) callback();
        });
    });
}

function loadSettings(callback) {
    socket.emit('getObject', id, function (err, res) {
        if (!err && res && res.native) {
            $('.adapter-instance').html(adapter + '.' + instance);
            $('.adapter-config').html('system.adapter.' + adapter + '.' + instance);
            common = res.common;
            res.common && res.common.name && $('.adapter-name').html(res.common.name);
            if (typeof load === 'undefined') {
                alert('Please implement save function in your admin/index.html');
            } else {
                // decode all native attributes listed in res.encryptedNative
                if (res.encryptedNative && typeof res.encryptedNative === 'object' && res.encryptedNative instanceof Array) {
                    for (var i = 0; i < res.encryptedNative.length; i++) {
                        if (res.native[res.encryptedNative[i]]) {
                            res.native[res.encryptedNative[i]] = decrypt(res.native[res.encryptedNative[i]]);
                        }
                    }
                } else {
                    var idx = supportedFeatures.indexOf('ADAPTER_AUTO_DECRYPT_NATIVE');
                    if (idx !== -1) {
                        // if no encryptedNative exists the feature is irrelevant, remove for compatibility reasons
                        supportedFeatures.splice(idx, 1);
                    }
                }
                // detect, that we are now in react container (themeNames = ['dark', 'blue', 'colored', 'light'])
                //query += '&react=dark'; // this is only for theme testing

                const _query = query.split('&');

                for (var q = 0; q < _query.length; q++) {
                    if (_query[q].indexOf('react=') !== -1) {
                        $('.adapter-container').addClass('react-' + _query[q].substring(6));
                        theme = 'react-' + _query[q].substring(6);
                    }
                }
                

                load(res.native, onChange);
                // init selects
                if (isMaterialize) {
                    $('select').select();
                    M.updateTextFields();

                    // workaround for materialize checkbox problem
                    $('input[type="checkbox"]+span').off('click').on('click', function (event) {
                        var $input = $(this).prev();
                        if (!$input.prop('disabled')) {
                            $input.prop('checked', !$input.prop('checked')).trigger('change');
                            // prevent propagation to prevent original handling from reverting our value change
                            event.preventDefault();
                            event.stopImmediatePropagation();
                        }
                    });
                }
            }
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            if (typeof callback === 'function') {
                callback();
            }
            alert('error loading settings for ' + id + '\n\n' + err);
        }
    });
}

function confirmMessage(message, title, icon, buttons, callback) {
    if (!isMaterialize) {
        return confirmMessageJQ(message, title, icon, buttons, callback);
    }

    var $dialogConfirm;
    // noinspection JSJQueryEfficiency
    $dialogConfirm = $('#dialog-confirm');
    if (!$dialogConfirm.length) {
        $('body').append(
            `<div class="${theme ? 'm ' + theme : 'm'}"><div id="dialog-confirm" class="modal modal-fixed-footer">` +
            '    <div class="modal-content">' +
            '        <h6 class="dialog-title title"></h6>' +
            '        <p><i class="large material-icons dialog-icon"></i><span class="dialog-text"></span></p>' +
            '    </div>' +
            '    <div class="modal-footer">' +
            '    </div>' +
            '</div></div>'
        );
        $dialogConfirm = $('#dialog-confirm');
    }
    if (typeof buttons === 'function') {
        callback = buttons;
        $dialogConfirm.find('.modal-footer').html(
            '<a class="modal-action modal-close waves-effect waves-green btn-flat translate" data-result="true">' + _('Ok') + '</a>' +
            '<a class="modal-action modal-close waves-effect waves-green btn-flat translate">' + _('Cancel') + '</a>');
        $dialogConfirm.find('.modal-footer .modal-action').on('click', function () {
            var cb = $dialogConfirm.data('callback');
            cb && cb($(this).data('result'));
        });
    } else if (typeof buttons === 'object') {
        var tButtons = '';
        for (var b = buttons.length - 1; b >= 0; b--) {
            tButtons += '<a class="modal-action modal-close waves-effect waves-green btn-flat translate" data-id="' + b + '">' + buttons[b] + '</a>';
        }
        $dialogConfirm.find('.modal-footer').html(tButtons);
        $dialogConfirm.find('.modal-footer .modal-action').on('click', function () {
            var cb = $dialogConfirm.data('callback');
            cb && cb($(this).data('id'));
        });
    }

    $dialogConfirm.find('.dialog-title').text(title || _('Please confirm'));
    if (icon) {
        $dialogConfirm.find('.dialog-icon')
            .show()
            .html(icon);
    } else {
        $dialogConfirm.find('.dialog-icon').hide();
    }
    if (title) {
        $dialogConfirm.find('.dialog-title').html(title).show();
    } else {
        $dialogConfirm.find('.dialog-title').hide();
    }
    $dialogConfirm.find('.dialog-text').html(message);
    $dialogConfirm.data('callback', callback);
    $dialogConfirm.modal({
        dismissible: false
    }).modal('open');
}

function showError(error) {
    showMessage(_(error), _('Error'), 'error_outline');
}

function showToast(parent, message, icon, duration, isError, classes) {
    if (typeof parent === 'string') {
        classes = isError;
        isError = duration;
        icon = message;
        message = parent;
        parent = null;
    }
    if (parent && parent instanceof jQuery) {
        parent = parent[0];
    }
    classes = classes || [];

    if (typeof classes === 'string') {
        classes = [classes];
    }
    isError && classes.push('dropZone-error');

    M.toast({
        parentSelector: parent || $('body')[0],
        html: message + (icon ? '<i class="material-icons">' + icon + '</i>' : ''),
        displayLength: duration || 3000,
        classes: classes
    });
}

function getState(id, callback) {
    socket.emit('getState', id, function (err, res) {
        if (!err && res) {
            callback && callback(err, res);
        } else {
            callback && callback(null);
        }
    });
}
function getAdapterInstances(_adapter, callback) {
    if (typeof _adapter === 'function') {
        callback = _adapter;
        _adapter = null;
    }

    socket.emit('getObjectView', 'system', 'instance', { startkey: 'system.adapter.' + (_adapter || adapter), endkey: 'system.adapter.' + (_adapter || adapter) + '.\u9999' }, function (err, doc) {
        if (err) {
            callback && callback([]);
        } else {
            if (doc.rows.length === 0) {
                callback && callback([]);
            } else {
                var res = [];
                for (var i = 0; i < doc.rows.length; i++) {
                    res.push(doc.rows[i].value);
                }
                callback && callback(res);
            }
        }

    });
}
function getIsAdapterAlive(adapter, callback) {
    if (typeof adapter === 'function') {
        callback = adapter;
        adapter = null;
    }
    getState(id + '.alive', function (err, obj) {
        if (!obj || !obj.val) {
            callback(false);
        } else {
            callback(true);
        }
    });
}
function prepareTooltips() {
    $('.admin-icon').each(function () {
        let id = $(this).data('id');
        if (!id) {
            let $prev = $(this).prev();
            let $input = $prev.find('input');
            if (!$input.length) $input = $prev.find('select');
            if (!$input.length) $input = $prev.find('textarea');

            if (!$input.length) {
                $prev = $prev.parent();
                $input = $prev.find('input');
                if (!$input.length) $input = $prev.find('select');
                if (!$input.length) $input = $prev.find('textarea');
            }
            if ($input.length) id = $input.attr('id');
        }

        if (!id) return;

        let tooltip = '';
        if (systemDictionary['tooltip_' + id]) {
            tooltip = systemDictionary['tooltip_' + id][systemLang] || systemDictionary['tooltip_' + id].en;
        }

        let icon = '';
        let link = $(this).data('link');
        if (link) {
            if (link === true) {
                if (common.readme) {
                    link = common.readme + '#' + id;
                } else {
                    link = 'https://github.com/ioBroker/ioBroker.' + common.name + '#' + id;
                }
            }
            if (!link.match('^https?:\/\/')) {
                if (common.readme) {
                    link = common.readme + '#' + link;
                } else {
                    link = 'https://github.com/ioBroker/ioBroker.' + common.name + '#' + link;
                }
            }
            icon += '<a class="admin-tooltip-link" target="config_help" href="' + link + '" title="' + (tooltip || systemDictionary.htooltip[systemLang]) + '"><img class="admin-tooltip-icon" src="../../img/info.png" /></a>';
        } else if (tooltip) {
            icon += '<img class="admin-tooltip-icon" title="' + tooltip + '" src="../../img/info.png"/>';
        }

        if (icon) {
            $(this).html(icon);
        }
    });
    $('.admin-text').each(function () {
        let id = $(this).data('id');
        if (!id) {
            let $prev = $(this).prev();
            let $input = $prev.find('input');
            if (!$input.length) $input = $prev.find('select');
            if (!$input.length) $input = $prev.find('textarea');
            if (!$input.length) {
                $prev = $prev.parent();
                $input = $prev.find('input');
                if (!$input.length) $input = $prev.find('select');
                if (!$input.length) $input = $prev.find('textarea');
            }
            if ($input.length) id = $input.attr('id');
        }

        if (!id) return;

        // check if translation for this exist
        if (systemDictionary['info_' + id]) {
            $(this).html('<span class="admin-tooltip-text">' + (systemDictionary['info_' + id][systemLang] || systemDictionary['info_' + id].en) + '</span>');
        }
    });
}


function sendTo(_adapter_instance, command, message, callback) {
    socket.emit('sendTo', (_adapter_instance || adapter + '.' + instance), command, message, callback);
}

function sendToHost(host, command, message, callback) {
    socket.emit('sendToHost', host || common.host, command, message, callback);
}

function onChange(isChanged) {
    //
}

function showMessage(message, title, icon) {
    var $dialogMessage;
    // noinspection JSJQueryEfficiency
    $dialogMessage = $('#dialog-message');
    if (!$dialogMessage.length) {
        $('body').append(
            `<div class="${theme ? 'm ' + theme : 'm'}"><div id="dialog-message" class="modal modal-fixed-footer">` +
            '    <div class="modal-content">' +
            '        <h6 class="dialog-title title"></h6>' +
            '        <p><i class="large material-icons dialog-icon"></i><span class="dialog-text"></span></p>' +
            '    </div>' +
            '    <div class="modal-footer">' +
            '        <a class="modal-action modal-close waves-effect waves-green btn-flat translate">Ok</a>' +
            '    </div>' +
            '</div></div>');
        $dialogMessage = $('#dialog-message');
    }
    if (icon) {
        $dialogMessage.find('.dialog-icon')
            .show()
            .html(icon);
    } else {
        $dialogMessage.find('.dialog-icon').hide();
    }
    if (title) {
        $dialogMessage.find('.dialog-title').html(title).show();
    } else {
        $dialogMessage.find('.dialog-title').hide();
    }
    $dialogMessage.find('.dialog-text').html(message);
    $dialogMessage.modal().modal('open');
}