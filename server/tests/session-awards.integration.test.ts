import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { RoomSession } from '../core/types/data.types';

// Opt-in: create and remove a uniquely named database on a local MySQL server.
test('session awards: atomic assignment, usage, recovery, expiry and rollback in MySQL', { skip: process.env.ROLL_AWARDS_INTEGRATION !== '1' }, async () => {
    const { config } = await import('dotenv');
    config();
    const mysql = await import('mysql2/promise');
    const database = `rolz_awards_test_${randomUUID().replaceAll('-', '')}`;
    const admin = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306), user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'root' });
    let pool: import('mysql2/promise').Pool | undefined;
    try {
        await admin.query(`CREATE DATABASE \`${database}\``);
        const url = new URL(`mysql://root@127.0.0.1:${process.env.MYSQL_PORT ?? 3306}/${database}`);
        url.password = process.env.MYSQL_ROOT_PASSWORD ?? 'root';
        process.env.DATABASE_URL = url.toString();
        process.env.DATABASE_SSL = 'false';
        const db = await import('../core/database/client');
        pool = db.pool;
        const { ensureDatabaseSetup } = await import('../core/database/schema');
        const sessions = await import('../services/rooms/room-sessions.service');
        const { handleSendMessage } = await import('../services/rooms/room-messages.service');
        const { getPublicUserProfile } = await import('../services/user-profiles.service');
        await ensureDatabaseSetup();
        await ensureDatabaseSetup(); // migration is repeatable
        for (const id of ['leader', 'alice', 'bob']) await db.execute("INSERT INTO users (discord_user_id, username, avatar) VALUES (?, ?, '')", [id, id]);
        const roomId = randomUUID();
        const awardId = randomUUID();
        await db.execute("INSERT INTO rooms (id, name, invite_code, created_by, roll_awards_enabled) VALUES (?, 'Test', 'awards-test', 'leader', 1)", [roomId]);
        for (const userId of ['leader', 'alice', 'bob']) await db.execute('INSERT INTO room_members (id, room_id, user_id) VALUES (?, ?, ?)', [randomUUID(), roomId, userId]);
        await db.execute("INSERT INTO room_roll_awards (id, room_id, name, description, dice_results) VALUES (?, ?, 'Twenties', 'Original', '[20]')", [awardId, roomId]);
        assert.deepEqual((await sessions.prepareRoomSessionStart({ roomId, userId: 'alice', request: true })).candidates, []);
        await assert.rejects(handleSendMessage({ roomId, userId: 'alice', type: 'roll_award_usage' as 'text', content: 'Forged usage' }), { status: 400 });
        const first = await handleSendMessage({ roomId, userId: 'alice', type: 'dice', dice: { notation: 'd20', total: 20, rolls: [20] } });
        assert.equal(first.sessionStarted, true);
        assert.deepEqual(first.session.ownedAwards, []);
        await handleSendMessage({ roomId, userId: 'bob', type: 'dice', dice: { notation: 'd20', total: 20, rolls: [20] } });
        await sessions.closeRoomSession(roomId, 'leader');
        await assert.rejects(handleSendMessage({ roomId, userId: 'alice', type: 'text', content: 'Must wait' }), { code: 'session_start_required' });
        assert.equal(Number((await db.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM room_messages'))[0].n), 2);
        const saturated = await Promise.all(Array.from({ length: 12 }, () => sessions.prepareRoomSessionStart({ roomId, userId: 'alice' })));
        assert.equal(saturated.length, 12);
        const [preparation, concurrent] = await Promise.all([
            sessions.prepareRoomSessionStart({ roomId, userId: 'alice', request: true }),
            sessions.prepareRoomSessionStart({ roomId, userId: 'bob', request: true })
        ]);
        assert.equal(preparation.request!.id, concurrent.request!.id);
        assert.equal(preparation.candidates[0].users.length, 2);
        const recovery = await sessions.prepareRoomSessionStart({ roomId, userId: 'leader' });
        assert.equal(recovery.request!.id, preparation.request!.id);
        const payload = { roomId, userId: 'leader', requestId: preparation.request!.id, previousSessionId: first.session.id, selections: [{ awardId, userId: 'alice' }] };
        await assert.rejects(sessions.startRoomSession(roomId, 'alice', payload), { status: 403 });
        await assert.rejects(sessions.startRoomSession(roomId, 'leader', { ...payload, selections: [] }), { code: 'session_start_required' });
        await assert.rejects(sessions.startRoomSession(roomId, 'leader', { ...payload, previousSessionId: 'stale' }), { code: 'session_start_required' });
        await assert.rejects(sessions.startRoomSession(roomId, 'leader', { ...payload, selections: [{ awardId, userId: 'leader' }] }), { code: 'session_start_required' });
        await db.execute("UPDATE room_roll_awards SET name = 'Updated', description = 'New description' WHERE id = ?", [awardId]);
        // A database failure after session insertion must roll back both the session and assignments.
        await db.query("CREATE TRIGGER reject_assignment BEFORE INSERT ON room_session_awards FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test rollback'");
        await assert.rejects(sessions.startRoomSession(roomId, 'leader', payload), /test rollback/);
        assert.equal(await sessions.getActiveRoomSession(roomId), null);
        await db.query('DROP TRIGGER reject_assignment');
        const started = await Promise.all([sessions.startRoomSession(roomId, 'leader', payload), sessions.startRoomSession(roomId, 'leader', payload)]);
        assert.equal(started[0].id, started[1].id);
        const active: RoomSession = started[0];
        const assignment = active.ownedAwards![0];
        assert.equal(active.ownedAwards!.length, 1);
        assert.equal(assignment.award.name, 'Updated');
        const use = { roomId, userId: 'alice', sessionId: active.id, assignmentId: assignment.id };
        await assert.rejects(sessions.useRoomRollAward({ ...use, userId: 'bob' }), { status: 403 });
        await assert.rejects(sessions.useRoomRollAward({ ...use, sessionId: first.session.id }), { status: 409 });
        await db.query("CREATE TRIGGER reject_usage BEFORE INSERT ON room_messages FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'usage rollback'");
        await assert.rejects(sessions.useRoomRollAward(use), /usage rollback/);
        assert.equal((await sessions.getActiveRoomSession(roomId))!.ownedAwards![0].usedAt, null);
        await db.query('DROP TRIGGER reject_usage');
        await db.execute('DELETE FROM room_roll_awards WHERE id = ?', [awardId]);
        const used = await Promise.all([sessions.useRoomRollAward(use), sessions.useRoomRollAward(use)]);
        assert.equal(used[0].message.id, used[1].message.id);
        assert.equal(used[0].message.type, 'roll_award_usage');
        assert.equal(used[0].message.rollAwardUsage!.award.description, 'New description');
        assert.equal(used[0].session.recap.messageCount, 0);
        assert.equal(used[0].session.recap.rollCount, 0);
        assert.equal(Number((await db.query<Array<{ n: number }>>("SELECT COUNT(*) AS n FROM room_messages WHERE type = 'roll_award_usage'"))[0].n), 1);
        assert.ok((await sessions.getActiveRoomSession(roomId))!.ownedAwards![0].usedAt);
        assert.ok((await getPublicUserProfile({ targetUserId: 'alice', requesterUserId: 'bob', roomId })).room!.rollAwards![0].usedAt);
        await db.execute('UPDATE room_sessions SET last_activity_at = DATE_SUB(NOW(), INTERVAL 5 HOUR) WHERE id = ?', [active.id]);
        await assert.rejects(sessions.useRoomRollAward(use), { status: 409 });
        const expired = await sessions.prepareRoomSessionStart({ roomId, userId: 'leader' });
        assert.equal(expired.session, null);
        assert.equal(expired.closedSession!.id, active.id);
        assert.deepEqual(expired.candidates, []);
        // Cancelled requests remain visible to reconnecting clients and cannot start a session.
        await db.execute("INSERT INTO room_roll_awards (id, room_id, name, dice_results) VALUES (?, ?, 'Again', '[20]')", [awardId, roomId]);
        await handleSendMessage({ roomId, userId: 'alice', type: 'dice', dice: { notation: 'd20', total: 20, rolls: [20] } });
        await sessions.closeRoomSession(roomId, 'leader');
        const pending = await sessions.prepareRoomSessionStart({ roomId, userId: 'bob', request: true });
        assert.equal(pending.candidates[0].users.length, 1);
        await sessions.cancelRoomSessionStart({ roomId, userId: 'leader', requestId: pending.request!.id });
        assert.equal((await sessions.prepareRoomSessionStart({ roomId, userId: 'bob' })).request!.status, 'cancelled');
        await assert.rejects(sessions.startRoomSession(roomId, 'leader', { ...payload, requestId: pending.request!.id, previousSessionId: pending.previousSessionId }), { code: 'session_start_required' });
        await db.execute('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, 'alice']);
        assert.deepEqual((await sessions.prepareRoomSessionStart({ roomId, userId: 'leader' })).candidates, []);
    } finally {
        await pool?.end();
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
        await admin.end();
    }
});
