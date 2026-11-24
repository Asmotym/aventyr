import { importArticleText } from '../../../server/core/articles/import-text';
import { test, expect, type Page } from '@playwright/test';

export const empty = () => ({ version: 1, content: { type: 'doc', content: [{ type: 'paragraph' }] } });

export async function setup(page: Page, chooseNew = true) {
  await page.addInitScript(() => localStorage.setItem('aventyr_global_state', JSON.stringify({ version: 1, theme: 'dark', themeStyle: 'default', locale: 'en', discord: { user: { id: 'owner', username: 'Owner', avatar: '', role: 'owner' }, auth: { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, expiresAt: Date.now() + 3600000, scope: 'identify', state: 'test' } }, ui: {} })));
  const drafts = new Map<string, Record<string, unknown>>();
  const saves: Record<string, any>[] = [];
  const tags: Array<{ id: string; name: string; slug: string }> = [];
  const categories = [{ id: 'guides', name: 'Guides', parentId: null, position: 0 }, { id: 'beginner', name: 'Beginner', parentId: 'guides', position: 0 }];
  const images: Array<{ id: string; url: string; library?: boolean }> = [];
  const deletions: string[] = [];
  const colors = { recent: [] as string[], custom: [] as string[] };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown = {};
    if (path.endsWith('/articles/import-text')) {
      try { data = { document: importArticleText(route.request().postDataJSON()) }; }
      catch (error) { await route.fulfill({ status: 400, json: { success: false, error: error instanceof Error ? error.message : 'Import failed' } }); return; }
    }
    if (path.endsWith('/discord') || path.includes('/users/owner')) data = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme: 'dark', themeStyle: 'default' };
    if (path.endsWith('/editor-colors')) {
      if (route.request().method() === 'POST') {
        const color = route.request().postDataJSON().color as string;
        const key = ['#9b9b9b','#a8795a','#e28a43','#d6b64c','#6b9e78','#6395cf','#a381c4','#d27ca5','#da7272','#eeeeee'].includes(color) ? 'recent' : 'custom';
        colors[key] = [color, ...colors[key].filter(c => c !== color)].slice(0, 8);
      }
      data = colors;
    }
    if (path.endsWith('/articles/categories')) data = { categories: categories.map(c => ({ ...c, name: url.searchParams.get('locale') === 'fr' ? ({ guides: 'Manuels', beginner: 'Débutants' }[c.id]) : c.name })) };
    if (path.endsWith('/articles/tags')) {
      if (route.request().method() === 'POST') {
        const name = route.request().postDataJSON().name;
        const tag = { id: `tag-${tags.length + 1}`, name, slug: name.toLowerCase() }; tags.push(tag); data = { tag };
      } else data = { tags };
    }
    if (path.includes('/admin/articles/tags/')) {
      const index = tags.findIndex(tag => tag.id === path.split('/').at(-1));
      if (route.request().method() === 'PATCH') { tags[index].name = route.request().postDataJSON().name; data = { tag: tags[index] }; }
      if (route.request().method() === 'DELETE') tags.splice(index, 1);
    }
    if (path.endsWith('/article-images')) {
      if (route.request().method() === 'POST') {
        const image = { library: url.searchParams.get('library') === 'true', id: '11111111-1111-4111-a111-111111111111', url: '/api/article-images/11111111-1111-4111-a111-111111111111' };
        images.push(image); data = image;
      } else data = { images: images.filter(image => image.library) };
    }
    if (path.includes('/admin/article-images/') && route.request().method() === 'DELETE') {
      const id = path.split('/').at(-1)!; deletions.push(id);
      const index = images.findIndex(image => image.id === id);
      if (index >= 0) images.splice(index, 1);
    }
    if (path.includes('/admin/article-images/') && route.request().method() !== 'DELETE') data = { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=' };
    if (path.endsWith('/articles/drafts')) {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON();
        saves.push(payload);
        const id = payload.id ?? `draft-${drafts.size + 1}`;
        data = { ...payload, id, uid: `UID-${id}`, ownerId: 'owner', title: payload.translations?.en?.title ?? '', introduction: payload.translations?.en?.introduction ?? '', updatedAt: '2026-11-13T10:30:00Z', translations: payload.translations ?? { en: { title: '', introduction: '', document: empty() } } };
        drafts.set(id, data as Record<string, unknown>);
        data = { draft: data };
      } else data = { drafts: [...drafts.values()] };
    }
    if (/\/articles\/drafts\/[^/]+\/preview$/.test(path)) data = { html: '<h2>Rendered section</h2><p>Saved <strong>body text</strong>.</p><ul><li>A list item</li></ul>' };
    if (path.endsWith('/articles') && route.request().method() === 'POST') data = { article: { id: 'article', uid: 'UID-article', slug: 'article' } };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/admin/articles/write');
  await expect(page.getByRole('dialog', { name: 'Choose a draft', exact: true })).toBeVisible();
  if (chooseNew) await page.getByRole('button', { name: 'New article', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Default', exact: true })).toBeVisible();
  return { saves, drafts, deletions, colors, tags };
}

export async function openTableActions(page: Page, axis: 'row' | 'column', row = 1, column = 0) {
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.locator('tr').nth(row).locator('td,th').nth(column).hover({ position: { x: 12, y: 10 } });
  await page.getByRole('button', { name: axis === 'row' ? 'Row actions' : 'Column actions', exact: true }).click();
  await expect(page.locator('.table-axis-outline')).toBeVisible();
}
