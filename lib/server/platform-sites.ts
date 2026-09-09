import { env } from 'cloudflare:workers';
import type { Statement, StoredObject } from './platform-types';
type BindingEnv = {
    DB: D1Database;
    BUCKET: R2Bucket;
    [key: string]: unknown;
};
const bindings = () => env as unknown as BindingEnv;
export const config = (key: string) => String(bindings()[key] ?? process.env[key] ?? '');
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> { const db = bindings().DB; if (!db)
    throw Error('Banco de dados indisponível.'); return (await db.prepare(sql).bind(...params).all<T>()).results; }
export async function transaction(statements: Statement[]) { const db = bindings().DB; const result = await db.batch(statements.map(s => db.prepare(s.sql).bind(...(s.params ?? [])))); return result.map(r => ({ changes: r.meta.changes })); }
export async function putObject(key: string, body: ReadableStream<Uint8Array>, mime: string, bytes: number) { const fixed = new FixedLengthStream(bytes); await Promise.all([body.pipeTo(fixed.writable), bindings().BUCKET.put(key, fixed.readable, { httpMetadata: { contentType: mime } })]); }
export async function getObject(key: string): Promise<StoredObject | null> { const r = await bindings().BUCKET.get(key); return r ? { body: r.body, size: r.size, mime: r.httpMetadata?.contentType ?? 'application/octet-stream' } : null; }
export async function headObject(key: string) { const r = await bindings().BUCKET.head(key); return r ? { size: r.size } : null; }
export async function deleteObject(key: string) { await bindings().BUCKET.delete(key); }
export async function presignUpload(_key: string, _mime: string): Promise<string | null> { void _key; void _mime; return null; }
export const platformName = 'sites';
