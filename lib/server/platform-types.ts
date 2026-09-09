export type Statement = {
    sql: string;
    params?: unknown[];
};
export type StoredObject = {
    body: ReadableStream<Uint8Array>;
    size: number;
    mime: string;
};
