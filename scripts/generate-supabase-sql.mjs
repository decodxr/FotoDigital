import { mkdirSync, writeFileSync } from 'node:fs';
import { setupSQL } from './postgres-migrations.mjs';

mkdirSync('supabase', { recursive: true });
writeFileSync('supabase/setup.sql', setupSQL());
console.log('SQL preparado em supabase/setup.sql. Nenhum banco foi alterado.');
