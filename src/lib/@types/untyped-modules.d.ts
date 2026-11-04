/**
 * Ambient declarations for the runtime dependencies that ship no types and have no
 * `@types` package on npm: `tar-fs`, `@esm2cjs/got` and `node-wol`.
 *
 * These deliberately describe only the surface BackItUp actually uses instead of trying to be a
 * complete typing of those libraries - a partial but accurate declaration is more useful than a
 * broad one that claims more than it can guarantee.
 *
 * Note on `tar-fs`: `@types/tar-fs` exists but only covers the 2.x line, while this adapter runs
 * tar-fs 3.x, whose streams come from `streamx` rather than from `node:stream`. Both still satisfy
 * the `.pipe()` / `.on('error')` / `.on('finish')` usage in lib/targz.ts, which is all that is
 * declared here.
 */

declare module 'tar-fs' {
    import type { Readable, Writable } from 'node:stream';

    /** Subset of the tar-stream header that the `map` hooks in lib/scripts touch */
    interface TarHeader {
        name: string;
        mode?: number;
        mtime?: Date;
        size?: number;
        type?: string;
        uid?: number;
        gid?: number;
    }

    interface PackOptions {
        /** Only pack these entries, relative to the packed directory */
        entries?: string[];
        /** Return true to leave an entry out of the archive */
        ignore?: (name: string) => boolean;
        /** Rewrite each header before it is written */
        map?: (header: TarHeader) => TarHeader;
        dereference?: boolean;
    }

    interface ExtractOptions {
        /** Return true to skip an entry while unpacking */
        ignore?: (name: string) => boolean;
        map?: (header: TarHeader) => TarHeader;
        strip?: number;
    }

    /**
     * Reads `cwd` and emits a tar stream
     *
     * @param cwd directory to pack
     * @param opts entry selection and header rewriting
     */
    function pack(cwd: string, opts?: PackOptions): Readable;

    /**
     * Consumes a tar stream and writes it into `cwd`
     *
     * @param cwd directory to unpack into
     * @param opts entry selection and header rewriting
     */
    function extract(cwd: string, opts?: ExtractOptions): Writable;
}

/**
 * `@esm2cjs/got` is a CommonJS repackaging of got, but it ships declarations only alongside its ESM
 * build, which is marked `"type": "module"` - so a CommonJS consumer cannot use them. Rather than
 * letting the whole module fall back to `any`, the handful of calls lib/oneDriveLib makes are
 * declared here.
 */
declare module '@esm2cjs/got' {
    import type { Duplex } from 'node:stream';

    interface GotOptions {
        headers?: Record<string, string | number>;
        /** request body sent as JSON */
        json?: unknown;
        body?: string | Buffer;
        responseType?: 'json' | 'text' | 'buffer';
        /** when false, non-2xx responses resolve instead of throwing */
        throwHttpErrors?: boolean;
    }

    interface GotResponse {
        statusCode: number;
        body: unknown;
    }

    interface Got {
        get(url: string, options?: GotOptions): Promise<GotResponse>;
        post(url: string, options?: GotOptions): Promise<GotResponse>;
        put(url: string, options?: GotOptions): Promise<GotResponse>;
        delete(url: string, options?: GotOptions): Promise<GotResponse>;
        stream(url: string, options?: GotOptions): Duplex;
    }

    const got: Got;
    export default got;
}

declare module 'node-wol' {
    interface WakeOptions {
        /** Broadcast address, or the NAS address when a directed packet is wanted */
        address?: string;
        port?: number;
    }

    function wake(mac: string, options: WakeOptions, callback: (error?: Error | string | null) => void): void;
    function wake(mac: string, callback: (error?: Error | string | null) => void): void;
}
