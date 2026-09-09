import { config, platformName } from '@/lib/server/platform';
import type { Customer } from '@/lib/shared/types';
import { z } from 'zod';
import { add, now, one, query, uid } from './db';
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export const requireValue = (condition: unknown, message: string, status = 400) => { if (!condition)
    throw new HttpError(status, message); };
export const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
export const sha = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
export function cookie(req: Request, key: string) { return req.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(key + '='))?.slice(key.length + 1) ?? ''; }
export function setCookie(res: Response, key: string, value: string, maxAge: number) { res.headers.append('Set-Cookie', `${key}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config('NODE_ENV') === 'development' ? '' : '; Secure'}`); }
export async function passwordHash(password: string, salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']); const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256); return `pbkdf2:100000:${salt}:${hex(result)}`; }
export async function verifyPassword(password: string, hash: string) { const parts = hash.split(':'); if (parts[0] !== 'pbkdf2' || parts[1] !== '100000')
    return false; const expected = await passwordHash(password, parts[2]); return await sha(expected) === await sha(hash); }
export async function getUser(req: Request): Promise<Customer | null> {
    const token = cookie(req, 'fd_session');
    if (token) {
        const u = await one<Customer>('SELECT u.id,u.name,u.email,u.phone,u."taxId",u.role FROM users u JOIN sessions s ON s."userId"=u.id WHERE s.id=? AND s."expiresAt">?', [await sha(token), now()]);
        if (u)
            return u;
    }
    // These headers are accepted ONLY in the Sites build; never on Vercel.
    const email = platformName === 'sites' ? req.headers.get('oai-authenticated-user-email')?.toLowerCase() : null;
    const siteUser = platformName === 'sites' ? req.headers.get('oai-authenticated-user-id') : null;
    if (email && siteUser) {
        let u = await one<Customer>('SELECT id,name,email,phone,"taxId",role FROM users WHERE email=?', [email]);
        if (!u) {
            let name = email.split('@')[0];
            try {
                name = decodeURIComponent(req.headers.get('oai-authenticated-user-full-name') ?? name);
            }
            catch { }
            ;
            const isAdmin = config('ADMIN_EMAILS').toLowerCase().split(',').map(x => x.trim()).includes(email);
            await add('users', { id: uid(), email, name, role: isAdmin ? 'admin' : 'customer', createdAt: now() }, true);
            u = await one<Customer>('SELECT id,name,email,phone,"taxId",role FROM users WHERE email=?', [email]);
        }
        if (u && config('ADMIN_EMAILS').toLowerCase().split(',').map(x => x.trim()).includes(email))
            u.role = 'admin';
        return u;
    }
    return null;
}
export async function requireUser(req: Request, admin = false) { const u = await getUser(req); if (!u)
    throw new HttpError(401, 'Entre na sua conta para continuar.'); if (admin && u.role !== 'admin')
    throw new HttpError(403, 'Esta área é exclusiva da administração.'); return u; }
export async function owner(req: Request) { const user = await getUser(req); const guest = cookie(req, 'fd_guest'); return { user, key: user ? 'user:' + user.id : /^[a-f0-9-]{36}$/.test(guest) ? 'guest:' + guest : null }; }
export async function rateLimit(key: string, max = 60, seconds = 60) { const id = await sha(key + ':' + Math.floor(Date.now() / seconds / 1000)); const result = await query<{
    count: number;
}>('INSERT INTO "rateLimits" (id,count,"resetAt") VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count="rateLimits".count+1 RETURNING count', [id, new Date(Date.now() + seconds * 1000).toISOString()]); if ((result[0]?.count ?? 0) > max)
    throw new HttpError(429, 'Muitas tentativas. Aguarde um pouco e tente novamente.'); }
export function csrf(req: Request) { if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
    return; const origin = req.headers.get('origin'); const allowed = config('APP_URL'); requireValue(origin && (origin === new URL(req.url).origin || (allowed && origin === new URL(allowed).origin)), 'Requisição de origem inválida.', 403); }
export async function readBytes(req: Request, max: number) { requireValue(Number(req.headers.get('content-length') ?? 0) <= max, 'Solicitação muito grande.', 413); requireValue(req.body, 'Solicitação vazia.'); const reader = req.body!.getReader(); const parts: Uint8Array[] = []; let length = 0; try {
    while (true) {
        const item = await reader.read();
        if (item.done)
            break;
        length += item.value.byteLength;
        requireValue(length <= max, 'Solicitação muito grande.', 413);
        parts.push(item.value);
    }
}
finally {
    await reader.cancel();
} const out = new Uint8Array(length); let offset = 0; for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
} return out; }
export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> { requireValue(Number(req.headers.get('content-length') ?? 0) <= 1000000, 'Solicitação muito grande.', 413); const raw = new TextDecoder().decode(await readBytes(req, 1000000)); requireValue(raw.length <= 1000000, 'Solicitação muito grande.', 413); let value; try {
    value = JSON.parse(raw);
}
catch {
    throw new HttpError(400, 'Dados inválidos.');
} const result = schema.safeParse(value); if (!result.success)
    throw new HttpError(422, result.error.issues.map(i => i.message).join(' ')); return result.data; }
export async function audit(userId: string, action: string, entityId: string) { await add('auditLogs', { id: uid(), userId, action, entityId, createdAt: now() }); }
export function respond(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
