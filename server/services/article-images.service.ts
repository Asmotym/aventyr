import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { query, execute, transaction } from '../core/database/client';
import { requireAdmin, requireOwner } from './roles.service';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../core/errors/http-errors';
import { articleImageIds, type ArticleTranslations } from '../core/articles/document';
import { getArticleById, getDraftById } from '../core/database/tables/articles.table';

export async function normalizeArticleImage(bytes: Buffer) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new BadRequestError('Image must be at most 5 MB');
    try {
        const source = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
        const metadata = await source.metadata();
        if (!['jpeg','png','webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
        return await source.rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    } catch { throw new BadRequestError('A valid static JPEG, PNG or WebP image is required'); }
}
export async function authorizeImageScope(userId: string, articleId?: string, draftId?: string) {
    if (Boolean(articleId) === Boolean(draftId)) throw new BadRequestError('Specify an article or draft');
    if (articleId) {
        await requireAdmin(userId);
        if (!await getArticleById(articleId)) throw new NotFoundError('Article not found');
    } else {
        await requireOwner(userId);
        if (!await getDraftById(userId, draftId!)) throw new NotFoundError('Draft not found');
    }
}
export async function uploadArticleImage(userId: string, bytes: Buffer, articleId?: string, draftId?: string, library = false) {
    if (library) await requireAdmin(userId);
    else await authorizeImageScope(userId, articleId, draftId);
    const image = await normalizeArticleImage(bytes);
    const id = randomUUID();
    await execute('INSERT INTO article_images (id, uploader_id, article_id, draft_id, bytes, width, height, is_library) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, userId, library ? null : articleId ?? null, library ? null : draftId ?? null, image.data, image.info.width, image.info.height, library]);
    return { id, url: `/api/article-images/${id}` };
}
export async function listArticleImages(userId: string, articleId?: string, draftId?: string) {
    if (!articleId && !draftId) {
        await requireAdmin(userId);
        const rows = await query<Array<{ id: string; uploader_id: string }>>('SELECT id, uploader_id FROM article_images WHERE is_library = 1 ORDER BY created_at DESC');
        return rows.map(row => ({ id: row.id, url: `/api/article-images/${row.id}`, canDelete: row.uploader_id === userId }));
    }
    await authorizeImageScope(userId, articleId, draftId);
    const rows = await query<Array<{ id: string }>>('SELECT id FROM article_images WHERE article_id = ? OR draft_id = ? ORDER BY created_at DESC', [articleId ?? null, draftId ?? null]);
    return rows.map(row => ({ id: row.id, url: `/api/article-images/${row.id}` }));
}
export async function deleteArticleImage(userId: string, id: string): Promise<void> {
    const [scope] = await query<Array<{ article_id: string | null; draft_id: string | null; is_library: number; uploader_id: string }>>('SELECT article_id, draft_id, is_library, uploader_id FROM article_images WHERE id = ?', [id]);
    if (!scope) throw new NotFoundError('Image not found');
    if (scope.is_library) {
        await requireAdmin(userId);
        if (scope.uploader_id !== userId) throw new ForbiddenError('Only the uploader can delete a library image');
    } else await authorizeImageScope(userId, scope.article_id ?? undefined, scope.draft_id ?? undefined);
    await transaction(async () => {
        // Match the parent-before-image lock order used by document saves and publication.
        if (scope.article_id || scope.draft_id) await query(`SELECT id FROM ${scope.article_id ? 'articles' : 'article_drafts'} WHERE id = ? FOR UPDATE`, [scope.article_id ?? scope.draft_id]);
        const [current] = await query<Array<{ article_id: string | null; draft_id: string | null }>>('SELECT article_id, draft_id FROM article_images WHERE id = ? FOR UPDATE', [id]);
        if (!current) throw new NotFoundError('Image not found');
        if (current.article_id !== scope.article_id || current.draft_id !== scope.draft_id) throw new ConflictError('Image scope changed; reload the image library');
        const references = await query<Array<{ parent_id: string }>>('SELECT parent_id FROM article_image_references WHERE image_id = ? LIMIT 1', [id]);
        if (references.length) throw new ConflictError('Remove the image from every language and save before deleting it');
        await execute('DELETE FROM article_images WHERE id = ?', [id]);
    });
}
export async function readArticleImage(id: string, userId?: string) {
    const rows = await query<Array<{ bytes: Buffer; article_id: string | null; draft_id: string | null; is_library: number }>>('SELECT bytes, article_id, draft_id, is_library FROM article_images WHERE id = ?', [id]);
    const image = rows[0];
    if (!image) throw new NotFoundError('Image not found');
    const visible = await query<Array<{ id: string }>>(`SELECT a.id FROM article_image_references r JOIN articles a ON a.id = r.parent_id AND r.is_draft = 0 WHERE r.image_id = ? AND a.status = 'published' AND a.archived_at IS NULL AND (a.published_at IS NULL OR a.published_at <= CURRENT_TIMESTAMP) LIMIT 1`, [id]);
    if (!visible.length) {
        if (!userId) throw new NotFoundError('Image not found');
        if (image.is_library) await requireAdmin(userId);
        else {
            if (!image.article_id && !image.draft_id) throw new NotFoundError('Image not found');
            await authorizeImageScope(userId, image.article_id ?? undefined, image.draft_id ?? undefined);
        }
    }
    return image.bytes;
}
export async function syncArticleImages(userId: string, parentId: string, translations: ArticleTranslations, draft = false, sourceDraftId?: string) {
    const ids = articleImageIds(translations).sort();
    for (const id of ids) {
        const rows = await query<Array<{ article_id: string | null; draft_id: string | null; is_library: number }>>('SELECT article_id, draft_id, is_library FROM article_images WHERE id = ? FOR UPDATE', [id]);
        const image = rows[0];
        if (!image || (!image.is_library && (draft ? image.draft_id !== parentId : image.article_id !== parentId && (!sourceDraftId || image.draft_id !== sourceDraftId)))) throw new BadRequestError('Image does not belong to this article');
    }
    if (sourceDraftId && !draft) {
        if (!await getDraftById(userId, sourceDraftId)) throw new BadRequestError('Draft not found');
        await execute('UPDATE article_images SET article_id = ?, draft_id = NULL WHERE draft_id = ?', [parentId, sourceDraftId]);
    }
    await execute('DELETE FROM article_image_references WHERE parent_id = ? AND is_draft = ?', [parentId, draft]);
    for (const id of ids) await execute('INSERT INTO article_image_references (image_id, parent_id, is_draft) VALUES (?, ?, ?)', [id, parentId, draft]);
}
export async function cleanupArticleImages() {
    await transaction(async () => {
        await execute(`DELETE r FROM article_image_references r LEFT JOIN articles a ON a.id = r.parent_id AND r.is_draft = 0 LEFT JOIN article_drafts d ON d.id = r.parent_id AND r.is_draft = 1 WHERE a.id IS NULL AND d.id IS NULL`);
        await execute(`DELETE i FROM article_images i LEFT JOIN article_image_references r ON r.image_id = i.id WHERE i.is_library = 0 AND r.image_id IS NULL AND i.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
    });
}
