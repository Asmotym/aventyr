import type { Express } from 'express';
import express from 'express';
import { ensureAuthenticatedSameUser, requireRequesterId, respondWithServiceError } from '../../infrastructure/http/request-helpers';
import { requireAdmin } from '../auth/roles.service';
import { deleteCategory, listAdminCategories, listCategories, reorderCategories, saveCategory } from './article-categories.service';
import { getArticleColors, recordArticleColor } from './article-colors.service';
import { deleteArticleImage, listArticleImages, readArticleImage, uploadArticleImage } from './article-images.service';
import { archiveArticle, convertArticleImport, createArticle, createTag, getAdminArticle, getDraftPreview, getPublicArticle, listAdminArticles, listNewsArticles, listOwnerDrafts, listPublicArticles, listTags, previewMarkdown, removeDraft, removeTag, renameTag, saveDraft, setArticlePublication, updateArticle } from './articles.service';
const services = { listCategories, listAdminCategories, saveCategory, deleteCategory, reorderCategories, getArticleColors, recordArticleColor, uploadArticleImage, deleteArticleImage, listArticleImages, readArticleImage, requireAdmin, convertArticleImport, archiveArticle, createArticle, createTag, getAdminArticle, getPublicArticle, listAdminArticles, listNewsArticles, listOwnerDrafts, getDraftPreview, listPublicArticles, listTags, previewMarkdown, removeDraft, removeTag, renameTag, saveDraft, setArticlePublication, updateArticle };
export function registerArticlesRoutes(app: Express, overrides: Partial<typeof services> = {}) {
    const { listCategories, listAdminCategories, saveCategory, deleteCategory, reorderCategories, getArticleColors, recordArticleColor, uploadArticleImage, deleteArticleImage, listArticleImages, readArticleImage, requireAdmin, convertArticleImport, archiveArticle, createArticle, createTag, getAdminArticle, getPublicArticle, listAdminArticles, listNewsArticles, listOwnerDrafts, getDraftPreview, listPublicArticles, listTags, previewMarkdown, removeDraft, removeTag, renameTag, saveDraft, setArticlePublication, updateArticle } = { ...services, ...overrides };
    app.get('/api/users/:userId/editor-colors', async (req, res) => {
        const userId = String(req.params.userId);
        if (!await ensureAuthenticatedSameUser(req, res, userId))
            return;
        try {
            res.setHeader('Cache-Control', 'private, no-store');
            res.json({ success: true, data: await getArticleColors(userId) });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.colors.fetch');
        }
    });
    app.post('/api/users/:userId/editor-colors', async (req, res) => {
        const userId = String(req.params.userId);
        if (!await ensureAuthenticatedSameUser(req, res, userId))
            return;
        try {
            res.setHeader('Cache-Control', 'private, no-store');
            res.json({ success: true, data: await recordArticleColor(userId, (req.body as {
                    color?: unknown;
                } | undefined)?.color) });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.colors.update');
        }
    });
    app.post('/api/admin/article-images', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const image = await uploadArticleImage(userId, req.body, typeof req.query.articleId === 'string' ? req.query.articleId : undefined, typeof req.query.draftId === 'string' ? req.query.draftId : undefined, req.query.library === 'true');
            res.json({ success: true, data: image });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.image.upload');
        }
    });
    app.get('/api/admin/article-images', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const images = await listArticleImages(userId, typeof req.query.articleId === 'string' ? req.query.articleId : undefined, typeof req.query.draftId === 'string' ? req.query.draftId : undefined);
            res.json({ success: true, data: { images } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.image.list');
        }
    });
    app.delete('/api/admin/article-images/:imageId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            await deleteArticleImage(userId, String(req.params.imageId));
            res.json({ success: true, data: {} });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.image.delete');
        }
    });
    app.get('/api/admin/article-images/:imageId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const bytes = await readArticleImage(String(req.params.imageId), userId);
            res.set('Cache-Control', 'private, no-store').json({ success: true, data: { dataUrl: `data:image/webp;base64,${bytes.toString('base64')}` } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.image.read_private');
        }
    });
    app.get('/api/article-images/:imageId', async (req, res) => {
        try {
            const bytes = await readArticleImage(String(req.params.imageId));
            res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).send(bytes);
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.image.read');
        }
    });
    app.get('/api/articles', async (req, res) => {
        try {
            const articles = await listPublicArticles({
                search: req.query.search,
                categoryId: req.query.categoryId,
                sort: req.query.sort,
                locale: req.query.locale,
                tags: req.query.tags,
                limit: req.query.limit,
                offset: req.query.offset
            });
            res.json({ success: true, data: { articles } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.list_public');
        }
    });
    app.get('/api/articles/news', async (req, res) => {
        try {
            const articles = await listNewsArticles(req.query.limit, req.query.locale);
            res.json({ success: true, data: { articles } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.list_news');
        }
    });
    app.get('/api/articles/tags', async (_req, res) => {
        try {
            const tags = await listTags();
            res.json({ success: true, data: { tags } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article_tag.list');
        }
    });
    app.get('/api/articles/categories', async (req, res) => {
        try {
            res.json({ success: true, data: { categories: await listCategories(req.query.locale) } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.category.list');
        }
    });
    app.get('/api/admin/articles/categories', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            res.json({ success: true, data: { categories: await listAdminCategories(userId, req.query.locale) } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.category.list_admin');
        }
    });
    app.post('/api/admin/articles/categories', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            res.json({ success: true, data: { category: await saveCategory(userId, undefined, req.body ?? {}) } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.category.create');
        }
    });
    app.patch('/api/admin/articles/categories/order', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            await reorderCategories(userId, req.body?.parentId, req.body?.ids);
            res.json({ success: true, data: {} });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.category.order');
        }
    });
    app.patch('/api/admin/articles/categories/:categoryId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            res.json({ success: true, data: { category: await saveCategory(userId, String(req.params.categoryId), req.body ?? {}) } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.category.update');
        }
    });
    app.delete('/api/admin/articles/categories/:categoryId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            await deleteCategory(userId, String(req.params.categoryId), req.body?.replacementCategoryId);
            res.json({ success: true, data: {} });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.category.delete');
        }
    });
    app.get('/api/articles/:slug', async (req, res) => {
        try {
            const article = await getPublicArticle(req.params.slug, req.query.locale);
            res.json({ success: true, data: { article } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.fetch_public');
        }
    });
    app.post('/api/admin/articles/import-text', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const document = await convertArticleImport(userId, req.body);
            res.json({ success: true, data: { document } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.import_text');
        }
    });
    app.get('/api/admin/articles', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const articles = await listAdminArticles(userId, {
                search: req.query.search,
                tags: req.query.tags,
                statuses: req.query.statuses,
                archived: req.query.archived,
                limit: req.query.limit,
                offset: req.query.offset
            });
            res.json({ success: true, data: { articles } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.list_admin');
        }
    });
    app.get('/api/admin/articles/detail/:articleId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const article = await getAdminArticle(userId, req.params.articleId);
            res.json({ success: true, data: { article } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.fetch_admin');
        }
    });
    app.post('/api/admin/articles', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const article = await createArticle(userId, req.body as {
                translations?: unknown;
                tagIds?: unknown;
                categoryIds?: unknown;
                status?: unknown;
                publishedAt?: unknown;
                draftId?: unknown;
            });
            res.json({ success: true, data: { article } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.create');
        }
    });
    app.patch('/api/admin/articles/:articleId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const article = await updateArticle(userId, req.params.articleId, req.body as {
                translations?: unknown;
                tagIds?: unknown;
                categoryIds?: unknown;
            });
            res.json({ success: true, data: { article } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.update');
        }
    });
    app.post('/api/admin/articles/:articleId/publication', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const body = req.body as {
                published?: unknown;
                publishedAt?: unknown;
            };
            const article = await setArticlePublication(userId, req.params.articleId, { published: body.published === true, publishedAt: body.publishedAt });
            res.json({ success: true, data: { article } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.update_publication');
        }
    });
    app.post('/api/admin/articles/:articleId/archive', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const article = await archiveArticle(userId, req.params.articleId);
            res.json({ success: true, data: { article } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.archive');
        }
    });
    app.post('/api/admin/articles/preview', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            await requireAdmin(userId);
            const preview = previewMarkdown((req.body as {
                markdownSource?: unknown;
            }).markdownSource);
            res.json({ success: true, data: preview });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.preview');
        }
    });
    app.post('/api/admin/articles/tags', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const tag = await createTag(userId, (req.body as {
                name?: unknown;
            }).name);
            res.json({ success: true, data: { tag } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article_tag.create');
        }
    });
    app.patch('/api/admin/articles/tags/:tagId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const tag = await renameTag(userId, req.params.tagId, (req.body as {
                name?: unknown;
            }).name);
            res.json({ success: true, data: { tag } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article_tag.rename');
        }
    });
    app.delete('/api/admin/articles/tags/:tagId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            await removeTag(userId, req.params.tagId);
            res.json({ success: true, data: { tagId: req.params.tagId } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article_tag.delete');
        }
    });
    app.get('/api/admin/articles/drafts', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const drafts = await listOwnerDrafts(userId);
            res.json({ success: true, data: { drafts } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article_draft.list');
        }
    });
    app.get('/api/admin/articles/drafts/:draftId/preview', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            res.set('Cache-Control', 'private, no-store').json({ success: true, data: await getDraftPreview(userId, String(req.params.draftId)) });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article.draft.preview');
        }
    });
    app.post('/api/admin/articles/drafts', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const draft = await saveDraft(userId, req.body as {
                translations?: unknown;
                id?: unknown;
                selectedTagIds?: unknown;
                selectedCategoryIds?: unknown;
            });
            res.json({ success: true, data: { draft } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article_draft.save');
        }
    });
    app.delete('/api/admin/articles/drafts/:draftId', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            await removeDraft(userId, req.params.draftId);
            res.json({ success: true, data: { draftId: req.params.draftId } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'article_draft.delete');
        }
    });
}
