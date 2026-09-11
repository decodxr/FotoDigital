import { DeadlineError, withinDeadline } from './deadline';

interface Connection {
    end(options: { timeout: number }): Promise<void>;
}
interface Limits {
    queryMs?: number;
    transactionMs?: number;
    idleMs?: number;
}
const connectionErrors = new Set(['DATABASE_TIMEOUT', 'CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_DESTROYED', 'ECONNRESET', 'EPIPE']);

/** Bound the complete operation, including time spent waiting in the pool. */
export function createDatabaseRuntime<C extends Connection>(create: () => C, limits: Limits = {}) {
    type Entry = { client: C; pending: number; lastFinished: number; closed: boolean };
    let current: Entry | undefined;

    function discard(entry: Entry) {
        if (entry.closed) return;
        entry.closed = true;
        if (current === entry) current = undefined;
        // Reject queued work and retire the old pool. Never replay uncertain writes.
        void entry.client.end({ timeout: 0 }).catch(() => {});
    }

    return {
        async run<T>(phase: 'query' | 'transaction', label: string, action: (client: C) => PromiseLike<T>): Promise<T> {
            // Serverless suspension can leave a socket stale while its idle timer
            // is frozen. Recycle idle pools before work, never an active transaction.
            if (current && current.pending === 0 && Date.now() - current.lastFinished > (limits.idleMs ?? 5000)) discard(current);
            const entry = current ??= { client: create(), pending: 0, lastFinished: Date.now(), closed: false };
            entry.pending++;
            const started = Date.now();
            try {
                const timeout = phase === 'transaction' ? (limits.transactionMs ?? 25000) : (limits.queryMs ?? 8000);
                return await withinDeadline(action(entry.client), timeout,
                    new DeadlineError('DATABASE_TIMEOUT', 'O banco de dados não respondeu dentro do prazo.'), () => discard(entry));
            } catch (error) {
                const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
                // No SQL, parameters, URLs, passwords or certificate bodies in logs.
                console.error('database_operation_failed', { phase, label, code, elapsedMs: Date.now() - started });
                if (connectionErrors.has(code)) discard(entry);
                throw error;
            } finally {
                entry.pending--;
                entry.lastFinished = Date.now();
            }
        },
    };
}
