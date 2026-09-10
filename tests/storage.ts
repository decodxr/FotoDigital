// Test-only object storage; never imported by production.
import type {StoredObject} from '../lib/server/platform-types';
const storage=new Map<string,{data:Uint8Array;mime:string}>();
export async function putObject(key:string,stream:ReadableStream<Uint8Array>,mime:string,bytes:number){const data=new Uint8Array(await new Response(stream).arrayBuffer());if(data.length!==bytes)throw Error('Length mismatch');storage.set(key,{data,mime});}
export async function getObject(key:string):Promise<StoredObject|null>{const o=storage.get(key);return o?{body:new Blob([o.data as BlobPart]).stream(),size:o.data.byteLength,mime:o.mime}:null;}
export async function headObject(key:string){const o=storage.get(key);return o?{size:o.data.byteLength}:null;}
export async function deleteObject(key:string){storage.delete(key);}
export async function presignUpload(key:string,mime:string):Promise<string|null>{void key;void mime;return null;}
