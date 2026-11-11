import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { BagAction, BagActionName, BagSnapshot } from '../core/types/bag.types';

test('Bag templates: owner privacy, cross-scope reuse, public discovery, privatization copies and migration', { skip: process.env.BAG_INTEGRATION !== '1' }, async () => {
    const { config } = await import('dotenv'); config();
    const mysql = await import('mysql2/promise');
    const database = `rolz_bag_test_${randomUUID().replaceAll('-', '')}`;
    const admin = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306), user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'root' });
    let db: typeof import('../core/database/client') | undefined;
    try {
        await admin.query(`CREATE DATABASE \`${database}\``);
        const url = new URL(`mysql://root@127.0.0.1:${process.env.MYSQL_PORT ?? 3306}/${database}`); url.password = process.env.MYSQL_ROOT_PASSWORD ?? 'root';
        process.env.DATABASE_URL = url.toString(); process.env.DATABASE_SSL = 'false';
        db = await import('../core/database/client');
        const { ensureDatabaseSetup } = await import('../core/database/schema');
        await ensureDatabaseSetup(); await ensureDatabaseSetup();
        for (const id of ['owner', 'alice', 'bob', 'outsider']) await db.execute("INSERT INTO users (discord_user_id, username, avatar) VALUES (?, ?, '')", [id, id]);
        const roomId = randomUUID();
        await db.execute("INSERT INTO rooms (id, name, invite_code, created_by) VALUES (?, 'Bag Test', 'bag-test', 'owner')", [roomId]);
        for (const id of ['owner', 'alice', 'bob']) await db.execute('INSERT INTO room_members (id, room_id, user_id, role) VALUES (?, ?, ?, ?)', [randomUUID(), roomId, id, id === 'owner' ? 'creator' : 'player']);
        const { handleBagAction } = await import('../services/rooms/room-bag.service');
        const run = (action: BagActionName, userId = 'alice', extra: Partial<BagAction['payload']> = {}) => handleBagAction({ action, payload: { roomId, userId, scope: 'team', ...extra } });
        const read = async (userId = 'alice', scope: 'team' | 'personal' = 'team'): Promise<BagSnapshot> => { const r = await run('bag', userId, { scope }); if (!('bag' in r) || !r.bag) throw new Error('Missing bag'); return r.bag; };

        await run('setBagEnabled', 'owner', { enabled: true });
        await run('createBagTemplate', 'alice', { data: { name: 'Private stat', type: 'integer' } });
        const secret = (await read('alice')).templates[0]!;
        assert.deepEqual((await read('alice', 'personal')).templates, (await read('alice')).templates);
        assert.equal((await read('bob')).templates.length, 0);
        assert.equal((await read('owner')).templates.length, 0);
        await assert.rejects(run('updateBagTemplate', 'bob', { id: secret.id, revision: secret.revision, data: { name: 'Forged', type: 'integer' } }), { status: 404 });
        await assert.rejects(run('deleteBagTemplate', 'owner', { id: secret.id, revision: secret.revision }), { status: 404 });
        await assert.rejects(run('createBagItem', 'bob', { data: { name: 'Forbidden copy', fields: [{ ...secret, templateId: secret.id, value: 1 }] } }), { status: 400 });
        await run('createBagItem', 'alice', { scope: 'personal', data: { name: 'Private reuse', fields: [{ ...secret, templateId: secret.id, value: 9 }] } });
        await run('createBagTemplate', 'alice', { data: { name: 'Damage type', type: 'select', options: ['Fire', 'Ice'], public: true } });
        const shared = (await read('bob')).publicTemplates![0]!;
        assert.equal(shared.ownerId, 'alice'); assert.equal(shared.public, true);
        await assert.rejects(run('updateBagTemplate', 'bob', { id: shared.id, revision: shared.revision, data: { name: 'Stolen', type: 'string', public: true } }), { status: 404 });
        await run('createBagItem', 'bob', { data: { name: 'Team staff', fields: [{ ...shared, templateId: shared.id, value: 'Fire' }] } });
        await run('createBagItem', 'bob', { scope: 'personal', data: { name: 'My staff', fields: [{ ...shared, templateId: shared.id, value: 'Ice' }] } });
        const original = (await read('bob', 'personal')).items[0]!;
        assert.equal((await read('bob')).templates.length, 0);
        await run('updateBagTemplate', 'alice', { scope: 'personal', id: shared.id, revision: shared.revision, data: { name: 'Renamed damage', type: 'select', options: ['Arcane'], public: false } });
        const bobBag = await read('bob');
        assert.equal(bobBag.publicTemplates!.length, 0);
        assert.equal(bobBag.templates.length, 1);
        const replica = bobBag.templates[0]!;
        assert.notEqual(replica.id, shared.id); assert.equal(replica.ownerId, 'bob'); assert.equal(replica.public, false);
        assert.equal(replica.name, 'Damage type'); assert.deepEqual(replica.options, ['Fire', 'Ice']);
        assert.deepEqual((await read('bob', 'personal')).items[0], original);
        assert.equal((await read('owner')).templates.length, 0);
        assert.equal((await read('alice')).templates.some(t => t.id === replica.id), false);
        await run('createBagItem', 'bob', { scope: 'personal', data: { name: 'Replica staff', fields: [{ ...replica, templateId: replica.id, value: 'Fire' }] } });
        await run('updateBagItem', 'bob', { scope: 'personal', id: original.id, revision: original.revision, data: { ...original, description: 'Still editable' } });
        await assert.rejects(run('createBagItem', 'owner', { data: { name: 'Hidden', fields: [{ ...shared, templateId: shared.id, value: 'Fire' }] } }), { status: 400 });
        // Publishing/deleting preserves users' previously used definitions without duplicate replicas.
        const changed = (await read('alice')).templates.find(t => t.id === shared.id)!;
        await run('updateBagTemplate', 'alice', { id: shared.id, revision: changed.revision, data: { name: 'Damage type', type: 'select', options: ['Fire', 'Ice'], public: true } });
        const republished = (await read('alice')).templates.find(t => t.id === shared.id)!;
        await run('deleteBagTemplate', 'alice', { id: shared.id, revision: republished.revision });
        assert.equal((await read('bob')).templates.length, 1);
        assert.equal((await read('bob')).publicTemplates!.length, 0);
        // A user who only used a public field is also protected on deletion.
        await run('createBagTemplate', 'alice', { data: { name: 'Delete safely', type: 'string', public: true } });
        const deleted = (await read('owner')).publicTemplates![0]!;
        await run('createBagItem', 'owner', { data: { name: 'Owner item', fields: [{ ...deleted, templateId: deleted.id, value: 'kept' }] } });
        await run('deleteBagTemplate', 'alice', { id: deleted.id, revision: deleted.revision });
        assert.equal((await read('owner')).templates[0]!.name, 'Delete safely');
        // Legacy migration preserves IDs and definitions and is repeatable without resurrecting deletions.
        const legacyId = randomUUID(), legacyBag = (await read('alice', 'personal')).id;
        await db.execute('INSERT INTO room_bag_templates (id, bag_id, data) VALUES (?, ?, ?)', [legacyId, legacyBag, JSON.stringify({ name: 'Legacy private', type: 'integer', options: [] })]);
        await ensureDatabaseSetup();
        const migrated = (await read('alice')).templates.find(t => t.id === legacyId)!;
        assert.equal(migrated.public, false); assert.equal(migrated.ownerId, 'alice');
        await run('deleteBagTemplate', 'alice', { id: migrated.id, revision: migrated.revision });
        await ensureDatabaseSetup(); assert.equal((await read('alice')).templates.some(t => t.id === legacyId), false);
        await assert.rejects(run('bag', 'outsider'), { status: 403 });
    } finally {
        if (db) await db.pool.end();
        await admin.query('DROP DATABASE IF EXISTS `' + database + '`');
        await admin.end();
    }
});
