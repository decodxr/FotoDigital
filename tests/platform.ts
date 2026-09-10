// Test-only adapters. Never imported by production application code.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Statement} from '../lib/server/platform-types';
const db=new DatabaseSync(join(mkdtempSync(join(tmpdir(),'fd-test-')),'test.sqlite'));
db.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
export const platformName:string='vercel';
export const config=(key:string)=>({PIX_KEY:'05998428000199',ADMIN_BOOTSTRAP_TOKEN:'test-only-bootstrap-code-1234567890',APP_URL:'https://fotodigital.test',NODE_ENV:'development'} as Record<string,string>)[key]??'';
export async function query<T>(sql:string,params:unknown[]=[]):Promise<T[]>{return db.prepare(sql).all(...params as (string|number|null)[]) as T[];}
export async function transaction(statements:Statement[]){db.exec('BEGIN');try{const results=statements.map(s=>({changes:Number(db.prepare(s.sql).run(...(s.params??[]) as (string|number|null)[]).changes)}));db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}
export {putObject,getObject,headObject,deleteObject,presignUpload} from './storage';
export async function close(){db.close();}
