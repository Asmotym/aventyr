import { query } from '../../../infrastructure/database/client';
import { columnExists } from '../../../infrastructure/database/schema/inspection';
export async function ensureBonusConfigurationSchema(): Promise<void> {
    if (!await columnExists('rooms', 'bonus_config_version'))
        await query('ALTER TABLE rooms ADD COLUMN bonus_config_version INT NOT NULL DEFAULT 1');
    for (const table of ['room_bonus_triggers', 'room_bonus_conditions', 'room_bonus_effects']) {
        await query(`CREATE TABLE IF NOT EXISTS ${table} (
            id CHAR(36) PRIMARY KEY, room_id CHAR(36) NOT NULL, position INT NOT NULL,
            definition JSON NOT NULL, INDEX (room_id, position),
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!await columnExists('room_messages', 'bonus_effect'))
        await query('ALTER TABLE room_messages ADD COLUMN bonus_effect JSON NULL');
    if (!await columnExists('room_messages', 'bonus_point_effects_used'))
        await query('ALTER TABLE room_messages ADD COLUMN bonus_point_effects_used JSON NULL');
    const { migrateRoomBonusConfiguration } = await import('./repositories/room-bonus-config.table');
    const bonusRooms = await query<Array<{
        id: string;
    }>>('SELECT id FROM rooms WHERE bonus_config_version <> 2');
    for (const room of bonusRooms)
        await migrateRoomBonusConfiguration(room.id);
}
