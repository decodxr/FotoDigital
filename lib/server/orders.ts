import { config } from '@/lib/server/platform';
import { totals, transitions, validTaxId } from '@/lib/shared/commerce';
import type { CartItem, Order, OrderStatus, Quote } from '@/lib/shared/types';
import { z } from 'zod';
import { cartIdentity, getCart, itemFileIds, stockTotals, validateItem } from './cart';
import { getSettings } from './catalog';
import { insert, json, now, one, query, transaction, uid, update } from './db';
import { HostedPaymentProvider, paymentAvailability, pixPayload } from './providers';
import { audit, HttpError, requireUser, requireValue, sha } from './security';
export const customerSchema = z.object({ name: z.string().trim().min(3, 'Informe seu nome completo.').max(120), email: z.string().email('E-mail inválido.'), phone: z.string().regex(/^\+?[\d ()-]{10,20}$/, 'Telefone inválido.'), taxId: z.string().refine(validTaxId, 'CPF ou CNPJ inválido.') });
export const addressSchema = z.object({ cep: z.string().regex(/^\d{8}$/, 'CEP inválido.'), street: z.string().min(3), number: z.string().min(1), complement: z.string().max(120).default(''), district: z.string().min(2), city: z.string().min(2), state: z.string().regex(/^[A-Z]{2}$/) });
export const checkoutSchema = z.object({ customer: customerSchema, delivery: z.enum(['pickup', 'shipping']), address: addressSchema.optional(), quoteId: z.string().uuid().optional(), paymentMethod: z.enum(['pix', 'credit', 'debit']), coupon: z.string().max(60).optional(), consent: z.literal(true, { errorMap: () => ({ message: 'Aceite os termos para continuar.' }) }), idempotencyKey: z.string().uuid() });
type Coupon = {
    id: string;
    code: string;
    type: string;
    value: number;
    minAmount: number;
    expiresAt: string | null;
    categories: string;
    maxUses: number | null;
    used: number;
    perCustomer: number;
    firstPurchase: number;
    active: number;
};
export async function evaluateCoupon(code: string, userId: string, items: CartItem[], subtotal: number) {
    const c = await one<Coupon>('SELECT * FROM coupons WHERE code=?', [code.trim().toUpperCase()]);
    requireValue(c && c.active, 'Cupom inválido ou indisponível.');
    const coupon = c!;
    requireValue(!coupon.expiresAt || coupon.expiresAt > now(), 'Este cupom expirou.');
    requireValue(subtotal >= coupon.minAmount, 'O pedido não atingiu o valor mínimo do cupom.');
    requireValue(coupon.maxUses === null || coupon.used < coupon.maxUses, 'O limite deste cupom foi atingido.');
    const uses = await one<{
        count: number;
    }>('SELECT COUNT(*) AS count FROM "couponUses" WHERE "couponId"=? AND "userId"=?', [coupon.id, userId]);
    requireValue((uses?.count ?? 0) < coupon.perCustomer, 'Você já utilizou este cupom.');
    if (coupon.firstPurchase) {
        const prior = await one<{
            count: number;
        }>('SELECT COUNT(*) AS count FROM orders WHERE "userId"=? AND status<>?', [userId, 'cancelled']);
        requireValue(!prior?.count, 'Este cupom é válido apenas para a primeira compra.');
    }
    const categories = json<string[]>(coupon.categories, []);
    const eligible = items.filter(i => !categories.length || categories.includes(i.product.categoryId)).reduce((s, i) => s + (i.subtotal ?? 0), 0);
    requireValue(eligible > 0, 'O cupom não se aplica aos produtos deste pedido.');
    return { coupon, ordinal: (uses?.count ?? 0) + 1, discount: Math.min(eligible, coupon.type === 'percent' ? Math.round(eligible * coupon.value / 100) : coupon.value) };
}
export async function readOrder(req: Request, id: string, admin = false): Promise<Order> { const u = await requireUser(req, admin); const row = await one<Record<string, unknown>>('SELECT * FROM orders WHERE id=?', [id]); requireValue(row, 'Pedido não encontrado.', 404); requireValue(row!.userId === u.id || u.role === 'admin', 'Você não tem acesso a este pedido.', 403); const [items, events] = await Promise.all([query<{
        snapshot: string;
    }>('SELECT snapshot FROM "orderItems" WHERE "orderId"=?', [id]), query<Order['events'][number]>('SELECT status,note,"createdAt" FROM "orderEvents" WHERE "orderId"=? ORDER BY "createdAt"', [id])]); const order = { ...row, address: json(row!.address, {}), customer: json(row!.customer, {}), items: items.map(i => json<CartItem>(i.snapshot, {} as CartItem)), events } as Order; if (u.role !== 'admin')
    delete order.internalNote; return order; }
export async function createOrder(req: Request, input: z.infer<typeof checkoutSchema>) {
    const user = await requireUser(req);
    const existing = await one<{
        id: string;
    }>('SELECT id FROM orders WHERE "userId"=? AND "idempotencyKey"=?', [user.id, input.idempotencyKey]);
    if (existing)
        return readOrder(req, existing.id);
    const { cartId, key } = await cartIdentity(req);
    const cart = await getCart(req);
    const settings = await getSettings();
    requireValue(settings.storeOpen, 'Os pedidos online estão temporariamente pausados.');
    requireValue(cart.ready, 'Há produtos sem preço definido ou indisponíveis. Fale com a loja para continuar.', 409);
    for (const i of cart.items)
        await validateItem(req, i);
    const availability = paymentAvailability();
    requireValue(input.paymentMethod === 'pix' ? (availability.pix && settings.pixEnabled) : availability.card, 'Esta forma de pagamento ainda não está disponível.');
    if (input.paymentMethod === 'debit')
        requireValue(availability.debit, 'Pagamento por débito indisponível.');
    let shipping = 0;
    let shipmentId: string | null = null;
    if (input.delivery === 'shipping') {
        requireValue(input.address && input.quoteId, 'Informe o endereço e selecione um frete.');
        const s = await one<{
            data: string;
            expiresAt: string;
            cartDigest: string;
            cep: string;
        }>('SELECT * FROM shipments WHERE id=? AND "ownerKey"=?', [input.quoteId, key]);
        requireValue(s && s.expiresAt > now() && s.cep === input.address!.cep && s.cartDigest === await sha(JSON.stringify(cart.items)), 'A cotação de frete expirou. Calcule novamente.', 409);
        shipping = json<Quote>(s!.data, {} as Quote).cents;
        shipmentId = input.quoteId!;
    }
    const coupon = input.coupon ? await evaluateCoupon(input.coupon, user.id, cart.items, cart.subtotal) : null;
    const values = totals(cart.subtotal, coupon?.discount ?? 0, shipping, input.paymentMethod === 'pix' ? settings.pixDiscount : 0);
    const id = uid(), number = crypto.getRandomValues(new Uint32Array(1))[0] % 90000000 + 10000000;
    const orderRecord = { id, number, userId: user.id, idempotencyKey: input.idempotencyKey, status: 'payment_pending', ...values, delivery: input.delivery, address: JSON.stringify(input.address ?? {}), customer: JSON.stringify(input.customer), paymentMethod: input.paymentMethod, paymentStatus: 'pending', pixCode: input.paymentMethod === 'pix' ? pixPayload(config('PIX_KEY'), values.total, 'FD' + number) : null, couponId: coupon?.coupon.id ?? null, createdAt: now() };
    const statements = [insert('orders', orderRecord), insert('orderEvents', { id: uid(), orderId: id, status: 'received', note: 'Seu pedido foi recebido.', createdAt: now() }), insert('orderEvents', { id: uid(), orderId: id, status: 'payment_pending', note: 'Aguardando confirmação do pagamento.', createdAt: now() }), insert('payments', { id: uid(), orderId: id, provider: input.paymentMethod === 'pix' ? 'manual_pix' : 'hosted', status: 'pending', amount: values.total, createdAt: now() }), update('users', user.id, { name: input.customer.name, phone: input.customer.phone, taxId: input.customer.taxId })];
    for (const item of cart.items) {
        const itemId = uid();
        statements.push(insert('orderItems', { id: itemId, orderId: id, productId: item.productId, snapshot: JSON.stringify(item) }));
        for (const fileId of itemFileIds(item)) {
            const configs = item.photos.filter(p => p.photoId === fileId);
            for (const pc of configs.length ? configs : [{ photoId: fileId, sizeId: item.product.kind === 'document' ? 'documentos' : 'personalizados', fields: item.fields }])
                statements.push(insert('photoConfigurations', { id: uid(), orderItemId: itemId, photoId: fileId, data: JSON.stringify({...pc,productName:item.product.name,quantity:('quantity' in pc?pc.quantity:1)*item.quantity}) }));
        }
    }
    for (const [productId, quantity] of Object.entries(stockTotals(cart.items))) {
        const item = cart.items.find(i => i.productId === productId)!;
        if (item.product.stock !== null) {
            statements.push({ sql: 'UPDATE inventory SET available=available-? WHERE id=?', params: [quantity, productId] }, { sql: 'UPDATE products SET stock=(SELECT available FROM inventory WHERE id=?) WHERE id=?', params: [productId, productId] });
        }
    }
    for (const item of cart.items) {
        if (item.variantId) {
            const variant = item.product.variants.find(v => v.id === item.variantId);
            if (variant?.stock !== null && variant?.stock !== undefined)
                statements.push({ sql: 'UPDATE inventory SET available=available-? WHERE id=?', params: [item.quantity, item.productId + ':' + item.variantId] });
        }
    }
    if (coupon) {
        statements.push(insert('couponUses', { id: uid(), couponId: coupon.coupon.id, userId: user.id, orderId: id, ordinal: coupon.ordinal }), { sql: 'UPDATE coupons SET used=used+1 WHERE id=?', params: [coupon.coupon.id] });
        if (coupon.coupon.maxUses !== null)
            statements.push({ sql: 'UPDATE "couponInventory" SET available=available-1 WHERE id=?', params: [coupon.coupon.id] });
        if (coupon.coupon.firstPurchase)
            statements.push(insert('firstPurchaseClaims', { id: user.id, orderId: id }));
    }
    if (shipmentId)
        statements.push(update('shipments', shipmentId, { orderId: id }));
    statements.push({ sql: 'DELETE FROM "cartItems" WHERE "cartId"=?', params: [cartId] });
    try {
        await transaction(statements);
    }
    catch (e) {
        const repeat = await one<{
            id: string;
        }>('SELECT id FROM orders WHERE "userId"=? AND "idempotencyKey"=?', [user.id, input.idempotencyKey]);
        if (repeat)
            return readOrder(req, repeat.id);
        console.error('checkout_transaction_failed', e instanceof Error ? e.message : 'unknown');
        throw new HttpError(409, 'Estoque ou cupom foi atualizado durante a compra. Confira seu carrinho e tente novamente.');
    }
    const result = await readOrder(req, id);
    if (input.paymentMethod !== 'pix') {
        try {
            return await retryPayment(req, id);
        }
        catch {
            return { ...result, paymentNotice: 'O pedido foi salvo. Tente abrir o pagamento novamente.' };
        }
    }
    return result;
}
export async function retryPayment(req: Request, id: string) { const order = await readOrder(req, id); requireValue(order.paymentStatus === 'pending' && order.status === 'payment_pending', 'Este pedido não está aguardando pagamento.'); requireValue(order.paymentMethod !== 'pix', 'Use o código PIX do pedido.'); const p = await new HostedPaymentProvider().create(order); await transaction([update('orders', id, { paymentUrl: p.url }), { sql: 'UPDATE payments SET "externalId"=? WHERE "orderId"=?', params: [p.externalId, id] }]); return { ...order, paymentUrl: p.url }; }
export async function changeStatus(req: Request, id: string, status: OrderStatus, note: string, tracking?: string) { const admin = await requireUser(req, true); const order = await readOrder(req, id, true); requireValue(transitions[order.status].includes(status), 'Esta mudança de status não é permitida.'); requireValue(status !== 'shipped' || (order.delivery === 'shipping' && tracking?.trim()), 'Informe o código de rastreio para marcar como enviado.'); requireValue(status !== 'ready' || order.delivery === 'pickup', 'Este pedido foi configurado para envio.'); const changes: Record<string, unknown> = { status }; if (status === 'paid')
    changes.paymentStatus = 'approved'; if (tracking)
    changes.tracking = tracking; const statements = [{ sql: 'UPDATE orders SET status=?,"paymentStatus"=?,tracking=? WHERE id=? AND status=?', params: [status, changes.paymentStatus ?? order.paymentStatus, tracking ?? order.tracking, id, order.status] }, insert('orderEvents', { id: id + ':from:' + order.status, orderId: id, status, note: note || '', createdAt: now() })]; if (status === 'paid')
    statements.push({ sql: 'UPDATE payments SET status=? WHERE "orderId"=?', params: ['approved', id] }); if(status === 'cancelled') {for(const [productId,quantity] of Object.entries(stockTotals(order.items))){const item=order.items.find(i=>i.productId===productId)!;if(item.product.stock!==null)statements.push({sql:'UPDATE inventory SET available=available+? WHERE id=?',params:[quantity,productId]},{sql:'UPDATE products SET stock=(SELECT available FROM inventory WHERE id=?) WHERE id=? AND stock IS NOT NULL',params:[productId,productId]});}for(const item of order.items){const variant=item.product.variants.find(v=>v.id===item.variantId);if(item.variantId&&variant&&variant.stock!==null)statements.push({sql:'UPDATE inventory SET available=available+? WHERE id=?',params:[item.quantity,item.productId+':'+item.variantId]});}}
try{await transaction(statements);}catch{throw new HttpError(409,'Este pedido foi atualizado por outra ação. Recarregue os detalhes.');}await audit(admin.id, 'order.status.' + status, id); return readOrder(req, id, true); }
export async function repeatOrder(req: Request, id: string) { const order = await readOrder(req, id); const { cartId } = await cartIdentity(req); for (const item of order.items)
    await validateItem(req, item); await transaction(order.items.map(item => insert('cartItems', { id: uid(), cartId, productId: item.productId, quantity: item.quantity, variantId: item.variantId ?? null, fields: JSON.stringify(item.fields), photos: JSON.stringify(item.photos), createdAt: now() }))); return getCart(req); }
