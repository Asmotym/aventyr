import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { execute, query } from '../client';
import type {
    DatabaseRoomBonusPointBalance,
    DatabaseRoomBonusPointRule,
    NewRoomBonusPointRule
} from '../../types/database.types';

export async function listRoomBonusPointRules(roomId: string): Promise<DatabaseRoomBonusPointRule[]> {
    return query<DatabaseRoomBonusPointRule[]>(
        'SELECT * FROM room_bonus_point_rules WHERE room_id = ? ORDER BY created_at ASC',
        [roomId]
    );
}

export async function getRoomBonusPointRule(id: string): Promise<DatabaseRoomBonusPointRule | undefined> {
    const rows = await query<DatabaseRoomBonusPointRule[]>(
        'SELECT * FROM room_bonus_point_rules WHERE id = ? LIMIT 1',
        [id]
    );
    return rows[0];
}

export async function insertRoomBonusPointRule(rule: NewRoomBonusPointRule): Promise<DatabaseRoomBonusPointRule> {
    const id = rule.id ?? randomUUID();

    await execute(
        `INSERT INTO room_bonus_point_rules (
            id,
            room_id,
            created_by,
            name,
            dice_notation,
            condition_operator,
            threshold,
            threshold_max,
            adjustment_sign,
            adjustment_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            rule.room_id,
            rule.created_by ?? null,
            rule.name,
            rule.dice_notation,
            rule.condition_operator,
            rule.threshold,
            rule.threshold_max ?? null,
            rule.adjustment_sign,
            rule.adjustment_amount
        ]
    );

    const created = await getRoomBonusPointRule(id);
    if (!created) {
        throw new Error('Failed to insert bonus point rule');
    }
    return created;
}

export async function updateRoomBonusPointRule(rule: {
    id: string;
    name: string;
    dice_notation: string;
    condition_operator: NewRoomBonusPointRule['condition_operator'];
    threshold: number;
    threshold_max?: number | null;
    adjustment_sign: NewRoomBonusPointRule['adjustment_sign'];
    adjustment_amount: number;
}): Promise<DatabaseRoomBonusPointRule> {
    await execute(
        `UPDATE room_bonus_point_rules
         SET name = ?,
             dice_notation = ?,
             condition_operator = ?,
             threshold = ?,
             threshold_max = ?,
             adjustment_sign = ?,
             adjustment_amount = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
            rule.name,
            rule.dice_notation,
            rule.condition_operator,
            rule.threshold,
            rule.threshold_max ?? null,
            rule.adjustment_sign,
            rule.adjustment_amount,
            rule.id
        ]
    );

    const updated = await getRoomBonusPointRule(rule.id);
    if (!updated) {
        throw new Error('Failed to update bonus point rule');
    }
    return updated;
}

export async function deleteRoomBonusPointRule(id: string): Promise<void> {
    await execute('DELETE FROM room_bonus_point_rules WHERE id = ?', [id]);
}

export async function listRoomBonusPointBalances(roomId: string): Promise<DatabaseRoomBonusPointBalance[]> {
    return query<DatabaseRoomBonusPointBalance[]>(
        `SELECT
            rm.room_id,
            rm.user_id,
            IFNULL(balance.points, 0) AS points,
            balance.updated_at,
            u.username,
            u.avatar,
            rm.nickname
         FROM room_members rm
         LEFT JOIN room_bonus_point_balances balance
            ON balance.room_id = rm.room_id AND balance.user_id = rm.user_id
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         WHERE rm.room_id = ?
         ORDER BY rm.joined_at ASC`,
        [roomId]
    );
}

export async function getRoomBonusPointBalance(roomId: string, userId: string, connection?: PoolConnection): Promise<number> {
    const statement = 'SELECT points FROM room_bonus_point_balances WHERE room_id = ? AND user_id = ? LIMIT 1';
    const rows = connection
        ? ((await connection.query(statement, [roomId, userId]))[0] as Array<{ points: number | string }>)
        : await query<Array<{ points: number | string }>>(statement, [roomId, userId]);
    return Number(rows[0]?.points ?? 0);
}

export async function setRoomBonusPointBalance(roomId: string, userId: string, points: number, connection?: PoolConnection): Promise<void> {
    const executor = connection?.execute.bind(connection) ?? execute;
    await executor(
        `INSERT INTO room_bonus_point_balances (room_id, user_id, points)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE points = VALUES(points), updated_at = CURRENT_TIMESTAMP`,
        [roomId, userId, points]
    );
}

export async function capRoomBonusPointBalances(roomId: string, maxPoints: number): Promise<void> {
    await execute(
        `UPDATE room_bonus_point_balances
         SET points = LEAST(points, ?), updated_at = CURRENT_TIMESTAMP
         WHERE room_id = ?`,
        [maxPoints, roomId]
    );
}
