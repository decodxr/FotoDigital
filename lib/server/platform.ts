// Vercel/Node adapter. Vite replaces this module with platform-sites.ts.
import type { Statement, StoredObject } from './platform-types';
import { signedS3Url } from './s3';
export const config = (key: string) => process.env[key] ?? '';
function postgres(sql: string) { let n = 0; return sql.replace(/\?/g, () => '$' + (++n)); }
// Neon SQL-over-HTTP; response validation fails closed on an incompatible bridge.
async function neon(body: unknown) { const connection = config('DATABASE_URL'); if (!connection)
    throw Error('Configure DATABASE_URL para conectar o PostgreSQL.'); const url = new URL(connection); if (!url.hostname.endsWith('.neon.tech'))
    throw Error('Este adapter requer um endpoint PostgreSQL Neon.'); const response = await fetch('https://' + url.hostname + '/sql', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connection, 'Neon-Raw-Text-Output': 'false', 'Neon-Array-Mode': 'false', 'Neon-Batch-Isolation-Level': 'Serializable' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!response.ok)
    throw Error('Falha no banco PostgreSQL.'); return response.json(); }
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> { const result = await neon({ query: postgres(sql), params }); if (!Array.isArray(result.rows))
    throw Error('Resposta PostgreSQL inválida.'); return result.rows; }
export async function transaction(statements: Statement[]): Promise<{
    changes: number;
}[]> { const result = await neon({ queries: statements.map(s => ({ query: postgres(s.sql), params: s.params ?? [] })) }); const rows = Array.isArray(result) ? result : result.results; if (!Array.isArray(rows) || rows.length !== statements.length)
    throw Error('Resposta da transação PostgreSQL inválida.'); return rows.map((r: {
    rowCount: number;
}) => ({ changes: r.rowCount })); }
export async function putObject(key: string, body: ReadableStream<Uint8Array>, mime: string, bytes: number) { const url = await signedS3Url('PUT', key, config); const r = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': mime, 'Content-Length': String(bytes) }, duplex: 'half' } as RequestInit); if (!r.ok)
    throw Error('Não foi possível armazenar o arquivo.'); }
export async function getObject(key: string): Promise<StoredObject | null> { const r = await fetch(await signedS3Url('GET', key, config)); if (r.status === 404)
    return null; if (!r.ok || !r.body)
    throw Error('Arquivo indisponível.'); return { body: r.body, size: Number(r.headers.get('content-length')), mime: r.headers.get('content-type') ?? 'application/octet-stream' }; }
export async function headObject(key: string) { const r = await fetch(await signedS3Url('HEAD', key, config), { method: 'HEAD' }); if (r.status === 404)
    return null; if (!r.ok)
    throw Error('Storage indisponível.'); return { size: Number(r.headers.get('content-length')) }; }
export async function deleteObject(key: string) { const r = await fetch(await signedS3Url('DELETE', key, config), { method: 'DELETE' }); if (!r.ok)
    throw Error('Não foi possível excluir o arquivo.'); }
export async function presignUpload(key: string, _mime: string) { void _mime; return signedS3Url('PUT', key, config); }
export const platformName: string = 'vercel';
