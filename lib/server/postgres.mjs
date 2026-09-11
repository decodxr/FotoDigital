// Node only. Shared by the Vercel adapter and command-line database tools.
import postgres from 'postgres';

/** @param {string} sql */
export function parameterize(sql) {
    let index = 0;
    // Application SQL uses question marks as parameters, never as JSON operators.
    // Keep literals, quoted identifiers and comments intact.
    return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|(\?)/g,
        (token, placeholder) => placeholder ? '$' + (++index) : token);
}

/** @param {string} value */
export function safeInteger(value) {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw Error('Valor inteiro PostgreSQL fora do limite seguro.');
    return number;
}

/** @param {string} connection @param {{ ca?: string, max?: number }} [options] */
export function createPostgres(connection, options = {}) {
    if (!connection) throw Error('Configure DATABASE_URL com a conexão PostgreSQL do Supabase.');
    let url;
    try { url = new URL(connection); }
    catch { throw Error('DATABASE_URL inválida. Copie a URI PostgreSQL na opção Connect do Supabase.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.password)
        throw Error('DATABASE_URL deve ser uma URI PostgreSQL com usuário, senha e host.');
    // TLS is always verified. Supply the project's CA for a direct endpoint
    // with a private CA; never suppress a certificate verification error.
    url.searchParams.delete('sslmode');
    url.searchParams.delete('sslrootcert');
    return postgres(url.toString(), {
        ssl: { rejectUnauthorized: true, ...(options.ca ? { ca: options.ca.replace(/\\n/g, '\n') } : {}) },
        prepare: false, // Supavisor transaction mode (port 6543).
        // The schema stores lists as JSON text, not native PostgreSQL arrays.
        // Avoid the driver's unawaited pg_type introspection on first connect:
        // its rejection can terminate the process before our query is handled.
        fetch_types: false,
        max: options.max ?? 1,
        idle_timeout: 20,
        connect_timeout: 10,
        max_lifetime: 300,
        // Session settings are not portable across the transaction pooler.
        connection: { application_name: 'foto-digital' },
        types: {
            // COUNT/SUM use int8. Returning "0" breaks first-purchase checks.
            safeInteger: { to: 20, from: [20], serialize: String, parse: safeInteger },
        },
        onnotice: () => {},
    });
}

/**
 * @param {ReturnType<typeof createPostgres>} client
 * @param {{sql: string, params?: (string | number | boolean | null)[]}[]} statements
 */
export async function postgresTransaction(client, statements) {
    if (!statements.length) return [];
    for (let attempt = 0; ; attempt++) {
        try {
            return await client.begin('isolation level serializable', async transaction => {
                const results = [];
                for (const statement of statements) {
                    const rows = await transaction.unsafe(parameterize(statement.sql), statement.params ?? []);
                    results.push({ changes: rows.count });
                }
                return results;
            });
        } catch (error) {
            // Retry only transactions guaranteed by PostgreSQL to be rolled back.
            if (attempt >= 2 || !['40001', '40P01'].includes(error?.code)) throw error;
        }
    }
}
