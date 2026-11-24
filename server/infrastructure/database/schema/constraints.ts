import { createLogger } from '../../logging/logger';
import { query } from '../client';
import { indexExists } from './inspection';
const logger = createLogger('DatabaseSchema');
export async function ensureContraintsCreated(): Promise<void> {
    logger.info('Ensuring constraints are created...');
    const existingCategoryConstraint = await query<{
        constraint_name: string;
    }[]>(`
        SELECT CONSTRAINT_NAME AS constraint_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'room_dices'
          AND CONSTRAINT_NAME = 'fk_room_dices_category'
        LIMIT 1
        `);
    if (existingCategoryConstraint.length === 0) {
        logger.info('Creating missing "fk_room_dices_category" contraint...');
        await query(`
            ALTER TABLE room_dices
            ADD CONSTRAINT fk_room_dices_category FOREIGN KEY (category_id)
            REFERENCES room_dice_categories(id) ON DELETE SET NULL
        `);
    }
    const messageSessionConstraint = await query<{
        constraint_name: string;
    }[]>(`
        SELECT CONSTRAINT_NAME AS constraint_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'room_messages'
          AND CONSTRAINT_NAME = 'fk_messages_session' LIMIT 1
    `);
    if (messageSessionConstraint.length === 0) {
        logger.info('Creating missing "fk_messages_session" constraint...');
        await query(`ALTER TABLE room_messages ADD CONSTRAINT fk_messages_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE SET NULL`);
    }
}
export async function ensureIndexesCreated(): Promise<void> {
    logger.info('Ensuring indexes are created...');
    if (!(await indexExists('room_dices', 'idx_room_dices_category'))) {
        logger.info('Creating missing "idx_room_dices_category" index...');
        await query(`
            CREATE INDEX idx_room_dices_category ON room_dices (category_id)
        `);
    }
    if (!(await indexExists('articles', 'uniq_articles_uid'))) {
        logger.info('Creating missing "uniq_articles_uid" index...');
        await query(`CREATE UNIQUE INDEX uniq_articles_uid ON articles (uid)`);
    }
    if (!(await indexExists('room_messages', 'idx_room_messages_session'))) {
        logger.info('Creating missing "idx_room_messages_session" index...');
        await query(`CREATE INDEX idx_room_messages_session ON room_messages (session_id, type, created_at)`);
    }
    if (!(await indexExists('article_drafts', 'uniq_article_drafts_uid'))) {
        logger.info('Creating missing "uniq_article_drafts_uid" index...');
        await query(`CREATE UNIQUE INDEX uniq_article_drafts_uid ON article_drafts (uid)`);
    }
}
