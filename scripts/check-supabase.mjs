import { randomUUID } from 'node:crypto';
import { createPostgres } from '../lib/server/postgres.mjs';
import { signedS3Url } from '../lib/server/s3.ts';
import { loadLocalEnv } from './load-local-env.mjs';
import { migrations } from './postgres-migrations.mjs';
import { databaseError } from './database-errors.mjs';

loadLocalEnv();
const config = key => process.env[key] ?? '';
const writeTest = process.argv.includes('--write-test');
const check = (condition, message) => { if (!condition) throw Error(message); };
const request = (url, options = {}) => fetch(url, {
    ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000),
});

async function main() {
    const missing = ['APP_URL','DATABASE_URL','S3_ENDPOINT','S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'].filter(key => !config(key));
    check(!missing.length, 'Preencha estas variáveis: ' + missing.join(', ') + '. Consulte docs/supabase.md.');
    let origin, endpoint;
    try { origin = new URL(config('APP_URL')).origin; endpoint = new URL(config('S3_ENDPOINT')); }
    catch { throw Error('APP_URL ou S3_ENDPOINT inválido. Use URLs completas.'); }
    check(origin.startsWith('https://') || /^http:\/\/localhost(?::\d+)?$/.test(origin), 'APP_URL precisa usar HTTPS em produção.');
    check(endpoint.protocol === 'https:' && endpoint.pathname.replace(/\/$/, '') === '/storage/v1/s3',
        'Copie o endpoint S3 completo do Supabase, incluindo /storage/v1/s3.');
    check(config('S3_REGION') !== 'auto', 'S3_REGION deve ser a região exibida pelo Supabase; não use auto.');
    const project = endpoint.hostname.match(/^([a-z0-9]+)(?:\.storage)?\.supabase\.co$/)?.[1];
    check(project, 'Use o endpoint S3 HTTPS do seu projeto Supabase.');
    const database = new URL(config('DATABASE_URL'));
    check(decodeURIComponent(database.username).endsWith('.' + project) || database.hostname === 'db.' + project + '.supabase.co',
        'O banco e o Storage parecem pertencer a projetos diferentes. Copie os dois do mesmo projeto Supabase.');
    console.log('OK: formato das variáveis. Nenhum segredo é exibido.');

    let sql;
    try {
        sql = createPostgres(config('DATABASE_URL'), { ca: config('DATABASE_CA_CERT'), max: 1 });
        const [role] = await sql`SELECT current_user AS name, rolbypassrls, rolsuper FROM pg_roles WHERE rolname=current_user`;
        const installed = await sql`SELECT id FROM public._migrations`;
        const pending = migrations().filter(migration => !installed.some(row => row.id === migration.name));
        check(!pending.length, 'Aplique as migrations pendentes: ' + pending.map(m => m.name).join(', '));
        const expected = migrations().flatMap(m => [...m.sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(match => match[1]));
        const tables = await sql`SELECT tablename, tableowner, rowsecurity FROM pg_tables WHERE schemaname='public'`;
        for (const name of [...expected, '_migrations']) {
            const table = tables.find(row => row.tablename === name);
            check(table?.rowsecurity, 'Tabela ausente ou RLS desativado: ' + name + '. Confira supabase/setup.sql.');
            check(role.rolbypassrls || role.rolsuper || table.tableowner === role.name,
                'A conexão do servidor precisa ser proprietária das tabelas ou ter BYPASSRLS.');
        }
        for (const apiRole of ['anon', 'authenticated']) {
            const exposed = await sql`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='public' AND c.relname = ANY(${[...expected, '_migrations']})
                AND has_table_privilege(${apiRole}, c.oid, 'SELECT, INSERT, UPDATE, DELETE')`;
            check(!exposed.length, 'Há permissões de acesso direto para ' + apiRole + '. Revise a migration de privacidade.');
        }
        console.log('OK: PostgreSQL conectado, migrations aplicadas e tabelas protegidas.');
        const [bucket] = await sql`SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id=${config('S3_BUCKET')}`;
        check(bucket, 'Crie o bucket informado em S3_BUCKET na área Storage do Supabase.');
        check(bucket.public === false, 'O bucket está público. Desative Public bucket antes de receber fotografias.');
        const [store] = await sql`SELECT data FROM settings WHERE id='store'`;
        const maximum = (store ? JSON.parse(store.data).maxUploadMb ?? 25 : 25) * 1024 * 1024;
        check(!bucket.file_size_limit || Number(bucket.file_size_limit) >= maximum,
            'O limite do bucket é menor que o limite de upload configurado na loja. Ajuste os dois.');
        const formats = ['image/jpeg','image/png','image/heic','application/pdf'];
        if (bucket.allowed_mime_types) for (const mime of formats)
            check(bucket.allowed_mime_types.some(allowed => allowed === mime || allowed === '*' || allowed === mime.split('/')[0] + '/*'),
                'O bucket não aceita ' + mime + '. Ajuste Allowed MIME types no Supabase.');
        console.log('OK: bucket privado e formatos/limite compatíveis. Confira também o limite global do Storage.');
    } catch (error) {
        if (error?.code) throw Error(databaseError(error));
        throw error;
    } finally {
        if (sql) await sql.end({ timeout: 5 });
    }

    const key = 'diagnostics/' + randomUUID() + '.png';
    const url = await signedS3Url('PUT', key, config, new Date(), { 'content-type': 'image/png' });
    const preflight = await request(url, { method: 'OPTIONS', headers: {
        Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type',
    } });
    check(preflight.ok && ['*', origin].includes(preflight.headers.get('access-control-allow-origin')),
        'O Storage não liberou o upload para APP_URL. Confira o endpoint e a resposta CORS.');
    const methods = preflight.headers.get('access-control-allow-methods') ?? '';
    check(methods === '*' || methods.toUpperCase().split(/[, ]+/).includes('PUT'), 'CORS não permite PUT no Storage.');
    const headers = preflight.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
    check(headers === '*' || headers.split(/[, ]+/).includes('content-type'), 'CORS não permite o cabeçalho Content-Type.');
    console.log('OK: preflight de upload aceito para APP_URL.');
    if (!writeTest) {
        console.log('Diagnóstico de leitura concluído. Para verificar credenciais S3 e os bytes do arquivo: npm run supabase:check -- --write-test');
        return;
    }

    const original = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2l0AAAAASUVORK5CYII=', 'base64');
    try {
        const uploaded = await request(url, { method: 'PUT', body: original, headers: { 'Content-Type': 'image/png' } });
        check(uploaded.ok, 'Upload S3 recusado. Confira Access Key ID, Secret Access Key, região e protocolo S3 habilitado.');
        const head = await request(await signedS3Url('HEAD', key, config), { method: 'HEAD' });
        check(head.ok && Number(head.headers.get('content-length')) === original.length, 'O Storage não confirmou o tamanho do arquivo de teste.');
        const downloaded = await request(await signedS3Url('GET', key, config));
        check(downloaded.ok, 'Download S3 recusado. Confira as permissões da credencial.');
        check(Buffer.from(await downloaded.arrayBuffer()).equals(original), 'Os bytes baixados diferem dos bytes enviados.');
        const anonymousURL = new URL(await signedS3Url('GET', key, config)); anonymousURL.search = '';
        const anonymous = await request(anonymousURL);
        await anonymous.body?.cancel();
        check(!anonymous.ok, 'O objeto respondeu sem assinatura. Revise imediatamente a privacidade do Storage.');
        console.log('OK: upload direto, HEAD, download idêntico ao original e acesso sem assinatura bloqueado.');
    } finally {
        const removed = await request(await signedS3Url('DELETE', key, config), { method: 'DELETE' });
        check(removed.ok || removed.status === 404, 'Remova manualmente apenas o objeto de diagnóstico: ' + key);
        console.log('Arquivo temporário de diagnóstico removido. Nenhuma fotografia de cliente foi alterada.');
    }
}

main().catch(error => {
    // Errors emitted here contain only our messages, never request URLs/tokens.
    const message = error?.code ? databaseError(error) : error?.message;
    console.error(message && !/(?:postgres(?:ql)?:\/\/|X-Amz-|password=)/i.test(message)
        ? message : 'Falha de conexão. Confira o guia docs/supabase.md.');
    process.exitCode = 1;
});
