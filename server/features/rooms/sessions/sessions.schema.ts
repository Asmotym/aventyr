import { query } from '../../../infrastructure/database/client';
import { columnExists } from '../../../infrastructure/database/schema/inspection';
export async function ensureSessionBagSchema() {
    await query(`CREATE TABLE IF NOT EXISTS room_session_bag_events (
        id CHAR(36) PRIMARY KEY,
        session_id CHAR(36) NOT NULL,
        room_id CHAR(36) NOT NULL,
        owner_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(16) NOT NULL,
        item_id CHAR(36) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_bag_events (session_id, owner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    if (!(await columnExists('room_session_bag_events', 'item_snapshot'))) {
        await query('ALTER TABLE room_session_bag_events ADD COLUMN item_snapshot JSON NULL');
    }
}
