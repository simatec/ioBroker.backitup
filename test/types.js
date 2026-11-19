const { readFileSync } = require('node:fs');
const path = require('node:path');
// node:assert rather than chai: chai is ESM-only from v5 on, and this file is CommonJS.
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');

/**
 * `BackItUpAdapterOptions` in lib/types.d.ts is what gives `adapter.config` its type. Nothing forces
 * it to stay in step with the `native` defaults in io-package.json, and in the first TypeScript
 * attempt (PR #1190) it had drifted by 13 keys before anyone noticed. This test makes that drift a
 * test failure instead of a silent lie in the type system.
 *
 * A key may be intentionally absent from `native` while still being declared - deprecated settings
 * that main.js only reads to migrate older instance configurations. Those must be marked optional,
 * which is how this test tells "deliberately kept" apart from "forgotten".
 */
describe('Adapter config typing', () => {
    const native = JSON.parse(readFileSync(path.join(ROOT, 'io-package.json'), 'utf8')).native;
    const types = readFileSync(path.join(ROOT, 'src', 'lib', 'types.d.ts'), 'utf8');

    const start = types.indexOf('export interface BackItUpAdapterOptions');
    const body = types.slice(start, types.indexOf('\n}', start));

    const declared = new Map();
    for (const m of body.matchAll(/^ {4}(\w+)(\??):/gm)) {
        declared.set(m[1], { optional: m[2] === '?' });
    }

    it('finds the interface and its members', () => {
        assert.ok(start > -1, 'BackItUpAdapterOptions not found in lib/types.d.ts');
        assert.ok(declared.size > 100, `only ${declared.size} members found`);
    });

    it('declares every key from io-package.json native', () => {
        const missing = Object.keys(native).filter(key => !declared.has(key));
        assert.deepStrictEqual(missing, [], `not declared in BackItUpAdapterOptions: ${missing.join(', ')}`);
    });

    it('marks keys that are no longer in native as optional', () => {
        const stale = [...declared.entries()]
            .filter(([key, info]) => !(key in native) && !info.optional)
            .map(([key]) => key);
        assert.deepStrictEqual(
            stale,
            [],
            `declared as required but absent from io-package.json native - remove them, or mark ` +
                `them optional and @deprecated if main.js still reads them: ${stale.join(', ')}`,
        );
    });
});

/**
 * The message `help` (src/lib/help.ts) describes the messages for AI agents. Its list of commands has to
 * follow the switch in `onMessage` of src/main.ts, and the text has to name every command.
 */
describe('Message help', () => {
    const main = readFileSync(path.join(ROOT, 'src', 'main.ts'), 'utf8');
    const help = readFileSync(path.join(ROOT, 'src', 'lib', 'help.ts'), 'utf8');

    const start = main.indexOf('private async onMessage(');
    const end = main.indexOf('private async updateAccessTokens(', start);
    const handled = [...main.slice(start, end).matchAll(/case '([^']+)':/g)].map(m => m[1]);
    const commands = [...help.matchAll(/\{ command: '([^']+)', write: (true|false) \}/g)].map(m => ({
        command: m[1],
        write: m[2] === 'true',
    }));
    const marker = 'export const HELP = `';
    const text = help.slice(help.indexOf(marker) + marker.length, help.lastIndexOf('`;'));

    it('lists exactly the commands onMessage answers', () => {
        assert.ok(start > -1 && end > start, 'onMessage not found in src/main.ts');
        assert.deepStrictEqual(commands.map(c => c.command).sort(), [...handled].sort());
    });

    it('lists every command once', () => {
        const names = commands.map(c => c.command);
        assert.deepStrictEqual(names, [...new Set(names)]);
    });

    it('names every command in the text', () => {
        for (const { command } of commands.filter(c => c.command !== 'help')) {
            assert.ok(text.includes(command), command);
        }
    });

    it('marks the commands that change something as write', () => {
        const write = Object.fromEntries(commands.map(c => [c.command, c.write]));
        for (const command of ['restore', 'getFile', 'slaveBackup', 'uploadFile']) {
            assert.strictEqual(write[command], true, command);
        }
        for (const command of ['help', 'list', 'getLog', 'getFileSystemInfo', 'getSystemInfo']) {
            assert.strictEqual(write[command], false, command);
        }
    });

    it('keeps the lines short', () => {
        for (const line of text.split('\n')) {
            assert.ok(line.length <= 120, line);
        }
    });
});
