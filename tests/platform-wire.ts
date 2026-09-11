// Exercise the actual Vercel database adapter through TLS/Postgres.js.
// Only object storage is replaced; no application SQL/transactions are mocked.
import { postgresWireServer } from './postgres-wire-server.mjs';
import { setupSQL } from '../scripts/postgres-migrations.mjs';
export { query, transaction } from '../lib/server/platform';
export { putObject, getObject, headObject, deleteObject, presignUpload } from './storage';
export const platformName: string = 'vercel';
export const config = (key: string) => ({ PIX_KEY: '05998428000199', ADMIN_BOOTSTRAP_TOKEN: 'test-only-bootstrap-code-1234567890', APP_URL: 'https://fotodigital.test', NODE_ENV: 'development' } as Record<string, string>)[key] ?? '';
const previous = { DATABASE_URL: process.env.DATABASE_URL, DATABASE_CA_CERT: process.env.DATABASE_CA_CERT };
const server = await postgresWireServer(setupSQL());
process.env.DATABASE_URL = server.connection;
process.env.DATABASE_CA_CERT = server.ca;
export async function close() {
    await server.close();
    for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
}
