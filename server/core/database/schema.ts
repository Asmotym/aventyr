import { query } from './client';
import { createLogger } from '../utils/logger';
import { generateArticleUid } from '../utils/id';

const logger = createLogger('DatabaseSchema');

async function columnExists(table: string, column: string): Promise<boolean> {
    const result = await query<{ count: number }[]>(
        `
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        `,
        [table, column]
    );
    const count = Number(result[0]?.count ?? 0);
    return Number.isFinite(count) && count > 0;
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
    const result = await query<{ count: number }[]>(
        `
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        `,
        [table, indexName]
    );
    const count = Number(result[0]?.count ?? 0);
    return Number.isFinite(count) && count > 0;
}

async function populateMissingArticleUids(table: 'articles' | 'article_drafts'): Promise<void> {
    const rows = await query<{ id: string }[]>(`SELECT id FROM ${table} WHERE uid IS NULL OR uid = ''`);
    const used = new Set<string>();
    if (await columnExists('articles', 'uid')) {
        for (const row of await query<{ uid: string }[]>(`SELECT uid FROM articles WHERE uid IS NOT NULL AND uid <> ''`)) {
            used.add(row.uid);
        }
    }
    if (await columnExists('article_drafts', 'uid')) {
        for (const row of await query<{ uid: string }[]>(`SELECT uid FROM article_drafts WHERE uid IS NOT NULL AND uid <> ''`)) {
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

export async function ensureDatabaseSetup(): Promise<void> {
    logger.info('Ensuring database setup...');

    await createTables();
    await ensureAllColumnsCreated();
    await ensureIndexesCreated();
    await ensureContraintsCreated();    

    logger.success('Database schema ready');
}

async function createTables(): Promise<void> {
    logger.info('Creating tables...');

    await query(`
        CREATE TABLE IF NOT EXISTS users (
            discord_user_id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(191) NOT NULL,
            avatar TEXT NOT NULL,
            about_me VARCHAR(500) NOT NULL DEFAULT '',
            theme VARCHAR(16) NOT NULL DEFAULT 'dark',
            theme_style VARCHAR(16) NOT NULL DEFAULT 'aventyr',
            locale VARCHAR(8) NOT NULL DEFAULT 'en',
            role VARCHAR(16) NOT NULL DEFAULT 'user',
            rights_update TINYINT(1) DEFAULT 0,
            rights_testing_ground TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS rooms (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            invite_code VARCHAR(16) NOT NULL UNIQUE,
            password_hash VARCHAR(255),
            password_salt VARCHAR(255),
            created_by VARCHAR(64),
            roll_awards_enabled TINYINT(1) DEFAULT 0,
            roll_awards_window INT NULL,
            room_criticals JSON NULL,
            bonus_points_enabled TINYINT(1) DEFAULT 0,
            bonus_points_max INT DEFAULT 0,
            bonus_points_allow_extreme_spend TINYINT(1) DEFAULT 0,
            session_inactivity_minutes INT NOT NULL DEFAULT 240,
            archived_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_rooms_created_by FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_members (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            nickname VARCHAR(80),
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_room_member (room_id, user_id),
            CONSTRAINT fk_members_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_sessions (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            started_by VARCHAR(64),
            start_reason VARCHAR(16) NOT NULL,
            close_reason VARCHAR(24) NULL,
            started_at DATETIME(3) NOT NULL,
            last_activity_at DATETIME(3) NOT NULL,
            ended_at DATETIME(3) NULL,
            configuration_json JSON NOT NULL,
            recap_json JSON NULL,
            active_marker TINYINT GENERATED ALWAYS AS (IF(ended_at IS NULL, 1, NULL)) STORED,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_room_sessions_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_room_sessions_user FOREIGN KEY (started_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            UNIQUE KEY uniq_active_room_session (room_id, active_marker),
            INDEX idx_room_sessions_history (room_id, started_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_messages (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            user_id VARCHAR(64),
            content TEXT,
            type VARCHAR(16) NOT NULL DEFAULT 'text',
            dice_notation VARCHAR(64),
            dice_total INT,
            dice_rolls JSON,
            point_used TINYINT(1) DEFAULT 0,
            dice_base_total INT NULL,
            bonus_point_adjustment INT NULL,
            bonus_points_used INT DEFAULT 0,
            bonus_point_rule_used JSON NULL,
            bonus_point_rules_skipped TINYINT(1) DEFAULT 0,
            session_id CHAR(36) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            CONSTRAINT fk_messages_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
            INDEX idx_room_messages_session (session_id, type, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_session_awards (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            session_id CHAR(36) NOT NULL,
            source_session_id CHAR(36) NOT NULL,
            award_id CHAR(36) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            award_json JSON NOT NULL,
            used_at DATETIME(3) NULL,
            usage_message_id CHAR(36) NULL,
            UNIQUE KEY uniq_session_award (session_id, award_id),
            CONSTRAINT fk_owned_award_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_owned_award_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS room_session_start_requests (
            room_id CHAR(36) PRIMARY KEY,
            id CHAR(36) NOT NULL,
            previous_session_id CHAR(36) NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            session_id CHAR(36) NULL,
            CONSTRAINT fk_session_request_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    if (!(await columnExists('room_messages', 'roll_award_usage'))) {
        await query('ALTER TABLE room_messages ADD COLUMN roll_award_usage JSON NULL');
    }

    await query(`
        CREATE TABLE IF NOT EXISTS room_session_bonus_events (
            id CHAR(36) PRIMARY KEY,
            session_id CHAR(36) NOT NULL,
            room_id CHAR(36) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            event_type VARCHAR(16) NOT NULL,
            amount INT NOT NULL,
            message_id CHAR(36) NULL,
            created_at DATETIME(3) NOT NULL,
            CONSTRAINT fk_session_bonus_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
            CONSTRAINT fk_session_bonus_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_session_bonus_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE CASCADE,
            CONSTRAINT fk_session_bonus_message FOREIGN KEY (message_id) REFERENCES room_messages(id) ON DELETE SET NULL,
            INDEX idx_session_bonus_events (session_id, user_id, event_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_dice_categories (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            name VARCHAR(80) NOT NULL,
            sort_order INT DEFAULT 0,
            is_default TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_dice_categories_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_dice_categories_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            UNIQUE KEY uniq_dice_category (room_id, created_by, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_dices (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            category_id CHAR(36),
            notation VARCHAR(64) NOT NULL,
            description VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_room_dices_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_room_dices_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            CONSTRAINT fk_room_dices_category FOREIGN KEY (category_id) REFERENCES room_dice_categories(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_roll_awards (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            name VARCHAR(120) NOT NULL,
            description VARCHAR(255),
            dice_notation VARCHAR(64) NULL,
            dice_results JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_roll_awards_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_roll_awards_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            INDEX idx_roll_awards_room (room_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_bonus_point_rules (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            name VARCHAR(120) NOT NULL,
            dice_notation VARCHAR(64) NOT NULL,
            condition_operator VARCHAR(16) NOT NULL,
            threshold INT NOT NULL,
            threshold_max INT NULL,
            adjustment_sign CHAR(1) NOT NULL,
            adjustment_amount INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_bonus_point_rules_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_bonus_point_rules_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            INDEX idx_bonus_point_rules_room (room_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_bonus_point_balances (
            room_id CHAR(36) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            points INT NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (room_id, user_id),
            CONSTRAINT fk_bonus_point_balances_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_bonus_point_balances_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS user_api_keys (
            user_id VARCHAR(64) PRIMARY KEY,
            api_key_hash CHAR(64) NOT NULL,
            api_key_encrypted TEXT NOT NULL,
            last_used_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_user_api_keys_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE CASCADE,
            UNIQUE KEY uniq_api_keys_hash (api_key_hash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS articles (
            id CHAR(36) PRIMARY KEY,
            uid VARCHAR(16) NOT NULL,
            slug VARCHAR(191) NOT NULL UNIQUE,
            title VARCHAR(191) NOT NULL,
            introduction TEXT NOT NULL,
            markdown_source MEDIUMTEXT NOT NULL,
            sanitized_html MEDIUMTEXT NOT NULL,
            excerpt TEXT NOT NULL,
            author_id VARCHAR(64),
            status VARCHAR(24) NOT NULL DEFAULT 'unpublished',
            published_at TIMESTAMP NULL DEFAULT NULL,
            archived_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_articles_author FOREIGN KEY (author_id) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            UNIQUE KEY uniq_articles_uid (uid),
            INDEX idx_articles_status_publication (status, archived_at, published_at),
            INDEX idx_articles_title (title)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS article_tags (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(80) NOT NULL,
            slug VARCHAR(96) NOT NULL UNIQUE,
            created_by VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_article_tags_created_by FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS article_tag_links (
            article_id CHAR(36) NOT NULL,
            tag_id CHAR(36) NOT NULL,
            PRIMARY KEY (article_id, tag_id),
            CONSTRAINT fk_article_tag_links_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
            CONSTRAINT fk_article_tag_links_tag FOREIGN KEY (tag_id) REFERENCES article_tags(id) ON DELETE CASCADE,
            INDEX idx_article_tag_links_tag (tag_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS article_drafts (
            id CHAR(36) PRIMARY KEY,
            uid VARCHAR(16) NOT NULL,
            owner_id VARCHAR(64) NOT NULL,
            title VARCHAR(191),
            introduction TEXT NULL,
            markdown_source MEDIUMTEXT NOT NULL,
            selected_tag_ids JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_article_drafts_owner FOREIGN KEY (owner_id) REFERENCES users(discord_user_id) ON DELETE CASCADE,
            UNIQUE KEY uniq_article_drafts_uid (uid),
            INDEX idx_article_drafts_owner_updated (owner_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

async function ensureContraintsCreated(): Promise<void> {
    logger.info('Ensuring constraints are created...');

    const existingCategoryConstraint = await query<{ constraint_name: string }[]>(
        `
        SELECT CONSTRAINT_NAME AS constraint_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'room_dices'
          AND CONSTRAINT_NAME = 'fk_room_dices_category'
        LIMIT 1
        `
    );

    if (existingCategoryConstraint.length === 0) {
        logger.info('Creating missing "fk_room_dices_category" contraint...');

        await query(`
            ALTER TABLE room_dices
            ADD CONSTRAINT fk_room_dices_category FOREIGN KEY (category_id)
            REFERENCES room_dice_categories(id) ON DELETE SET NULL
        `);
    }

    const messageSessionConstraint = await query<{ constraint_name: string }[]>(`
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

async function ensureIndexesCreated(): Promise<void> {
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
    
async function ensureAllColumnsCreated(): Promise<void> {
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
            ADD COLUMN locale VARCHAR(8) NOT NULL DEFAULT 'en' AFTER theme
        `);
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
        await query(
            `UPDATE users SET role = 'owner', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ?`,
            [ownerDiscordUserId]
        );
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
