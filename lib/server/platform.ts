// Vercel/Node adapter. Vite replaces this module with platform-sites.ts.
import type { Statement } from './platform-types';
import { createPostgres, parameterize, postgresTransaction } from './postgres.mjs';
export { putObject, getObject, headObject, deleteObject, presignUpload } from './storage-s3';

export const config = (key: string) => process.env[key] ?? '';
export const platformName: string = 'vercel';
let client: ReturnType<typeof createPostgres> | undefined;

function database() {
    return client ??= createPostgres(config('DATABASE_URL'), { ca: config('DATABASE_CA_CERT') });
}

function parameters(values: unknown[]): (string | number | boolean | null)[] {
    return values.map(value => {
        if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
            (typeof value === 'number' && Number.isFinite(value))) return value;
        throw Error('Parâmetro SQL inválido.');
    });
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await database().unsafe(parameterize(sql), parameters(params)) as unknown as T[];
}

export async function transaction(statements: Statement[]): Promise<{ changes: number }[]> {
    return postgresTransaction(database(), statements.map(statement => ({
        sql: statement.sql, params: parameters(statement.params ?? []),
    })));
}
