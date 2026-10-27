import type { PoolConnection } from 'mysql2/promise';
import { pool, query } from '../../core/database/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/http-errors';
import type { DatabaseRoomMemberWithUser, DatabaseRoom } from '../../core/types/database.types';
import { ROOM_PERMISSIONS, ROOM_ROLES, normalizeRoomOverrides, parseRoomOverrides, resolveRoomRights, type RoomPermission, type RoomRole } from '../../core/utils/room-permissions';
import { mapMemberRecord } from './rooms.mappers';

export async function requireRoomPermission(roomId: string, userId: string, permission: RoomPermission, connection?: PoolConnection): Promise<void> {
    const sql = 'SELECT rm.* FROM room_members rm WHERE rm.room_id = ? AND rm.user_id = ?';
    const rows = connection ? (await connection.query(sql, [roomId, userId]))[0] as DatabaseRoomMemberWithUser[] : await query<DatabaseRoomMemberWithUser[]>(sql, [roomId, userId]);
    const member = rows[0];
    if (!member || !resolveRoomRights(member.role ?? 'player', parseRoomOverrides(member.permission_overrides))[permission]) throw new ForbiddenError('Missing room permission: ' + permission);
}

export async function updateRoomMemberAccess(action: string, payload: { roomId: string; userId: string; targetUserId: string; role?: RoomRole; rights?: unknown }) {
    if (![payload?.roomId, payload?.userId, payload?.targetUserId].every(value => typeof value === 'string' && value.trim())) throw new BadRequestError('Room, actor and target member IDs are required');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rooms] = await connection.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [payload.roomId]);
        const room = (rooms as DatabaseRoom[])[0];
        if (!room) throw new NotFoundError('Room not found');
        const [rows] = await connection.query('SELECT rm.*, u.username, u.avatar FROM room_members rm LEFT JOIN users u ON u.discord_user_id = rm.user_id WHERE rm.room_id = ? FOR UPDATE', [payload.roomId]);
        const members = rows as DatabaseRoomMemberWithUser[];
        const actor = members.find(m => m.user_id === payload.userId);
        const target = members.find(m => m.user_id === payload.targetUserId);
        if (!actor || !['creator', 'admin'].includes(actor.role ?? 'player')) throw new ForbiddenError('Room administration required');
        if (!target) throw new NotFoundError('Room member not found');
        if (action === 'transferRoomOwnership') {
            if (room.created_by !== payload.userId || target.user_id === payload.userId) throw new ForbiddenError('Only the current creator can transfer ownership to another member');
            await connection.execute('UPDATE rooms SET created_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [target.user_id, room.id]);
            await connection.execute("UPDATE room_members SET role = IF(user_id = ?, 'creator', 'admin'), permission_overrides = NULL WHERE room_id = ? AND user_id IN (?, ?)", [target.user_id, room.id, target.user_id, actor.user_id]);
        } else {
            if (target.role === 'creator' || target.user_id === room.created_by) throw new ForbiddenError('The creator cannot be modified');
            if (action === 'updateMemberRole') {
                if (!ROOM_ROLES.includes(payload.role!) || payload.role === 'creator') throw new BadRequestError('Invalid role; transfer ownership separately');
                await connection.execute('UPDATE room_members SET role = ?, permission_overrides = NULL WHERE room_id = ? AND user_id = ?', [payload.role!, room.id, target.user_id]);
            } else {
                const rights = payload.rights;
                if (!rights || typeof rights !== 'object' || Array.isArray(rights) || Object.entries(rights).some(([key, value]) => !ROOM_PERMISSIONS.includes(key as RoomPermission) || typeof value !== 'boolean')) throw new BadRequestError('Invalid room rights');
                const overrides = normalizeRoomOverrides(target.role ?? 'player', rights);
                await connection.execute('UPDATE room_members SET permission_overrides = ? WHERE room_id = ? AND user_id = ?', [Object.keys(overrides).length ? JSON.stringify(overrides) : null, room.id, target.user_id]);
            }
        }
        const [updated] = await connection.query('SELECT rm.*, u.username, u.avatar FROM room_members rm LEFT JOIN users u ON u.discord_user_id = rm.user_id WHERE rm.room_id = ? AND rm.user_id IN (?, ?)', [room.id, target.user_id, actor.user_id]);
        await connection.commit();
        return { roomId: room.id, members: (updated as DatabaseRoomMemberWithUser[]).map(mapMemberRecord) };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}
