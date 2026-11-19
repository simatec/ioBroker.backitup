/**
 * The answer of the message `help`: what the instance answers, written for AI agents (e.g. ioBroker.pi-agent, or
 * the MCP server with `send_to`) and script authors. Keep it in sync with `onMessage` in main.ts.
 */

/** Every command `onMessage` answers; `write` = the command changes something */
export const COMMANDS: { command: string; write: boolean }[] = [
    { command: 'help', write: false },
    { command: 'list', write: false },
    { command: 'getLog', write: false },
    { command: 'getFileSystemInfo', write: false },
    { command: 'getSystemInfo', write: false },
    { command: 'getFile', write: true },
    { command: 'restore', write: true },
    { command: 'slaveBackup', write: true },
    { command: 'uploadFile', write: true },
    { command: 'serverClose', write: true },
    { command: 'authGoogleDrive', write: false },
    { command: 'authDropbox', write: false },
    { command: 'authOnedrive', write: true },
    { command: 'getTelegramUser', write: false },
    { command: 'testWebDAV', write: false },
    { command: 'slaveInstance', write: false },
];

export const HELP = `ioBroker.backitup: backs up the ioBroker installation and, as set in the settings, its databases (MySQL,
PostgreSQL, SQLite, InfluxDB, Redis, history), Zigbee, Zigbee2MQTT, ESPHome, Node-RED, Yahka, Grafana, Jarvis and
the scripts (all together the backup "iobroker"), and a Homematic CCU (the backup "ccu"); on a schedule or on
demand. The files stay in the local backup directory and are copied to the storages of the settings (NAS by
CIFS/NFS or copy, FTP, WebDAV, Dropbox, Google Drive, OneDrive). An agent can start a backup, read its result and
log, list the stored backups and give a download link; it can restore a backup, but only on the user's request.

Commands (sendTo backitup.0):
- list (message = a storage as a plain string, or null / "" for all): the stored backups:
  {error, data: {<storage>: {<type>: [{path, name, size}]}}}. Storages asked: local, cifs, ftp, webdav, dropbox,
  googledrive, onedrive; the NAS answers under "nas / copy". type from the file name: iobroker, ccu, mysql,
  javascripts, zigbee ...; names hold the time, e.g. iobroker_2026_11_15-03_00_10_backupiobroker.tar.gz.
  size in bytes. An object as message lists nothing. Takes a few seconds per storage.
- getLog {latest?, timestamp?, backupName?}: the log of a run. latest "iobroker" or "ccu" = the last run of that
  backup, also a failed one: {timestamp, log}; timestamp (of history.json) or backupName: the log as text.
- getFileSystemInfo: free space of the host: {diskState (ok, warn, error), diskFree (MB), storage (local, nas),
  ready (a backup can run)}; no answer if the host reports no free space.
- getSystemInfo: {systemOS (linux, win, docker ...), dockerDB, backupDir}.
- getFile {type, fileName, protocol}: makes a backup downloadable: fetches it from the storage type (as in list)
  into the local backup directory (local: already there) and starts a download server: {fileName, listenPort}
  or {error}. fileName = path of list; protocol "http:" or "https:".
  Link for the user: <protocol>//<ioBroker host>:<listenPort>/<fileName>.
- restore {type, fileName, currentTheme?, currentProtocol?, stopIOB?}: restores the backup fileName (path of
  list) from the storage type (as in list: local, "nas / copy", ftp ...). A backup of iobroker or redis stops
  ioBroker, restores it and starts it again (several minutes; objects, states and settings are replaced by those
  of the backup; connections drop): answer {error: ""} at once. Others (databases, scripts, Zigbee ...) are
  restored while ioBroker runs and answer {error, exitCode} when done; exitCode 0 or "... restore done" =
  success. Homematic CCU (.sbk), remote Redis and Zigbee2MQTT backups cannot be restored here: {error}.
  currentTheme, currentProtocol and stopIOB serve the progress page of the admin (stopIOB: take the https
  certificate of the sender).
- slaveBackup {config: {deleteAfter}}: sent by a master instance: starts the iobroker backup of this slave.
- uploadFile {protocol}, serverClose {downloadFinish | uploadFinish}: upload and download of the admin tab.
- authGoogleDrive, authDropbox, authOnedrive {code?}, getTelegramUser {config: {instance}}, testWebDAV {config},
  slaveInstance {instance}: for the settings, not for agents.

States (backitup.0.*):
- oneClick.iobroker / oneClick.ccu: write true (ack false) to start that backup now, also if its schedule is off
  (this run deletes no old backups). It stays true while the backup runs and turns false when done; a backup
  started while another one runs waits for it. It needs free disk space (getFileSystemInfo ready) unless a NAS
  is used.
- output.line: the progress of the running backup or restore; "[EXIT] 0" at the end = success, else an error.
- history.iobrokerSuccess / ccuSuccess (result of the last run), history.iobrokerLastTime / ccuLastTime (local
  time text, "error: <time>" if it failed), history.json (the last runs, newest first: [{date, name, type,
  storage, filesize, filesizeBytes, error ("none" if OK), timestamp}]).
- info.iobrokerNextTime / ccuNextTime: the next scheduled run ("none" = no schedule).

How to talk to the user:
- Start a backup only when the user asks; it takes minutes. Then tell the result from history.* or output.line.
- restore only on the user's explicit request for a backup: list first, show which backup (type, storage, time
  from the name, size in MB) and ask to confirm. Say that a restore of iobroker or redis stops the whole system
  for minutes and replaces everything with the state of the backup. Never restore to fix something on your own.
- Name storages and backups in plain words; times in local time; sizes in MB.`;
