const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const bytes = (s: string) => new TextEncoder().encode(s);
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
async function hmac(key: Uint8Array | string, data: string) { const k = await crypto.subtle.importKey('raw', (typeof key === 'string' ? bytes(key) : key) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes(data))); }
export async function signedS3Url(method: string, key: string, config: (s: string) => string, now = new Date()) {
    const endpoint = config('S3_ENDPOINT'), bucket = config('S3_BUCKET'), access = config('S3_ACCESS_KEY_ID'), secret = config('S3_SECRET_ACCESS_KEY'), region = config('S3_REGION') || 'auto';
    if (!endpoint || !bucket || !access || !secret)
        throw Error('O armazenamento privado ainda não foi configurado.');
    const url = new URL(endpoint);
    if (url.protocol !== 'https:')
        throw Error('Storage requer HTTPS.');
    const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, ''), date = stamp.slice(0, 8), scope = `${date}/${region}/s3/aws4_request`;
    url.pathname = '/' + [bucket, ...key.split('/')].map(encode).join('/');
    const params: Record<string, string> = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': access + '/' + scope, 'X-Amz-Date': stamp, 'X-Amz-Expires': '300', 'X-Amz-SignedHeaders': 'host' };
    const qs = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => encode(k) + '=' + encode(v)).join('&');
    const canonical = [method, url.pathname, qs, 'host:' + url.host + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const signing = await hmac(await hmac(await hmac(await hmac('AWS4' + secret, date), region), 's3'), 'aws4_request');
    const signature = hex((await hmac(signing, ['AWS4-HMAC-SHA256', stamp, scope, hex(await crypto.subtle.digest('SHA-256', bytes(canonical)))].join('\n'))).buffer as ArrayBuffer);
    return url.origin + url.pathname + '?' + qs + '&X-Amz-Signature=' + signature;
}
