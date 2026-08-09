import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { execute, query } from '../client';
import type { DatabaseRoomMessage, NewRoomMessage } from '../../types/database.types';

export async function insertMessage(message: NewRoomMessage, connection?: PoolConnection): Promise<DatabaseRoomMessage> {
    const id = message.id ?? randomUUID();
    const executor = connection ?? { execute, query };

    await executor.execute(
        `INSERT INTO room_messages (
            id,
            room_id,
            user_id,
            content,
            type,
            dice_notation,
            dice_total,
            dice_rolls,
            point_used,
            dice_base_total,
            bonus_point_adjustment,
            bonus_points_used,
            bonus_point_rule_used,
            bonus_point_rules_skipped,
            session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            message.room_id,
            message.user_id,
            message.content ?? null,
            message.type,
            message.dice_notation ?? null,
            message.dice_total ?? null,
            message.dice_rolls ? JSON.stringify(message.dice_rolls) : null,
            message.point_used ? 1 : 0,
            message.dice_base_total ?? null,
            message.bonus_point_adjustment ?? null,
            message.bonus_points_used ?? 0,
            message.bonus_point_rule_used ?? null,
            message.bonus_point_rules_skipped ? 1 : 0,
            message.session_id ?? null
        ]
    );

    const selectStatement = `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.id = ?
         LIMIT 1`;
    const rows = connection
        ? ((await connection.query(selectStatement, [id]))[0] as DatabaseRoomMessage[])
        : await query<DatabaseRoomMessage[]>(selectStatement, [id]);
    if (!rows[0]) {
        throw new Error('Failed to insert message');
    }

    return rows[0];
}

export async function getMessageById(messageId: string): Promise<DatabaseRoomMessage | undefined> {
    const rows = await query<DatabaseRoomMessage[]>(
        `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.id = ?
         LIMIT 1`,
        [messageId]
    );
    return rows[0];
}

export async function updateMessageBonusPointUsage(payload: {
    messageId: string;
    diceTotal: number;
    diceBaseTotal: number;
    bonusPointAdjustment: number;
    bonusPointsUsed: number;
    bonusPointRuleUsed: string;
}): Promise<DatabaseRoomMessage> {
    await execute(
        `UPDATE room_messages
         SET dice_total = ?,
             point_used = 1,
             dice_base_total = ?,
             bonus_point_adjustment = ?,
             bonus_points_used = ?,
             bonus_point_rule_used = ?
         WHERE id = ?`,
        [
            payload.diceTotal,
            payload.diceBaseTotal,
            payload.bonusPointAdjustment,
            payload.bonusPointsUsed,
            payload.bonusPointRuleUsed,
            payload.messageId
        ]
    );

    const updated = await getMessageById(payload.messageId);
    if (!updated) {
        throw new Error('Failed to update dice message');
    }
    return updated;
}

export async function listMessages(
    roomId: string,
    options?: { limit?: number; since?: string; before?: string }
): Promise<DatabaseRoomMessage[]> {
    const limit = options?.limit ?? 50;
    if (options?.since) {
        return query<DatabaseRoomMessage[]>(
            `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
             FROM room_messages rm
             LEFT JOIN users u ON u.discord_user_id = rm.user_id
             LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
             WHERE rm.room_id = ? AND rm.created_at > ?
             ORDER BY rm.created_at ASC
             LIMIT ?`,
            [roomId, options.since, limit]
        );
    }

    if (options?.before) {
        return query<DatabaseRoomMessage[]>(
            `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
             FROM room_messages rm
             LEFT JOIN users u ON u.discord_user_id = rm.user_id
             LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
             WHERE rm.room_id = ? AND rm.created_at < ?
             ORDER BY rm.created_at DESC
             LIMIT ?`,
            [roomId, options.before, limit]
        );
    }

    return query<DatabaseRoomMessage[]>(
        `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.room_id = ?
         ORDER BY rm.created_at DESC
         LIMIT ?`,
        [roomId, limit]
    );
}

export async function listDiceMessages(roomId: string, options?: { limit?: number; since?: string }): Promise<DatabaseRoomMessage[]> {
    const limit = options?.limit ?? 50;

    if (options?.since) {
        return query<DatabaseRoomMessage[]>(
            `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
             FROM room_messages rm
             LEFT JOIN users u ON u.discord_user_id = rm.user_id
             LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
             WHERE rm.room_id = ? AND rm.type = 'dice' AND rm.created_at > ?
             ORDER BY rm.created_at ASC
             LIMIT ?`,
            [roomId, options.since, limit]
        );
    }

    return query<DatabaseRoomMessage[]>(
        `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.room_id = ? AND rm.type = 'dice'
         ORDER BY rm.created_at DESC
         LIMIT ?`,
        [roomId, limit]
    );
}
