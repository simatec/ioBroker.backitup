"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compress = compress;
exports.decompress = decompress;
const node_fs_1 = require("node:fs");
const tar_fs_1 = require("tar-fs");
const node_zlib_1 = require("node:zlib");
/**
 * Compress all files in the given directory into tar.gz
 *
 * @param opts Pack options
 * @param opts.src Source directory
 * @param opts.dest Destination file *.tar.gz
 * @param opts.tar options for tar
 * @param opts.gz options for gz
 */
function compress(opts) {
    // ensure opts
    opts.tar = opts.tar || {};
    opts.gz = opts.gz || {};
    // default gzip config
    opts.gz.level = opts.gz.level || 6;
    opts.gz.memLevel = opts.gz.memLevel || 6;
    // ensure src and dest
    if (!opts.src) {
        throw new Error(`BackItUp cannot found source "${opts.src}" for compress!`);
    }
    if (!opts.dest) {
        throw new Error(`BackItUp cannot found destination "${opts.dest}" for compress!`);
    }
    // compress
    return new Promise((resolve, reject) => {
        process.nextTick(() => (0, tar_fs_1.pack)(opts.src, opts.tar)
            .on('error', reject)
            .pipe((0, node_zlib_1.createGzip)(opts.gz).on('error', reject))
            .pipe((0, node_fs_1.createWriteStream)(opts.dest).on('error', reject).on('finish', resolve)));
    });
}
/**
 * Extract from tar.gz file
 *
 * @param opts Pack options
 * @param opts.src Source file *.tar.gz
 * @param opts.dest Destination directory
 * @param opts.tar options for tar
 * @param opts.gz options for gz
 */
function decompress(opts) {
    // ensure opts
    opts.tar = opts.tar || {};
    opts.gz = opts.gz || {};
    // ensure src and dest
    if (!opts.src) {
        throw new Error(`BackItUp cannot found source "${opts.src}" for decompress!`);
    }
    if (!opts.dest) {
        throw new Error(`BackItUp cannot found destination "${opts.dest}" for decompress!`);
    }
    // decompress
    return new Promise((resolve, reject) => {
        process.nextTick(() => {
            (0, node_fs_1.createReadStream)(opts.src)
                .on('error', reject)
                .pipe((0, node_zlib_1.createGunzip)(opts.gz).on('error', reject))
                .pipe((0, tar_fs_1.extract)(opts.dest, opts.tar).on('error', reject).on('finish', resolve));
        });
    });
}
//# sourceMappingURL=targzAsync.js.map