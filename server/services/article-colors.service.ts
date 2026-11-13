import { query, execute, transaction } from '../core/database/client';
import { requireKnownUser } from './roles.service';
import { BadRequestError } from '../core/errors/http-errors';
import { isArticleColor, normalizeColorHistory, rememberArticleColor } from '../core/articles/colors';

export async function getArticleColors(userId: string) {
    await requireKnownUser(userId);
    const [row] = await query<Array<{ colors: string | object }>>('SELECT colors FROM article_editor_preferences WHERE user_id = ?', [userId]);
    return normalizeColorHistory(typeof row?.colors === 'string' ? JSON.parse(row.colors) : row?.colors);
}
export async function recordArticleColor(userId: string, color: unknown) {
    await requireKnownUser(userId);
    if (!isArticleColor(color)) throw new BadRequestError('A six-digit hex color is required');
    return transaction(async () => {
        await execute('INSERT IGNORE INTO article_editor_preferences (user_id, colors) VALUES (?, ?)', [userId, JSON.stringify({ recent: [], custom: [] })]);
        const [row] = await query<Array<{ colors: string | object }>>('SELECT colors FROM article_editor_preferences WHERE user_id = ? FOR UPDATE', [userId]);
        const history = normalizeColorHistory(typeof row.colors === 'string' ? JSON.parse(row.colors) : row.colors);
        const colors = rememberArticleColor(history, color);
        await execute('UPDATE article_editor_preferences SET colors = ? WHERE user_id = ?', [JSON.stringify(colors), userId]);
        return colors;
    });
}
