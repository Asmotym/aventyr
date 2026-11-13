import type { ArticleTranslations } from 'netlify/core/articles/document';
import type { ArticleDetails, ArticleDraft, ArticleSummary, ArticleTag } from 'netlify/core/types/data.types';
import { apiRequest, toQuery } from './api.service';

export interface ArticleListOptions {
  locale?: string;
  search?: string;
  tags?: string[];
  statuses?: string[];
  archived?: boolean | null;
  limit?: number;
  offset?: number;
}

function queryOptions(options: ArticleListOptions): Record<string, unknown> {
  return { ...options };
}

export class ArticlesService {
  static async listPublicArticles(options: ArticleListOptions = {}): Promise<ArticleSummary[]> {
    const data = await apiRequest<{ articles: ArticleSummary[] }>(`/articles${toQuery(queryOptions(options))}`);
    return data.articles;
  }

  static async listNews(limit = 3, locale = 'en'): Promise<ArticleSummary[]> {
    const data = await apiRequest<{ articles: ArticleSummary[] }>(`/articles/news${toQuery({ limit, locale })}`);
    return data.articles;
  }

  static async getArticle(slug: string, locale = 'en'): Promise<ArticleDetails> {
    const data = await apiRequest<{ article: ArticleDetails }>(`/articles/${encodeURIComponent(slug)}${toQuery({ locale })}`);
    return data.article;
  }

  static async listTags(): Promise<ArticleTag[]> {
    const data = await apiRequest<{ tags: ArticleTag[] }>('/articles/tags');
    return data.tags;
  }
}

export class AdminArticlesService {
  static async listArticles(options: ArticleListOptions = {}): Promise<ArticleSummary[]> {
    const data = await apiRequest<{ articles: ArticleSummary[] }>(`/admin/articles${toQuery(queryOptions(options))}`);
    return data.articles;
  }

  static async getArticle(articleId: string): Promise<ArticleDetails> {
    const data = await apiRequest<{ article: ArticleDetails }>(`/admin/articles/detail/${articleId}`);
    return data.article;
  }

  static async createArticle(payload: { translations: ArticleTranslations; tagIds: string[]; status: 'unpublished' | 'published'; publishedAt?: string | null; draftId?: string }): Promise<ArticleDetails> {
    const data = await apiRequest<{ article: ArticleDetails }>('/admin/articles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.article;
  }

  static async updateArticle(articleId: string, payload: { translations: ArticleTranslations; tagIds: string[] }): Promise<ArticleDetails> {
    const data = await apiRequest<{ article: ArticleDetails }>(`/admin/articles/${articleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.article;
  }

  static async setPublication(articleId: string, published: boolean, publishedAt?: string | null): Promise<ArticleDetails> {
    const data = await apiRequest<{ article: ArticleDetails }>(`/admin/articles/${articleId}/publication`, {
      method: 'POST',
      body: JSON.stringify({ published, publishedAt }),
    });
    return data.article;
  }

  static async archiveArticle(articleId: string): Promise<ArticleDetails> {
    const data = await apiRequest<{ article: ArticleDetails }>(`/admin/articles/${articleId}/archive`, { method: 'POST' });
    return data.article;
  }

  static async createTag(name: string): Promise<ArticleTag> {
    const data = await apiRequest<{ tag: ArticleTag }>('/admin/articles/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return data.tag;
  }

  static async renameTag(tagId: string, name: string): Promise<ArticleTag> {
    const data = await apiRequest<{ tag: ArticleTag }>(`/admin/articles/tags/${tagId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    return data.tag;
  }

  static async deleteTag(tagId: string): Promise<void> {
    await apiRequest<{ tagId: string }>(`/admin/articles/tags/${tagId}`, { method: 'DELETE' });
  }

  static async listDrafts(): Promise<ArticleDraft[]> {
    const data = await apiRequest<{ drafts: ArticleDraft[] }>('/admin/articles/drafts');
    return data.drafts;
  }

  static async previewDraft(id: string): Promise<string> {
    return (await apiRequest<{ html: string }>(`/admin/articles/drafts/${encodeURIComponent(id)}/preview`)).html;
  }

  static async saveDraft(payload: { id?: string; translations: ArticleTranslations; selectedTagIds: string[] }): Promise<ArticleDraft> {
    const data = await apiRequest<{ draft: ArticleDraft }>('/admin/articles/drafts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.draft;
  }

  static async deleteDraft(draftId: string): Promise<void> {
    await apiRequest<{ draftId: string }>(`/admin/articles/drafts/${draftId}`, { method: 'DELETE' });
  }
}
