import { createPostgres } from '../lib/server/postgres.mjs';
import { loadLocalEnv } from './load-local-env.mjs';
import { setupSQL } from './postgres-migrations.mjs';
import { databaseError } from './database-errors.mjs';

loadLocalEnv();
let sql;
try {
    const connection = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connection) throw Error('missing_configuration');
    sql = createPostgres(connection, { ca: process.env.DATABASE_CA_CERT, max: 1 });
    // Execute the complete SQL: splitting on semicolons corrupts DO blocks.
    // A transaction and advisory lock make repeated/concurrent runs safe.
    await sql.unsafe(setupSQL()).simple();
    const applied = await sql`SELECT id FROM public._migrations ORDER BY id`;
    for (const { id } of applied) console.log('Migration aplicada:', id);
    console.log('Esquema atualizado. Dados existentes foram preservados.');
} catch (error) {
    console.error(databaseError(error));
    process.exitCode = 1;
} finally {
    if (sql) await sql.end({ timeout: 5 });
}
