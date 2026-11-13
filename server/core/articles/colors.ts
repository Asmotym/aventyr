export const ARTICLE_COLOR_PRESETS = [
    { name: 'gray', value: '#9b9b9b' }, { name: 'brown', value: '#a8795a' },
    { name: 'orange', value: '#e28a43' }, { name: 'yellow', value: '#d6b64c' },
    { name: 'green', value: '#6b9e78' }, { name: 'blue', value: '#6395cf' },
    { name: 'purple', value: '#a381c4' }, { name: 'pink', value: '#d27ca5' },
    { name: 'red', value: '#da7272' }, { name: 'white', value: '#eeeeee' }
] as const;
export interface ArticleColorHistory { recent: string[]; custom: string[] }
export const ARTICLE_COLOR_LIMIT = 8;
export const isArticleColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function normalizeColorHistory(value: unknown): ArticleColorHistory {
    const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const list = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter(isArticleColor).map(c => c.toLowerCase()))].slice(0, ARTICLE_COLOR_LIMIT) : [];
    return { recent: list(data.recent).filter(c => ARTICLE_COLOR_PRESETS.some(p => p.value === c)), custom: list(data.custom).filter(c => !ARTICLE_COLOR_PRESETS.some(p => p.value === c)) };
}
export function rememberArticleColor(history: ArticleColorHistory, color: string): ArticleColorHistory {
    const value = color.toLowerCase();
    const key = ARTICLE_COLOR_PRESETS.some(p => p.value === value) ? 'recent' : 'custom';
    return { ...history, [key]: [value, ...history[key].filter(c => c !== value)].slice(0, ARTICLE_COLOR_LIMIT) };
}
