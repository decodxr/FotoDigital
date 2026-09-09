import { config } from '@/lib/server/platform';
import type { Order, Quote } from '@/lib/shared/types';
import { z } from 'zod';
import { getCart, shippingItems } from './cart';
import { getSettings } from './catalog';
import { add, now, uid } from './db';
import { HttpError, owner, requireValue, sha } from './security';
export interface ShippingProvider {
    carrier: string;
    quote(input: {
        originCep: string;
        destinationCep: string;
        items: ReturnType<typeof shippingItems>;
    }): Promise<Omit<Quote, 'id' | 'expiresAt'>[]>;
}
const quoteSchema = z.object({ quotes: z.array(z.object({ service: z.string().min(1).max(100), cents: z.number().int().min(0), days: z.number().int().min(1).max(180) })).max(20) });
// A merchant-owned bridge implements the documented contract. No assumed carrier URLs.
export class HttpShippingProvider implements ShippingProvider {
    constructor(public carrier: string, private prefix: string) { }
    async quote(input: Parameters<ShippingProvider['quote']>[0]) { const endpoint = config(this.prefix + '_QUOTE_URL'), token = config(this.prefix + '_API_TOKEN'); if (!endpoint || !token)
        throw new HttpError(503, this.carrier + ': consulta de frete ainda indisponível.'); const u = new URL(endpoint); if (u.protocol !== 'https:')
        throw new HttpError(503, 'A integração de frete requer HTTPS.'); const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(input), signal: AbortSignal.timeout(8000) }); if (!r.ok)
        throw new HttpError(503, this.carrier + ': não foi possível consultar agora.'); return quoteSchema.parse(await r.json()).quotes.map(q => ({ ...q, carrier: this.carrier })); }
}
export const shippingProviders = [new HttpShippingProvider('Correios', 'CORREIOS'), new HttpShippingProvider('Jadlog', 'JADLOG')];
export async function quoteShipping(req: Request, cep: string) { const cart = await getCart(req); requireValue(cart.ready, 'Configure os produtos do carrinho antes de consultar o frete.'); const { key } = await owner(req); const items = shippingItems(cart.items); requireValue(items.every(i => i.weightGrams && i.widthCm && i.heightCm && i.lengthCm), 'O envio destes produtos precisa ser confirmado pela loja. A retirada local está disponível.', 409); const digest = await sha(JSON.stringify(cart.items)); const results = await Promise.allSettled(shippingProviders.map(p => p.quote({ originCep: '87302230', destinationCep: cep, items }))); const quotes: Quote[] = [], errors: string[] = []; for (const r of results) {
    if (r.status === 'rejected') {
        errors.push(r.reason instanceof Error ? r.reason.message : 'Consulta indisponível.');
        continue;
    }
    for (const q of r.value) {
        const quote = { ...q, id: uid(), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
        await add('shipments', { id: quote.id, ownerKey: key, cep, cartDigest: digest, data: JSON.stringify(quote), expiresAt: quote.expiresAt });
        quotes.push(quote);
    }
} return { quotes, errors }; }
export interface PaymentProvider {
    create(order: Order): Promise<{
        externalId: string;
        url: string;
    }>;
}
export class HostedPaymentProvider implements PaymentProvider {
    async create(order: Order) { const settings = await getSettings(); const endpoint = config('PAYMENT_CREATE_URL'), token = config('PAYMENT_API_TOKEN'); if (!endpoint || !token)
        throw new HttpError(503, 'O pagamento online por cartão ainda não está disponível.'); if (!endpoint.startsWith('https://'))
        throw new HttpError(503, 'O pagamento requer HTTPS.'); const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': order.id }, body: JSON.stringify({ orderId: order.id, amountCents: order.total, currency: 'BRL', method: order.paymentMethod, installments: { maximum: settings.installments, disclosure: settings.installmentText }, customer: order.customer, returnUrl: config('APP_URL') + '/pedido/' + order.id, webhookUrl: config('APP_URL') + '/api/payments/webhook' }), signal: AbortSignal.timeout(10000) }); if (!r.ok)
        throw new HttpError(503, 'Não foi possível abrir o pagamento. Seu pedido continua pendente para tentar novamente.'); const data = z.object({ externalId: z.string(), url: z.string().url() }).parse(await r.json()); const allowed = config('PAYMENT_REDIRECT_HOSTS').split(',').map(x => x.trim()); const url = new URL(data.url); requireValue(url.protocol === 'https:' && allowed.includes(url.hostname), 'Destino de pagamento não autorizado.', 502); return data; }
}
export function paymentAvailability() { return { pix: !!config('PIX_KEY'), card: !!(config('PAYMENT_CREATE_URL') && config('PAYMENT_API_TOKEN') && config('PAYMENT_REDIRECT_HOSTS')), debit: config('PAYMENT_DEBIT_ENABLED') === 'true' }; }
function tlv(id: string, value: string) { return id + String(value.length).padStart(2, '0') + value; }
export function pixPayload(key: string, amount: number, reference: string) { const clean = (s: string, max: number) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, max); const account = tlv('00', 'br.gov.bcb.pix') + tlv('01', key); let payload = tlv('00', '01') + tlv('26', account) + tlv('52', '0000') + tlv('53', '986') + tlv('54', (amount / 100).toFixed(2)) + tlv('58', 'BR') + tlv('59', 'MATSUMI E MATSUMI LTDA') + tlv('60', 'CAMPO MOURAO') + tlv('62', tlv('05', clean(reference, 25))) + '6304'; let crc = 0xffff; for (const c of payload) {
    crc ^= c.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++)
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
} payload += crc.toString(16).toUpperCase().padStart(4, '0'); return payload; }
export async function verifyWebhook(req: Request, raw: string) { const secret = config('PAYMENT_WEBHOOK_SECRET'); requireValue(secret, 'Webhook indisponível.', 503); const stamp = req.headers.get('x-fd-timestamp') ?? ''; requireValue(/^\d+$/.test(stamp) && Math.abs(Date.now() - Number(stamp) * 1000) < 300000, 'Webhook expirado.', 401); const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sig = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stamp + '.' + raw)))).map(x => x.toString(16).padStart(2, '0')).join(''); requireValue(await sha(sig) === await sha(req.headers.get('x-fd-signature') ?? ''), 'Assinatura inválida.', 401); }
export const createdAt = now;
