interface D1Result<T=unknown>{results:T[];meta:{changes:number};success:boolean}
interface D1PreparedStatement{bind(...values:unknown[]):D1PreparedStatement;all<T=unknown>():Promise<D1Result<T>>;run():Promise<D1Result>;first<T=unknown>():Promise<T|null>}
interface D1Database{prepare(sql:string):D1PreparedStatement;batch(statements:D1PreparedStatement[]):Promise<D1Result[]>}
interface R2Bucket{put(key:string,body:ReadableStream<Uint8Array>,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>;get(key:string):Promise<{body:ReadableStream<Uint8Array>;size:number;httpMetadata?:{contentType?:string}}|null>;head(key:string):Promise<{size:number}|null>;delete(key:string):Promise<void>}
interface Fetcher{fetch(request:Request):Promise<Response>}
declare class FixedLengthStream{constructor(length:number);readable:ReadableStream<Uint8Array>;writable:WritableStream<Uint8Array>}
declare module 'cloudflare:workers'{export const env:Record<string,unknown>}
