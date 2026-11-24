import { createLogger } from '../../logging/logger';
import { query } from '../client';
import { columnExists } from './inspection';
const logger = createLogger('DatabaseSchema');
export async function createTables(): Promise<void> {
    logger.info('Creating tables...');
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            discord_user_id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(191) NOT NULL,
            avatar TEXT NOT NULL,
            about_me VARCHAR(500) NOT NULL DEFAULT '',
            theme VARCHAR(16) NOT NULL DEFAULT 'dark',
            theme_style VARCHAR(16) NOT NULL DEFAULT 'aventyr',
            locale VARCHAR(8) NULL DEFAULT NULL,
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
            roll_awards_allow_non_leaders TINYINT(1) NOT NULL DEFAULT 0,
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
