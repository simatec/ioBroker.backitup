// targz for Backup and Restore

module.exports = {

    compress: function (opts, callback) {

        const fs = require('fs');
        const tar = require('tar-fs');
        const zlib = require('zlib');

        // utility
        const error = function (error) {
            callback(error);
        };

        // ensure callback
        callback = callback || function () { };

        // ensure opts
        opts = opts || {};
        opts.tar = opts.tar || {};
        opts.gz = opts.gz || {};

        // default gzip config
        opts.gz.level = opts.gz.level || 6;
        opts.gz.memLevel = opts.gz.memLevel || 6;

        // ensure src and dest
        if (!opts.src) return error(`Backitup cannot found source "${opts.src}" for compress!`);
        if (!opts.dest) return error(`Backitup cannot found destination "${opts.dest}" for compress!`);

        // compress
        process.nextTick(function () {
            tar.pack(opts.src, opts.tar)
                .on('error', error)
                .pipe(zlib.createGzip(opts.gz)
                    .on('error', error))
                .pipe(fs.createWriteStream(opts.dest)
                    .on('error', error)
                    .on('finish', callback));
        });
    },

    decompress: function (opts, callback) {

        const fs = require('fs');
        const tar = require('tar-fs');
        const zlib = require('zlib');

        // utility
        const error = function (error) {
            callback(error);
        };

        // ensure callback
        callback = callback || function () { };

        // ensure opts
        opts = opts || {};
        opts.tar = opts.tar || {};
        opts.gz = opts.gz || {};

        // ensure src and dest
        if (!opts.src) return error(`Backitup cannot found source "${opts.src}" for decompress!`);
        if (!opts.dest) return error(`Backitup cannot found destination "${opts.dest}" for decompress!`);

        // decompress
        process.nextTick(function () {
            fs.createReadStream(opts.src)
                .on('error', error)
                .pipe(zlib.createGunzip(opts.gz)
                    .on('error', error))
                .pipe(tar.extract(opts.dest, opts.tar)
                    .on('error', error)
                    .on('finish', callback));
        });
    }
};