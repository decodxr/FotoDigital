// Real PostgreSQL engine in WASM, isolated in memory; not a remote Supabase mock.
import { PGlite } from '@electric-sql/pglite';
import { setupSQL } from '../scripts/postgres-migrations.mjs';
import { parameterize, safeInteger } from '../lib/server/postgres.mjs';
import type { Statement } from '../lib/server/platform-types';
export { putObject, getObject, headObject, deleteObject, presignUpload } from './storage';
export const platformName: string = 'vercel';
export const config = (key: string) => ({ PIX_KEY: '05998428000199', ADMIN_BOOTSTRAP_TOKEN: 'test-only-bootstrap-code-1234567890', APP_URL: 'https://fotodigital.test', NODE_ENV: 'development' } as Record<string, string>)[key] ?? '';
const db = new PGlite({ parsers: { 20: safeInteger } });
await db.exec(setupSQL());

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await db.query<T>(parameterize(sql), params)).rows;
}
export async function transaction(statements: Statement[]) {
    return db.transaction(async tx => {
        const results = [];
        for (const statement of statements) {
            const result = await tx.query(parameterize(statement.sql), statement.params ?? []);
            results.push({ changes: result.affectedRows });
        }
        return results;
    });
}
export async function close() { await db.close(); }
