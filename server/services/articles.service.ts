import { assignedCategories, listCategories, categoryDescendants, lockCategories, replaceCategories } from './article-categories.service';
import { transaction, query } from '../core/database/client';
import { normalizeLocale, type AppLocale } from '../core/types/locale.types';
import { readTranslations, replaceTranslations, legacyTranslation, normalizeTranslations, localizedArticleRows } from '../core/articles/translations';
import { renderArticleDocument } from '../core/articles/render';
import { syncArticleImages } from './article-images.service';
import { randomUUID } from 'crypto';
import { Renderer, marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { hljs } from '../core/utils/markdown-highlight';
import {
    articleSlugExists,
    articleDraftUidExists,
    articleUidExists,
    deleteArticleTag,
    deleteDraft,
    getArticleById,
    getArticleBySlug,
    getDraftById,
    getArticleTagBySlug,
    insertArticle,
    insertArticleTag,
    listArticles,
    listArticleTags,
    listDrafts,
    listTagsForArticles,
    replaceArticleTags,
    setArticleArchived,
    updateArticleRecord,
    updateArticleTag,
    upsertDraft
} from '../core/database/tables/articles.table';
import type { DatabaseArticle, DatabaseArticleDraft, DatabaseArticleTag } from '../core/types/database.types';
import { isArticleSort } from '../core/types/data.types';
import type { ArticleDetails, ArticleDraft, ArticleStatus, ArticleSummary, ArticleTag } from '../core/types/data.types';
import { BadRequestError, NotFoundError } from '../core/errors/http-errors';
import { generateArticleUid } from '../core/utils/id';
import { requireAdmin, requireOwner } from './roles.service';

const ARTICLE_MARKDOWN_MAX = 250_000;
const ARTICLE_EXCERPT_MAX = 260;
const TAG_NAME_MAX = 80;
const DEFAULT_PUBLIC_LIMIT = 5;
const SAFE_COLOR_STYLE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|^rgb\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\)$/;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const renderer = new Renderer();
renderer.code = ({ text, lang }) => {
    const language = (lang ?? '').trim().split(/\s+/)[0];
    const highlighted = language && hljs.getLanguage(language)
        ? hljs.highlight(text, { language }).value
        : escapeHtml(text);
    const className = language ? ` class="language-${escapeHtml(language)}"` : '';
    return `<pre><code${className}>${highlighted}</code></pre>\n`;
};

marked.use({
    gfm: true,
    breaks: true,
    renderer
});

function slugify(value: string): string {
    const slug = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 96);
    return slug || randomUUID().slice(0, 8);
}

async function uniqueArticleSlug(title: string, articleId?: string): Promise<string> {
    const base = slugify(title).slice(0, 80);
    let candidate = base;
    let index = 2;
    while (await articleSlugExists(candidate, articleId)) {
        candidate = `${base}-${index}`.slice(0, 96);
        index += 1;
    }
    return candidate;
}

async function uniqueArticleUid(exceptDraftId?: string): Promise<string> {
    for (let attempts = 0; attempts < 25; attempts += 1) {
        const uid = generateArticleUid();
        if (!(await articleUidExists(uid)) && !(await articleDraftUidExists(uid, exceptDraftId))) {
            return uid;
        }
    }
    throw new Error('Failed to generate article UID, please retry');
}

function sanitizeRenderedHtml(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: [
            'p', 'br', 'strong', 'em', 's', 'blockquote', 'code', 'pre',
            'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'img', 'input', 'span'
        ],
        allowedAttributes: {
            a: ['href', 'name', 'target', 'rel'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            input: ['type', 'checked', 'disabled'],
            th: ['align'],
            td: ['align'],
            code: ['class'],
            span: ['class', 'style']
        },
        allowedStyles: {
            span: {
                color: [SAFE_COLOR_STYLE]
            }
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        transformTags: {
            a: sanitizeHtml.simpleTransform('a', { rel: 'noreferrer noopener', target: '_blank' }),
            input: (_tagName, attribs) => ({
                tagName: 'input',
                attribs: {
                    type: 'checkbox',
                    disabled: '',
                    ...(Object.prototype.hasOwnProperty.call(attribs, 'checked') ? { checked: '' } : {})
                }
            })
        }
    });
}

function renderMarkdown(markdown: string): string {
    const rendered = marked.parse(markdown, { async: false }) as string;
    return sanitizeRenderedHtml(rendered);
}

function excerptFromHtml(html: string): string {
    const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
        .replace(/\s+/g, ' ')
        .trim();
    return text.slice(0, ARTICLE_EXCERPT_MAX);
}

function parseTagIds(value: DatabaseArticleDraft['selected_tag_ids']): string[] {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

function mapTag(row: DatabaseArticleTag): ArticleTag {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function attachTags(rows: DatabaseArticle[]): Promise<ArticleSummary[]> {
    const categoryRows = await assignedCategories(rows.map(row => row.id));
    const tagRows = await listTagsForArticles(rows.map((row) => row.id));
    const tagsByArticle = new Map<string, ArticleTag[]>();
    for (const tag of tagRows) {
        const list = tagsByArticle.get(tag.article_id) ?? [];
        list.push(mapTag(tag));
        tagsByArticle.set(tag.article_id, list);
    }

    return rows.map((row) => ({
        id: row.id,
        uid: row.uid,
        slug: row.slug,
        title: row.title,
        introduction: row.introduction,
        excerpt: row.excerpt,
        status: row.status,
        authorId: row.author_id,
        authorName: row.author_name,
        publishedAt: row.published_at,
        archivedAt: row.archived_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        categories: categoryRows.filter(category => category.documentId === row.id).map(({ documentId, ...category }) => category),
        tags: tagsByArticle.get(row.id) ?? []
    }));
}

async function mapArticleDetails(row: DatabaseArticle, includeMarkdown: boolean, locale: AppLocale = 'en'): Promise<ArticleDetails> {
    const [summary] = await attachTags([row]);
    const [localized] = await localizedArticleRows([summary], locale);
    const translations = await readTranslations(row.id);
    const selected = translations[localized.resolvedLocale];
    return {
        ...localized,
        sanitizedHtml: selected ? renderArticleDocument(selected.document) : renderMarkdown(row.markdown_source),
        markdownSource: includeMarkdown ? row.markdown_source : undefined,
        translations: includeMarkdown ? (translations.en ? translations : legacyTranslation(row)) : undefined
    };
}

function normalizeMarkdown(markdown: unknown): string {
    if (typeof markdown !== 'string') throw new BadRequestError('Markdown content is required');
    if (markdown.length > ARTICLE_MARKDOWN_MAX) throw new BadRequestError('Article content is too long');
    return markdown;
}

function normalizeStatus(status: unknown): ArticleStatus {
    if (status === 'published' || status === 'unpublished' || status === 'draft') return status;
    throw new BadRequestError('Invalid article status');
}

function normalizePublishedAt(value: unknown): string | null {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestError('Invalid publication date');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid publication date');
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeLimit(value: unknown, fallback = DEFAULT_PUBLIC_LIMIT): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.floor(parsed), 1), 50);
}

function normalizeOffset(value: unknown): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(Math.floor(parsed), 0);
}

function normalizeTags(value: unknown): string[] {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return raw.map((tag) => slugify(String(tag))).filter(Boolean);
}

async function ensureTagIdsExist(tagIds: string[]): Promise<string[]> {
    const existing = await listArticleTags();
    const allowed = new Set(existing.map((tag) => tag.id));
    return [...new Set(tagIds)].filter((tagId) => allowed.has(tagId));
}

export async function listPublicArticles(params: { search?: unknown; tags?: unknown; limit?: unknown; offset?: unknown; locale?: unknown; categoryId?: unknown; sort?: unknown }) {
    let categoryIds: string[] | undefined;
    if (typeof params.categoryId === 'string' && params.categoryId) {
        const categories = await listCategories();
        if (!categories.some(category => category.id === params.categoryId)) throw new BadRequestError('Category no longer exists. Refresh categories.');
        categoryIds = categoryDescendants(categories, params.categoryId);
    }
    if (params.sort !== undefined && !isArticleSort(params.sort)) throw new BadRequestError('Invalid article sort');
    const articles = await listArticles({
        categoryIds,
        sort: isArticleSort(params.sort) ? params.sort : 'newest',
        locale: normalizeLocale(params.locale),
        publicOnly: true,
        search: typeof params.search === 'string' ? params.search : undefined,
        tags: normalizeTags(params.tags),
        limit: normalizeLimit(params.limit),
        offset: normalizeOffset(params.offset)
    });
    return localizedArticleRows(await attachTags(articles), normalizeLocale(params.locale));
}

export async function listNewsArticles(limit: unknown, locale?: unknown) {
    const articles = await listArticles({
        publicOnly: true,
        newsOnly: true,
        limit: normalizeLimit(limit, 3),
        offset: 0
    });
    return localizedArticleRows(await attachTags(articles), normalizeLocale(locale));
}

export async function getPublicArticle(slug: string, locale?: unknown): Promise<ArticleDetails> {
    const article = await getArticleBySlug(slug, true);
    if (!article) throw new NotFoundError('Article not found');
    return mapArticleDetails(article, false, normalizeLocale(locale));
}

export async function listAdminArticles(userId: string, params: { search?: unknown; tags?: unknown; statuses?: unknown; archived?: unknown; limit?: unknown; offset?: unknown }) {
    await requireAdmin(userId);
    const statuses = Array.isArray(params.statuses)
        ? params.statuses.map(normalizeStatus)
        : typeof params.statuses === 'string' && params.statuses
            ? params.statuses.split(',').map(normalizeStatus)
            : undefined;
    const archived = params.archived === 'true' || params.archived === true
        ? true
        : params.archived === 'false' || params.archived === false
            ? false
            : null;

    const articles = await listArticles({
        search: typeof params.search === 'string' ? params.search : undefined,
        tags: normalizeTags(params.tags),
        statuses,
        archived,
        limit: normalizeLimit(params.limit, 20),
        offset: normalizeOffset(params.offset)
    });
    return attachTags(articles);
}

export async function getAdminArticle(userId: string, articleId: string): Promise<ArticleDetails> {
    await requireAdmin(userId);
    const article = await getArticleById(articleId);
    if (!article) throw new NotFoundError('Article not found');
    return mapArticleDetails(article, true);
}

interface ArticleWritePayload { translations?: unknown; tagIds?: unknown; categoryIds?: unknown; status?: unknown; publishedAt?: unknown; draftId?: unknown }
export async function createArticle(userId: string, payload: ArticleWritePayload) {
    await requireOwner(userId);
    return transaction(async () => {
        await lockCategories();
        if (typeof payload.draftId === 'string') await query('SELECT id FROM article_drafts WHERE id = ? FOR UPDATE', [payload.draftId]);
        const draft = typeof payload.draftId === 'string' && payload.draftId ? await getDraftById(userId, payload.draftId) : null;
        if (payload.draftId && !draft) throw new BadRequestError('Draft not found');
        const status = payload.status ? normalizeStatus(payload.status) : 'unpublished';
        if (status === 'draft') throw new BadRequestError('Use drafts endpoint for drafts');
        const translations = normalizeTranslations(payload.translations, status === 'published');
        const english = translations.en!;
        const sanitizedHtml = renderArticleDocument(english.document);
        const article = await insertArticle({
            id: randomUUID(), uid: draft?.uid ?? await uniqueArticleUid(),
            slug: await uniqueArticleSlug(english.title), title: english.title, introduction: english.introduction,
            markdown_source: draft?.markdown_source ?? '', sanitized_html: sanitizedHtml, excerpt: excerptFromHtml(sanitizedHtml),
            author_id: userId, status,
            published_at: status === 'published' ? normalizePublishedAt(payload.publishedAt) ?? new Date().toISOString().slice(0,19).replace('T',' ') : null,
            archived_at: null
        });
        await replaceTranslations(article.id, translations);
        await replaceArticleTags(article.id, await ensureTagIdsExist(Array.isArray(payload.tagIds) ? payload.tagIds.map(String) : []));
        await replaceCategories(article.id, payload.categoryIds === undefined ? (draft ? (await assignedCategories([draft.id], true)).map(category => category.id) : undefined) : payload.categoryIds);
        await syncArticleImages(userId, article.id, translations, false, draft?.id);
        if (draft) {
            await query('DELETE FROM article_image_references WHERE parent_id = ? AND is_draft = 1', [draft.id]);
            await deleteDraft(userId, draft.id);
        }
        return getAdminArticle(userId, article.id);
    });
}

export async function updateArticle(userId: string, articleId: string, payload: ArticleWritePayload) {
    await requireAdmin(userId);
    return transaction(async () => {
        await lockCategories();
        await query('SELECT id FROM articles WHERE id = ? FOR UPDATE', [articleId]);
        const existing = await getArticleById(articleId);
        if (!existing) throw new NotFoundError('Article not found');
        const translations = normalizeTranslations(payload.translations, existing.status === 'published');
        const english = translations.en!;
        const html = renderArticleDocument(english.document);
        await updateArticleRecord(articleId, { title: english.title, introduction: english.introduction, sanitized_html: html, excerpt: excerptFromHtml(html) });
        await replaceTranslations(articleId, translations);
        if (Array.isArray(payload.tagIds)) await replaceArticleTags(articleId, await ensureTagIdsExist(payload.tagIds.map(String)));
        await replaceCategories(articleId, payload.categoryIds);
        await syncArticleImages(userId, articleId, translations);
        return getAdminArticle(userId, articleId);
    });
}

export async function setArticlePublication(userId: string, articleId: string, payload: { published: boolean; publishedAt?: unknown }) {
    await requireAdmin(userId);
    return transaction(async () => {
        await lockCategories();
        await query('SELECT id FROM articles WHERE id = ? FOR UPDATE', [articleId]);
        const existing = await getArticleById(articleId);
        if (!existing) throw new NotFoundError('Article not found');
        if (payload.published) {
            const stored = await readTranslations(articleId);
            normalizeTranslations(stored.en ? stored : legacyTranslation(existing), true);
        }
        await updateArticleRecord(articleId, {
            status: payload.published ? 'published' : 'unpublished',
            published_at: payload.published ? normalizePublishedAt(payload.publishedAt) ?? new Date().toISOString().slice(0,19).replace('T',' ') : null
        });
        return getAdminArticle(userId, articleId);
    });
}

export async function archiveArticle(userId: string, articleId: string) {
    await requireOwner(userId);
    const updated = await setArticleArchived(articleId);
    if (!updated) throw new NotFoundError('Article not found');
    return getAdminArticle(userId, articleId);
}

export async function listTags(): Promise<ArticleTag[]> {
    return (await listArticleTags()).map(mapTag);
}

export async function createTag(userId: string, name: unknown): Promise<ArticleTag> {
    await requireOwner(userId);
    if (typeof name !== 'string' || !name.trim()) throw new BadRequestError('Tag name is required');
    const trimmed = name.trim().slice(0, TAG_NAME_MAX);
    const slug = slugify(trimmed);
    const existing = await getArticleTagBySlug(slug);
    if (existing) return mapTag(existing);
    return mapTag(await insertArticleTag({ id: randomUUID(), name: trimmed, slug, created_by: userId }));
}

export async function renameTag(userId: string, tagId: string, name: unknown): Promise<ArticleTag> {
    await requireOwner(userId);
    if (typeof name !== 'string' || !name.trim()) throw new BadRequestError('Tag name is required');
    const trimmed = name.trim().slice(0, TAG_NAME_MAX);
    const updated = await updateArticleTag(tagId, trimmed, slugify(trimmed));
    if (!updated) throw new NotFoundError('Tag not found');
    return mapTag(updated);
}

export async function removeTag(userId: string, tagId: string): Promise<void> {
    await requireOwner(userId);
    await deleteArticleTag(tagId);
}

async function mapDraft(draft: DatabaseArticleDraft): Promise<ArticleDraft> {
    const stored = await readTranslations(draft.id, true);
    return { id: draft.id, uid: draft.uid, ownerId: draft.owner_id, title: draft.title, introduction: draft.introduction,
        markdownSource: draft.markdown_source, translations: stored.en ? stored : legacyTranslation(draft),
        selectedCategoryIds: (await assignedCategories([draft.id], true)).map(category => category.id),
        selectedTagIds: parseTagIds(draft.selected_tag_ids), createdAt: draft.created_at, updatedAt: draft.updated_at };
}
export async function listOwnerDrafts(userId: string): Promise<ArticleDraft[]> {
    await requireOwner(userId);
    return Promise.all((await listDrafts(userId)).map(mapDraft));
}
export async function getDraftPreview(userId: string, draftId: string): Promise<{ html: string }> {
    await requireOwner(userId);
    const stored = await getDraftById(userId, draftId);
    if (!stored) throw new NotFoundError('Draft not found');
    const draft = await mapDraft(stored);
    const document = draft.translations!.en!.document;
    return { html: renderArticleDocument({ version: 1, content: { type: 'doc', content: document.content.content?.slice(0, 3) ?? [{ type: 'paragraph' }] } }) };
}
export async function saveDraft(userId: string, payload: { id?: unknown; translations?: unknown; selectedTagIds?: unknown; selectedCategoryIds?: unknown }): Promise<ArticleDraft> {
    await requireOwner(userId);
    return transaction(async () => {
        await lockCategories();
        if (typeof payload.id === 'string') await query('SELECT id FROM article_drafts WHERE id = ? FOR UPDATE', [payload.id]);
        const existing = typeof payload.id === 'string' && payload.id ? await getDraftById(userId, payload.id) : null;
        if (payload.id && !existing) throw new NotFoundError('Draft not found');
        const translations = normalizeTranslations(payload.translations);
        const draft = await upsertDraft({
            id: existing?.id ?? randomUUID(), uid: existing?.uid ?? await uniqueArticleUid(), owner_id: userId,
            title: translations.en!.title, introduction: translations.en!.introduction, markdown_source: existing?.markdown_source ?? '',
            selected_tag_ids: JSON.stringify(Array.isArray(payload.selectedTagIds) ? payload.selectedTagIds.map(String) : [])
        });
        await replaceCategories(draft.id, payload.selectedCategoryIds, true);
        await replaceTranslations(draft.id, translations, true);
        await syncArticleImages(userId, draft.id, translations, true);
        return mapDraft(draft);
    });
}
export async function removeDraft(userId: string, draftId: string): Promise<void> {
    await requireOwner(userId);
    await transaction(async () => {
        await lockCategories();
        if (!await getDraftById(userId, draftId)) throw new NotFoundError('Draft not found');
        await query('DELETE FROM article_image_references WHERE parent_id = ? AND is_draft = 1', [draftId]);
        await deleteDraft(userId, draftId);
    });
}

export function previewMarkdown(markdown: unknown): { sanitizedHtml: string; excerpt: string } {
    const source = normalizeMarkdown(markdown);
    const sanitizedHtml = renderMarkdown(source);
    return { sanitizedHtml, excerpt: excerptFromHtml(sanitizedHtml) };
}
