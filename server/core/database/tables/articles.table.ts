import { execute, query } from '../client';
import type { DatabaseArticle, DatabaseArticleDraft, DatabaseArticleTag } from '../../types/database.types';
import type { ArticleStatus, ArticleSort } from '../../types/data.types';

export interface ArticleListFilters {
    locale?: string;
    search?: string;
    tags?: string[];
    statuses?: ArticleStatus[];
    archived?: boolean | null;
    publicOnly?: boolean;
    limit?: number;
    offset?: number;
    newsOnly?: boolean;
    categoryIds?: string[];
    sort?: ArticleSort;
}

export async function insertArticle(article: DatabaseArticle): Promise<DatabaseArticle> {
    await execute(
        `INSERT INTO articles
         (id, uid, slug, title, introduction, markdown_source, sanitized_html, excerpt, author_id, status, published_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            article.id,
            article.uid,
            article.slug,
            article.title,
            article.introduction,
            article.markdown_source,
            article.sanitized_html,
            article.excerpt,
            article.author_id ?? null,
            article.status,
            article.published_at ?? null,
            article.archived_at ?? null
        ]
    );

    const created = await getArticleById(article.id);
    if (!created) throw new Error('Failed to create article');
    return created;
}

export async function updateArticleRecord(articleId: string, data: Partial<DatabaseArticle>): Promise<DatabaseArticle | null> {
    await execute(
        `UPDATE articles
         SET title = COALESCE(?, title),
             slug = COALESCE(?, slug),
             introduction = COALESCE(?, introduction),
             markdown_source = COALESCE(?, markdown_source),
             sanitized_html = COALESCE(?, sanitized_html),
             excerpt = COALESCE(?, excerpt),
             status = COALESCE(?, status),
             published_at = IF(? = 0, published_at, ?),
             archived_at = COALESCE(?, archived_at),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
            data.title ?? null,
            data.slug ?? null,
            data.introduction ?? null,
            data.markdown_source ?? null,
            data.sanitized_html ?? null,
            data.excerpt ?? null,
            data.status ?? null,
            typeof data.published_at === 'undefined' ? 0 : 1,
            data.published_at ?? null,
            data.archived_at ?? null,
            articleId
        ]
    );

    return getArticleById(articleId);
}

export async function setArticleArchived(articleId: string): Promise<DatabaseArticle | null> {
    await execute(
        `UPDATE articles SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [articleId]
    );
    return getArticleById(articleId);
}

export async function getArticleById(articleId: string): Promise<DatabaseArticle | null> {
    const rows = await query<DatabaseArticle[]>(
        `SELECT a.*, u.username AS author_name
         FROM articles a
         LEFT JOIN users u ON u.discord_user_id = a.author_id
         WHERE a.id = ?
         LIMIT 1`,
        [articleId]
    );
    return rows[0] ?? null;
}

export async function getArticleBySlug(slug: string, publicOnly = false): Promise<DatabaseArticle | null> {
    const publicClause = publicOnly
        ? `AND a.status = 'published' AND a.archived_at IS NULL AND (a.published_at IS NULL OR a.published_at <= CURRENT_TIMESTAMP)`
        : '';
    const rows = await query<DatabaseArticle[]>(
        `SELECT a.*, u.username AS author_name
         FROM articles a
         LEFT JOIN users u ON u.discord_user_id = a.author_id
         WHERE a.slug = ? ${publicClause}
         LIMIT 1`,
        [slug]
    );
    return rows[0] ?? null;
}

export async function articleSlugExists(slug: string, exceptArticleId?: string): Promise<boolean> {
    const rows = await query<{ count: number }[]>(
        `SELECT COUNT(*) AS count FROM articles WHERE slug = ? AND (? IS NULL OR id <> ?)`,
        [slug, exceptArticleId ?? null, exceptArticleId ?? null]
    );
    return Number(rows[0]?.count ?? 0) > 0;
}

export async function articleUidExists(uid: string, exceptArticleId?: string): Promise<boolean> {
    const rows = await query<{ count: number }[]>(
        `SELECT COUNT(*) AS count FROM articles WHERE uid = ? AND (? IS NULL OR id <> ?)`,
        [uid, exceptArticleId ?? null, exceptArticleId ?? null]
    );
    return Number(rows[0]?.count ?? 0) > 0;
}

export async function articleDraftUidExists(uid: string, exceptDraftId?: string): Promise<boolean> {
    const rows = await query<{ count: number }[]>(
        `SELECT COUNT(*) AS count FROM article_drafts WHERE uid = ? AND (? IS NULL OR id <> ?)`,
        [uid, exceptDraftId ?? null, exceptDraftId ?? null]
    );
    return Number(rows[0]?.count ?? 0) > 0;
}

export async function listArticles(filters: ArticleListFilters = {}): Promise<DatabaseArticle[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.publicOnly) {
        where.push(`a.status = 'published'`);
        where.push(`a.archived_at IS NULL`);
        where.push(`(a.published_at IS NULL OR a.published_at <= CURRENT_TIMESTAMP)`);
    }

    if (filters.search?.trim()) {
        where.push(`COALESCE((SELECT t.title FROM article_translations t WHERE t.parent_id = a.id AND t.locale = ?), (SELECT t.title FROM article_translations t WHERE t.parent_id = a.id AND t.locale = 'en'), a.title) LIKE ?`);
        params.push(filters.locale ?? 'en', `%${filters.search.trim()}%`);
    }

    if (filters.statuses?.length) {
        where.push(`a.status IN (?)`);
        params.push(filters.statuses);
    }

    if (typeof filters.archived === 'boolean') {
        where.push(filters.archived ? `a.archived_at IS NOT NULL` : `a.archived_at IS NULL`);
    }

    const tags = filters.newsOnly ? [...(filters.tags ?? []), 'news'] : filters.tags ?? [];
    if (tags.length > 0) {
        where.push(`
            a.id IN (
                SELECT atl.article_id
                FROM article_tag_links atl
                INNER JOIN article_tags at ON at.id = atl.tag_id
                WHERE at.slug IN (?)
                GROUP BY atl.article_id
                HAVING COUNT(DISTINCT at.slug) = ?
            )
        `);
        params.push(tags, tags.length);
    }

    if (filters.categoryIds) {
        where.push('EXISTS (SELECT 1 FROM article_category_links acl WHERE acl.parent_id = a.id AND acl.category_id IN (?))');
        params.push(filters.categoryIds);
    }
    let order = `COALESCE(a.published_at, a.created_at) ${filters.sort === 'oldest' ? 'ASC' : 'DESC'}, a.created_at ${filters.sort === 'oldest' ? 'ASC' : 'DESC'}, a.id ASC`;
    if (filters.sort === 'title-asc' || filters.sort === 'title-desc') {
        order = `COALESCE((SELECT t.title FROM article_translations t WHERE t.parent_id = a.id AND t.locale = ?), (SELECT t.title FROM article_translations t WHERE t.parent_id = a.id AND t.locale = 'en'), a.title) ${filters.sort === 'title-asc' ? 'ASC' : 'DESC'}, a.id ASC`;
        params.push(filters.locale ?? 'en');
    }
    const limit = Math.min(Math.max(filters.limit ?? 5, 1), 50);
    const offset = Math.max(filters.offset ?? 0, 0);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    return query<DatabaseArticle[]>(
        `SELECT a.*, u.username AS author_name
         FROM articles a
         LEFT JOIN users u ON u.discord_user_id = a.author_id
         ${clause}
         ORDER BY ${order}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
}

export async function listTagsForArticles(articleIds: string[]): Promise<Array<DatabaseArticleTag & { article_id: string }>> {
    if (articleIds.length === 0) return [];
    return query<Array<DatabaseArticleTag & { article_id: string }>>(
        `SELECT atl.article_id, at.*
         FROM article_tag_links atl
         INNER JOIN article_tags at ON at.id = atl.tag_id
         WHERE atl.article_id IN (?)`,
        [articleIds]
    );
}

export async function replaceArticleTags(articleId: string, tagIds: string[]): Promise<void> {
    await execute(`DELETE FROM article_tag_links WHERE article_id = ?`, [articleId]);
    for (const tagId of [...new Set(tagIds)]) {
        await execute(
            `INSERT IGNORE INTO article_tag_links (article_id, tag_id) VALUES (?, ?)`,
            [articleId, tagId]
        );
    }
}

export async function listArticleTags(): Promise<DatabaseArticleTag[]> {
    return query<DatabaseArticleTag[]>(
        `SELECT * FROM article_tags ORDER BY name ASC`
    );
}

export async function getArticleTagBySlug(slug: string): Promise<DatabaseArticleTag | null> {
    const rows = await query<DatabaseArticleTag[]>(
        `SELECT * FROM article_tags WHERE slug = ? LIMIT 1`,
        [slug]
    );
    return rows[0] ?? null;
}

export async function insertArticleTag(tag: DatabaseArticleTag): Promise<DatabaseArticleTag> {
    await execute(
        `INSERT INTO article_tags (id, name, slug, created_by) VALUES (?, ?, ?, ?)`,
        [tag.id, tag.name, tag.slug, tag.created_by ?? null]
    );
    const created = await getArticleTagBySlug(tag.slug);
    if (!created) throw new Error('Failed to create tag');
    return created;
}

export async function updateArticleTag(tagId: string, name: string, slug: string): Promise<DatabaseArticleTag | null> {
    await execute(
        `UPDATE article_tags SET name = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, slug, tagId]
    );
    const rows = await query<DatabaseArticleTag[]>(`SELECT * FROM article_tags WHERE id = ? LIMIT 1`, [tagId]);
    return rows[0] ?? null;
}

export async function deleteArticleTag(tagId: string): Promise<void> {
    await execute(`DELETE FROM article_tags WHERE id = ?`, [tagId]);
}

export async function listDrafts(ownerId: string): Promise<DatabaseArticleDraft[]> {
    return query<DatabaseArticleDraft[]>(
        `SELECT * FROM article_drafts WHERE owner_id = ? ORDER BY updated_at DESC`,
        [ownerId]
    );
}

export async function upsertDraft(draft: DatabaseArticleDraft): Promise<DatabaseArticleDraft> {
    await execute(
        `INSERT INTO article_drafts (id, uid, owner_id, title, introduction, markdown_source, selected_tag_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             title = VALUES(title),
             introduction = VALUES(introduction),
             markdown_source = VALUES(markdown_source),
             selected_tag_ids = VALUES(selected_tag_ids),
             updated_at = CURRENT_TIMESTAMP`,
        [
            draft.id,
            draft.uid,
            draft.owner_id,
            draft.title ?? null,
            draft.introduction ?? null,
            draft.markdown_source,
            typeof draft.selected_tag_ids === 'string' ? draft.selected_tag_ids : JSON.stringify(draft.selected_tag_ids ?? [])
        ]
    );

    const rows = await query<DatabaseArticleDraft[]>(
        `SELECT * FROM article_drafts WHERE id = ? AND owner_id = ? LIMIT 1`,
        [draft.id, draft.owner_id]
    );
    if (!rows[0]) throw new Error('Failed to save draft');
    return rows[0];
}

export async function getDraftById(ownerId: string, draftId: string): Promise<DatabaseArticleDraft | null> {
    const rows = await query<DatabaseArticleDraft[]>(
        `SELECT * FROM article_drafts WHERE id = ? AND owner_id = ? LIMIT 1`,
        [draftId, ownerId]
    );
    return rows[0] ?? null;
}

export async function deleteDraft(ownerId: string, draftId: string): Promise<void> {
    await execute(`DELETE FROM article_drafts WHERE id = ? AND owner_id = ?`, [draftId, ownerId]);
}
