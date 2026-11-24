import assert from 'node:assert/strict';
import test from 'node:test';
import { withHttpApp } from '../support/http';

// No database connections are opened: all exercised IO boundaries are explicit stubs.
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/aventyr_http_unused';
const { createApp } = await import('../../app/create-app');
const { DatabaseUnavailableError } = await import('../../infrastructure/database/errors');
const apiKeys = {
    verifyApiKey: async (key: string) => key === 'valid-key' ? { userId: 'member' } : null,
    recordApiKeyUsage: async () => {},
};
const trusted = { Origin: 'http://localhost:5173' };

test('real application probes are correlated, uncached and independent of API-key authentication', async () => {
    let calls = 0;
    const app = createApp({ readiness: async () => { calls++; } });
    await withHttpApp(app, async base => {
        const live = await fetch(base + '/health');
        assert.equal(live.status, 200);
        assert.equal(calls, 0);
        assert.equal(live.headers.get('cache-control'), 'no-store');
        const ready = await fetch(base + '/ready');
        assert.equal(ready.status, 200);
        assert.equal(calls, 1);
        assert.notEqual(live.headers.get('x-request-id'), ready.headers.get('x-request-id'));
    });
    await withHttpApp(createApp({ readiness: async () => { throw new Error('offline'); } }), async base => {
        const response = await fetch(base + '/ready');
        assert.equal(response.status, 503);
        assert.equal((await response.json()).requestId, response.headers.get('x-request-id'));
    });
});

test('API gate rejects missing/invalid keys and forwards verified owner identity', async () => {
    const seen: string[] = [];
    await withHttpApp(createApp({ apiKeys, rooms: { listRoomsForUser: async id => { seen.push(id); return []; } } }), async base => {
        assert.equal((await fetch(base + '/api/rooms')).status, 401);
        assert.equal((await fetch(base + '/api/rooms', { headers: { 'X-API-Key': 'bad' } })).status, 403);
        for (const headers of [{ 'X-API-Key': 'valid-key' }, { Authorization: 'Bearer valid-key' }] as Array<Record<string, string>>) {
            const response = await fetch(base + '/api/rooms', { headers });
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { success: true, data: { rooms: [] } });
        }
        assert.deepEqual(seen, ['member', 'member']);
        assert.equal((await fetch(base + '/api/rooms', { headers: trusted })).status, 401);
        const preflight = await fetch(base + '/api/rooms', { method: 'OPTIONS', headers: trusted });
        assert.equal(preflight.status, 200);
        assert.equal(preflight.headers.get('access-control-allow-origin'), trusted.Origin);
    });
});

test('room action validation rejects malformed JSON and shapes without reaching services', async () => {
    let calls = 0;
    await withHttpApp(createApp({ rooms: { handleRoomsAction: async () => { calls++; throw new Error('Unexpected service call'); } } }), async base => {
        for (const body of ['{', '{}', '{"payload":null}', '{"action":"message","payload":[]}']) {
            const response = await fetch(base + '/api/rooms', { method: 'POST', headers: { ...trusted, 'Content-Type': 'application/json' }, body });
            assert.equal(response.status, 400);
            const result = await response.json();
            assert.equal(result.success, false);
            assert.equal(result.requestId, response.headers.get('x-request-id'));
        }
        assert.equal(calls, 0);
    });
});

test('dependency errors from real routes preserve the 503 response contract', async () => {
    await withHttpApp(createApp({ apiKeys, rooms: { listRoomsForUser: async () => { throw new DatabaseUnavailableError('unavailable'); } } }), async base => {
        const response = await fetch(base + '/api/rooms', { headers: { 'X-API-Key': 'valid-key' } });
        assert.equal(response.status, 503);
        const result = await response.json();
        assert.equal(result.success, false);
        assert.equal(result.requestId, response.headers.get('x-request-id'));
    });
});

test('image routes preserve raw bytes, scope, identity and private read headers', async () => {
    const input = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await withHttpApp(createApp({ apiKeys, bags: {
        storeBagImage: async (roomId, userId, scope, bytes) => {
            assert.deepEqual([roomId, userId, scope], ['room', 'member', 'personal']);
            assert.deepEqual(bytes, input);
            return 'image';
        },
        readBagImage: async () => input,
    } }), async base => {
        const response = await fetch(base + '/api/rooms/room/bag/images?scope=personal', {
            method: 'POST', headers: { 'X-API-Key': 'valid-key', 'Content-Type': 'image/png' }, body: input,
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, data: { imageId: 'image' } });
        const image = await fetch(base + '/api/rooms/room/bag/images/image', { headers: { 'X-API-Key': 'valid-key' } });
        assert.equal(image.headers.get('content-type'), 'image/webp');
        assert.equal(image.headers.get('cache-control'), 'private, no-store');
        assert.deepEqual(Buffer.from(await image.arrayBuffer()), input);
    });
});

test('public dice history requires a verified API-key owner and forwards that identity', async () => {
    let actor: string | undefined;
    await withHttpApp(createApp({ apiKeys, rooms: { listRoomDiceRolls: async payload => { actor = (payload as typeof payload & { userId?: string }).userId; return []; } } }), async base => {
        const url = base + '/api/rooms/room/dice-rolls';
        assert.equal((await fetch(url, { headers: trusted })).status, 401);
        assert.equal((await fetch(url, { headers: { 'X-API-Key': 'invalid' } })).status, 403);
        const response = await fetch(url, { headers: { 'X-API-Key': 'valid-key' } });
        assert.equal(response.status, 200);
        assert.equal(actor, 'member');
    });
});

test('account keys cannot be read/generated/revoked anonymously through a trusted origin', async () => {
    let calls = 0;
    await withHttpApp(createApp({ accounts: {
        getUserApiKey: async () => { calls++; return null; },
        generateUserApiKey: async () => { calls++; return { apiKey: 'never' }; },
        revokeUserApiKey: async () => { calls++; },
    } }), async base => {
        for (const method of ['GET', 'POST', 'DELETE']) {
            assert.equal((await fetch(base + '/api/users/victim/api-key', { method, headers: trusted })).status, 401);
        }
        assert.equal(calls, 0);
    });
});
