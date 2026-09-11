// Vercel/Node adapter. Vite replaces this module with platform-sites.ts.
import type { Statement } from './platform-types';
import { createPostgres, parameterize, postgresTransaction } from './postgres.mjs';
import { createDatabaseRuntime } from './postgres-runtime';
export { putObject, getObject, headObject, deleteObject, presignUpload } from './storage-s3';

export const config = (key: string) => process.env[key] ?? '';
export const platformName: string = 'vercel';
const database = createDatabaseRuntime(() => createPostgres(config('DATABASE_URL'), { ca: config('DATABASE_CA_CERT') }));

function parameters(values: unknown[]): (string | number | boolean | null)[] {
    return values.map(value => {
        if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
            (typeof value === 'number' && Number.isFinite(value))) return value;
        throw Error('Parâmetro SQL inválido.');
    });
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const values = parameters(params);
    const verb = sql.trim().match(/^[a-z]+/i)?.[0].toUpperCase() ?? 'SQL';
    const table = sql.match(/\b(?:FROM|INTO|UPDATE)\s+"?([a-z_][a-z0-9_]*)/i)?.[1] ?? '';
    return await database.run('query', `${verb}:${table}`, client => client.unsafe(parameterize(sql), values)) as unknown as T[];
}

export async function transaction(statements: Statement[]): Promise<{ changes: number }[]> {
    const bound = statements.map(statement => ({
        sql: statement.sql, params: parameters(statement.params ?? []),
    }));
    return database.run('transaction', `${bound.length} statements`, client => postgresTransaction(client, bound));
}
