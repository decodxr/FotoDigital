import { parsePages, photoQuality, tierPrice } from '@/lib/shared/commerce';
import type { CartData, CartItem, PhotoConfig, PrintSize, Product } from '@/lib/shared/types';
import { z } from 'zod';
import { catalog, productRow } from './catalog';
import { add, json, now, one, query, uid } from './db';
import { HttpError, owner, requireValue } from './security';
export const cropSchema = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), zoom: z.number().min(1).max(4), rotation: z.number().refine(v => [0, 90, 180, 270].includes(v)), fit: z.enum(['cover', 'contain']) });
export const photoConfigSchema = z.object({ photoId: z.string().uuid(), sizeId: z.string().max(60), quantity: z.number().int().min(1).max(999), finish: z.string().max(40), crop: cropSchema, caption: z.string().max(80).optional(), qualityAccepted: z.boolean().optional() });
export const cartSchema = z.object({ productId: z.string().min(1).max(80), quantity: z.number().int().min(1).max(999), variantId: z.string().max(80).optional(), fields: z.record(z.string().max(3000)).default({}), photos: z.array(photoConfigSchema).max(200).default([]) });
type RawCart = {
    id: string;
    productId: string;
    quantity: number;
    variantId?: string;
    fields: string;
    photos: string;
};
export async function cartIdentity(req: Request) { const o = await owner(req); requireValue(o.key, 'Atualize a página para iniciar seu carrinho.', 401); let c = await one<{
    id: string;
}>('SELECT id FROM carts WHERE "ownerKey"=?', [o.key]); if (!c) {
    c = { id: uid() };
    await add('carts', { id: c.id, ownerKey: o.key, userId: o.user?.id ?? null, createdAt: now() }, true);
    c = (await one<{
        id: string;
    }>('SELECT id FROM carts WHERE "ownerKey"=?', [o.key]))!;
} return { ...o, cartId: c.id }; }
export async function getCart(req: Request): Promise<CartData> {
    const { cartId } = await cartIdentity(req);
    const data = await catalog();
    const raw = await query<RawCart>('SELECT * FROM "cartItems" WHERE "cartId"=? ORDER BY "createdAt"', [cartId]);
    const counts: Record<string, number> = {};
    for (const r of raw)
        for (const p of json<PhotoConfig[]>(r.photos, []))
            counts[p.sizeId] = (counts[p.sizeId] ?? 0) + p.quantity * r.quantity;
    const items: CartItem[] = await Promise.all(raw.map(async (r) => {
        let product = data.products.find(p => p.id === r.productId);
        if (!product) {
            const archived = await one<Record<string, unknown>>('SELECT * FROM products WHERE id=?', [r.productId]);
            if (!archived)
                throw new HttpError(409, 'Produto indisponível. Fale com a loja para revisar o carrinho.');
            product = { ...productRow(archived), active: 0, category: 'Indisponível' };
        }
        const configs = json<PhotoConfig[]>(r.photos, []);
        const fields = json<Record<string, string>>(r.fields, {});
        let price = product.salePrice ?? product.price;
        if (r.variantId) {
            const v = product.variants.find(v => v.id === r.variantId);
            price = v?.price ?? price;
        }
        if (product.kind === 'photo') {
            price = configs.length ? 0 : null;
            for (const c of configs) {
                const s = data.sizes.find(s => s.id === c.sizeId);
                const p = s ? tierPrice(s.price, s.tiers, counts[c.sizeId]) : null;
                if (p === null) {
                    price = null;
                    break;
                }
                price = (price ?? 0) + p * c.quantity;
            }
        }
        if (product.kind === 'document') {
            const rate = fields.color === 'color' ? data.settings.documentColor : data.settings.documentBw;
            const file = await one<{
                pageCount: number;
            }>('SELECT "pageCount" FROM uploads WHERE id=?', [fields.fileId]);
            const pages = parsePages(fields.pages ?? '', file?.pageCount ?? 1);
            price = rate === null ? null : pages.length * rate;
        }
        const thumbnails: string[] = [];
        for (const c of configs.slice(0, 4)) {
            const p = await one<{
                thumbnailKey: string | null;
            }>('SELECT "thumbnailKey" FROM uploads WHERE id=?', [c.photoId]);
            if (p?.thumbnailKey)
                thumbnails.push('/api/files/' + c.photoId + '?thumbnail=1');
        }
        return { ...r, product, fields, photos: configs, thumbnails, unitPrice: price, subtotal: price === null ? null : price * r.quantity };
    }));
    return { items, subtotal: items.reduce((s, i) => s + (i.subtotal ?? 0), 0), ready: items.length > 0 && items.every(i => i.subtotal !== null && i.product.active && i.product.stock !== 0), count: items.reduce((s, i) => s + i.quantity, 0) };
}
export async function validateItem(req: Request, data: z.infer<typeof cartSchema>) {
    const { key } = await cartIdentity(req);
    const c = await catalog();
    const p = c.products.find(p => p.id === data.productId);
    requireValue(p, 'Produto indisponível.');
    const product = p!;
    requireValue(product.kind !== 'quote', 'Este serviço precisa de orçamento.');
    requireValue(product.stock === null || product.stock >= data.quantity, 'Estoque insuficiente.', 409);
    if (product.variants.length)
        requireValue(data.variantId && product.variants.some(v => v.id === data.variantId), 'Escolha uma variação válida.');
    for (const entry of [{ id: product.id, stock: product.stock }, ...product.variants.filter(v => v.id === data.variantId).map(v => ({ id: product.id + ':' + v.id, stock: v.stock }))]) {
        if (entry.stock !== null) {
            const stock = await one<{
                available: number;
            }>('SELECT available FROM inventory WHERE id=?', [entry.id]);
            requireValue(stock && stock.available >= data.quantity, 'Estoque insuficiente.', 409);
        }
    }
    for (const field of product.fields) {
        if (field.required)
            requireValue(data.fields[field.key]?.trim(), 'Preencha: ' + field.label);
        if (field.type === 'select' && data.fields[field.key])
            requireValue(field.options?.includes(data.fields[field.key]), 'Opção inválida: ' + field.label);
        if (field.type === 'photo' && data.fields[field.key])
            await requirePhoto(data.fields[field.key], key!);
    }
    if (product.kind === 'photo') {
        requireValue(data.photos.length, 'Adicione pelo menos uma fotografia.');
        for (const pc of data.photos) {
            const photo = await requirePhoto(pc.photoId, key!);
            requireValue(photo.mime.startsWith("image/"), "Envie uma imagem para revelar fotografias.");
            const size = c.sizes.find(s => s.id === pc.sizeId);
            requireValue(size, 'Tamanho indisponível.');
            requireValue(size!.finishes.includes(pc.finish), 'Acabamento indisponível.');
            const q = photoQuality(photo.width, photo.height, size!.width, size!.height, pc.crop);
            requireValue(!['low', 'unknown'].includes(q.level) || pc.qualityAccepted, 'Confirme a resolução das fotos antes de continuar.');
        }
    }
    if (product.kind === 'document') {
        const file = await requirePhoto(data.fields.fileId, key!);
        requireValue(Number(data.fields.pageCount) === file.pageCount, 'O total de páginas precisa corresponder ao documento.');
        parsePages(data.fields.pages ?? '', file.pageCount);
        requireValue(['bw', 'color'].includes(data.fields.color), 'Escolha a cor da impressão.');
        requireValue(data.fields.duplex !== 'yes' || c.settings.documentDuplex, 'Impressão frente e verso indisponível.');
    }
    return product;
}
export async function requirePhoto(id: string, key: string) { const p = await one<{
    id: string;
    width: number;
    height: number;
    pageCount: number;
    mime: string;
}>('SELECT id,width,height,"pageCount",mime FROM uploads WHERE id=? AND "ownerKey"=? AND status=? AND "expiresAt">?', [id, key, 'ready', now()]); requireValue(p, 'Um arquivo está indisponível. Envie-o novamente.', 409); return p!; }
export function itemFileIds(item: CartItem) { return [...new Set([...item.photos.map(p => p.photoId), ...item.product.fields.filter(f => f.type === 'photo').map(f => item.fields[f.key]), ...(item.product.kind === 'document' ? [item.fields.fileId] : [])].filter(Boolean))]; }
export function stockTotals(items: CartItem[]) { const counts: Record<string, number> = {}; for (const i of items)
    counts[i.productId] = (counts[i.productId] ?? 0) + i.quantity; return counts; }
export function shippingItems(items: CartItem[]) {
    return items.map(item => {
        let units = 1;
        if (item.product.kind === 'photo') {
            units = item.photos.reduce((total, photo) => total + photo.quantity, 0);
        } else if (item.product.kind === 'document') {
            const pages = parsePages(item.fields.pages ?? '', Number(item.fields.pageCount));
            units = item.fields.duplex === 'yes' ? Math.ceil(pages.length / 2) : pages.length;
        }
        return {
            id: item.productId,
            variantId: item.variantId,
            kind: item.product.kind,
            quantity: units * item.quantity,
            name: item.product.name,
            prints: item.photos.map(photo => ({ sizeId: photo.sizeId, quantity: photo.quantity * item.quantity })),
            weightGrams: item.product.weight,
            widthCm: item.product.width,
            heightCm: item.product.height,
            lengthCm: item.product.length,
            valueCents: item.subtotal,
        };
    });
}
export type ProductPricing = {
    product: Product;
    sizes: PrintSize[];
};
