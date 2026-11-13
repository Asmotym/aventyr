import { apiRequest, toQuery } from './api.service';
export interface ArticleImage { id: string; url: string; canDelete?: boolean }
export class AdminArticleImagesService {
  static async upload(file: File, articleId?: string, draftId?: string, library = false): Promise<ArticleImage> {
    return apiRequest<ArticleImage>(`/admin/article-images${toQuery({ articleId, draftId, library })}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
  }
  static async list(articleId?: string, draftId?: string): Promise<ArticleImage[]> {
    return (await apiRequest<{ images: ArticleImage[] }>(`/admin/article-images${toQuery({ articleId, draftId })}`)).images;
  }
  static async remove(id: string): Promise<void> {
    await apiRequest(`/admin/article-images/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  static async preview(id: string): Promise<string> {
    return (await apiRequest<{ dataUrl: string }>(`/admin/article-images/${encodeURIComponent(id)}`)).dataUrl;
  }
}
