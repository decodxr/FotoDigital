import { deleteObject, getObject, headObject, presignUpload, putObject } from '@/lib/server/platform';
import { detectMime, safeFilename } from '@/lib/shared/commerce';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { getSettings } from './catalog';
import { add, now, one, query, transaction, uid, update } from './db';
import { HttpError, audit, owner, readBytes, requireUser, requireValue } from './security';
export type UploadRecord = {
    id: string;
    ownerKey: string;
    userId: string | null;
    name: string;
    mime: string;
    bytes: number;
    width: number;
    height: number;
    pageCount: number;
    objectKey: string;
    thumbnailKey: string | null;
    status: string;
    expiresAt: string;
    createdAt: string;
};
export async function initializeUpload(req: Request, input: {
    name: string;
    mime: string;
    bytes: number;
    width: number;
    height: number;
    consent: boolean;
}) {
    const { key, user } = await owner(req);
    requireValue(key, 'Atualize a página e tente novamente.', 401);
    requireValue(input.consent, 'Autorize o uso do arquivo para produzir o seu pedido.');
    const settings = await getSettings();
    requireValue(input.bytes <= settings.maxUploadMb * 1024 * 1024, 'O arquivo excede o limite de ' + settings.maxUploadMb + ' MB.', 413);
    const count = await one<{
        count: number;
    }>('SELECT COUNT(*) AS count FROM uploads WHERE "ownerKey"=? AND status<>? AND "expiresAt">?', [key, 'deleted', now()]);
    requireValue((count?.count ?? 0) < settings.maxPhotos, 'Você atingiu o limite de arquivos. Remova os que não vai utilizar.');
    requireValue(input.mime !== 'application/pdf' || input.bytes <= 10 * 1024 * 1024, 'PDFs devem ter no máximo 10 MB.', 413);
    const id = uid(), objectKey = 'originals/' + id + '/' + safeFilename(input.name);
    await add('uploads', { id, ownerKey: key, userId: user?.id ?? null, name: input.name, mime: input.mime, bytes: input.bytes, width: input.width, height: input.height, objectKey, status: 'pending', expiresAt: new Date(Date.now() + settings.retentionDays * 86400000).toISOString(), createdAt: now() });
    return { id, url: await presignUpload(objectKey, input.mime) ?? '/api/uploads/' + id, method: 'PUT' };
}
export async function ownedUpload(req: Request, id: string, allowAdmin = false) { const who = await owner(req); const p = await one<UploadRecord>('SELECT * FROM uploads WHERE id=?', [id]); if (!p)
    throw new HttpError(404, 'Arquivo não encontrado.'); requireValue(p.ownerKey === who.key || (allowAdmin && who.user?.role === 'admin'), 'Você não tem acesso a este arquivo.', 403); return p; }
export async function uploadBytes(req: Request, id: string) {
    const p = await ownedUpload(req, id);
    requireValue(p.status === 'pending', 'Este envio já foi concluído.', 409);
    requireValue(req.body, 'Arquivo vazio.');
    requireValue(Number(req.headers.get('content-length') ?? p.bytes) === p.bytes, 'Tamanho do arquivo divergente.');
    const reader = req.body!.getReader();
    let received = 0;
    let header = new Uint8Array();
    let validated = false;
    const stream = new ReadableStream<Uint8Array>({ async pull(controller) { try {
            const { done, value } = await reader.read();
            if (done) {
                if (received !== p.bytes || !validated)
                    throw new Error('Envio incompleto.');
                controller.close();
                return;
            }
            received += value.byteLength;
            if (received > p.bytes)
                throw new Error('Arquivo excede o tamanho declarado.');
            if (!validated) {
                const combined = new Uint8Array(header.length + value.length);
                combined.set(header);
                combined.set(value, header.length);
                header = combined;
                if (header.length < 32 && received < p.bytes)
                    return;
                const mime = detectMime(header);
                requireValue(mime === p.mime, 'O conteúdo do arquivo não corresponde ao formato informado.', 415);
                validated = true;
                controller.enqueue(header);
                header = new Uint8Array();
            }
            else
                controller.enqueue(value);
        }
        catch (e) {
            await reader.cancel();
            controller.error(e);
        } }, cancel() { return reader.cancel(); } });
    try {
        await putObject(p.objectKey, stream, p.mime, p.bytes);
    }
    catch (e) {
        await deleteObject(p.objectKey).catch(() => { });
        throw e;
    }
    return completeUpload(req, id);
}
export async function completeUpload(req: Request, id: string) {
    const p = await ownedUpload(req, id);
    if (p.status === 'ready')
        return publicPhoto(p);
    const h = await headObject(p.objectKey);
    requireValue(h?.size === p.bytes, 'O upload não foi concluído. Tente novamente.', 409);
    const file = await getObject(p.objectKey);
    requireValue(file, 'Arquivo não encontrado.');
    const reader = file!.body.getReader();
    const first = await reader.read();
    await reader.cancel();
    if (!first.value || detectMime(first.value) !== p.mime) {
        await deleteObject(p.objectKey);
        await transaction([update('uploads', id, { status: 'rejected' })]);
        throw new HttpError(415, 'Formato do arquivo inválido.');
    }
    let pageCount = 1;
    if (p.mime === 'application/pdf') {
        const original = await getObject(p.objectKey);
        const bytes = await new Response(original!.body).arrayBuffer();
        try {
            const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
            pageCount = pdf.getPageCount();
            requireValue(pageCount > 0 && pageCount <= 2000, 'Documento deve conter de 1 a 2000 páginas.');
            for (const [, object] of pdf.context.enumerateIndirectObjects()) {
                if (object instanceof PDFDict)
                    for (const key of object.keys()) {
                        requireValue(!['/JavaScript', '/JS', '/Launch', '/EmbeddedFiles', '/EmbeddedFile', '/RichMedia'].includes(key.toString()), 'O PDF contém conteúdo ativo ou anexos não permitidos.');
                        const entry = object.get(key);
                        if (entry instanceof PDFName)
                            requireValue(!['/JavaScript', '/Launch', '/EmbeddedFile', '/RichMedia'].includes(entry.toString()), 'O PDF contém conteúdo ativo não permitido.');
                    }
            }
        }
        catch (e) {
            await deleteObject(p.objectKey);
            await transaction([update('uploads', id, { status: 'rejected' })]);
            throw new HttpError(415, e instanceof HttpError ? e.message : 'PDF inválido ou protegido por senha. Envie uma versão desbloqueada.');
        }
    }
    await transaction([update('uploads', id, { status: 'ready', pageCount })]);
    return publicPhoto({ ...p, status: 'ready', pageCount });
}
export async function uploadThumbnail(req: Request, id: string) { await ownedUpload(req, id); requireValue(req.body, 'Miniatura vazia.'); const length = Number(req.headers.get('content-length') ?? 0); requireValue(length <= 600000, 'Miniatura muito grande.', 413); const buffer = await readBytes(req, 600000); requireValue(buffer.byteLength <= 600000 && detectMime(new Uint8Array(buffer)) === 'image/jpeg', 'Miniatura inválida.', 415); const key = 'thumbnails/' + id + '.jpg'; await putObject(key, new Blob([buffer as BlobPart]).stream(), 'image/jpeg', buffer.byteLength); await transaction([update('uploads', id, { thumbnailKey: key })]); return { ok: true }; }
export function publicPhoto(p: UploadRecord) { return { id: p.id, name: p.name, mime: p.mime, bytes: p.bytes, width: p.width, height: p.height, pageCount: p.pageCount, status: p.status, createdAt: p.createdAt, thumbnail: p.thumbnailKey ? '/api/files/' + p.id + '?thumbnail=1' : null }; }
async function activeUse(id: string) { return await one('SELECT o.id FROM orders o JOIN "orderItems" i ON i."orderId"=o.id JOIN "photoConfigurations" c ON c."orderItemId"=i.id WHERE c."photoId"=? AND o.status NOT IN (?,?) LIMIT 1', [id, 'delivered', 'cancelled']) || await one('SELECT id FROM inquiries WHERE "photoId"=? AND status<>? LIMIT 1', [id, 'closed']); }
export async function downloadFile(req: Request, id: string) { const p = await ownedUpload(req, id, true); requireValue(p.status === 'ready' && (p.expiresAt > now() || await activeUse(id)), 'Este arquivo expirou ou foi removido.', 410); const thumbnail = new URL(req.url).searchParams.has('thumbnail'); const key = thumbnail ? p.thumbnailKey : p.objectKey; requireValue(key, 'Miniatura indisponível.', 404); const file = await getObject(key!); requireValue(file, 'Arquivo indisponível.', 404); const headers: Record<string, string> = { 'Content-Type': thumbnail ? 'image/jpeg' : 'application/octet-stream', 'Content-Length': String(file!.size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" }; if (!thumbnail)
    headers['Content-Disposition'] = `attachment; filename="${safeFilename(p.name)}"`; return new Response(file!.body, { headers }); }
export async function removeUpload(req: Request, id: string) { const p = await ownedUpload(req, id); const used = await one<{
    id: string;
}>('SELECT id FROM "photoConfigurations" WHERE "photoId"=?', [id]); requireValue(!used && !await activeUse(id), 'Este arquivo está vinculado a um pedido. Solicite a exclusão à loja.', 409); await deleteObject(p.objectKey); if (p.thumbnailKey)
    await deleteObject(p.thumbnailKey); await transaction([update('uploads', id, { status: 'deleted', thumbnailKey: null })]); return { ok: true }; }
export async function pruneFiles(req: Request) { const user = await requireUser(req, true); const files = await query<UploadRecord>('SELECT * FROM uploads WHERE "expiresAt"<? AND status<>? LIMIT 20', [now(), 'deleted']); let removed = 0; for (const p of files) {
    const open = await one<{
        id: string;
    }>('SELECT o.id FROM orders o JOIN "orderItems" i ON i."orderId"=o.id JOIN "photoConfigurations" c ON c."orderItemId"=i.id WHERE c."photoId"=? AND o.status NOT IN (?,?)', [p.id, 'delivered', 'cancelled']);
    if (open || await activeUse(p.id))
        continue;
    await deleteObject(p.objectKey);
    if (p.thumbnailKey)
        await deleteObject(p.thumbnailKey);
    await transaction([update('uploads', p.id, { status: 'deleted', thumbnailKey: null })]);
    removed++;
} await audit(user.id, 'files.prune', String(removed)); return { removed }; }
// ZIP STORE streams exact original bytes; data descriptors avoid buffering photos.
export async function orderZip(req: Request, orderId: string) {
    const admin = await requireUser(req, true);
    const order = await one<{
        number: number;
    }>('SELECT number FROM orders WHERE id=?', [orderId]);
    requireValue(order, 'Pedido não encontrado.', 404);
    const files = await query<UploadRecord & {
        data: string;
    }>('SELECT u.*,c.data FROM uploads u JOIN "photoConfigurations" c ON c."photoId"=u.id JOIN "orderItems" i ON i.id=c."orderItemId" WHERE i."orderId"=?', [orderId]);
    requireValue(files.length, 'Este pedido não possui arquivos.', 404);
    requireValue((await Promise.all(files.map(async (f) => f.status === 'ready' && (f.expiresAt > now() || !!await activeUse(f.id))))).every(Boolean), 'Um ou mais arquivos expiraram. Baixe os disponíveis individualmente.', 410);
    requireValue(files.reduce((n, f) => n + f.bytes, 0) < 4000000000, 'O pedido excede o limite do ZIP. Baixe os arquivos individualmente.', 413);
    await audit(admin.id, 'order.download_zip', orderId);
    const encoder = new TextEncoder();
    const central: Uint8Array[] = [];
    let offset = 0;
    const u16 = (n: number) => [n & 255, (n >>> 8) & 255], u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    async function* chunks() {
        const entries: {
            name: string;
            body: () => Promise<ReadableStream<Uint8Array>>;
        }[] = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i], settings = JSON.parse(f.data);
            entries.push({ name: `pedido-${order!.number}/${safeFilename(settings.sizeId || 'arquivos')}/${i + 1}-${safeFilename(f.name)}`, body: async () => { const o = await getObject(f.objectKey); if (!o)
                    throw Error('Arquivo indisponível.'); return o.body; } });
        }
        entries.push({ name: `pedido-${order!.number}/instrucoes-de-impressao.json`, body: async () => new Blob([JSON.stringify(files.map(f => ({ file: f.name, ...JSON.parse(f.data) })), null, 2)]).stream() });
        for (const entry of entries) {
            const name = encoder.encode(entry.name);
            const start = offset;
            const header = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0808), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0), ...u16(name.length), ...u16(0), ...name]);
            yield header;
            offset += header.length;
            let crc = 0xffffffff, size = 0;
            const reader = (await entry.body()).getReader();
            try {
                while (true) {
                    const r = await reader.read();
                    if (r.done)
                        break;
                    for (const b of r.value)
                        crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
                    size += r.value.length;
                    offset += r.value.length;
                    yield r.value;
                }
            }
            finally {
                await reader.cancel();
            }
            crc = (crc ^ 0xffffffff) >>> 0;
            const descriptor = new Uint8Array([...u32(0x08074b50), ...u32(crc), ...u32(size), ...u32(size)]);
            yield descriptor;
            offset += descriptor.length;
            central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0808), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(start), ...name]));
        }
        const start = offset;
        for (const c of central) {
            yield c;
            offset += c.length;
        }
        yield new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(offset - start), ...u32(start), ...u16(0)]);
    }
    const generator = chunks();
    const stream = new ReadableStream<Uint8Array>({ async pull(c) { try {
            const n = await generator.next();
            if (n.done)
                c.close();
            else
                c.enqueue(n.value);
        }
        catch (e) {
            c.error(e);
        } }, async cancel() { await generator.return(undefined); } });
    return new Response(stream, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="pedido-${order!.number}.zip"`, 'Cache-Control': 'no-store' } });
}
