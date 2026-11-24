import { isAppLocale } from '../../../../shared/accounts/locale.types';
import type { ArticleCategoryTranslations } from '../../../../shared/articles/articles.types';
import { BadRequestError } from '../../../infrastructure/http/errors';
export function normalizeCategoryTranslations(value: unknown): ArticleCategoryTranslations {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new BadRequestError('Category translations are required');
    const result: ArticleCategoryTranslations = {};
    for (const [locale, raw] of Object.entries(value)) {
        if (!isAppLocale(locale) || !raw || typeof raw !== 'object' || Array.isArray(raw))
            throw new BadRequestError('Invalid category language');
        const { name, description = null } = raw as Record<string, unknown>;
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 80)
            throw new BadRequestError(`Category name must contain 1–80 characters (${locale})`);
        if (locale === 'en' && name.trim().toLowerCase() === 'default')
            throw new BadRequestError('Default is reserved for uncategorized articles');
        if (description !== null && (typeof description !== 'string' || description.length > 2000))
            throw new BadRequestError(`Category description must contain at most 2000 characters (${locale})`);
        result[locale] = { name: name.trim(), description: description as string | null };
    }
    if (!result.en)
        throw new BadRequestError('Default English translation is required');
    return result;
}
