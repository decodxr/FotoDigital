import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';
import { createPostgres, postgresTransaction } from '../lib/server/postgres.mjs';
import { postgresWireServer } from './postgres-wire-server.mjs';

const loader = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: createHttpServer() }, watch: null }, appType: 'custom' });
after(() => loader.close());
const { createDatabaseRuntime } = await loader.ssrLoadModule('/lib/server/postgres-runtime.ts');

test('Real driver serializes concurrent reads and transactions, commits and rolls back without leaking work', { timeout: 20000 }, async () => {
    const server = await postgresWireServer();
    const client = createPostgres(server.connection, { ca: server.ca });
    const database = createDatabaseRuntime(() => client);
    const read = (sql, params = []) => database.run('query', 'test', connection => connection.unsafe(sql, params));
    const write = statements => database.run('transaction', 'test', connection => postgresTransaction(connection, statements));
    try {
        // First operation on a cold connection is a transaction, like an empty cart.
        const writes = await write([{ sql: 'CREATE TABLE test_transaction (id integer PRIMARY KEY)' }, { sql: 'INSERT INTO test_transaction (id) VALUES (?)', params: [1] }]);
        assert.equal(writes[1].changes, 1);
        assert.equal((await read('SELECT id FROM test_transaction'))[0].id, 1);
        const results = await Promise.all(Array.from({ length: 20 }, (_, index) => index % 2
            ? read('SELECT $1::integer AS value', [index])
            : read(`SELECT ${index} AS value`)));
        assert.deepEqual(results.map(rows => rows[0].value), Array.from({ length: 20 }, (_, index) => index));
        const concurrent = await Promise.all([
            read('SELECT COUNT(*) AS count FROM test_transaction'),
            write([{ sql: 'INSERT INTO test_transaction (id) VALUES (?)', params: [2] }]),
            read('SELECT COUNT(*) AS count FROM test_transaction'),
        ]);
        assert.equal(concurrent[0][0].count, 1);
        assert.equal(concurrent[2][0].count, 2);
        await assert.rejects(write([
            { sql: 'INSERT INTO test_transaction (id) VALUES (?)', params: [3] },
            { sql: 'INSERT INTO test_transaction (id) VALUES (?)', params: [1] },
        ]), { code: '23505' });
        assert.deepEqual((await read('SELECT id FROM test_transaction ORDER BY id')).map(row => row.id), [1, 2]);
        const stats = server.stats();
        assert.ifError(stats.failure);
        assert.equal(stats.peak, 1, 'A second query must wait for ReadyForQuery from the first');
        assert.equal(stats.pending, 0);
    } finally {
        await client.end({ timeout: 0 });
        await server.close();
    }
});
