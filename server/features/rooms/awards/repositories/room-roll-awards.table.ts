import { randomUUID } from 'crypto';
import { execute, query } from '../../../../infrastructure/database/client';
import type { DatabaseRoomRollAward, NewRoomRollAward } from '../../../../infrastructure/database/records';
export async function listRoomRollAwards(roomId: string): Promise<DatabaseRoomRollAward[]> {
    return query<DatabaseRoomRollAward[]>('SELECT * FROM room_roll_awards WHERE room_id = ? ORDER BY created_at ASC', [roomId]);
}
export async function getRoomRollAward(id: string): Promise<DatabaseRoomRollAward | undefined> {
    const rows = await query<DatabaseRoomRollAward[]>('SELECT * FROM room_roll_awards WHERE id = ? LIMIT 1', [id]);
    return rows[0];
}
export async function insertRoomRollAward(award: NewRoomRollAward): Promise<DatabaseRoomRollAward> {
    const id = award.id ?? randomUUID();
    await execute(`INSERT INTO room_roll_awards (id, room_id, created_by, name, description, dice_notation, dice_results)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        id,
        award.room_id,
        award.created_by ?? null,
        award.name,
        award.description ?? null,
        award.dice_notation ?? null,
        award.dice_results
    ]);
    const created = await getRoomRollAward(id);
    if (!created) {
        throw new Error('Failed to insert roll award');
    }
    return created;
}
export async function updateRoomRollAward(award: {
    id: string;
    name: string;
    description?: string | null;
    dice_notation?: string | null;
    dice_results: string;
}): Promise<DatabaseRoomRollAward> {
    await execute(`UPDATE room_roll_awards
         SET name = ?, description = ?, dice_notation = ?, dice_results = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [award.name, award.description ?? null, award.dice_notation ?? null, award.dice_results, award.id]);
    const updated = await getRoomRollAward(award.id);
    if (!updated) {
        throw new Error('Failed to update roll award');
    }
    return updated;
}
export async function deleteRoomRollAward(id: string): Promise<void> {
    await execute('DELETE FROM room_roll_awards WHERE id = ?', [id]);
}
