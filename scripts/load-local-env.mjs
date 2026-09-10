import { existsSync } from 'node:fs';

// Explicit environment variables take precedence; .env.local overrides .env.
// Never print values (connection strings include the database password).
export function loadLocalEnv() {
    for (const file of ['.env.local', '.env']) {
        if (existsSync(file)) process.loadEnvFile(file);
    }
}
