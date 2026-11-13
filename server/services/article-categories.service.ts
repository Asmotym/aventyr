import { randomUUID } from 'node:crypto';
import { execute, query, transaction } from '../core/database/client';
import { BadRequestError, NotFoundError } from '../core/errors/http-errors';
import type { ArticleCategory } from '../core/types/data.types';
import { requireOwner } from './roles.service';

// Always acquire before document locks. Serializes tree edits and category assignments,
// including an empty tree, across server instances and database connections.
export async function lockCategories(): Promise<void> {
    await query('SELECT id FROM article_category_lock WHERE id = 1 FOR UPDATE');
}

export async function listCategories(): Promise<ArticleCategory[]> {
    const rows = await query<ArticleCategory[]>(`SELECT id, name, description, parent_id AS parentId, position,
        created_at AS createdAt, updated_at AS updatedAt FROM article_categories
        ORDER BY position, created_at, id`);
    const base = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
    return rows.map(row => ({ ...row, urlSegment: rows.filter(item => base(item.name) === base(row.name)).length > 1 || base(row.name) === 'default' ? `${base(row.name)}-${row.id}` : base(row.name) }));
}

export async function listAdminCategories(userId: string): Promise<ArticleCategory[]> {
    await requireOwner(userId);
    return query<ArticleCategory[]>(`SELECT c.id, c.name, c.description, c.parent_id AS parentId, c.position,
        c.created_at AS createdAt, c.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM article_category_links l WHERE l.category_id = c.id) AS articleCount,
        (SELECT COUNT(*) FROM article_draft_category_links l WHERE l.category_id = c.id) AS draftCount
        FROM article_categories c ORDER BY c.position, c.created_at, c.id`);
}

export async function assignedCategories(ids: string[], draft = false): Promise<Array<ArticleCategory & { documentId: string }>> {
    if (!ids.length) return [];
    const rows = await query<Array<ArticleCategory & { documentId: string }>>(`SELECT c.id, c.name, c.description, c.parent_id AS parentId, c.position,
        l.parent_id AS documentId FROM ${draft ? 'article_draft_category_links' : 'article_category_links'} l
        JOIN article_categories c ON c.id = l.category_id WHERE l.parent_id IN (?) ORDER BY c.position, c.created_at, c.id`, [ids]);
    const catalog = await listCategories();
    return rows.map(row => ({ ...row, urlSegment: catalog.find(category => category.id === row.id)?.urlSegment }));
}

// Caller holds the category lock in the document transaction.
export async function replaceCategories(id: string, value: unknown, draft = false): Promise<void> {
    if (value === undefined) return;
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new BadRequestError('Invalid category selection');
    const ids = [...new Set(value as string[])];
    const allowed = new Set((await listCategories()).map(category => category.id));
    if (ids.some(categoryId => !allowed.has(categoryId))) throw new BadRequestError('A selected category no longer exists. Refresh categories and select again.');
    const table = draft ? 'article_draft_category_links' : 'article_category_links';
    await execute(`DELETE FROM ${table} WHERE parent_id = ?`, [id]);
    for (const categoryId of ids) await execute(`INSERT INTO ${table} (parent_id, category_id) VALUES (?, ?)`, [id, categoryId]);
}

export function categoryDescendants(categories: ArticleCategory[], id: string): string[] {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const category of categories) if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
            ids.add(category.id); changed = true;
        }
    }
    return [...ids];
}

export async function saveCategory(userId: string, id: string | undefined, payload: { name?: unknown; description?: unknown; parentId?: unknown }): Promise<ArticleCategory> {
    await requireOwner(userId);
    return transaction(async () => {
        await lockCategories();
        const categories = await listCategories();
        const existing = categories.find(category => category.id === id);
        if (id && !existing) throw new NotFoundError('Category not found');
        const name = payload.name === undefined ? existing?.name : payload.name;
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new BadRequestError('Category name must contain 1–80 characters');
        if (name.trim().toLowerCase() === 'default') throw new BadRequestError('Default is reserved for uncategorized articles');
        const description = payload.description === undefined ? existing?.description ?? null : payload.description;
        if (description !== null && (typeof description !== 'string' || description.length > 2000)) throw new BadRequestError('Category description must contain at most 2000 characters');
        const parentId = payload.parentId === undefined ? existing?.parentId ?? null : payload.parentId;
        if (parentId !== null && (typeof parentId !== 'string' || !categories.some(category => category.id === parentId))) throw new BadRequestError('Parent category not found');
        if (id && parentId && categoryDescendants(categories, id).includes(parentId)) throw new BadRequestError('A category cannot be placed beneath itself');
        const position = existing && existing.parentId === parentId ? existing.position : Math.max(-1, ...categories.filter(category => category.parentId === parentId).map(category => category.position)) + 1;
        const categoryId = id ?? randomUUID();
        if (existing) await execute('UPDATE article_categories SET name = ?, description = ?, parent_id = ?, position = ? WHERE id = ?', [name.trim(), description, parentId, position, categoryId]);
        else await execute('INSERT INTO article_categories (id, name, description, parent_id, position) VALUES (?, ?, ?, ?, ?)', [categoryId, name.trim(), description, parentId, position]);
        return (await listCategories()).find(category => category.id === categoryId)!;
    });
}

export async function reorderCategories(userId: string, parentId: unknown, ids: unknown): Promise<void> {
    await requireOwner(userId);
    await transaction(async () => {
        await lockCategories();
        const categories = await listCategories();
        const siblings = categories.filter(category => category.parentId === parentId);
        if (parentId !== null && !categories.some(category => category.id === parentId)) throw new BadRequestError('Parent category not found');
        if (!Array.isArray(ids) || ids.length !== siblings.length || new Set(ids).size !== ids.length || ids.some(id => !siblings.some(category => category.id === id))) throw new BadRequestError('Category order changed. Refresh categories and try again.');
        for (const [position, id] of ids.entries()) await execute('UPDATE article_categories SET position = ? WHERE id = ?', [position, id]);
    });
}

export async function deleteCategory(userId: string, id: string, replacementId: unknown): Promise<void> {
    await requireOwner(userId);
    await transaction(async () => {
        await lockCategories();
        const categories = await listCategories();
        const category = categories.find(item => item.id === id);
        if (!category) throw new NotFoundError('Category not found');
        const tables = ['article_category_links', 'article_draft_category_links'];
        for (const table of tables) {
            const [row] = await query<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM ${table} WHERE category_id = ?`, [id]);
            if (Number(row.count) > 0 && (replacementId === id || !categories.some(item => item.id === replacementId))) throw new BadRequestError('Select another category for existing articles and drafts before deleting');
        }
        for (const table of tables) {
            if (typeof replacementId === 'string' && replacementId !== id && categories.some(item => item.id === replacementId)) {
                await execute(`INSERT IGNORE INTO ${table} (parent_id, category_id) SELECT parent_id, ? FROM ${table} WHERE category_id = ?`, [replacementId, id]);
            }
            await execute(`DELETE FROM ${table} WHERE category_id = ?`, [id]);
        }
        let position = Math.max(-1, ...categories.filter(item => item.parentId === category.parentId).map(item => item.position)) + 1;
        for (const child of categories.filter(item => item.parentId === id)) {
            await execute('UPDATE article_categories SET parent_id = ?, position = ? WHERE id = ?', [category.parentId, position++, child.id]);
        }
        await execute('DELETE FROM article_categories WHERE id = ?', [id]);
    });
}
