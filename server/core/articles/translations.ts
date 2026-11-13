import { query, execute } from '../database/client';
import { APP_LOCALES, isAppLocale, type AppLocale } from '../types/locale.types';
import { BadRequestError } from '../errors/http-errors';
import { validateDocument, documentHasContent, type ArticleTranslations } from './document';
import { renderArticleDocument, articleExcerpt, markdownToDocument } from './render';

export interface TranslationRow { locale: AppLocale; title: string; introduction: string; document: string | object; sanitized_html: string; excerpt: string }
export async function readTranslations(id: string, draft = false): Promise<ArticleTranslations> {
    const rows = await query<TranslationRow[]>(`SELECT * FROM ${draft ? 'article_draft_translations' : 'article_translations'} WHERE parent_id = ?`, [id]);
    return Object.fromEntries(rows.map(row => [row.locale, { title: row.title, introduction: row.introduction, document: typeof row.document === 'string' ? JSON.parse(row.document) : row.document }]));
}
export function legacyTranslation(row: { title?: string | null; introduction?: string | null; markdown_source: string }): ArticleTranslations {
    return { en: { title: row.title ?? '', introduction: row.introduction ?? '', document: markdownToDocument(row.markdown_source) } };
}
export function normalizeTranslations(value: unknown, complete = false): ArticleTranslations {
    try {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Article translations are required');
        const result: ArticleTranslations = {};
        for (const [locale, translation] of Object.entries(value)) {
            if (!isAppLocale(locale) || !translation || typeof translation !== 'object') throw new Error('Invalid article language');
            const item = translation as Record<string, unknown>;
            if (typeof item.title !== 'string' || item.title.length > 191 || typeof item.introduction !== 'string' || item.introduction.length > 1200) throw new Error('Invalid title or introduction');
            const document = validateDocument(item.document);
            result[locale] = { title: item.title.trim(), introduction: item.introduction.trim(), document };
            if (complete && (!result[locale]!.title || !result[locale]!.introduction || !documentHasContent(document))) throw new Error(`Complete the ${locale} translation before publishing`);
        }
        if (!result.en) throw new Error('Default English translation is required');
        return result;
    } catch (error) { throw new BadRequestError(error instanceof Error ? error.message : 'Invalid translations'); }
}
export async function replaceTranslations(id: string, translations: ArticleTranslations, draft = false): Promise<void> {
    const table = draft ? 'article_draft_translations' : 'article_translations';
    await execute(`DELETE FROM ${table} WHERE parent_id = ?`, [id]);
    for (const locale of APP_LOCALES) {
        const translation = translations[locale];
        if (!translation) continue;
        const html = renderArticleDocument(translation.document);
        await execute(`INSERT INTO ${table} (parent_id, locale, title, introduction, document, sanitized_html, excerpt) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, locale, translation.title, translation.introduction, JSON.stringify(translation.document), html, articleExcerpt(html)]);
    }
}
export async function localizedArticleRows<T extends { id: string; title: string; introduction: string; excerpt: string }>(rows: T[], locale: AppLocale): Promise<Array<T & { requestedLocale: AppLocale; resolvedLocale: AppLocale; availableLocales: AppLocale[] }>> {
    if (!rows.length) return [];
    const translations = await query<Array<TranslationRow & { parent_id: string }>>('SELECT parent_id, locale, title, introduction, excerpt FROM article_translations WHERE parent_id IN (?)', [rows.map(row => row.id)]);
    return rows.map(row => {
        const versions = translations.filter(t => t.parent_id === row.id);
        const selected = versions.find(t => t.locale === locale) ?? versions.find(t => t.locale === 'en');
        return { ...row, ...(selected ? { title: selected.title, introduction: selected.introduction, excerpt: selected.excerpt } : {}), requestedLocale: locale, resolvedLocale: selected?.locale ?? 'en', availableLocales: versions.length ? versions.map(t => t.locale) : ['en'] };
    });
}
