// Private storage for Supabase's S3 API, AWS S3 and Cloudflare R2.
import type { StoredObject } from './platform-types';
import { signedS3Url } from './s3';
const config = (key: string) => process.env[key] ?? '';

function objectSize(response: Response) {
    const header = response.headers.get('content-length');
    const size = Number(header);
    if (header === null || !Number.isSafeInteger(size) || size < 0)
        throw Error('O Storage não informou o tamanho do arquivo.');
    return size;
}

export async function putObject(key: string, body: ReadableStream<Uint8Array>, mime: string, bytes: number) {
    const response = await fetch(await signedS3Url('PUT', key, config), {
        method: 'PUT', body, headers: { 'Content-Type': mime, 'Content-Length': String(bytes) },
        duplex: 'half', cache: 'no-store', signal: AbortSignal.timeout(45000), redirect: 'error',
    } as RequestInit);
    if (!response.ok) throw Error('Não foi possível armazenar o arquivo. Confira o bucket e as credenciais S3 do Supabase.');
}

export async function getObject(key: string): Promise<StoredObject | null> {
    const response = await fetch(await signedS3Url('GET', key, config), {
        cache: 'no-store', signal: AbortSignal.timeout(45000), redirect: 'error',
    });
    if (response.status === 404) return null;
    if (!response.ok || !response.body) throw Error('Arquivo indisponível no Storage.');
    return { body: response.body, size: objectSize(response), mime: response.headers.get('content-type') ?? 'application/octet-stream' };
}

export async function headObject(key: string) {
    const response = await fetch(await signedS3Url('HEAD', key, config), {
        method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    if (response.status === 404) return null;
    if (!response.ok) throw Error('Storage indisponível. Confira endpoint, região e credenciais S3.');
    return { size: objectSize(response) };
}

export async function deleteObject(key: string) {
    const response = await fetch(await signedS3Url('DELETE', key, config), {
        method: 'DELETE', cache: 'no-store', signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (!response.ok && response.status !== 404) throw Error('Não foi possível excluir o arquivo do Storage.');
}

export async function presignUpload(key: string, mime: string) {
    return signedS3Url('PUT', key, config, new Date(), { 'content-type': mime });
}
