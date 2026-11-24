import { query } from '../../../infrastructure/database/client';
export async function ensureTalentSchema() {
    await query(`CREATE TABLE IF NOT EXISTS room_talent_settings (room_id VARCHAR(255) PRIMARY KEY, revision INT NOT NULL DEFAULT 0, data JSON NOT NULL)`);
    await query(`CREATE TABLE IF NOT EXISTS room_talent_trees (id VARCHAR(80) NOT NULL, room_id VARCHAR(255) NOT NULL, data JSON NOT NULL, hidden JSON NOT NULL, PRIMARY KEY (room_id, id))`);
    await query(`CREATE TABLE IF NOT EXISTS room_talent_players (room_id VARCHAR(255) NOT NULL, user_id VARCHAR(255) NOT NULL, data JSON NOT NULL, PRIMARY KEY (room_id, user_id))`);
    await query(`CREATE TABLE IF NOT EXISTS room_talent_images (id VARCHAR(80) PRIMARY KEY, room_id VARCHAR(255) NOT NULL, uploader_id VARCHAR(255) NOT NULL, bytes MEDIUMBLOB NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (room_id))`);
}
