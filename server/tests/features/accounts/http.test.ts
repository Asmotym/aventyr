import assert from 'node:assert/strict';
import test from 'node:test';
import { withHttpApp } from '../../support/http';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/aventyr_accounts_unused';
const { createApp } = await import('../../../app/create-app');
const apiKeys = { verifyApiKey: async () => ({ userId: 'member' }), recordApiKeyUsage: async () => {} };
const key = { 'X-API-Key': 'valid', 'Content-Type': 'application/json' };

test('preferences validate partial updates, preserve null locale and enforce the authenticated user', async () => {
    let saves = 0;
    await withHttpApp(createApp({ apiKeys, accounts: {
        getUser: async () => ({ discord_user_id: 'member', username: 'Member', avatar: '', locale: null }),
        updateUserPreferences: async (id, update) => {
            saves++;
            assert.equal(id, 'member');
            assert.deepEqual(update, { theme: 'light' });
            return { theme: 'light', themeStyle: 'aventyr', locale: null, articleSort: 'newest' };
        },
    } }), async base => {
        const response = await fetch(base + '/api/users/member/preferences', { headers: key });
        assert.deepEqual((await response.json()).data, { theme: 'dark', themeStyle: 'aventyr', locale: null, articleSort: 'newest' });
        for (const body of [{}, { locale: null }, { locale: 'xx' }, { theme: 'unknown' }, { themeStyle: 'unknown' }, { articleSort: 'unknown' }]) {
            assert.equal((await fetch(base + '/api/users/member/preferences', { method: 'PATCH', headers: key, body: JSON.stringify(body) })).status, 400);
        }
        assert.equal(saves, 0);
        const saved = await fetch(base + '/api/users/member/preferences', { method: 'PATCH', headers: key, body: JSON.stringify({ theme: 'light' }) });
        assert.equal(saved.status, 200);
        assert.equal(saves, 1);
        assert.equal((await fetch(base + '/api/users/victim/preferences', { headers: key })).status, 403);
    });
});

test('key generation/read/revocation retain their envelopes and reject another account', async () => {
    let current: string | null = null;
    await withHttpApp(createApp({ apiKeys, accounts: {
        getUserApiKey: async () => current ? { apiKey: current } : null,
        generateUserApiKey: async () => ({ apiKey: current = 'generated' }),
        revokeUserApiKey: async () => { current = null; },
    } }), async base => {
        const url = base + '/api/users/member/api-key';
        assert.equal((await (await fetch(url, { headers: key })).json()).data.apiKey, null);
        assert.equal((await (await fetch(url, { method: 'POST', headers: key })).json()).data.apiKey, 'generated');
        assert.equal((await (await fetch(url, { headers: key })).json()).data.apiKey, 'generated');
        assert.equal((await (await fetch(url, { method: 'DELETE', headers: key })).json()).data.apiKey, null);
        for (const method of ['GET', 'POST', 'DELETE']) assert.equal((await fetch(base + '/api/users/victim/api-key', { method, headers: key })).status, 403);
    });
});
