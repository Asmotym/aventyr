import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestDatabase } from '../../../support/database';
import { withHttpApp } from '../../../support/http';

test('Rooms HTTP/MySQL: entry, membership, key ownership, dice history, favorites and archive lifecycle', {
    skip: process.env.ROOMS_INTEGRATION !== '1',
}, async t => {
    const { admin, database } = await createTestDatabase('rooms_http');
    const db = await import('../../../../infrastructure/database/client');
    t.after(async () => {
        await db.pool.end();
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
        await admin.end();
    });
    const { ensureDatabaseSetup } = await import('../../../../app/schema');
    await ensureDatabaseSetup();
    const { handleRoomsAction } = await import('../../../../features/rooms/rooms.service');
    const { generateUserApiKey } = await import('../../../../features/accounts/api-keys.service');
    const { createApp } = await import('../../../../app/create-app');
    for (const id of ['creator', 'member', 'outsider']) {
        await db.execute("INSERT INTO users (discord_user_id, username, avatar) VALUES (?, ?, '')", [id, id]);
    }
    const ownerKey = (await generateUserApiKey('creator')).apiKey;
    const memberKey = (await generateUserApiKey('member')).apiKey;
    const outsiderKey = (await generateUserApiKey('outsider')).apiKey;
    await withHttpApp(createApp(), async base => {
        async function action(key: string, action: string, payload: object) {
            return fetch(base + '/api/rooms', { method: 'POST', headers: { 'X-API-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
        }
        assert.equal((await action(ownerKey, 'create', { userId: 'creator', name: '  ' })).status, 400);
        const created = await action(ownerKey, 'create', { userId: 'creator', name: '  Campaign  ', password: 'protected' });
        assert.equal(created.status, 200);
        const room = (await created.json()).data.room;
        assert.equal(room.name, 'Campaign');
        assert.equal((await action(memberKey, 'join', { userId: 'member', inviteCode: room.inviteCode, password: 'bad' })).status, 403);
        assert.equal((await action(memberKey, 'join', { userId: 'creator', inviteCode: room.inviteCode, password: 'protected' })).status, 403);
        assert.equal((await action(memberKey, 'join', { userId: 'member', inviteCode: room.inviteCode, password: 'protected' })).status, 200);
        const history = base + `/api/rooms/${room.id}/dice-rolls`;
        assert.equal((await fetch(history, { headers: { Origin: 'http://localhost:5173' } })).status, 401);
        assert.equal((await fetch(history, { headers: { 'X-API-Key': outsiderKey } })).status, 403);
        assert.equal((await fetch(history, { headers: { 'X-API-Key': memberKey } })).status, 200);
        assert.equal((await fetch(base + '/api/rooms/missing/dice-rolls', { headers: { 'X-API-Key': memberKey } })).status, 404);
        assert.equal((await fetch(base + `/api/users/creator/api-key`, { headers: { 'X-API-Key': memberKey } })).status, 403);
        assert.equal((await action(memberKey, 'setRoomFavorite', { userId: 'member', roomId: room.id, favorite: true })).status, 200);
        const listing = await fetch(base + '/api/rooms', { headers: { 'X-API-Key': memberKey } });
        assert.equal((await listing.json()).data.rooms[0].isFavorite, true);
        const archived = await action(ownerKey, 'archiveRoom', { userId: 'creator', roomId: room.id });
        assert.equal(archived.status, 200);
        assert.equal((await action(ownerKey, 'unarchiveRoom', { userId: 'creator', roomId: room.id })).status, 200);
        assert.equal((await action(memberKey, 'leaveRoom', { userId: 'member', roomId: room.id })).status, 200);
        assert.equal((await fetch(history, { headers: { 'X-API-Key': memberKey } })).status, 403);
    });
    await assert.rejects(handleRoomsAction({ action: 'leaveRoom', payload: { roomId: 'missing', userId: 'creator' } }), { status: 404 });
    await ensureDatabaseSetup();
});
