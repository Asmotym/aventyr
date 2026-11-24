import type { Express } from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Bind an ephemeral loopback port and always release it, including failed assertions. */
export async function withHttpApp<T>(app: Express, run: (baseUrl: string) => Promise<T>): Promise<T> {
    const server = createServer(app);
    try {
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
        server.closeAllConnections();
        if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}
