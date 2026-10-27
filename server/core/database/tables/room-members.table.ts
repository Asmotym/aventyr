import { randomUUID } from 'crypto';
import { execute, query } from '../client';
import type { DatabaseRoomMemberWithUser } from '../../types/database.types';

export async function upsertMember(roomId: string, userId: string): Promise<void> {
    await execute(
        `INSERT INTO room_members (id, room_id, user_id, role)
         SELECT ?, ?, ?, IF(created_by = ?, 'creator', 'player') FROM rooms WHERE id = ?
         ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP`,
        [randomUUID(), roomId, userId, userId, roomId]
    );
}

export async function countMembers(roomId: string): Promise<number> {
    const rows = await query<Array<{ count: number | string }>>(
        'SELECT COUNT(*) AS count FROM room_members WHERE room_id = ?',
        [roomId]
    );
    return Number(rows[0]?.count ?? 0);
}

export async function listMembers(roomId: string): Promise<DatabaseRoomMemberWithUser[]> {
    return query<DatabaseRoomMemberWithUser[]>(
        `SELECT rm.*, u.username, u.avatar
         FROM room_members rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         WHERE rm.room_id = ?
         ORDER BY rm.joined_at ASC`,
        [roomId]
    );
}

export async function getMember(roomId: string, userId: string): Promise<DatabaseRoomMemberWithUser | undefined> {
    const rows = await query<DatabaseRoomMemberWithUser[]>(
        `SELECT rm.*, u.username, u.avatar
         FROM room_members rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         WHERE rm.room_id = ? AND rm.user_id = ?
         LIMIT 1`,
        [roomId, userId]
    );
    return rows[0];
}

export async function updateMemberNickname(roomId: string, userId: string, nickname: string | null): Promise<void> {
    await execute(
        `UPDATE room_members
         SET nickname = ?
         WHERE room_id = ? AND user_id = ?`,
        [nickname, roomId, userId]
    );
}

export async function touchMember(roomId: string, userId: string): Promise<void> {
    await execute(
        `UPDATE room_members
         SET last_seen = CURRENT_TIMESTAMP
         WHERE room_id = ? AND user_id = ?`,
        [roomId, userId]
    );
}

export async function removeMember(roomId: string, userId: string): Promise<void> {
    await execute(
        `DELETE FROM room_members
         WHERE room_id = ? AND user_id = ?`,
        [roomId, userId]
    );
}

export async function listRoomIdsForMember(userId: string): Promise<string[]> {
    const rows = await query<Array<{ room_id: string }>>(
        'SELECT room_id FROM room_members WHERE user_id = ?',
        [userId]
    );
    return rows.map((row) => row.room_id);
}
