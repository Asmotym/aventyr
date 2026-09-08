import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { pool, query } from '../../core/database/client';
import { getRoomById } from '../../core/database/tables/rooms.table';
import { capRoomBonusPointBalances } from '../../core/database/tables/room-bonus-points.table';
import type { DatabaseRoomMessage, DatabaseRoomSession, DatabaseRoom, DatabaseRoomRollAward, DatabaseRoomBonusPointRule } from '../../core/types/database.types';
import type {
    RoomSession,
    RoomSessionCloseReason,
    RoomSessionConfiguration,
    RoomSessionListItem,
    RoomSessionRecap
} from '../../core/types/data.types';
import { evaluateRoomRollAward } from '../../core/utils/room-roll-awards';
import { HttpError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/http-errors';
import { mapBonusPointRuleRecord, mapMessageRecord, mapRollAwardRecord, parseStoredRoomCriticals } from './rooms.mappers';
import { DEFAULT_SESSION_INACTIVITY_MINUTES } from './rooms.constants';

import type { RoomSessionAwardAssignment, RoomSessionStartPreparation, RoomSessionStartRequest, StartRoomSessionPayload, RoomMessage } from '../../core/types/data.types';
import { selectSessionAwardCandidates } from '../../core/utils/session-award-candidates';
import { insertMessage } from '../../core/database/tables/room-messages.table';

type SessionLifecycle<T = undefined> = { session: RoomSession; started: boolean; closed?: RoomSession; value?: T };

function iso(value: string): string {
    if (value.includes('T')) return new Date(value).toISOString();
    return new Date(`${value.replace(' ', 'T')}Z`).toISOString();
}

function parseJson<T>(value: string | T | null | undefined, fallback: T): T {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value) as T; } catch { return fallback; }
}

function emptyRecap(startedAt: string, endedAt?: string | null): RoomSessionRecap {
    const end = endedAt ? new Date(iso(endedAt)).getTime() : Date.now();
    return {
        messageCount: 0,
        rollCount: 0,
        durationSeconds: Math.max(0, Math.floor((end - new Date(iso(startedAt)).getTime()) / 1000)),
        rollAwards: [],
        criticals: [],
        bonusPoints: { awarded: 0, used: 0, users: [] }
    };
}

function mapSessionRow(row: DatabaseRoomSession, recap?: RoomSessionRecap): RoomSession {
    const configuration = parseJson<RoomSessionConfiguration>(row.configuration_json, {
        rollAwards: { enabled: false, awards: [] },
        criticals: [],
        bonusPoints: { roomId: row.room_id, enabled: false, maxPointsPerUser: 0, allowExtremeSpend: false, rules: [] }
    });
    return {
        id: row.id,
        roomId: row.room_id,
        startedAt: iso(row.started_at),
        lastActivityAt: iso(row.last_activity_at),
        endedAt: row.ended_at ? iso(row.ended_at) : null,
        startReason: row.start_reason,
        closeReason: row.close_reason ?? null,
        configuration,
        recap: recap ?? parseJson(row.recap_json, emptyRecap(row.started_at, row.ended_at))
    };
}

async function buildConfiguration(roomId: string, connection: PoolConnection): Promise<RoomSessionConfiguration> {
    const [rooms] = await connection.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    const room = (rooms as DatabaseRoom[])[0];
    if (!room) throw new NotFoundError('Room not found');
    const [awardRows] = await connection.query('SELECT * FROM room_roll_awards WHERE room_id = ? ORDER BY created_at ASC', [roomId]);
    const [bonusRows] = await connection.query('SELECT * FROM room_bonus_point_rules WHERE room_id = ? ORDER BY created_at ASC', [roomId]);
    return {
        rollAwards: { enabled: Boolean(room.roll_awards_enabled), awards: (awardRows as DatabaseRoomRollAward[]).map(mapRollAwardRecord) },
        criticals: parseStoredRoomCriticals(room.room_criticals),
        bonusPoints: {
            roomId,
            enabled: Boolean(room.bonus_points_enabled),
            maxPointsPerUser: Number(room.bonus_points_max ?? 0),
            allowExtremeSpend: Boolean(room.bonus_points_allow_extreme_spend),
            rules: (bonusRows as DatabaseRoomBonusPointRule[]).map(mapBonusPointRuleRecord)
        }
    };
}

async function activeRow(connection: PoolConnection, roomId: string, lock = false): Promise<DatabaseRoomSession | undefined> {
    const [rows] = await connection.query(
        `SELECT * FROM room_sessions WHERE room_id = ? AND ended_at IS NULL LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
        [roomId]
    );
    return (rows as DatabaseRoomSession[])[0];
}

async function calculateRecap(connection: PoolConnection, row: DatabaseRoomSession, endedAt?: Date): Promise<RoomSessionRecap> {
    const [messageRows] = await connection.query(
        `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.session_id = ? ORDER BY rm.created_at ASC`,
        [row.id]
    );
    const messages = (messageRows as DatabaseRoomMessage[]).map(mapMessageRecord);
    const configuration = parseJson<RoomSessionConfiguration>(row.configuration_json, mapSessionRow(row).configuration);
    const names = new Map<string, string>();
    for (const message of messages) {
        if (message.userId) names.set(message.userId, message.nickname?.trim() || message.username?.trim() || message.userId);
    }
    const rollEntries = messages.filter((message) => message.type === 'dice' && message.userId).map((message) => ({
        userId: message.userId as string,
        rolls: message.diceRolls ?? [],
        notation: message.diceNotation
    }));
    const rollAwards = (configuration.rollAwards.enabled ? configuration.rollAwards.awards : []).map((award) => {
        const evaluation = evaluateRoomRollAward(award, rollEntries);
        const users = [...evaluation.counts.entries()].map(([userId, count]) => ({
            userId, displayName: names.get(userId) ?? userId, count
        })).sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
        return {
            award,
            users,
            leaders: users.filter((user) => evaluation.leaderUserIds.includes(user.userId)),
            maxHits: evaluation.maxHits
        };
    });
    const criticals = configuration.criticals.map((rule) => ({
        rule,
        matchCount: messages.filter((message) => {
            if (message.type !== 'dice' || !Number.isFinite(Number(message.diceTotal))) return false;
            return rule.operator === 'moreThan'
                ? Number(message.diceTotal) > rule.threshold
                : Number(message.diceTotal) < rule.threshold;
        }).length
    }));
    const [eventRows] = await connection.query(
        `SELECT e.user_id, e.event_type, SUM(e.amount) AS amount, u.username, rm.nickname
         FROM room_session_bonus_events e
         LEFT JOIN users u ON u.discord_user_id = e.user_id
         LEFT JOIN room_members rm ON rm.room_id = e.room_id AND rm.user_id = e.user_id
         WHERE e.session_id = ? GROUP BY e.user_id, e.event_type, u.username, rm.nickname`,
        [row.id]
    );
    const bonusUsers = new Map<string, { userId: string; displayName: string; awarded: number; used: number }>();
    for (const event of eventRows as Array<{ user_id: string; event_type: 'awarded' | 'used'; amount: number | string; username?: string; nickname?: string }>) {
        const current = bonusUsers.get(event.user_id) ?? {
            userId: event.user_id,
            displayName: event.nickname?.trim() || event.username?.trim() || names.get(event.user_id) || event.user_id,
            awarded: 0,
            used: 0
        };
        current[event.event_type] = Number(event.amount ?? 0);
        bonusUsers.set(event.user_id, current);
    }
    const users = [...bonusUsers.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
    const endMs = endedAt?.getTime() ?? (row.ended_at ? new Date(iso(row.ended_at)).getTime() : Date.now());
    return {
        messageCount: messages.filter((message) => message.type === 'text').length,
        rollCount: messages.filter((message) => message.type === 'dice').length,
        durationSeconds: Math.max(0, Math.floor((endMs - new Date(iso(row.started_at)).getTime()) / 1000)),
        rollAwards,
        criticals,
        bonusPoints: {
            awarded: users.reduce((sum, user) => sum + user.awarded, 0),
            used: users.reduce((sum, user) => sum + user.used, 0),
            users
        }
    };
}

async function closeLocked(connection: PoolConnection, row: DatabaseRoomSession, reason: RoomSessionCloseReason, endedAt: Date): Promise<RoomSession> {
    const recap = await calculateRecap(connection, row, endedAt);
    await connection.execute(
        'UPDATE room_sessions SET ended_at = ?, close_reason = ?, recap_json = ? WHERE id = ? AND ended_at IS NULL',
        [endedAt, reason, JSON.stringify(recap), row.id]
    );
    return mapSessionRow({ ...row, ended_at: endedAt.toISOString(), close_reason: reason, recap_json: JSON.stringify(recap) }, recap);
}

function inactivityDeadline(row: DatabaseRoomSession, minutes: number): Date {
    return new Date(new Date(iso(row.last_activity_at)).getTime() + minutes * 60_000);
}

export async function ensureSessionForActivity<T = undefined>(
    roomId: string,
    userId: string,
    operation?: (connection: PoolConnection, session: RoomSession) => Promise<T>
): Promise<SessionLifecycle<T>> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [roomRows] = await connection.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
        const room = (roomRows as Array<{ session_inactivity_minutes?: number }>)[0];
        if (!room) throw new NotFoundError('Room not found');
        const configuration = await buildConfiguration(roomId, connection);
        let row = await activeRow(connection, roomId, true);
        let closed: RoomSession | undefined;
        const now = new Date();
        if (row) {
            const deadline = inactivityDeadline(row, Number(room.session_inactivity_minutes ?? DEFAULT_SESSION_INACTIVITY_MINUTES));
            if (deadline.getTime() <= now.getTime()) {
                closed = await closeLocked(connection, row, 'inactivity', deadline);
                row = undefined;
            }
        }
        if (!row) {
            const preparation = await prepareLocked(connection, roomId, configuration);
            if (preparation.candidates.length) {
                // Expiry must survive a rejected activity; the payload has not been written.
                await connection.commit();
                throw new HttpError(409, 'Award selection is required before starting the session', { code: 'session_start_required' });
            }
            await capRoomBonusPointBalances(roomId, configuration.bonusPoints.maxPointsPerUser, connection);
            const id = randomUUID();
            await connection.execute(
                `INSERT INTO room_sessions (id, room_id, started_by, start_reason, started_at, last_activity_at, configuration_json)
                 VALUES (?, ?, ?, 'activity', ?, ?, ?)`,
                [id, roomId, userId, now, now, JSON.stringify(configuration)]
            );
            await connection.execute("UPDATE room_session_start_requests SET status = 'started', session_id = ? WHERE room_id = ?", [id, roomId]);
            row = (await activeRow(connection, roomId, true))!;
            const baseSession = mapSessionRow(row, emptyRecap(row.started_at));
            const value = operation ? await operation(connection, baseSession) : undefined;
            const recap = await calculateRecap(connection, row);
            await connection.commit();
            return { session: await withOwnedAwards(connection, mapSessionRow(row, recap)), started: true, closed, value };
        }
        await connection.execute('UPDATE room_sessions SET last_activity_at = ? WHERE id = ?', [now, row.id]);
        row = { ...row, last_activity_at: now.toISOString() };
        const baseSession = mapSessionRow(row, emptyRecap(row.started_at));
        const value = operation ? await operation(connection, baseSession) : undefined;
        const recap = await calculateRecap(connection, row);
        await connection.commit();
        return { session: await withOwnedAwards(connection, mapSessionRow(row, recap)), started: false, closed, value };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}

export async function startRoomSession(roomId: string, userId: string, payload: StartRoomSessionPayload = { roomId, userId }): Promise<RoomSession> {
    return withRoomLock(roomId, async (connection, room) => {
        if (room.created_by !== userId) throw new ForbiddenError('Only the room creator can start a session');
        const request = await readStartRequest(connection, roomId);
        const active = await expireLocked(connection, roomId, room.session_inactivity_minutes);
        if (active) {
            if (payload.requestId && request?.id === payload.requestId && request.sessionId === active.id) {
                return withOwnedAwards(connection, mapSessionRow(active, await calculateRecap(connection, active)));
            }
            throw new ConflictError('A session is already active');
        }
        const configuration = await buildConfiguration(roomId, connection);
        const preparation = await prepareLocked(connection, roomId, configuration);
        if (preparation.candidates.length) {
            if (!request || request.status !== 'pending' || payload.requestId !== request.id || payload.previousSessionId !== preparation.previousSessionId) {
                throw new HttpError(409, 'Refresh session award selection', { code: 'session_start_required' });
            }
            const selections = payload.selections ?? [];
            if (!Array.isArray(selections) || selections.some((entry) => !entry || typeof entry.awardId !== 'string' || typeof entry.userId !== 'string') || selections.length !== preparation.candidates.length ||
                new Set(selections.map((entry) => entry.awardId)).size !== selections.length ||
                preparation.candidates.some(({ award, users }) => !users.some((user) =>
                    selections.some((entry) => entry.awardId === award.id && entry.userId === user.userId)))) {
                throw new HttpError(409, 'Select an eligible owner for every award', { code: 'session_start_required' });
            }
        } else if (payload.requestId && (request?.id !== payload.requestId || request.status !== 'pending')) {
            throw new ConflictError('This session start request is no longer pending');
        }
        await capRoomBonusPointBalances(roomId, configuration.bonusPoints.maxPointsPerUser, connection);
        const id = randomUUID();
        const now = new Date();
        await connection.execute(
            `INSERT INTO room_sessions (id, room_id, started_by, start_reason, started_at, last_activity_at, configuration_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, roomId, userId, payload.reason === 'activity' ? 'activity' : 'manual', now, now, JSON.stringify(configuration)]
        );
        for (const { award } of preparation.candidates) {
            const owner = payload.selections!.find((entry) => entry.awardId === award.id)!;
            await connection.execute(
                `INSERT INTO room_session_awards (id, room_id, session_id, source_session_id, award_id, user_id, award_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [randomUUID(), roomId, id, preparation.previousSessionId, award.id, owner.userId, JSON.stringify(award)]
            );
        }
        await connection.execute("UPDATE room_session_start_requests SET status = 'started', session_id = ? WHERE room_id = ?", [id, roomId]);
        const row = (await activeRow(connection, roomId, true))!;
        return withOwnedAwards(connection, mapSessionRow(row, await calculateRecap(connection, row)));
    });
}

export async function closeRoomSession(roomId: string, userId: string, reason: RoomSessionCloseReason = 'manual'): Promise<RoomSession> {
    const room = await getRoomById(roomId);
    if (!room) throw new NotFoundError('Room not found');
    if (reason === 'manual' && room.created_by !== userId) throw new ForbiddenError('Only the room creator can close a session');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('SELECT id FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
        const row = await activeRow(connection, roomId, true);
        if (!row) throw new ConflictError('No session is active');
        const session = await closeLocked(connection, row, reason, new Date());
        await connection.commit();
        return session;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function getActiveRoomSession(roomId: string): Promise<RoomSession | null> {
    const rows = await query<DatabaseRoomSession[]>('SELECT * FROM room_sessions WHERE room_id = ? AND ended_at IS NULL LIMIT 1', [roomId]);
    const row = rows[0];
    if (!row) return null;
    const recap = await getLiveRecap(row.id);
    const connection = await pool.getConnection();
    try { return await withOwnedAwards(connection, mapSessionRow(row, recap)); }
    finally { connection.release(); }
}

export async function getLiveRecap(sessionId: string): Promise<RoomSessionRecap> {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT * FROM room_sessions WHERE id = ? LIMIT 1', [sessionId]);
        const row = (rows as DatabaseRoomSession[])[0];
        if (!row) throw new NotFoundError('Session not found');
        return row.recap_json ? parseJson(row.recap_json, emptyRecap(row.started_at, row.ended_at)) : calculateRecap(connection, row);
    } finally { connection.release(); }
}

export async function getRoomSessionRecap(roomId: string, sessionId: string): Promise<RoomSession> {
    const rows = await query<DatabaseRoomSession[]>('SELECT * FROM room_sessions WHERE id = ? AND room_id = ? LIMIT 1', [sessionId, roomId]);
    if (!rows[0]) throw new NotFoundError('Session not found');
    const recap = rows[0].recap_json ? undefined : await getLiveRecap(sessionId);
    const connection = await pool.getConnection();
    try { return await withOwnedAwards(connection, mapSessionRow(rows[0], recap)); }
    finally { connection.release(); }
}

export async function listClosedRoomSessions(payload: { roomId: string; before?: string; date?: string; limit?: number }): Promise<{ sessions: RoomSessionListItem[]; nextCursor: string | null }> {
    const limit = Math.min(100, Math.max(1, Math.floor(Number(payload.limit ?? 25))));
    const clauses = ['room_id = ?', 'ended_at IS NOT NULL'];
    const params: Array<string | number> = [payload.roomId];
    if (payload.before) {
        const cursor = new Date(payload.before);
        if (Number.isNaN(cursor.getTime())) throw new BadRequestError('Invalid session cursor');
        clauses.push('started_at < ?');
        params.push(cursor.toISOString().slice(0, 23).replace('T', ' '));
    }
    if (payload.date) { clauses.push('DATE(started_at) = ?'); params.push(payload.date); }
    const rows = await query<DatabaseRoomSession[]>(
        `SELECT * FROM room_sessions WHERE ${clauses.join(' AND ')} ORDER BY started_at DESC LIMIT ?`,
        [...params, limit + 1]
    );
    const page = rows.slice(0, limit);
    return {
        sessions: page.map((row) => ({
            id: row.id,
            roomId: row.room_id,
            startedAt: iso(row.started_at),
            endedAt: row.ended_at ? iso(row.ended_at) : null,
            closeReason: row.close_reason ?? null,
            durationSeconds: emptyRecap(row.started_at, row.ended_at).durationSeconds
        })),
        nextCursor: rows.length > limit && page[page.length - 1] ? iso(page[page.length - 1].started_at) : null
    };
}

export async function recordSessionBonusEvent(payload: { sessionId: string; roomId: string; userId: string; type: 'awarded' | 'used'; amount: number; messageId?: string }): Promise<void> {
    if (payload.amount <= 0) return;
    await query(
        `INSERT INTO room_session_bonus_events (id, session_id, room_id, user_id, event_type, amount, message_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), payload.sessionId, payload.roomId, payload.userId, payload.type, payload.amount, payload.messageId ?? null, new Date()]
    );
}

export async function expireInactiveSessions(): Promise<RoomSession[]> {
    const rooms = await query<Array<{ room_id: string }>>('SELECT room_id FROM room_sessions WHERE ended_at IS NULL');
    const closed: RoomSession[] = [];
    for (const { room_id: roomId } of rooms) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [roomRows] = await connection.query('SELECT session_inactivity_minutes FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
            const room = (roomRows as Array<{ session_inactivity_minutes: number }>)[0];
            const row = await activeRow(connection, roomId, true);
            if (room && row) {
                const deadline = inactivityDeadline(row, Number(room.session_inactivity_minutes ?? DEFAULT_SESSION_INACTIVITY_MINUTES));
                if (deadline.getTime() <= Date.now()) closed.push(await closeLocked(connection, row, 'inactivity', deadline));
            }
            await connection.commit();
        } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    }
    return closed;
}


type LockedRoom = { created_by: string; session_inactivity_minutes: number; archived_at?: string | null };
async function withRoomLock<T>(roomId: string, operation: (connection: PoolConnection, room: LockedRoom) => Promise<T>): Promise<T> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
        const room = (rows as LockedRoom[])[0];
        if (!room || room.archived_at) throw new NotFoundError('Active room not found');
        const result = await operation(connection, room);
        await connection.commit();
        return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}

async function expireLocked(connection: PoolConnection, roomId: string, minutes: number): Promise<DatabaseRoomSession | undefined> {
    const row = await activeRow(connection, roomId, true);
    if (row) {
        const deadline = inactivityDeadline(row, Number(minutes ?? DEFAULT_SESSION_INACTIVITY_MINUTES));
        if (deadline.getTime() <= Date.now()) {
            await closeLocked(connection, row, 'inactivity', deadline);
            return undefined;
        }
    }
    return row;
}

async function requireMember(connection: PoolConnection, roomId: string, userId: string): Promise<void> {
    const [rows] = await connection.query('SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (!(rows as unknown[]).length) throw new ForbiddenError('Room membership required');
}

async function readStartRequest(connection: PoolConnection, roomId: string): Promise<RoomSessionStartRequest | null> {
    const [rows] = await connection.query('SELECT * FROM room_session_start_requests WHERE room_id = ?', [roomId]);
    const row = (rows as Array<{ id: string; previous_session_id: string | null; status: RoomSessionStartRequest['status']; session_id: string | null }>)[0];
    return row ? { id: row.id, roomId, previousSessionId: row.previous_session_id, status: row.status, sessionId: row.session_id } : null;
}

async function prepareLocked(connection: PoolConnection, roomId: string, configuration: RoomSessionConfiguration): Promise<RoomSessionStartPreparation> {
    const [rows] = await connection.query('SELECT * FROM room_sessions WHERE room_id = ? AND ended_at IS NOT NULL ORDER BY started_at DESC, id DESC LIMIT 1', [roomId]);
    const previous = (rows as DatabaseRoomSession[])[0];
    const [members] = await connection.query('SELECT user_id FROM room_members WHERE room_id = ?', [roomId]);
    return {
        session: null,
        previousSessionId: previous?.id ?? null,
        candidates: selectSessionAwardCandidates(configuration.rollAwards.awards, previous ? mapSessionRow(previous).recap.rollAwards : [],
            new Set((members as Array<{ user_id: string }>).map((member) => member.user_id)), configuration.rollAwards.enabled),
        request: await readStartRequest(connection, roomId)
    };
}

export async function prepareRoomSessionStart(payload: { roomId: string; userId: string; request?: boolean }): Promise<RoomSessionStartPreparation> {
    return withRoomLock(payload.roomId, async (connection, room) => {
        await requireMember(connection, payload.roomId, payload.userId);
        const beforeExpiry = await activeRow(connection, payload.roomId);
        const row = await expireLocked(connection, payload.roomId, room.session_inactivity_minutes);
        if (row) return { session: await withOwnedAwards(connection, mapSessionRow(row, await calculateRecap(connection, row))), previousSessionId: null, candidates: [], request: await readStartRequest(connection, payload.roomId) };
        const preparation = await prepareLocked(connection, payload.roomId, await buildConfiguration(payload.roomId, connection));
        if (beforeExpiry) {
            const [closedRows] = await connection.query('SELECT * FROM room_sessions WHERE id = ?', [beforeExpiry.id]);
            preparation.closedSession = mapSessionRow((closedRows as DatabaseRoomSession[])[0]);
        }
        if (payload.request && preparation.candidates.length && (preparation.request?.status !== 'pending' || preparation.request.previousSessionId !== preparation.previousSessionId)) {
            const id = randomUUID();
            await connection.execute(`INSERT INTO room_session_start_requests (room_id, id, previous_session_id, status, session_id)
                VALUES (?, ?, ?, 'pending', NULL) ON DUPLICATE KEY UPDATE id = VALUES(id), previous_session_id = VALUES(previous_session_id), status = 'pending', session_id = NULL`,
                [payload.roomId, id, preparation.previousSessionId]);
            preparation.request = await readStartRequest(connection, payload.roomId);
        }
        return preparation;
    });
}

export async function cancelRoomSessionStart(payload: { roomId: string; userId: string; requestId: string }): Promise<RoomSessionStartRequest> {
    return withRoomLock(payload.roomId, async (connection, room) => {
        if (room.created_by !== payload.userId) throw new ForbiddenError('Only the room creator can cancel a session start');
        const request = await readStartRequest(connection, payload.roomId);
        if (!request || request.id !== payload.requestId || request.status === 'started') throw new ConflictError('Session start request is no longer pending');
        await connection.execute("UPDATE room_session_start_requests SET status = 'cancelled' WHERE room_id = ?", [payload.roomId]);
        return { ...request, status: 'cancelled' };
    });
}

async function withOwnedAwards(connection: PoolConnection, session: RoomSession): Promise<RoomSession> {
    const [rows] = await connection.query('SELECT * FROM room_session_awards WHERE session_id = ? ORDER BY id', [session.id]);
    session.ownedAwards = (rows as Array<{ id: string; session_id: string; source_session_id: string; user_id: string; award_json: string; used_at: string | null; usage_message_id: string | null }>).map((row): RoomSessionAwardAssignment => ({
        id: row.id, sessionId: row.session_id, sourceSessionId: row.source_session_id, userId: row.user_id,
        award: parseJson(row.award_json, {} as RoomSessionAwardAssignment['award']), usedAt: row.used_at ? iso(row.used_at) : null, usageMessageId: row.usage_message_id
    }));
    return session;
}

export async function useRoomRollAward(payload: { roomId: string; userId: string; sessionId: string; assignmentId: string }): Promise<{ message: RoomMessage; session: RoomSession }> {
    return withRoomLock(payload.roomId, async (connection, room) => {
        await requireMember(connection, payload.roomId, payload.userId);
        const row = await activeRow(connection, payload.roomId, true);
        if (!row || row.id !== payload.sessionId || inactivityDeadline(row, room.session_inactivity_minutes).getTime() <= Date.now()) throw new ConflictError('This session has ended');
        const session = await withOwnedAwards(connection, mapSessionRow(row));
        const assignment = session.ownedAwards!.find((entry) => entry.id === payload.assignmentId);
        if (!assignment || assignment.userId !== payload.userId) throw new ForbiddenError('You do not own this award');
        let message: RoomMessage;
        if (assignment.usageMessageId) {
            const [rows] = await connection.query(`SELECT rm.*, u.username, u.avatar, m.nickname AS member_nickname FROM room_messages rm
                LEFT JOIN users u ON u.discord_user_id = rm.user_id
                LEFT JOIN room_members m ON m.room_id = rm.room_id AND m.user_id = rm.user_id WHERE rm.id = ?`, [assignment.usageMessageId]);
            message = mapMessageRecord((rows as DatabaseRoomMessage[])[0]);
        } else {
            message = mapMessageRecord(await insertMessage({ room_id: payload.roomId, user_id: payload.userId, session_id: row.id,
                type: 'roll_award_usage', roll_award_usage: { assignmentId: assignment.id, award: assignment.award } }, connection));
            const now = new Date();
            await connection.execute('UPDATE room_session_awards SET used_at = ?, usage_message_id = ? WHERE id = ?', [now, message.id, assignment.id]);
            await connection.execute('UPDATE room_sessions SET last_activity_at = ? WHERE id = ?', [now, row.id]);
            row.last_activity_at = now.toISOString();
        }
        return { message, session: await withOwnedAwards(connection, mapSessionRow(row, await calculateRecap(connection, row))) };
    });
}
