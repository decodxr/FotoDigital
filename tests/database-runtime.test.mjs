import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { createServer as createHttpServer } from 'node:http';

const loader = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: createHttpServer() }, watch: null }, appType: 'custom' });
after(() => loader.close());
const { createDatabaseRuntime } = await loader.ssrLoadModule('/lib/server/postgres-runtime.ts');
const { DeadlineError, withinDeadline } = await loader.ssrLoadModule('/lib/server/deadline.ts');

function connections() {
    const entries = [];
    return {
        entries,
        create() {
            const entry = { closed: false, async end({ timeout }) { assert.equal(timeout, 0); entry.closed = true; } };
            entries.push(entry);
            return entry;
        },
    };
}

test('A stalled database operation releases the caller and replaces the pool without replaying a write', async t => {
    t.mock.method(console, 'error', () => {});
    const pool = connections();
    const runtime = createDatabaseRuntime(pool.create, { queryMs: 20, transactionMs: 20 });
    let executions = 0;
    await assert.rejects(runtime.run('transaction', '1 statement', () => {
        executions++;
        return new Promise(() => {});
    }), { code: 'DATABASE_TIMEOUT' });
    assert.equal(executions, 1);
    assert.equal(pool.entries[0].closed, true);
    assert.equal(await runtime.run('query', 'SELECT:settings', async () => 'recovered'), 'recovered');
    assert.equal(pool.entries.length, 2);
    assert.equal(pool.entries[1].closed, false);
});

test('A late failure from an abandoned connection cannot retire its replacement', async t => {
    t.mock.method(console, 'error', () => {});
    const pool = connections();
    const runtime = createDatabaseRuntime(pool.create, { queryMs: 15, transactionMs: 1000 });
    let rejectOld;
    const old = runtime.run('transaction', '1 statement', () => new Promise((_, reject) => { rejectOld = reject; }));
    const oldResult = assert.rejects(old, { code: 'CONNECTION_CLOSED' });
    await assert.rejects(runtime.run('query', 'SELECT:settings', () => new Promise(() => {})), { code: 'DATABASE_TIMEOUT' });
    await runtime.run('query', 'SELECT:settings', async () => []);
    rejectOld(Object.assign(Error('old socket'), { code: 'CONNECTION_CLOSED' }));
    await oldResult;
    assert.equal(pool.entries.length, 2);
    assert.equal(pool.entries[1].closed, false);
});

test('Idle pools are recycled after suspension, while active transactions keep their connection', async () => {
    const pool = connections();
    const runtime = createDatabaseRuntime(pool.create, { idleMs: 1, transactionMs: 1000 });
    let finish;
    const transaction = runtime.run('transaction', '1 statement', () => new Promise(resolve => { finish = resolve; }));
    await delay(5);
    await runtime.run('query', 'SELECT:settings', async () => []);
    assert.equal(pool.entries.length, 1);
    assert.equal(pool.entries[0].closed, false);
    finish('committed');
    assert.equal(await transaction, 'committed');
    await delay(5);
    await runtime.run('query', 'SELECT:settings', async () => []);
    assert.equal(pool.entries.length, 2);
    assert.equal(pool.entries[0].closed, true);
});

test('SQL errors retain their code and never put query values into diagnostics', async t => {
    const records = [];
    t.mock.method(console, 'error', (...record) => records.push(record));
    const pool = connections();
    const runtime = createDatabaseRuntime(pool.create);
    let executions = 0;
    await assert.rejects(runtime.run('query', 'SELECT:settings', async () => {
        executions++;
        throw Object.assign(Error('private-customer-value'), { code: '57014', query: 'private-query', parameters: ['private-password'] });
    }), { code: '57014' });
    assert.equal(executions, 1);
    assert.equal(records[0][1].code, '57014');
    assert.equal(records[0][1].label, 'SELECT:settings');
    assert.doesNotMatch(JSON.stringify(records), /private-/);
});

test('Deadline handling also observes late provider rejections', async () => {
    let rejectLate;
    const task = new Promise((_, reject) => { rejectLate = reject; });
    await assert.rejects(withinDeadline(task, 10, new DeadlineError('TIMEOUT', 'test')), { code: 'TIMEOUT' });
    rejectLate(Error('late provider error'));
    await delay(0);
});

test('An unresponsive database still returns the explicit unavailable catalog after the page deadline', async t => {
    const virtual = '\0offline-platform';
    const offline = await createServer({
        configFile: false, server: { middlewareMode: true, hmr: { server: createHttpServer() }, watch: null }, appType: 'custom',
        resolve: { alias: [{ find: '@/lib/server/platform', replacement: virtual }, { find: '@', replacement: resolve('.') }] },
        plugins: [{ name: 'offline-database', resolveId: id => id === virtual ? id : null,
            load: id => id === virtual ? 'export const query = () => new Promise(() => {}); export const transaction = async () => [];' : null }],
    });
    try {
        const { safeCatalog } = await offline.ssrLoadModule('/lib/server/catalog.ts');
        t.mock.method(console, 'error', () => {});
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const result = safeCatalog();
        t.mock.timers.tick(12001);
        const catalog = await result;
        assert.equal(catalog.unavailable, true);
        assert.equal(catalog.products.every(product => product.price === null), true);
        assert.equal(catalog.testimonials.length, 0);
    } finally {
        t.mock.timers.reset();
        await offline.close();
    }
});
