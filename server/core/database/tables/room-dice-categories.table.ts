import { randomUUID } from 'crypto';
import { execute, query } from '../client';
import type { DatabaseRoomDiceCategory, NewRoomDiceCategory } from '../../types/database.types';

export async function listRoomDiceCategories(roomId: string, createdBy: string): Promise<DatabaseRoomDiceCategory[]> {
    return query<DatabaseRoomDiceCategory[]>(
        `SELECT * FROM room_dice_categories WHERE room_id = ? AND created_by = ? ORDER BY is_default DESC, sort_order ASC, name ASC`,
        [roomId, createdBy]
    );
}

export async function getRoomDiceCategory(id: string): Promise<DatabaseRoomDiceCategory | undefined> {
    const rows = await query<DatabaseRoomDiceCategory[]>(
        `SELECT * FROM room_dice_categories WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0];
}

export async function findDefaultRoomDiceCategory(roomId: string, createdBy: string): Promise<DatabaseRoomDiceCategory | undefined> {
    const rows = await query<DatabaseRoomDiceCategory[]>(
        `SELECT * FROM room_dice_categories WHERE room_id = ? AND created_by = ? AND is_default = 1 LIMIT 1`,
        [roomId, createdBy]
    );
    return rows[0];
}

export async function insertRoomDiceCategory(payload: NewRoomDiceCategory): Promise<DatabaseRoomDiceCategory> {
    const id = payload.id ?? randomUUID();

    await execute(
        `INSERT INTO room_dice_categories (id, room_id, created_by, name, sort_order, is_default)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id,
            payload.room_id,
            payload.created_by ?? null,
            payload.name,
            payload.sort_order ?? 0,
            payload.is_default ? 1 : 0
        ]
    );

    const created = await getRoomDiceCategory(id);
    if (!created) {
        throw new Error('Failed to create dice category');
    }
    return created;
}

export async function setDefaultRoomDiceCategory(categoryId: string, roomId: string, createdBy: string): Promise<void> {
    await execute(
        `UPDATE room_dice_categories
         SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END
         WHERE room_id = ? AND created_by = ?`,
        [categoryId, roomId, createdBy]
    );
}

export async function getNextDiceCategorySortOrder(roomId: string, createdBy: string): Promise<number> {
    const rows = await query<{ max_sort: number | string | null }[]>(
        `SELECT MAX(sort_order) AS max_sort FROM room_dice_categories WHERE room_id = ? AND created_by = ?`,
        [roomId, createdBy]
    );
    const maxSort = rows[0]?.max_sort;
    if (maxSort === null || maxSort === undefined) {
        return 0;
    }
    const parsed = typeof maxSort === 'string' ? Number(maxSort) : maxSort;
    return Number.isFinite(parsed) ? parsed + 1 : 0;
}

export async function assignCategoryToUncategorizedDice(roomId: string, createdBy: string, categoryId: string): Promise<void> {
    await execute(
        `UPDATE room_dices
         SET category_id = ?
         WHERE room_id = ? AND created_by = ? AND (category_id IS NULL OR category_id = '')`,
        [categoryId, roomId, createdBy]
    );
}

export async function updateRoomDiceCategory(id: string, roomId: string, userId: string, name: string): Promise<DatabaseRoomDiceCategory | undefined> {
    await execute('UPDATE room_dice_categories SET name = ? WHERE id = ? AND room_id = ? AND created_by = ?', [name, id, roomId, userId]);
    return getRoomDiceCategory(id);
}
