import { z } from 'zod';
import { catalog, getSettings } from './catalog';
import { insert, json, now, one, query, transaction, uid, update } from './db';
import { audit, requireUser, requireValue } from './security';
const text = z.string().trim().min(1).max(200);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const flag = z.number().int().min(0).max(1);
const price = z.number().int().min(0).max(100000000).nullable();
const image = z.string().max(2000).refine(v => !v || v.startsWith('/images/') || /^https:\/\/(images\.pexels\.com|images\.unsplash\.com|[^/]+\.(?:r2\.dev|amazonaws\.com))\//.test(v), 'Use uma imagem HTTPS de uma fonte permitida.');
const schemas = {
    products: z.object({ name: text, slug, description: z.string().min(10).max(8000), categoryId: text, kind: z.enum(['product', 'photo', 'document', 'quote']), image, images: z.array(image).max(10), price, salePrice: price, stock: z.number().int().min(0).nullable(), active: flag, featured: flag, tags: z.array(text).max(30), fields: z.array(z.object({ key: slug, label: text, type: z.enum(['text', 'textarea', 'date', 'photo', 'select']), required: z.boolean(), options: z.array(text).optional() })).max(20), variants: z.array(z.object({ id: slug, name: text, price, stock: z.number().int().min(0).nullable() })).max(40), productionDays: z.number().int().min(0).max(120), weight: z.number().int().positive().nullable(), width: z.number().positive().nullable(), height: z.number().positive().nullable(), length: z.number().positive().nullable() }),
    categories: z.object({ name: text, slug, description: z.string().max(2000), image, active: flag }),
    printSizes: z.object({ name: text, width: z.number().positive().max(300), height: z.number().positive().max(300), price, active: flag, finishes: z.array(text).min(1).max(10), tiers: z.array(z.object({ quantity: z.number().int().positive(), price: z.number().int().nonnegative() })).max(20) }),
    coupons: z.object({ code: z.string().trim().min(3).max(60).transform(s => s.toUpperCase()), type: z.enum(['percent', 'fixed']), value: z.number().int().nonnegative(), minAmount: z.number().int().nonnegative(), expiresAt: z.string().datetime().nullable(), categories: z.array(text), maxUses: z.number().int().positive().nullable(), perCustomer: z.number().int().positive().max(20), firstPurchase: flag, active: flag }).refine(c => c.type !== 'percent' || c.value <= 100, 'Percentual máximo: 100%.'),
    testimonials: z.object({ name: text, rating: z.number().int().min(1).max(5), comment: z.string().min(5).max(2000), active: flag }),
    services: z.object({ name: text, slug, description: z.string().min(10).max(8000), image, gallery: z.array(image).max(20), faq: z.array(z.object({ question: text, answer: z.string().max(2000) })).max(20), active: flag }),
    banners: z.object({ title: text, subtitle: z.string().max(500), image, link: z.string().regex(/^\/(?!\/)/), active: flag }),
};
export const settingsSchema = z.object({ pixDiscount: z.number().min(0).max(100), pixEnabled: z.boolean(), retentionDays: z.number().int().min(1).max(3650), maxUploadMb: z.number().int().min(1).max(25), maxPhotos: z.number().int().min(1).max(200), documentBw: price, documentColor: price, documentDuplex: z.boolean(), photoSheetCount: z.number().int().min(1).max(100), polaroidCaption: z.boolean(), installments: z.number().int().min(1).max(24), installmentText: z.string().max(500), storeOpen: z.boolean(), shippingNotice: z.string().max(500) });
export type AdminEntity = keyof typeof schemas;
export async function adminData(req: Request, entity: string) {
    await requireUser(req, true);
    if (entity === 'dashboard') {
        const [recent, metrics, top, photos, pipeline] = await Promise.all([query('SELECT id,number,status,total,"createdAt",customer FROM orders ORDER BY "createdAt" DESC LIMIT 10'), one('SELECT COUNT(*) AS orders,COALESCE(SUM(CASE WHEN "paymentStatus"=? THEN total ELSE 0 END),0) AS revenue FROM orders', ['approved']), query('SELECT p.name,COUNT(*) AS count FROM "orderItems" i JOIN products p ON p.id=i."productId" JOIN orders o ON o.id=i."orderId" WHERE o."paymentStatus"=? GROUP BY p.id,p.name ORDER BY count DESC LIMIT 5', ['approved']), one('SELECT COUNT(*) AS count FROM uploads WHERE status=?', ['ready']), query('SELECT status,COUNT(*) AS count FROM orders GROUP BY status')]);
        return { recent, metrics, top, photos, pipeline };
    }
    if (entity === 'settings')
        return getSettings();
    const allowed = [...Object.keys(schemas), 'orders', 'users', 'inquiries', 'auditLogs'];
    requireValue(allowed.includes(entity), 'Área inválida.', 404);
    const columns = entity === 'users' ? 'id,name,email,phone,"taxId",role,"createdAt"' : '*';
    const rows = await query<Record<string, unknown>>(`SELECT ${columns} FROM "${entity}" LIMIT 500`);
    const inventory = entity === 'products' ? await query<{id:string;available:number}>('SELECT id,available FROM inventory') : [];
    return rows.map(r => { const result = { ...r }; for (const k of ['fields', 'tags', 'images', 'variants', 'finishes', 'tiers', 'categories', 'gallery', 'faq', 'customer', 'address'])
        if (k in result)
            result[k] = json(result[k], k === 'customer' || k === 'address' ? {} : []); if(entity==='products' && Array.isArray(result.variants)) result.variants=(result.variants as {id:string;stock:number|null}[]).map(v=>({...v,stock:v.stock===null?null:inventory.find(i=>i.id===String(result.id)+':'+v.id)?.available??0}));return result; });
}
export async function saveEntity(req: Request, entity: string, id: string | null, input: unknown) {
    const user = await requireUser(req, true);
    if (entity === 'settings') {
        const s = settingsSchema.parse(input);
        await transaction([update('settings', 'store', { data: JSON.stringify(s) })]);
        await audit(user.id, 'settings.update', 'store');
        return s;
    }
    requireValue(Object.hasOwn(schemas, entity), 'Área inválida.', 404);
    const schema = schemas[entity as AdminEntity];
    const parsed = schema.parse(input) as Record<string, unknown>;
    const data = { ...parsed };
    for (const [k, v] of Object.entries(data))
        if (Array.isArray(v) || typeof v === 'object' && v !== null)
            data[k] = JSON.stringify(v);
    if (entity === 'products') {
        const p = parsed as z.infer<typeof schemas.products>;
        requireValue(p.salePrice === null || p.price !== null && p.salePrice <= p.price, 'O preço promocional deve ser menor ou igual ao preço normal.');
        requireValue(new Set(p.fields.map(f => f.key)).size === p.fields.length, 'Use identificadores diferentes para os campos.');
    }
    const entityId = id ?? uid();
    if (!id && ['products', 'testimonials'].includes(entity))
        data.createdAt = now();
    const statements = [id ? update(entity, entityId, data) : insert(entity, { id: entityId, ...data })];
    if (entity === 'products') {
        const p = parsed as z.infer<typeof schemas.products>;
        for (const [inventoryId, stock] of [[entityId, p.stock], ...p.variants.map(v => [entityId + ':' + v.id, v.stock])] as [
            string,
            number | null
        ][]) {
            if (stock !== null)
                statements.push({ sql: 'INSERT INTO inventory (id,available) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET available=excluded.available', params: [inventoryId, stock] });
            else
                statements.push({ sql: 'DELETE FROM inventory WHERE id=?', params: [inventoryId] });
        }
    }
    if (entity === 'coupons' && parsed.maxUses !== null) {
        const used = id ? (await one<{
            used: number;
        }>('SELECT used FROM coupons WHERE id=?', [id]))?.used ?? 0 : 0;
        requireValue(Number(parsed.maxUses) >= used, 'O limite não pode ser menor que o total já utilizado.');
        statements.push({ sql: 'INSERT INTO "couponInventory" (id,available) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET available=excluded.available', params: [entityId, Number(parsed.maxUses) - used] });
    }
    await transaction(statements);
    await audit(user.id, entity + (id ? '.update' : '.create'), entityId);
    return { id: entityId };
}
export async function archiveEntity(req: Request, entity: string, id: string, hard = false) { const user = await requireUser(req, true); requireValue(Object.hasOwn(schemas, entity), 'Área inválida.', 404); if (hard) {
    if (entity === 'products') {
        const used = await one('SELECT id FROM "orderItems" WHERE "productId"=? LIMIT 1', [id]);
        requireValue(!used, 'Produtos com pedidos devem ser arquivados para preservar o histórico.', 409);
    }
    await transaction([{ sql: `DELETE FROM "${entity}" WHERE id=?`, params: [id] }]);
}
else
    await transaction([update(entity, id, { active: 0 })]); await audit(user.id, entity + (hard ? '.delete' : '.archive'), id); return { ok: true }; }
export const getAdminCatalog = catalog;
