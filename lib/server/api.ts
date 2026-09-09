import { uploadStoreMedia, readStoreMedia } from './store-media';
import { config, platformName } from '@/lib/server/platform';
import type { OrderStatus } from '@/lib/shared/types';
import { z, ZodError } from 'zod';
import { adminData, archiveEntity, saveEntity } from './admin';
import { cartIdentity, cartSchema, getCart, validateItem } from './cart';
import { catalog } from './catalog';
import { add, insert, now, one, query, transaction, uid, update } from './db';
import { completeUpload, downloadFile, initializeUpload, orderZip, pruneFiles, publicPhoto, removeUpload, uploadBytes, UploadRecord, uploadThumbnail } from './files';
import { addressSchema, changeStatus, checkoutSchema, createOrder, evaluateCoupon, readOrder, repeatOrder, retryPayment } from './orders';
import { paymentAvailability, quoteShipping, verifyWebhook } from './providers';
import { audit, body, cookie, csrf, getUser, HttpError, owner, passwordHash, rateLimit, readBytes, requireUser, requireValue, respond, setCookie, sha, verifyPassword } from './security';
const credentials = z.object({ email: z.string().trim().email().transform(v => v.toLowerCase()), password: z.string().min(10, 'Use uma senha com pelo menos 10 caracteres.').max(128), name: z.string().trim().min(2).max(120).optional() });
export async function handleApi(req: Request, path: string[]): Promise<Response> {
    try {
        const [resource, id, action] = path;
        const method = req.method;
        if (!(resource === 'payments' && id === 'webhook'))
            csrf(req);
        if (!['GET', 'HEAD'].includes(method)) {
            const identity = await owner(req);
            await rateLimit('api:' + (identity.key ?? req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? 'anonymous'), resource === 'uploads' ? 800 : 100, 60);
        }
        if (resource === 'store-media' && method === 'GET') return await readStoreMedia(req, id);
        if (resource === 'catalog' && method === 'GET')
            return respond(await catalog());
        if (resource === 'session' && method === 'GET') {
            const user = await getUser(req);
            const res = respond({ user, payments: paymentAvailability() });
            if (!cookie(req, 'fd_guest'))
                setCookie(res, 'fd_guest', uid(), 2592000);
            return res;
        }
        if (resource === 'auth' && method === 'POST') {
            if (id === 'logout') {
                const token = cookie(req, 'fd_session');
                if (token)
                    await transaction([{ sql: 'DELETE FROM sessions WHERE id=?', params: [await sha(token)] }]);
                const r = respond({ ok: true, redirect: platformName === 'sites' ? '/signout-with-chatgpt?return_to=/' : '/' });
                setCookie(r, 'fd_session', '', 0);
                return r;
            }
            if (id === 'password') {
                const user = await requireUser(req);
                const data = await body(req, z.object({ current: z.string(), password: z.string().min(10).max(128) }));
                const row = await one<{
                    passwordHash: string;
                }>('SELECT "passwordHash" FROM users WHERE id=?', [user.id]);
                requireValue(row?.passwordHash && await verifyPassword(data.current, row.passwordHash), 'Senha atual incorreta.', 403);
                await transaction([update('users', user.id, { passwordHash: await passwordHash(data.password) }), { sql: 'DELETE FROM sessions WHERE "userId"=?', params: [user.id] }]);
                return respond({ ok: true });
            }
            requireValue(id === 'login' || id === 'register', 'Ação inválida.', 404);
            const data = await body(req, credentials);
            await rateLimit('login:' + data.email, 8, 900);
            let user = await one<{
                id: string;
                passwordHash: string;
            }>('SELECT id,"passwordHash" FROM users WHERE email=?', [data.email]);
            if (id === 'register') {
                requireValue(data.name, 'Informe seu nome.');
                requireValue(!user, 'Não foi possível criar a conta. Tente entrar ou fale com a loja.', 409);
                const userId = uid();
                await add('users', { id: userId, email: data.email, name: data.name, passwordHash: await passwordHash(data.password), role: 'customer', createdAt: now() });
                user = { id: userId, passwordHash: '' };
            }
            else {
                const valid = await verifyPassword(data.password, user?.passwordHash ?? 'pbkdf2:100000:constant:invalid');
                requireValue(user && valid, 'E-mail ou senha incorretos.', 401);
            }
            const token = uid() + uid();
            await add('sessions', { id: await sha(token), userId: user!.id, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), createdAt: now() });
            const guest = cookie(req, 'fd_guest');
            if (guest) {
                const guestKey = 'guest:' + guest;
                const userKey = 'user:' + user!.id;
                const gc = await one<{
                    id: string;
                }>('SELECT id FROM carts WHERE "ownerKey"=?', [guestKey]);
                const uc = await one<{
                    id: string;
                }>('SELECT id FROM carts WHERE "ownerKey"=?', [userKey]);
                const statements = [{ sql: 'UPDATE uploads SET "ownerKey"=?,"userId"=? WHERE "ownerKey"=?', params: [userKey, user!.id, guestKey] }];
                if (gc && uc)
                    statements.push({ sql: 'UPDATE "cartItems" SET "cartId"=? WHERE "cartId"=?', params: [uc.id, gc.id] }, { sql: 'DELETE FROM carts WHERE id=?', params: [gc.id] });
                else if (gc)
                    statements.push({ sql: 'UPDATE carts SET "ownerKey"=?,"userId"=? WHERE id=?', params: [userKey, user!.id, gc.id] });
                await transaction(statements);
            }
            const res = respond({ ok: true });
            setCookie(res, 'fd_session', token, 604800);
            return res;
        }
        if (resource === 'profile') {
            const u = await requireUser(req);
            if (method === 'GET')
                return respond(u);
            if (method === 'PATCH') {
                const data = await body(req, z.object({ name: z.string().min(2).max(120), phone: z.string().max(20), taxId: z.string().max(20) }));
                await transaction([update('users', u.id, data)]);
                return respond({ ...u, ...data });
            }
        }
        if (resource === 'addresses') {
            const u = await requireUser(req);
            if (method === 'GET')
                return respond(await query('SELECT id,data FROM addresses WHERE "userId"=?', [u.id]));
            if (method === 'POST') {
                const data = await body(req, addressSchema);
                const aid = uid();
                await add('addresses', { id: aid, userId: u.id, data: JSON.stringify(data), createdAt: now() });
                return respond({ id: aid });
            }
            if (method === 'DELETE') {
                await transaction([{ sql: 'DELETE FROM addresses WHERE id=? AND "userId"=?', params: [id, u.id] }]);
                return respond({ ok: true });
            }
        }
        if (resource === 'favorites') {
            const u = await requireUser(req);
            if (method === 'GET')
                return respond((await query<{
                    productId: string;
                }>('SELECT "productId" FROM favorites WHERE "userId"=?', [u.id])).map(r => r.productId));
            if (method === 'POST') {
                const data = await body(req, z.object({ productIds: z.array(z.string().max(100)).max(100) }));
                await transaction(data.productIds.map(productId => insert('favorites', { id: uid(), userId: u.id, productId }, true)));
                return respond({ ok: true });
            }
            if (method === 'DELETE') {
                await transaction([{ sql: 'DELETE FROM favorites WHERE "userId"=? AND "productId"=?', params: [u.id, id] }]);
                return respond({ ok: true });
            }
        }
        if (resource === 'cart') {
            if (method === 'GET')
                return respond(await getCart(req));
            const { cartId } = await cartIdentity(req);
            if (method === 'POST' || method === 'PATCH') {
                const data = await body(req, cartSchema);
                await validateItem(req, data);
                const values = { productId: data.productId, quantity: data.quantity, variantId: data.variantId ?? null, fields: JSON.stringify(data.fields), photos: JSON.stringify(data.photos) };
                if (method === 'PATCH') {
                    requireValue(await one('SELECT id FROM "cartItems" WHERE id=? AND "cartId"=?', [id, cartId]), 'Item não encontrado.', 404);
                    await transaction([update('cartItems', id, values)]);
                }
                else {
                    const count = await one<{
                        count: number;
                    }>('SELECT COUNT(*) AS count FROM "cartItems" WHERE "cartId"=?', [cartId]);
                    requireValue((count?.count ?? 0) < 100, 'Limite de itens do carrinho atingido.');
                    await add('cartItems', { id: uid(), cartId, ...values, createdAt: now() });
                }
                return respond(await getCart(req));
            }
            if (method === 'DELETE') {
                await transaction([{ sql: 'DELETE FROM "cartItems" WHERE id=? AND "cartId"=?', params: [id, cartId] }]);
                return respond(await getCart(req));
            }
        }
        if (resource === 'uploads') {
            if (method === 'GET') {
                const { key } = await owner(req);
                return respond((await query<UploadRecord>('SELECT * FROM uploads WHERE "ownerKey"=? AND status=? AND "expiresAt">? ORDER BY "createdAt" DESC LIMIT 200', [key, 'ready', now()])).map(publicPhoto));
            }
            if (method === 'POST' && !id) {
                const data = await body(req, z.object({ name: z.string().min(1).max(250), mime: z.enum(['image/jpeg', 'image/png', 'image/heic', 'application/pdf']), bytes: z.number().int().positive(), width: z.number().int().min(0).max(30000), height: z.number().int().min(0).max(30000), consent: z.boolean() }));
                return respond(await initializeUpload(req, data));
            }
            if (method === 'PUT' && action === 'thumbnail')
                return respond(await uploadThumbnail(req, id));
            if (method === 'PUT')
                return respond(await uploadBytes(req, id));
            if (method === 'POST' && action === 'complete')
                return respond(await completeUpload(req, id));
            if (method === 'DELETE')
                return respond(await removeUpload(req, id));
        }
        if (resource === 'files' && method === 'GET')
            return await downloadFile(req, id);
        if (resource === 'shipping' && method === 'POST') {
            const data = await body(req, z.object({ cep: z.string().regex(/^\d{8}$/, 'Digite um CEP válido com 8 números.') }));
            return respond(await quoteShipping(req, data.cep));
        }
        if (resource === 'coupon' && method === 'POST') {
            const u = await requireUser(req);
            const { code } = await body(req, z.object({ code: z.string().max(60) }));
            const cart = await getCart(req);
            const result = await evaluateCoupon(code, u.id, cart.items, cart.subtotal);
            return respond({ code: result.coupon.code, discount: result.discount });
        }
        if (resource === 'orders') {
            if (method === 'POST' && !id)
                return respond(await createOrder(req, await body(req, checkoutSchema)), 201);
            if (method === 'GET' && !id) {
                const u = await requireUser(req);
                return respond(await query('SELECT id,number,status,total,"paymentStatus","createdAt" FROM orders WHERE "userId"=? ORDER BY "createdAt" DESC LIMIT 100', [u.id]));
            }
            if (method === 'GET' && id)
                return respond(await readOrder(req, id));
            if (method === 'POST' && action === 'pay')
                return respond(await retryPayment(req, id));
            if (method === 'POST' && action === 'repeat')
                return respond(await repeatOrder(req, id));
        }
        if (resource === 'inquiries' && method === 'POST') {
            const { user, key } = await owner(req);
            const data = await body(req, z.object({ kind: z.enum(['contact', 'restoration', 'photography', 'product']), name: z.string().trim().min(2).max(120), phone: z.string().min(10).max(20), email: z.string().email().optional(), message: z.string().trim().min(10).max(6000), photoId: z.string().uuid().optional(), consent: z.literal(true) }));
            if (data.photoId)
                requireValue(await one('SELECT id FROM uploads WHERE id=? AND "ownerKey"=? AND status=?', [data.photoId, key, 'ready']), 'Arquivo indisponível.');
            const inquiryId = uid();
            await add('inquiries', { id: inquiryId, userId: user?.id ?? null, kind: data.kind, name: data.name, phone: data.phone, email: data.email ?? null, message: data.message, photoId: data.photoId ?? null, createdAt: now() });
            return respond({ id: inquiryId, message: 'Recebemos sua mensagem. Nossa equipe retornará pelo contato informado.' }, 201);
        }
        if (resource === 'payments' && id === 'webhook' && method === 'POST') {
            const raw = new TextDecoder().decode(await readBytes(req, 100000));
            await verifyWebhook(req, raw);
            const data = z.object({ orderId: z.string().uuid(), externalId: z.string(), status: z.enum(['approved', 'failed']), amountCents: z.number().int().nonnegative(), currency: z.literal('BRL') }).parse(JSON.parse(raw));
            const payment = await one<{
                id: string;
                amount: number;
                status: string;
            }>('SELECT id,amount,status FROM payments WHERE "orderId"=? AND "externalId"=?', [data.orderId, data.externalId]);
            requireValue(payment && payment.amount === data.amountCents, 'Pagamento não corresponde ao pedido.', 409);
            if (payment!.status === 'approved')
                return respond({ ok: true });
            if (data.status === 'approved') {
                const state = await one<{
                    status: string;
                }>('SELECT status FROM orders WHERE id=?', [data.orderId]);
                requireValue(state?.status === 'payment_pending', 'A loja deve conciliar este recebimento: pedido fora da etapa de pagamento.', 409);
                await transaction([update('payments', payment!.id, { status: 'approved' }), { sql: 'UPDATE orders SET "paymentStatus"=?,status=? WHERE id=? AND status=?', params: ['approved', 'paid', data.orderId, 'payment_pending'] }, insert('orderEvents', { id: data.orderId + ':from:payment_pending', orderId: data.orderId, status: 'paid', note: 'Pagamento confirmado pela operadora.', createdAt: now() })]);
            }
            return respond({ ok: true });
        }
        if (resource === 'admin') {
            if (id === 'bootstrap' && method === 'POST') {
                const u = await requireUser(req);
                const data = await body(req, z.object({ token: z.string().min(20) }));
                await rateLimit('admin-bootstrap:' + u.id, 3, 3600);
                requireValue(config('ADMIN_BOOTSTRAP_TOKEN') && await sha(data.token) === await sha(config('ADMIN_BOOTSTRAP_TOKEN')), 'Código de configuração inválido.', 403);
                requireValue(!await one('SELECT id FROM users WHERE role=?', ['admin']), 'A administração já foi configurada.', 409);
                const result = await transaction([{ sql: 'UPDATE users SET role=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM users WHERE role=?)', params: ['admin', u.id, 'admin'] }]);
                requireValue(result[0].changes === 1, 'A administração já foi configurada.', 409);
                await audit(u.id, 'admin.bootstrap', u.id);
                return respond({ ok: true });
            }
            await requireUser(req, true);
            if (id === 'media' && method === 'POST') return respond(await uploadStoreMedia(req), 201);
            if (id === 'files' && action === 'prune' && method === 'POST')
                return respond(await pruneFiles(req));
            if (id === 'order' && action) {
                const orderId = action, operation = path[3];
                if (method === 'GET' && operation === 'zip')
                    return await orderZip(req, orderId);
                if (method === 'GET')
                    return respond(await readOrder(req, orderId, true));
                if (method === 'PATCH') {
                    const data = await body(req, z.object({ status: z.string().optional(), note: z.string().max(2000).default(''), tracking: z.string().max(100).optional(), internalNote: z.string().max(6000).optional() }));
                    if (data.internalNote !== undefined) {
                        await transaction([update('orders', orderId, { internalNote: data.internalNote })]);
                        const u = await requireUser(req, true);
                        await audit(u.id, 'order.note', orderId);
                        return respond(await readOrder(req, orderId, true));
                    }
                    return respond(await changeStatus(req, orderId, data.status as OrderStatus, data.note, data.tracking));
                }
            }
            if (id === 'inquiries' && action && method === 'PATCH') {
                const data = await body(req, z.object({ status: z.enum(['received', 'contacted', 'closed']) }));
                await transaction([update('inquiries', action, data)]);
                return respond({ ok: true });
            }
            if (method === 'GET')
                return respond(await adminData(req, id));
            if (method === 'POST' || method === 'PATCH')
                return respond(await saveEntity(req, id, action ?? null, await body(req, z.record(z.unknown()))));
            if (method === 'DELETE')
                return respond(await archiveEntity(req, id, action, new URL(req.url).searchParams.has('permanent')));
        }
        throw new HttpError(404, 'Recurso não encontrado.');
    }
    catch (error) {
        if (error instanceof HttpError)
            return respond({ error: error.message }, error.status);
        if (error instanceof ZodError)
            return respond({ error: error.issues.map(i => i.message).join(' ') }, 422);
        console.error('api_error', error instanceof Error ? error.message : 'unknown');
        return respond({ error: 'Não foi possível concluir agora. Seus dados permanecem na tela; tente novamente.' }, 503);
    }
}
