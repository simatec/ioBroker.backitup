import { createWriteStream, createReadStream } from 'node:fs';
import { extract, pack, type PackOptions } from 'tar-fs';
import { createGzip, createGunzip, type ZlibOptions } from 'node:zlib';

// targz for Backup and Restore
/**
 * Compress all files in the given directory into tar.gz
 *
 * @deprecated Use `targzAsync.compress`
 * @param opts Pack options
 * @param opts.src Source directory
 * @param opts.dest Destination file *.tar.gz
 * @param opts.tar options for tar
 * @param opts.gz options for gz
 * @param callback optional callback
 */
export function compress(
    opts: {
        src: string;
        dest: string;
        tar?: PackOptions;
        gz?: ZlibOptions;
    },
    callback: (error?: Error | null) => void,
): void {
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
    process.nextTick(() =>
        pack(opts.src, opts.tar)
            .on('error', (error: Error) => callback && callback(error))
            .pipe(createGzip(opts.gz).on('error', (error: Error) => callback && callback(error)))
            .pipe(
                createWriteStream(opts.dest)
                    .on('error', (error: Error) => callback && callback(error))
                    .on('finish', () => callback && callback()),
            ),
    );
}

/**
 * Extract from tar.gz file
 *
 * @deprecated Use `targzAsync.decompress`
 * @param opts Pack options
 * @param opts.src Source file *.tar.gz
 * @param opts.dest Destination directory
 * @param opts.tar options for tar
 * @param opts.gz options for gz
 * @param callback optional callback
 */
export function decompress(
    opts: { src: string; dest: string; tar?: PackOptions; gz?: ZlibOptions },
    callback: (error?: Error | null) => void,
): void {
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
    process.nextTick(() => {
        createReadStream(opts.src)
            .on('error', (error: Error) => callback && callback(error))
            .pipe(createGunzip(opts.gz).on('error', (error: Error) => callback && callback(error)))
            .pipe(
                extract(opts.dest, opts.tar)
                    .on('error', (error: Error) => callback && callback(error))
                    .on('finish', () => callback && callback()),
            );
    });
}
