import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPostgres, parameterize, safeInteger, postgresTransaction } from '../lib/server/postgres.mjs';
import { signedS3Url } from '../lib/server/s3.ts';
import { migrations, setupSQL } from '../scripts/postgres-migrations.mjs';

test('Supabase SQL installs twice, preserves records, enforces RLS and rolls back invalid stock', async () => {
    const db = new PGlite({ parsers: { 20: safeInteger } });
    try {
        await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
        assert.equal(readFileSync('supabase/setup.sql', 'utf8'), setupSQL(), 'Regenerate the SQL after adding a migration');
        await db.exec(setupSQL());
        await db.query('INSERT INTO users (id,email,name,"createdAt") VALUES ($1,$2,$3,$4)', ['kept', 'kept@test.example', 'Original', new Date().toISOString()]);
        await db.exec(setupSQL());
        assert.equal((await db.query('SELECT name FROM users WHERE id=$1', ['kept'])).rows[0].name, 'Original');
        assert.equal((await db.query('SELECT COUNT(*) AS count FROM _migrations')).rows[0].count, migrations().length);
        const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity");
        assert.equal(tables.rows.length, 30);
        for (const role of ['anon', 'authenticated']) {
            await db.exec('SET ROLE ' + role);
            await assert.rejects(db.query('SELECT * FROM users'), /permission denied/);
            await assert.rejects(db.query('SELECT * FROM uploads'), /permission denied/);
            await db.exec('RESET ROLE');
        }
        // Even accidentally granting SELECT must not expose rows while RLS is on.
        await db.exec('GRANT SELECT ON users TO anon; SET ROLE anon;');
        assert.deepEqual((await db.query('SELECT * FROM users')).rows, []);
        await db.exec('RESET ROLE; REVOKE SELECT ON users FROM anon;');
        await db.query('INSERT INTO inventory (id,available) VALUES ($1,$2)', ['last-unit', 1]);
        await assert.rejects(db.transaction(async tx => {
            await tx.query('UPDATE users SET name=$1 WHERE id=$2', ['Must roll back', 'kept']);
            await tx.query('UPDATE inventory SET available=available-2 WHERE id=$1', ['last-unit']);
        }), /check constraint/);
        assert.equal((await db.query('SELECT name FROM users WHERE id=$1', ['kept'])).rows[0].name, 'Original');
        assert.equal((await db.query('SELECT available FROM inventory WHERE id=$1', ['last-unit'])).rows[0].available, 1);
    } finally { await db.close(); }
});

test('PostgreSQL binding preserves literals and safely converts COUNT results', () => {
    assert.equal(parameterize(`SELECT '?' AS text, "?" AS name FROM users WHERE name=? AND email=? -- ?\n/* ? */`),
        `SELECT '?' AS text, "?" AS name FROM users WHERE name=$1 AND email=$2 -- ?\n/* ? */`);
    assert.equal(safeInteger('0'), 0);
    assert.equal(safeInteger('100000'), 100000);
    assert.throws(() => safeInteger('9007199254740993'), /seguro/);
});

test('Supavisor uses a bounded pool without prepared statements and verifies TLS', async () => {
    const client = createPostgres('postgresql://postgres.example:test-only@aws-0-test.pooler.supabase.com:6543/postgres?sslmode=require');
    try {
        assert.equal(client.options.prepare, false);
        assert.equal(client.options.max, 1);
        assert.equal(client.options.max_pipeline, 1);
        assert.equal(client.options.fetch_types, false);
        assert.equal(client.options.ssl.rejectUnauthorized, true);
        assert.equal(client.options.connect_timeout, 10);
    } finally { await client.end(); }
    assert.throws(() => createPostgres('https://example.supabase.co'), /PostgreSQL/);
    assert.throws(() => createPostgres(''), /DATABASE_URL/);
});

test('Transaction retries are limited to confirmed rollbacks, never uncertain writes', async () => {
    let calls = 0;
    const client = { async begin(isolation, run) {
        assert.equal(isolation, 'isolation level serializable');
        calls++;
        if (calls === 1) throw Object.assign(Error('serialization'), { code: '40001' });
        return run({ async unsafe(sql, values) {
            assert.equal(sql, 'UPDATE inventory SET available=available-$1 WHERE id=$2');
            assert.deepEqual(values, [1, 'a']);
            return { count: 1 };
        } });
    } };
    assert.deepEqual(await postgresTransaction(client, [{ sql: 'UPDATE inventory SET available=available-? WHERE id=?', params: [1, 'a'] }]), [{ changes: 1 }]);
    assert.equal(calls, 2);
    for (const code of ['23514', 'CONNECTION_CLOSED']) {
        calls = 0;
        await assert.rejects(postgresTransaction({ async begin() { calls++; throw Object.assign(Error(code), { code }); } }, [{ sql: 'UPDATE inventory SET available=0' }]));
        assert.equal(calls, 1);
    }
});

test('Supabase S3 signed URLs retain the API prefix, private key and exact MIME binding', async () => {
    const env = { S3_ENDPOINT: 'https://example.storage.supabase.co/storage/v1/s3/', S3_BUCKET: 'foto-digital-private', S3_REGION: 'sa-east-1', S3_ACCESS_KEY_ID: 'test-access', S3_SECRET_ACCESS_KEY: 'test-secret' };
    const config = key => env[key] ?? '';
    const now = new Date('2026-09-09T12:00:00Z');
    const key = 'originals/uuid/família foto.png';
    const signed = new URL(await signedS3Url('PUT', key, config, now, { 'content-type': 'image/png' }));
    assert.equal(signed.pathname, '/storage/v1/s3/foto-digital-private/originals/uuid/fam%C3%ADlia%20foto.png');
    assert.equal(signed.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host');
    assert.equal(signed.searchParams.get('X-Amz-Expires'), '300');
    assert.match(signed.searchParams.get('X-Amz-Credential'), /\/sa-east-1\/s3\/aws4_request$/);
    assert.equal(signed.href.includes('test-secret'), false);
    const other = new URL(await signedS3Url('PUT', key, config, now, { 'content-type': 'image/jpeg' }));
    assert.notEqual(signed.searchParams.get('X-Amz-Signature'), other.searchParams.get('X-Amz-Signature'));
    env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    assert.equal(new URL(await signedS3Url('GET', key, config, now)).pathname, '/foto-digital-private/originals/uuid/fam%C3%ADlia%20foto.png');
    await assert.rejects(signedS3Url('GET', '../private', config), /inválido/);
    env.S3_ENDPOINT = 'http://example.supabase.co/storage/v1/s3';
    await assert.rejects(signedS3Url('GET', key, config), /HTTPS/);
});
