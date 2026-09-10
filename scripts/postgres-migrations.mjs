import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const directory = fileURLToPath(new URL('../db/postgres/', import.meta.url));
export function migrations() {
    return readdirSync(directory).filter(file => /^\d{4}_[a-z0-9_]+\.sql$/.test(file)).sort()
        .map(name => ({ name, sql: readFileSync(join(directory, name), 'utf8') }));
}

export function setupSQL() {
    const blocks = migrations().map(({ name, sql }, index) => `
DO $fd_migration_${index}$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public._migrations WHERE id = '${name}') THEN
${sql.split('\n').map(line => line.trim() ? '        ' + line.replaceAll('\t', '    ').trimEnd() : '').join('\n')}
        INSERT INTO public._migrations (id) VALUES ('${name}');
    END IF;
END
$fd_migration_${index}$;`);
    return `-- FOTO DIGITAL: execute este arquivo inteiro no SQL Editor do Supabase.
-- Gerado por npm run supabase:sql. Não edite o arquivo gerado.
-- Reexecutável: cada migration aplicada é registrada uma única vez.
-- Não importa clientes, pedidos nem arquivos de outro banco.
BEGIN;
SET LOCAL search_path TO public;
SELECT pg_advisory_xact_lock(66042003);
CREATE TABLE IF NOT EXISTS public._migrations (id TEXT PRIMARY KEY);
${blocks.join('\n')}
COMMIT;
`;
}
