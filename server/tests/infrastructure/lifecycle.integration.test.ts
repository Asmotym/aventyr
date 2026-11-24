import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createTestDatabase } from '../support/database';

test('server startup runs schema before readiness and shutdown releases listeners and the database pool', {
    skip: process.env.ROOMS_INTEGRATION !== '1',
    timeout: 30_000,
}, async t => {
    const { admin, database } = await createTestDatabase('lifecycle');
    const { startServer } = await import('../../app/start-server');
    const { pool } = await import('../../infrastructure/database/client');
    let runtime: Awaited<ReturnType<typeof startServer>> | undefined;
    t.after(async () => {
        // startServer owns pool cleanup on both startup failure and normal shutdown.
        if (runtime) await runtime.stop();
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
        await admin.end();
    });
    runtime = await startServer({ port: 0, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${(runtime.server.address() as AddressInfo).port}`;
    assert.equal((await fetch(base + '/ready')).status, 200);
    const first = runtime.stop();
    assert.equal(runtime.stop(), first);
    await first;
    assert.equal(runtime.server.listening, false);
    await assert.rejects(pool.query('SELECT 1'), /closed/i);
    await runtime.stop();
});
