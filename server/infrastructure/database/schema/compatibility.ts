import { generateArticleUid } from '../../ids/id';
import { createLogger } from '../../logging/logger';
import { query } from '../client';
import { columnExists } from './inspection';
const logger = createLogger('DatabaseSchema');
export async function populateMissingArticleUids(table: 'articles' | 'article_drafts'): Promise<void> {
    const rows = await query<{
        id: string;
    }[]>(`SELECT id FROM ${table} WHERE uid IS NULL OR uid = ''`);
    const used = new Set<string>();
    if (await columnExists('articles', 'uid')) {
        for (const row of await query<{
            uid: string;
        }[]>(`SELECT uid FROM articles WHERE uid IS NOT NULL AND uid <> ''`)) {
            used.add(row.uid);
        }
    }
    if (await columnExists('article_drafts', 'uid')) {
        for (const row of await query<{
            uid: string;
        }[]>(`SELECT uid FROM article_drafts WHERE uid IS NOT NULL AND uid <> ''`)) {
            used.add(row.uid);
        }
    }
    for (const row of rows) {
        let uid = generateArticleUid();
        while (used.has(uid)) {
            uid = generateArticleUid();
        }
        used.add(uid);
        await query(`UPDATE ${table} SET uid = ? WHERE id = ?`, [uid, row.id]);
    }
}
export async function ensureAllColumnsCreated(): Promise<void> {
    logger.info('Ensuring all columns are created...');
    // users table
    if (!(await columnExists('users', 'about_me'))) {
        logger.info('Creating missing "about_me" column in "users" table...');
        await query(`
            ALTER TABLE users
            ADD COLUMN about_me VARCHAR(500) NOT NULL DEFAULT '' AFTER avatar
        `);
    }
    if (!(await columnExists('users', 'theme'))) {
        logger.info('Creating missing "theme" column in "users" table...');
        await query(`
            ALTER TABLE users
            ADD COLUMN theme VARCHAR(16) NOT NULL DEFAULT 'dark' AFTER avatar
        `);
    }
    if (!(await columnExists('users', 'locale'))) {
        logger.info('Creating missing "locale" column in "users" table...');
        await query(`
            ALTER TABLE users
            ADD COLUMN locale VARCHAR(8) NULL DEFAULT NULL AFTER theme
        `);
    }
    // Preserve existing selections while allowing new profiles to remain unset.
    const localeColumns = await query<{
        IS_NULLABLE: string;
        COLUMN_DEFAULT: string | null;
    }[]>(`SELECT IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'locale'`);
    if (localeColumns[0]?.IS_NULLABLE !== 'YES' || localeColumns[0]?.COLUMN_DEFAULT != null) {
        await query('ALTER TABLE users MODIFY COLUMN locale VARCHAR(8) NULL DEFAULT NULL');
    }
    if (!(await columnExists('users', 'theme_style'))) {
        logger.info('Creating missing "theme_style" column in "users" table...');
        await query(`
            ALTER TABLE users
            ADD COLUMN theme_style VARCHAR(16) NOT NULL DEFAULT 'aventyr' AFTER theme
        `);
    }
    if (!(await columnExists('users', 'role'))) {
        logger.info('Creating missing "role" column in "users" table...');
        await query(`
            ALTER TABLE users
            ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user' AFTER theme
        `);
    }
    const ownerDiscordUserId = process.env.OWNER_DISCORD_USER_ID?.trim();
    if (ownerDiscordUserId) {
        logger.info('Ensuring configured owner role is applied...');
        await query(`UPDATE users SET role = 'owner', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ?`, [ownerDiscordUserId]);
    }
    // room tables
    if (!(await columnExists('rooms', 'archived_at'))) {
        logger.info('Creating missing "archived_at" column in "rooms" table...');
        await query(`
            ALTER TABLE rooms
            ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL
        `);
    }
    if (!(await columnExists('rooms', 'roll_awards_enabled'))) {
        logger.info('Creating missing "roll_awards_enabled" column in "rooms" table...');
        await query(`
            ALTER TABLE rooms
            ADD COLUMN roll_awards_enabled TINYINT(1) DEFAULT 0
        `);
    }
    if (!(await columnExists('rooms', 'roll_awards_allow_non_leaders'))) {
        await query('ALTER TABLE rooms ADD COLUMN roll_awards_allow_non_leaders TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!(await columnExists('rooms', 'roll_awards_window'))) {
        logger.info('Creating missing "roll_awards_window" column in "rooms" table...');
        await query(`
            ALTER TABLE rooms
            ADD COLUMN roll_awards_window INT NULL
        `);
    }
    if (!(await columnExists('rooms', 'room_criticals'))) {
        logger.info('Creating missing "room_criticals" column in "rooms" table...');
        await query(`
            ALTER TABLE rooms
            ADD COLUMN room_criticals JSON NULL
        `);
    }
    if (!(await columnExists('rooms', 'bonus_points_max'))) {
        logger.info('Creating missing "bonus_points_max" column in "rooms" table...');
        await query(`
            ALTER TABLE rooms
            ADD COLUMN bonus_points_max INT DEFAULT 0
        `);
    }
    if (!(await columnExists('rooms', 'bonus_points_enabled'))) {
        logger.info('Creating missing "bonus_points_enabled" column in "rooms" table...');
        await query(`
            ALTER TABLE rooms
            ADD COLUMN bonus_points_enabled TINYINT(1) DEFAULT 0
        `);
    }
    if (!(await columnExists('rooms', 'bonus_points_allow_extreme_spend'))) {
        logger.info('Creating missing "bonus_points_allow_extreme_spend" column in "rooms" table...');
        await query(`
            ALTER TABLE rooms
            ADD COLUMN bonus_points_allow_extreme_spend TINYINT(1) DEFAULT 0
        `);
    }
    if (!(await columnExists('rooms', 'session_inactivity_minutes'))) {
        logger.info('Creating missing "session_inactivity_minutes" column in "rooms" table...');
        await query(`ALTER TABLE rooms ADD COLUMN session_inactivity_minutes INT NOT NULL DEFAULT 240`);
    }
    // Backfill only when introducing the role column; never reset saved roles.
    if (!(await columnExists('room_members', 'role'))) {
        await query("ALTER TABLE room_members ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'player'");
        await query("UPDATE room_members rm INNER JOIN rooms r ON r.id = rm.room_id SET rm.role = 'creator' WHERE rm.user_id = r.created_by");
    }
    if (!(await columnExists('room_members', 'permission_overrides'))) {
        await query('ALTER TABLE room_members ADD COLUMN permission_overrides JSON NULL');
    }
    if (!(await columnExists('room_members', 'is_favorite'))) {
        await query('ALTER TABLE room_members ADD COLUMN is_favorite TINYINT(1) NOT NULL DEFAULT 0');
    }
    // room members table
    if (!(await columnExists('room_members', 'nickname'))) {
        logger.info('Creating missing "nickname" column in "room_members" table...');
        await query(`
            ALTER TABLE room_members
            ADD COLUMN nickname VARCHAR(80)
        `);
    }
    // room dices table
    if (!(await columnExists('room_dices', 'category_id'))) {
        logger.info('Creating missing "category_id" column in "room_dices" table...');
        await query(`
            ALTER TABLE room_dices
            ADD COLUMN category_id CHAR(36) NULL
        `);
    }
    // room roll awards table
    if (!(await columnExists('room_roll_awards', 'description'))) {
        logger.info('Creating missing "description" column in "room_roll_awards" table...');
        await query(`
            ALTER TABLE room_roll_awards
            ADD COLUMN description VARCHAR(255) NULL AFTER name
        `);
    }
    if (!(await columnExists('room_roll_awards', 'dice_notation'))) {
        logger.info('Creating missing "dice_notation" column in "room_roll_awards" table...');
        await query(`
            ALTER TABLE room_roll_awards
            ADD COLUMN dice_notation VARCHAR(64) NULL AFTER description
        `);
    }
    if (!(await columnExists('room_messages', 'point_used'))) {
        logger.info('Creating missing "point_used" column in "room_messages" table...');
        await query(`ALTER TABLE room_messages ADD COLUMN point_used TINYINT(1) DEFAULT 0`);
    }
    if (!(await columnExists('room_messages', 'session_id'))) {
        logger.info('Creating missing "session_id" column in "room_messages" table...');
        await query(`ALTER TABLE room_messages ADD COLUMN session_id CHAR(36) NULL`);
    }
    if (!(await columnExists('room_messages', 'dice_base_total'))) {
        logger.info('Creating missing "dice_base_total" column in "room_messages" table...');
        await query(`ALTER TABLE room_messages ADD COLUMN dice_base_total INT NULL`);
    }
    if (!(await columnExists('room_messages', 'bonus_point_adjustment'))) {
        logger.info('Creating missing "bonus_point_adjustment" column in "room_messages" table...');
        await query(`ALTER TABLE room_messages ADD COLUMN bonus_point_adjustment INT NULL`);
    }
    if (!(await columnExists('room_messages', 'bonus_points_used'))) {
        logger.info('Creating missing "bonus_points_used" column in "room_messages" table...');
        await query(`ALTER TABLE room_messages ADD COLUMN bonus_points_used INT DEFAULT 0`);
    }
    if (!(await columnExists('room_messages', 'bonus_point_rule_used'))) {
        logger.info('Creating missing "bonus_point_rule_used" column in "room_messages" table...');
        await query(`ALTER TABLE room_messages ADD COLUMN bonus_point_rule_used JSON NULL`);
    }
    if (!(await columnExists('room_messages', 'bonus_point_rules_skipped'))) {
        logger.info('Creating missing "bonus_point_rules_skipped" column in "room_messages" table...');
        await query(`ALTER TABLE room_messages ADD COLUMN bonus_point_rules_skipped TINYINT(1) DEFAULT 0`);
    }
    // article tables
    if (!(await columnExists('articles', 'uid'))) {
        logger.info('Creating missing "uid" column in "articles" table...');
        await query(`ALTER TABLE articles ADD COLUMN uid VARCHAR(16) NULL AFTER id`);
        await populateMissingArticleUids('articles');
        await query(`ALTER TABLE articles MODIFY COLUMN uid VARCHAR(16) NOT NULL`);
    }
    if (!(await columnExists('articles', 'introduction'))) {
        logger.info('Creating missing "introduction" column in "articles" table...');
        await query(`ALTER TABLE articles ADD COLUMN introduction TEXT NULL AFTER title`);
        await query(`UPDATE articles SET introduction = COALESCE(NULLIF(excerpt, ''), title) WHERE introduction IS NULL OR introduction = ''`);
        await query(`ALTER TABLE articles MODIFY COLUMN introduction TEXT NOT NULL`);
    }
    if (!(await columnExists('article_drafts', 'introduction'))) {
        logger.info('Creating missing "introduction" column in "article_drafts" table...');
        await query(`ALTER TABLE article_drafts ADD COLUMN introduction TEXT NULL AFTER title`);
    }
    if (!(await columnExists('article_drafts', 'uid'))) {
        logger.info('Creating missing "uid" column in "article_drafts" table...');
        await query(`ALTER TABLE article_drafts ADD COLUMN uid VARCHAR(16) NULL AFTER id`);
        await populateMissingArticleUids('article_drafts');
        await query(`ALTER TABLE article_drafts MODIFY COLUMN uid VARCHAR(16) NOT NULL`);
    }
}
