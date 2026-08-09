import { execute, query } from '../client';
import type { DatabaseRoom, NewRoom } from '../../types/database.types';

export async function insertRoom(room: NewRoom): Promise<DatabaseRoom> {
    await execute(
        `INSERT INTO rooms (id, name, invite_code, password_hash, password_salt, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [room.id, room.name, room.invite_code, room.password_hash ?? null, room.password_salt ?? null, room.created_by ?? null]
    );

    const createdRoom = await getRoomById(room.id);
    if (!createdRoom) {
        throw new Error('Failed to insert room');
    }
    return createdRoom;
}

export async function getRoomByInviteCode(inviteCode: string): Promise<DatabaseRoom | undefined> {
    const rows = await query<DatabaseRoom[]>(
        'SELECT * FROM rooms WHERE invite_code = ? LIMIT 1',
        [inviteCode]
    );
    return rows[0];
}

export async function getRoomById(roomId: string): Promise<DatabaseRoom | undefined> {
    const rows = await query<DatabaseRoom[]>(
        'SELECT * FROM rooms WHERE id = ? LIMIT 1',
        [roomId]
    );
    return rows[0];
}

export async function listRooms(): Promise<DatabaseRoom[]> {
    const rows = await query<DatabaseRoom[]>(
        `SELECT
            r.*,
            IFNULL(members.member_count, 0) AS member_count,
            IFNULL(messages.last_activity, r.updated_at) AS last_activity
        FROM rooms r
        LEFT JOIN (
            SELECT room_id, COUNT(*) AS member_count
            FROM room_members
            GROUP BY room_id
        ) members ON members.room_id = r.id
        LEFT JOIN (
            SELECT room_id, MAX(created_at) AS last_activity
            FROM room_messages
            GROUP BY room_id
        ) messages ON messages.room_id = r.id
        WHERE r.archived_at IS NULL
        ORDER BY last_activity IS NULL, last_activity DESC`
    );

    return rows.map((row) => ({
        ...row,
        member_count: typeof row.member_count === 'string' ? Number(row.member_count) : row.member_count
    }));
}

export async function listUserRooms(userId: string): Promise<DatabaseRoom[]> {
    const rows = await query<DatabaseRoom[]>(
        `SELECT
            r.*,
            IFNULL(members.member_count, 0) AS member_count,
            IFNULL(messages.last_activity, r.updated_at) AS last_activity
        FROM rooms r
        INNER JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
        LEFT JOIN (
            SELECT room_id, COUNT(*) AS member_count
            FROM room_members
            GROUP BY room_id
        ) members ON members.room_id = r.id
        LEFT JOIN (
            SELECT room_id, MAX(created_at) AS last_activity
            FROM room_messages
            GROUP BY room_id
        ) messages ON messages.room_id = r.id
        WHERE r.archived_at IS NULL OR r.created_by = ?
        ORDER BY r.archived_at IS NULL DESC, last_activity IS NULL, last_activity DESC`,
        [userId, userId]
    );

    return rows.map((row) => ({
        ...row,
        member_count: typeof row.member_count === 'string' ? Number(row.member_count) : row.member_count
    }));
}

export async function touchRoom(roomId: string): Promise<void> {
    await execute('UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [roomId]);
}

export async function updateRoomName(roomId: string, name: string): Promise<DatabaseRoom | undefined> {
    await execute(
        'UPDATE rooms SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, roomId]
    );
    return getRoomById(roomId);
}

export async function updateRoomGeneralSettings(roomId: string, settings: { name: string; sessionInactivityMinutes: number }): Promise<DatabaseRoom | undefined> {
    await execute(
        'UPDATE rooms SET name = ?, session_inactivity_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [settings.name, settings.sessionInactivityMinutes, roomId]
    );
    return getRoomById(roomId);
}

export async function setRoomArchived(roomId: string, archived: boolean): Promise<DatabaseRoom | undefined> {
    await execute(
        'UPDATE rooms SET archived_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [archived ? new Date() : null, roomId]
    );
    return getRoomById(roomId);
}

export async function setRollAwardsEnabled(roomId: string, enabled: boolean): Promise<DatabaseRoom | undefined> {
    return updateRollAwardsSettings(roomId, { enabled });
}

export async function updateRollAwardsSettings(
    roomId: string,
    settings: { enabled?: boolean }
): Promise<DatabaseRoom | undefined> {
    await ensureRollAwardsColumns();
    const updates: string[] = [];
    const params: (number | null)[] = [];

    if (typeof settings.enabled !== 'undefined') {
        updates.push('roll_awards_enabled = ?');
        params.push(settings.enabled ? 1 : 0);
    }

    if (!updates.length) {
        return getRoomById(roomId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    await execute(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, [...params, roomId]);
    return getRoomById(roomId);
}

export async function updateRoomCriticals(roomId: string, criticals: string | null): Promise<DatabaseRoom | undefined> {
    await ensureRoomCriticalsColumn();
    await execute(
        'UPDATE rooms SET room_criticals = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [criticals, roomId]
    );
    return getRoomById(roomId);
}

export async function updateBonusPointsSettings(
    roomId: string,
    settings: { enabled?: boolean; maxPointsPerUser?: number; allowExtremeSpend?: boolean }
): Promise<DatabaseRoom | undefined> {
    await ensureBonusPointsColumns();
    const updates: string[] = [];
    const params: number[] = [];

    if (typeof settings.enabled !== 'undefined') {
        updates.push('bonus_points_enabled = ?');
        params.push(settings.enabled ? 1 : 0);
    }

    if (typeof settings.maxPointsPerUser !== 'undefined') {
        updates.push('bonus_points_max = ?');
        params.push(settings.maxPointsPerUser);
    }

    if (typeof settings.allowExtremeSpend !== 'undefined') {
        updates.push('bonus_points_allow_extreme_spend = ?');
        params.push(settings.allowExtremeSpend ? 1 : 0);
    }

    if (!updates.length) {
        return getRoomById(roomId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    await execute(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, [...params, roomId]);
    return getRoomById(roomId);
}

let rollAwardsColumnsChecked = false;
async function ensureRollAwardsColumns() {
    if (rollAwardsColumnsChecked) return;
    const hasEnabled = await columnExists('rooms', 'roll_awards_enabled');
    if (!hasEnabled) {
        await execute('ALTER TABLE rooms ADD COLUMN roll_awards_enabled TINYINT(1) DEFAULT 0');
    }
    const hasWindow = await columnExists('rooms', 'roll_awards_window');
    if (!hasWindow) {
        await execute('ALTER TABLE rooms ADD COLUMN roll_awards_window INT NULL');
    }
    rollAwardsColumnsChecked = true;
}

let roomCriticalsColumnChecked = false;
async function ensureRoomCriticalsColumn() {
    if (roomCriticalsColumnChecked) return;
    const hasCriticals = await columnExists('rooms', 'room_criticals');
    if (!hasCriticals) {
        await execute('ALTER TABLE rooms ADD COLUMN room_criticals JSON NULL');
    }
    roomCriticalsColumnChecked = true;
}

let bonusPointsColumnsChecked = false;
async function ensureBonusPointsColumns() {
    if (bonusPointsColumnsChecked) return;
    const hasMaxColumn = await columnExists('rooms', 'bonus_points_max');
    if (!hasMaxColumn) {
        await execute('ALTER TABLE rooms ADD COLUMN bonus_points_max INT DEFAULT 0');
    }
    const hasEnabledColumn = await columnExists('rooms', 'bonus_points_enabled');
    if (!hasEnabledColumn) {
        await execute('ALTER TABLE rooms ADD COLUMN bonus_points_enabled TINYINT(1) DEFAULT 0');
    }
    const hasAllowExtremeSpendColumn = await columnExists('rooms', 'bonus_points_allow_extreme_spend');
    if (!hasAllowExtremeSpendColumn) {
        await execute('ALTER TABLE rooms ADD COLUMN bonus_points_allow_extreme_spend TINYINT(1) DEFAULT 0');
    }
    bonusPointsColumnsChecked = true;
}

async function columnExists(table: string, column: string): Promise<boolean> {
    const rows = await query<{ count: number }[]>(
        `SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    const count = rows[0]?.count ?? 0;
    return Number(count) > 0;
}
