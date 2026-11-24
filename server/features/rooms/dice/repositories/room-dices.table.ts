import { randomUUID } from 'crypto';
import { execute, query } from '../../../../infrastructure/database/client';
import type { DatabaseRoomDice, NewRoomDice } from '../../../../infrastructure/database/records';
export async function listRoomDices(roomId: string, createdBy: string): Promise<DatabaseRoomDice[]> {
    return query<DatabaseRoomDice[]>(`SELECT * FROM room_dices WHERE room_id = ? AND created_by = ? ORDER BY created_at ASC`, [roomId, createdBy]);
}
export async function getRoomDice(id: string): Promise<DatabaseRoomDice | undefined> {
    const rows = await query<DatabaseRoomDice[]>(`SELECT * FROM room_dices WHERE id = ? LIMIT 1`, [id]);
    return rows[0];
}
export async function insertRoomDice(payload: NewRoomDice): Promise<DatabaseRoomDice> {
    const id = payload.id ?? randomUUID();
    await execute(`INSERT INTO room_dices (id, room_id, created_by, category_id, notation, description)
         VALUES (?, ?, ?, ?, ?, ?)`, [
        id,
        payload.room_id,
        payload.created_by ?? null,
        payload.category_id ?? null,
        payload.notation,
        payload.description ?? null
    ]);
    const created = await getRoomDice(id);
    if (!created) {
        throw new Error('Failed to create dice');
    }
    return created;
}
export async function updateRoomDice(id: string, payload: {
    notation: string;
    description?: string | null;
    category_id?: string | null;
}): Promise<DatabaseRoomDice | undefined> {
    await execute(`UPDATE room_dices SET notation = ?, description = ?, category_id = ? WHERE id = ? LIMIT 1`, [payload.notation, payload.description ?? null, payload.category_id ?? null, id]);
    return getRoomDice(id);
}
export async function deleteRoomDice(id: string): Promise<void> {
    await execute(`DELETE FROM room_dices WHERE id = ? LIMIT 1`, [id]);
}
