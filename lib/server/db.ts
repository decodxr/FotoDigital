import { query, transaction } from '@/lib/server/platform';
import type { Statement } from './platform-types';
export { query, transaction };
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export async function one<T>(sql: string, params: unknown[] = []) { return (await query<T>(sql, params))[0] ?? null; }
export function insert(table: string, data: Record<string, unknown>, ignore = false): Statement { const keys = Object.keys(data); return { sql: `INSERT INTO "${table}" (${keys.map(k => '"' + k + '"').join(',')}) VALUES (${keys.map(() => '?').join(',')})${ignore ? ' ON CONFLICT DO NOTHING' : ''}`, params: Object.values(data) }; }
export async function add(table: string, data: Record<string, unknown>, ignore = false) { return transaction([insert(table, data, ignore)]); }
export function update(table: string, id: string, data: Record<string, unknown>): Statement { return { sql: `UPDATE "${table}" SET ${Object.keys(data).map(k => '"' + k + '" = ?').join(',')} WHERE id = ?`, params: [...Object.values(data), id] }; }
export const json = <T>(s: unknown, fallback: T): T => { if (typeof s !== 'string')
    return (s as T) ?? fallback; try {
    return JSON.parse(s) as T;
}
catch {
    return fallback;
} };
