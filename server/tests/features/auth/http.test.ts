import assert from 'node:assert/strict';
import test from 'node:test';
import { withHttpApp } from '../../support/http';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/aventyr_auth_unused';
const { createApp } = await import('../../../app/create-app');
const request = globalThis.fetch;
const headers = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' };

test('Discord OAuth validates grants and callback, forwards exchange/refresh and never caches credentials', async t => {
    const env = { ...process.env };
    t.after(() => { process.env = env; });
    process.env.DISCORD_CLIENT_ID = 'test-client';
    process.env.DISCORD_CLIENT_SECRET = 'test-secret';
    process.env.DISCORD_REDIRECT_URI = 'http://localhost:5173';
    const exchanges: URLSearchParams[] = [];
    t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
        exchanges.push(options.body as URLSearchParams);
        return new Response(JSON.stringify({ token_type: 'Bearer', access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }), { status: 200 });
    });
    await withHttpApp(createApp(), async base => {
        for (const body of [ { grantType: 'unknown' }, { grantType: 'refresh_token' }, { grantType: 'authorization_code', code: 'code', redirectUri: 'https://outsider.test' } ]) {
            assert.equal((await request(base + '/api/discord/oauth/token', { method: 'POST', headers, body: JSON.stringify(body) })).status, 400);
        }
        assert.equal(exchanges.length, 0);
        for (const body of [ { grantType: 'authorization_code', code: 'code', redirectUri: 'http://localhost:5173' }, { grantType: 'refresh_token', refreshToken: 'refresh' } ]) {
            const response = await request(base + '/api/discord/oauth/token', { method: 'POST', headers, body: JSON.stringify(body) });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('cache-control'), 'no-store');
            assert.equal((await response.json()).data.access_token, 'access');
        }
        assert.equal(exchanges[0]!.get('code'), 'code');
        assert.equal(exchanges[1]!.get('refresh_token'), 'refresh');
        assert.equal(exchanges[0]!.get('client_secret'), 'test-secret');
    });
});

test('Discord OAuth reports provider rejection, malformed token responses and missing configuration', async t => {
    const env = { ...process.env };
    t.after(() => { process.env = env; });
    process.env.DISCORD_CLIENT_ID = 'test-client';
    process.env.DISCORD_CLIENT_SECRET = 'test-secret';
    let status = 401;
    t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status }));
    await withHttpApp(createApp(), async base => {
        const run = () => request(base + '/api/discord/oauth/token', { method: 'POST', headers, body: JSON.stringify({ grantType: 'refresh_token', refreshToken: 'refresh' }) });
        assert.equal((await run()).status, 401);
        status = 200;
        assert.equal((await run()).status, 401);
        delete process.env.DISCORD_CLIENT_SECRET;
        assert.equal((await run()).status, 503);
    });
});
