import { createWriteStream, createReadStream } from 'node:fs';
import { extract, pack, type PackOptions } from 'tar-fs';
import { createGzip, createGunzip, type ZlibOptions } from 'node:zlib';

/**
 * Compress all files in the given directory into tar.gz
 *
 * @param opts Pack options
 * @param opts.src Source directory
 * @param opts.dest Destination file *.tar.gz
 * @param opts.tar options for tar
 * @param opts.gz options for gz
 */
export function compress(opts: {
    src: string;
    dest: string;
    tar?: PackOptions;
    gz?: ZlibOptions;
}): Promise<void> {
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
        process.nextTick(() =>
            pack(opts.src, opts.tar)
                .on('error', reject)
                .pipe(createGzip(opts.gz).on('error', reject))
                .pipe(createWriteStream(opts.dest).on('error', reject).on('finish', resolve)),
        );
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
export function decompress(opts: {
    src: string;
    dest: string;
    tar?: PackOptions;
    gz?: ZlibOptions;
}): Promise<void> {
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
            createReadStream(opts.src)
                .on('error', reject)
                .pipe(createGunzip(opts.gz).on('error', reject))
                .pipe(extract(opts.dest, opts.tar).on('error', reject).on('finish', resolve));
        });
    });
}
