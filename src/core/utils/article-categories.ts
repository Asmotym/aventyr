import type { ArticleCategory } from 'netlify/core/types/data.types';

export function categoryOptions(categories: ArticleCategory[]): Array<ArticleCategory & { label: string; depth: number }> {
  const result: Array<ArticleCategory & { label: string; depth: number }> = [];
  const visited = new Set<string>();
  function visit(parentId: string | null, path: string[], depth: number) {
    for (const category of categories.filter(item => item.parentId === parentId).sort((a, b) => a.position - b.position || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))) {
      if (visited.has(category.id)) continue;
      visited.add(category.id);
      const names = [...path, category.name];
      result.push({ ...category, label: names.join(' / '), depth });
      visit(category.id, names, depth + 1);
    }
  }
  visit(null, [], 0);
  return result;
}

export function categoryPath(categories: ArticleCategory[], id: string): string {
  const segments: string[] = [];
  const seen = new Set<string>();
  let category = categories.find(item => item.id === id);
  while (category && !seen.has(category.id)) {
    seen.add(category.id);
    segments.unshift(category.urlSegment ?? `${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${category.id}`);
    category = categories.find(item => item.id === category!.parentId);
  }
  return '/articles/' + segments.map(encodeURIComponent).join('/');
}
export function articleCategorySegment(article: { categories?: ArticleCategory[] }): string {
  const category = article.categories?.[0];
  return category ? category.urlSegment ?? `${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${category.id}` : 'default';
}
