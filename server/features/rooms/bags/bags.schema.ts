import { query } from '../../../infrastructure/database/client';
import { columnExists } from '../../../infrastructure/database/schema/inspection';
export async function ensureBagSchema(): Promise<void> {
    if (!await columnExists('rooms', 'bag_enabled'))
        await query('ALTER TABLE rooms ADD COLUMN bag_enabled TINYINT(1) NOT NULL DEFAULT 0');
    if (!await columnExists('room_messages', 'item_snapshot'))
        await query('ALTER TABLE room_messages ADD COLUMN item_snapshot JSON NULL');
    await query(`CREATE TABLE IF NOT EXISTS room_bags (
        id CHAR(36) PRIMARY KEY, room_id CHAR(36) NOT NULL, owner_id VARCHAR(64) NOT NULL DEFAULT '',
        revision INT NOT NULL DEFAULT 1, UNIQUE KEY bag_owner (room_id, owner_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    if (!await columnExists('room_bags', 'tab_order'))
        await query('ALTER TABLE room_bags ADD COLUMN tab_order JSON NULL');
    if (!await columnExists('room_bags', 'uncategorized'))
        await query('ALTER TABLE room_bags ADD COLUMN uncategorized JSON NULL');
    for (const table of ['room_bag_sections', 'room_bag_templates'])
        await query(`CREATE TABLE IF NOT EXISTS ${table} (
        id CHAR(36) PRIMARY KEY, bag_id CHAR(36) NOT NULL, revision INT NOT NULL DEFAULT 1, data JSON NOT NULL,
        FOREIGN KEY (bag_id) REFERENCES room_bags(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`CREATE TABLE IF NOT EXISTS room_bag_images (
        id CHAR(36) PRIMARY KEY, room_id CHAR(36) NOT NULL, owner_id VARCHAR(64) NOT NULL, uploader_id VARCHAR(64) NOT NULL,
        bytes MEDIUMBLOB NOT NULL, width INT NOT NULL, height INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`CREATE TABLE IF NOT EXISTS room_bag_items (
        id CHAR(36) PRIMARY KEY, bag_id CHAR(36) NOT NULL, section_id CHAR(36) NULL, creator_id VARCHAR(64) NOT NULL,
        revision INT NOT NULL DEFAULT 1, image_id CHAR(36) NULL, data JSON NOT NULL,
        FOREIGN KEY (bag_id) REFERENCES room_bags(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES room_bag_sections(id) ON DELETE SET NULL,
        FOREIGN KEY (image_id) REFERENCES room_bag_images(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`CREATE TABLE IF NOT EXISTS room_user_bag_templates (
        id CHAR(36) PRIMARY KEY, room_id CHAR(36) NOT NULL, owner_id VARCHAR(64) NOT NULL,
        source_id CHAR(36) NULL, is_public TINYINT(1) NOT NULL DEFAULT 0, revision INT NOT NULL DEFAULT 1, data JSON NOT NULL,
        UNIQUE KEY template_source_owner (room_id, owner_id, source_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`CREATE TABLE IF NOT EXISTS room_bag_item_templates (
        id CHAR(36) PRIMARY KEY, room_id CHAR(36) NOT NULL, owner_id VARCHAR(64) NOT NULL,
        is_public TINYINT(1) NOT NULL DEFAULT 0, revision INT NOT NULL DEFAULT 1, image_id CHAR(36) NULL, data JSON NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES room_bag_images(id) ON DELETE RESTRICT,
        INDEX item_template_library (room_id, owner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`CREATE TABLE IF NOT EXISTS room_bag_template_uses (
        template_id CHAR(36) NOT NULL, user_id VARCHAR(64) NOT NULL, data JSON NOT NULL,
        PRIMARY KEY (template_id, user_id),
        FOREIGN KEY (template_id) REFERENCES room_user_bag_templates(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Preserve legacy IDs and copied item definitions. Legacy Team templates become private to the room creator.
    await query(`INSERT IGNORE INTO room_user_bag_templates (id, room_id, owner_id, revision, data)
        SELECT t.id, b.room_id, IF(b.owner_id = '', r.created_by, b.owner_id), t.revision, t.data
        FROM room_bag_templates t JOIN room_bags b ON b.id = t.bag_id JOIN rooms r ON r.id = b.room_id`);
    await query('DELETE legacy FROM room_bag_templates legacy JOIN room_user_bag_templates migrated ON migrated.id = legacy.id');
    for (const column of ['created_at', 'updated_at'])
        if (!await columnExists('room_bag_items', column))
            await query(`ALTER TABLE room_bag_items ADD COLUMN ${column} DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`);
}
