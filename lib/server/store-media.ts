import { detectMime } from '@/lib/shared/commerce';
import { add, now, one, uid } from './db';
import { deleteObject, getObject, putObject } from '@/lib/server/platform';
import { audit, readBytes, requireUser, requireValue } from './security';

// Public marketing images have a separate namespace and table from private customer originals.
export async function uploadStoreMedia(req: Request) {
    const user = await requireUser(req, true);
    const bytes = await readBytes(req, 6 * 1024 * 1024);
    const mime = detectMime(bytes);
    requireValue(mime === 'image/jpeg' || mime === 'image/png', 'Envie uma fotografia JPG ou PNG válida.', 415);
    const id = uid();
    const objectKey = 'storefront/' + id + (mime === 'image/png' ? '.png' : '.jpg');
    await putObject(objectKey, new Blob([bytes as BlobPart]).stream(), mime!, bytes.byteLength);
    try {
        await add('storeMedia', { id, objectKey, mime, bytes: bytes.byteLength, createdAt: now() });
    } catch (error) {
        await deleteObject(objectKey).catch(() => {});
        throw error;
    }
    await audit(user.id, 'store-media.upload', id);
    return { id, url: '/api/store-media/' + id };
}

export async function readStoreMedia(req: Request, id: string) {
    requireValue(/^[a-f0-9-]{36}$/.test(id), 'Imagem não encontrada.', 404);
    const record = await one<{ objectKey: string; mime: string }>('SELECT "objectKey",mime FROM "storeMedia" WHERE id=?', [id]);
    requireValue(record, 'Imagem não encontrada.', 404);
    const published = await one('SELECT id FROM banners WHERE image=? AND active=1 LIMIT 1', ['/api/store-media/' + id]);
    if (!published) await requireUser(req, true);
    const object = await getObject(record!.objectKey);
    requireValue(object, 'Imagem indisponível.', 404);
    return new Response(object!.body, { headers: {
        'Content-Type': record!.mime,
        'Content-Length': String(object!.size),
        'Cache-Control': published ? 'public, max-age=60, s-maxage=60' : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
}
