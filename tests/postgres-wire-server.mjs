import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { TLSSocket, createSecureContext } from 'node:tls';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PGlite } from '@electric-sql/pglite';

function message(type, payload) {
    const header = Buffer.alloc(5);
    header[0] = type.charCodeAt(0);
    header.writeInt32BE(payload.length + 4, 1);
    return Buffer.concat([header, payload]);
}

// Local TLS endpoint with a real PostgreSQL engine, exclusively for tests.
export async function postgresWireServer(setup = '') {
    const directory = await mkdtemp(join(tmpdir(), 'foto-digital-wire-'));
    const db = new PGlite();
    const sockets = new Set();
    let server, failure;
    let pending = 0, peak = 0;
    try {
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
            '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
            '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem')], { stdio: 'ignore' });
        const [key, cert] = await Promise.all(['key.pem', 'cert.pem'].map(file => readFile(join(directory, file))));
        const secureContext = createSecureContext({ key, cert });
        await db.waitReady;
        if (setup) await db.exec(setup);
        server = createServer(socket => {
            sockets.add(socket);
            socket.once('data', request => {
                assert.equal(request.readInt32BE(4), 80877103, 'TLS negotiation must remain enabled');
                socket.write('S');
                const tls = new TLSSocket(socket, { isServer: true, secureContext });
                sockets.add(tls);
                let startup = true, input = Buffer.alloc(0), batch = [], chain = Promise.resolve();
                tls.on('error', error => { failure ??= error; });
                tls.on('data', bytes => {
                    input = Buffer.concat([input, bytes]);
                    if (startup) {
                        if (input.length < 4 || input.length < input.readInt32BE(0)) return;
                        input = input.subarray(input.readInt32BE(0));
                        startup = false;
                        tls.write(Buffer.concat([message('R', Buffer.alloc(4)), message('Z', Buffer.from('I'))]));
                    }
                    while (input.length >= 5 && input.length >= input.readInt32BE(1) + 1) {
                        const frame = input.subarray(0, input.readInt32BE(1) + 1);
                        input = input.subarray(frame.length);
                        const type = String.fromCharCode(frame[0]);
                        if (type === 'X') { tls.end(); return; }
                        if (type === 'Q' || type === 'P') peak = Math.max(peak, ++pending);
                        batch.push(frame);
                        if (!['Q', 'H', 'S'].includes(type)) continue;
                        const request = Buffer.concat(batch);
                        batch = [];
                        chain = chain.then(async () => {
                            // Allow pipelined input to arrive before sending the
                            // reply, as happens across the production network.
                            await delay(3);
                            const reply = Buffer.from(await db.execProtocolRaw(request));
                            for (let offset = 0; offset < reply.length; offset += reply.readInt32BE(offset + 1) + 1) {
                                // Error recovery may send an extra Sync/ReadyForQuery
                                // without starting another SQL statement.
                                if (reply[offset] === 90 && pending > 0) pending--;
                            }
                            tls.write(reply);
                        }).catch(error => { failure ??= error; tls.destroy(); });
                    }
                });
            });
        });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        return {
            connection: `postgresql://test:local-only@127.0.0.1:${server.address().port}/postgres`,
            ca: cert.toString(),
            stats: () => ({ pending, peak, failure }),
            close,
        };
    } catch (error) {
        await close();
        throw error;
    }
    async function close() {
        for (const socket of sockets) socket.destroy();
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        await db.close();
        await rm(directory, { recursive: true, force: true });
    }
}
