import type { AppLocale } from '../accounts/locale.types';
import type { ArticleTranslations } from './document';
export type ArticleStatus = 'draft' | 'unpublished' | 'published';
export const ARTICLE_SORTS = ['newest', 'oldest', 'title-asc', 'title-desc'] as const;
export type ArticleSort = typeof ARTICLE_SORTS[number];
export function isArticleSort(value: unknown): value is ArticleSort {
    return ARTICLE_SORTS.includes(value as ArticleSort);
}
export interface ArticleCategoryTranslation {
    name: string;
    description: string | null;
}
export type ArticleCategoryTranslations = Partial<Record<AppLocale, ArticleCategoryTranslation>>;
export interface ArticleCategory {
    translations?: ArticleCategoryTranslations;
    urlSegment?: string;
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    position: number;
    createdAt?: string;
    updatedAt?: string;
    articleCount?: number;
    draftCount?: number;
}
export interface ArticleTag {
    id: string;
    name: string;
    slug: string;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}
export interface ArticleSummary {
    requestedLocale?: AppLocale;
    resolvedLocale?: AppLocale;
    availableLocales?: AppLocale[];
    id: string;
    uid: string;
    slug: string;
    title: string;
    introduction: string;
    excerpt: string;
    status: ArticleStatus;
    authorId?: string | null;
    authorName?: string | null;
    publishedAt?: string | null;
    archivedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    tags: ArticleTag[];
    categories: ArticleCategory[];
}
export interface ArticleDetails extends ArticleSummary {
    translations?: ArticleTranslations;
    markdownSource?: string;
    sanitizedHtml: string;
}
export interface ArticleDraft {
    translations?: ArticleTranslations;
    id: string;
    uid: string;
    ownerId: string;
    title?: string | null;
    introduction?: string | null;
    markdownSource: string;
    selectedTagIds: string[];
    selectedCategoryIds: string[];
    createdAt?: string;
    updatedAt?: string;
}
