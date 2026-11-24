import { query } from '../../infrastructure/database/client';
import { columnExists } from '../../infrastructure/database/schema/inspection';
export async function ensureArticleSchema(): Promise<void> {
    if (!await columnExists('users', 'article_sort'))
        await query("ALTER TABLE users ADD COLUMN article_sort VARCHAR(16) NOT NULL DEFAULT 'newest'");
    await query(`CREATE TABLE IF NOT EXISTS article_category_lock (id INT PRIMARY KEY) ENGINE=InnoDB`);
    await query('INSERT IGNORE INTO article_category_lock (id) VALUES (1)');
    await query(`CREATE TABLE IF NOT EXISTS article_categories (
        id CHAR(36) PRIMARY KEY, name VARCHAR(80) NOT NULL, description TEXT NULL,
        parent_id CHAR(36) NULL, position INT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        FOREIGN KEY (parent_id) REFERENCES article_categories(id), INDEX (parent_id, position)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`CREATE TABLE IF NOT EXISTS article_category_translations (
        category_id CHAR(36) NOT NULL, locale VARCHAR(8) NOT NULL,
        name VARCHAR(80) NOT NULL, description TEXT NULL,
        PRIMARY KEY (category_id, locale),
        FOREIGN KEY (category_id) REFERENCES article_categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`INSERT IGNORE INTO article_category_translations (category_id, locale, name, description)
        SELECT id, 'en', name, description FROM article_categories`);
    for (const [table, parent] of [['article_category_links', 'articles'], ['article_draft_category_links', 'article_drafts']]) {
        await query(`CREATE TABLE IF NOT EXISTS ${table} (
            parent_id CHAR(36) NOT NULL, category_id CHAR(36) NOT NULL,
            PRIMARY KEY (parent_id, category_id), INDEX (category_id),
            FOREIGN KEY (parent_id) REFERENCES ${parent}(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES article_categories(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    await query(`CREATE TABLE IF NOT EXISTS article_editor_preferences (
        user_id VARCHAR(64) PRIMARY KEY, colors JSON NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    for (const [table, parent] of [['article_translations', 'articles'], ['article_draft_translations', 'article_drafts']]) {
        await query(`CREATE TABLE IF NOT EXISTS ${table} (
            parent_id CHAR(36) NOT NULL, locale VARCHAR(8) NOT NULL,
            title VARCHAR(191) NOT NULL, introduction TEXT NOT NULL, document JSON NOT NULL,
            sanitized_html MEDIUMTEXT NOT NULL, excerpt TEXT NOT NULL,
            PRIMARY KEY (parent_id, locale), FOREIGN KEY (parent_id) REFERENCES ${parent}(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    await query(`CREATE TABLE IF NOT EXISTS article_images (
        id CHAR(36) PRIMARY KEY, uploader_id VARCHAR(64) NOT NULL,
        article_id CHAR(36) NULL, draft_id CHAR(36) NULL, bytes MEDIUMBLOB NOT NULL,
        width INT NOT NULL, height INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL,
        FOREIGN KEY (draft_id) REFERENCES article_drafts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    if (!await columnExists('article_images', 'is_library')) {
        await query('ALTER TABLE article_images ADD COLUMN is_library BOOLEAN NOT NULL DEFAULT 1');
    }
    await query(`CREATE TABLE IF NOT EXISTS article_image_references (
        image_id CHAR(36) NOT NULL, parent_id CHAR(36) NOT NULL, is_draft BOOLEAN NOT NULL,
        PRIMARY KEY (image_id, parent_id, is_draft),
        FOREIGN KEY (image_id) REFERENCES article_images(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
