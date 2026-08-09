import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { pool, query } from '../../core/database/client';
import { getRoomById } from '../../core/database/tables/rooms.table';
import { listRoomRollAwards } from '../../core/database/tables/room-roll-awards.table';
import { capRoomBonusPointBalances, listRoomBonusPointRules } from '../../core/database/tables/room-bonus-points.table';
import type { DatabaseRoomMessage, DatabaseRoomSession } from '../../core/types/database.types';
import type {
    RoomSession,
    RoomSessionCloseReason,
    RoomSessionConfiguration,
    RoomSessionListItem,
    RoomSessionRecap
} from '../../core/types/data.types';
import { evaluateRoomRollAward } from '../../core/utils/room-roll-awards';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/http-errors';
import { mapBonusPointRuleRecord, mapMessageRecord, mapRollAwardRecord, parseStoredRoomCriticals } from './rooms.mappers';
import { DEFAULT_SESSION_INACTIVITY_MINUTES } from './rooms.constants';

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

async function buildConfiguration(roomId: string): Promise<RoomSessionConfiguration> {
    const room = await getRoomById(roomId);
    if (!room) throw new NotFoundError('Room not found');
    const [awardRows, bonusRows] = await Promise.all([
        listRoomRollAwards(roomId),
        listRoomBonusPointRules(roomId)
    ]);
    return {
        rollAwards: { enabled: Boolean(room.roll_awards_enabled), awards: awardRows.map(mapRollAwardRecord) },
        criticals: parseStoredRoomCriticals(room.room_criticals),
        bonusPoints: {
            roomId,
            enabled: Boolean(room.bonus_points_enabled),
            maxPointsPerUser: Number(room.bonus_points_max ?? 0),
            allowExtremeSpend: Boolean(room.bonus_points_allow_extreme_spend),
            rules: bonusRows.map(mapBonusPointRuleRecord)
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
    const configuration = await buildConfiguration(roomId);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [roomRows] = await connection.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
        const room = (roomRows as Array<{ session_inactivity_minutes?: number }>)[0];
        if (!room) throw new NotFoundError('Room not found');
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
            await capRoomBonusPointBalances(roomId, configuration.bonusPoints.maxPointsPerUser);
            const id = randomUUID();
            await connection.execute(
                `INSERT INTO room_sessions (id, room_id, started_by, start_reason, started_at, last_activity_at, configuration_json)
                 VALUES (?, ?, ?, 'activity', ?, ?, ?)`,
                [id, roomId, userId, now, now, JSON.stringify(configuration)]
            );
            row = (await activeRow(connection, roomId, true))!;
            const baseSession = mapSessionRow(row, emptyRecap(row.started_at));
            const value = operation ? await operation(connection, baseSession) : undefined;
            const recap = await calculateRecap(connection, row);
            await connection.commit();
            return { session: mapSessionRow(row, recap), started: true, closed, value };
        }
        await connection.execute('UPDATE room_sessions SET last_activity_at = ? WHERE id = ?', [now, row.id]);
        row = { ...row, last_activity_at: now.toISOString() };
        const baseSession = mapSessionRow(row, emptyRecap(row.started_at));
        const value = operation ? await operation(connection, baseSession) : undefined;
        const recap = await calculateRecap(connection, row);
        await connection.commit();
        return { session: mapSessionRow(row, recap), started: false, closed, value };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}

export async function startRoomSession(roomId: string, userId: string): Promise<RoomSession> {
    const room = await getRoomById(roomId);
    if (!room) throw new NotFoundError('Room not found');
    if (room.created_by !== userId) throw new ForbiddenError('Only the room creator can start a session');
    const configuration = await buildConfiguration(roomId);
    await capRoomBonusPointBalances(roomId, configuration.bonusPoints.maxPointsPerUser);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('SELECT id FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
        if (await activeRow(connection, roomId, true)) throw new ConflictError('A session is already active');
        const id = randomUUID();
        const now = new Date();
        await connection.execute(
            `INSERT INTO room_sessions (id, room_id, started_by, start_reason, started_at, last_activity_at, configuration_json)
             VALUES (?, ?, ?, 'manual', ?, ?, ?)`,
            [id, roomId, userId, now, now, JSON.stringify(configuration)]
        );
        const row = (await activeRow(connection, roomId, true))!;
        const recap = await calculateRecap(connection, row);
        await connection.commit();
        return mapSessionRow(row, recap);
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
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
    return mapSessionRow(row, await getLiveRecap(row.id));
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
    return mapSessionRow(rows[0], rows[0].recap_json ? undefined : await getLiveRecap(sessionId));
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
