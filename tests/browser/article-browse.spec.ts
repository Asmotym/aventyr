import { test, expect, type Page } from '@playwright/test';

const category = (id: string, name: string, parentId: string | null = null, position = 0) => ({ id, name, description: null as string | null, parentId, position, articleCount: 0, draftCount: 0 });
const article = (index: number) => ({ id: `a${index}`, uid: `UID-${index}`, slug: `article-${index}`, title: `Article ${String(index).padStart(2, '0')}`, introduction: `Introduction for article ${index}. ${'Useful reading about adventures. '.repeat(8)}`, tags: [], categories: [], status: 'published', publishedAt: '2026-01-01', resolvedLocale: 'en', createdAt: '2026-01-01', sanitizedHtml: '<p>Article body</p>' });
async function setup(page: Page, role: 'owner' | 'admin' | 'user' | 'guest' = 'owner') {
  await page.addInitScript(({ role }) => {
    localStorage.setItem('aventyr_global_state', JSON.stringify({ version: 1, theme: 'dark', themeStyle: 'default', locale: 'en', discord: role === 'guest' ? {} : { user: { id: role, username: role, avatar: '', role }, auth: { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, state: 'test', expiresAt: Date.now() + 3600000, scope: 'identify' } }, ui: {} }));
  }, { role });
  const categories = [category('root', 'Guides'), category('child', 'Beginners', 'root'), category('other', 'Stories', null, 1)];
  const rows = Array.from({ length: 12 }, (_, i) => article(i));
  const requests: URL[] = [];
  const writes: any[] = [];
  const categoryWrites: any[] = [];
  let savedSort = 'newest';
  let failNext = false;
  let slowSearch = '';
  let slowPreference = false;
  let preferenceRequests = 0;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; const method = route.request().method();
    let data: any = {};
    if (path.endsWith('/discord') || path.includes(`/users/${role}`)) data = { id: role, username: role, avatar: '', role, locale: 'en', theme: 'dark', themeStyle: 'default' };
    if (path.endsWith('/preferences')) {
      preferenceRequests++;
      const responseSort = savedSort;
      if (method === 'PATCH') { const body = route.request().postDataJSON(); writes.push(body); savedSort = body.articleSort ?? savedSort; }
      if (method === 'GET' && slowPreference) await new Promise(resolve => setTimeout(resolve, 1000));
      data = { theme: 'dark', themeStyle: 'default', locale: 'en', articleSort: method === 'PATCH' ? savedSort : responseSort };
    }
    if (path.endsWith('/articles/tags')) data = { tags: [{ id: 'news', name: 'News', slug: 'news' }] };
    if (path.endsWith('/articles/categories/order')) {
      const body = route.request().postDataJSON(); categoryWrites.push({ method, ...body });
      body.ids.forEach((id: string, position: number) => { categories.find(c => c.id === id)!.position = position; });
    } else if (path.endsWith('/articles/categories')) {
      if (method === 'POST') { const body = route.request().postDataJSON(); categoryWrites.push({ method, ...body }); const created = { ...category(`c${categories.length}`, body.name, body.parentId, categories.length), description: body.description }; categories.push(created); data = { category: created }; }
      else data = { categories };
    } else if (path.includes('/admin/articles/categories/')) {
      const id = path.split('/').at(-1)!; const body = route.request().postDataJSON(); categoryWrites.push({ method, id, ...body });
      if (method === 'DELETE') { categories.splice(categories.findIndex(c => c.id === id), 1); }
      if (method === 'PATCH') { Object.assign(categories.find(c => c.id === id)!, body); data = { category: categories.find(c => c.id === id) }; }
    }
    if (path.endsWith('/articles') && method === 'GET') {
      requests.push(url);
      if (failNext) { failNext = false; return route.fulfill({ status: 500, json: { success: false, error: 'Temporary listing failure' } }); }
      if (url.searchParams.get('search') === slowSearch && slowSearch) await new Promise(resolve => setTimeout(resolve, 800));
      const search = url.searchParams.get('search') ?? '';
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const sort = url.searchParams.get('sort') ?? 'newest';
      let matching = rows.filter(row => row.title.toLowerCase().includes(search.toLowerCase()));
      if (sort === 'oldest' || sort === 'title-desc') matching = [...matching].reverse();
      data = { articles: matching.slice(offset, offset + Number(url.searchParams.get('limit') ?? 5)) };
    }
    if (/\/articles\/article-\d+$/.test(path)) data = { article: rows.find(row => row.slug === path.split('/').at(-1)) };
    await route.fulfill({ json: { success: true, data } });
  });
  return { categories, requests, writes, categoryWrites, setFail: () => { failNext = true; }, setSlowSearch: (value: string) => { slowSearch = value; }, setSlowPreference: () => { slowPreference = true; }, preferenceRequests: () => preferenceRequests };
}

async function chooseSort(page: Page, value: string) {
  const labels: Record<string, string> = { newest: 'Newest first', oldest: 'Oldest first', 'title-asc': 'Title A–Z', 'title-desc': 'Title Z–A' };
  await page.locator('.sort-field').click();
  await page.getByRole('option', { name: labels[value], exact: true }).click();
}

test('five initial articles, infinite loading and an end state', async ({ page }, testInfo) => {
  const api = await setup(page); await page.goto('/articles');
  await expect(page.locator('.browse-article')).toHaveCount(5);
  const searchBounds = await page.locator('.search-field').boundingBox();
  const sortBounds = await page.locator('.sort-field .v-field').boundingBox();
  expect(searchBounds).not.toBeNull(); expect(sortBounds).not.toBeNull();
  expect(Math.abs(searchBounds!.height - sortBounds!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(searchBounds!.y - sortBounds!.y)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('article-listing.png') });
  expect(api.requests[0]!.searchParams.get('limit')).toBe('5');
  await page.locator('.feed-sentinel').scrollIntoViewIfNeeded();
  await expect(page.locator('.browse-article')).toHaveCount(10);
  await page.locator('.feed-sentinel').scrollIntoViewIfNeeded();
  await expect(page.locator('.browse-article')).toHaveCount(12);
  await expect(page.getByText('You have reached the end.')).toBeVisible();
  expect(api.requests.map(url => url.searchParams.get('offset'))).toEqual(['0', '5', '10']);
});

test('category, tags, debounced search and locale reach the same list request', async ({ page }, testInfo) => {
  const api = await setup(page); await page.goto('/articles');
  await page.getByRole('button', { name: 'Guides / Beginners', exact: true }).click();
  await page.locator('.browse-sidebar .v-select').click();
  const newsOption = page.getByRole('option', { name: 'News', exact: true });
  await expect(newsOption.locator('.mdi-pound')).toBeVisible();
  await newsOption.click();
  await expect(newsOption).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.article-filter-tag-menu')).toContainText('1 selected');
  await page.screenshot({ path: testInfo.outputPath('tag-filter.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Search by title' }).fill('Article 01');
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('search')).toBe('Article 01');
  const request = api.requests.at(-1)!;
  expect(request.searchParams.get('categoryId')).toBe('child');
  expect(request.searchParams.get('tags')).toBe('news');
  expect(request.searchParams.get('locale')).toBe('en');
  expect(request.searchParams.get('offset')).toBe('0');
  await expect(page.locator('.browse-article')).toHaveCount(1);
  await page.getByRole('button', { name: 'en', exact: true }).click();
  await page.getByText('FR', { exact: true }).click();
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('locale')).toBe('fr');
  expect(api.requests.at(-1)!.searchParams.get('search')).toBe('Article 01');
  expect(api.requests.at(-1)!.searchParams.get('categoryId')).toBe('child');
});

test('autocomplete displays introduction, supports arrows, Escape and Enter navigation', async ({ page }) => {
  await setup(page); await page.goto('/articles');
  const search = page.getByRole('combobox', { name: 'Search by title' });
  await search.fill('Article 0');
  await expect(page.getByRole('listbox', { name: 'Article suggestions' })).toBeVisible();
  await expect(page.locator('#article-suggestions [role=option]')).toHaveCount(5);
  await expect(page.locator('#article-suggestions')).toContainText('Introduction for article 0.');
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'article-suggestion-0');
  await search.press('Escape'); await expect(page.locator('#article-suggestions')).toHaveCount(0);
  await search.press('ArrowUp'); await expect(search).toHaveAttribute('aria-activedescendant', 'article-suggestion-4');
  await search.press('Enter'); await expect(page).toHaveURL(/\/article\/default\/article-4$/);
});

test('autocomplete mouse selection and no-results state', async ({ page }) => {
  await setup(page); await page.goto('/articles');
  const search = page.getByRole('combobox', { name: 'Search by title' });
  await search.fill('no matches'); await expect(page.getByText('No matching articles.')).toBeVisible();
  await search.fill('Article 01');
  await page.locator('#article-suggestions [role=option]').click();
  await expect(page).toHaveURL(/\/article\/default\/article-1$/);
});

test('ignores a stale search response and retries a failed page', async ({ page }) => {
  const api = await setup(page); await page.goto('/articles');
  await expect(page.locator('.browse-article')).toHaveCount(5);
  api.setSlowSearch('Article 01');
  const search = page.getByRole('combobox', { name: 'Search by title' });
  await search.fill('Article 01');
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('search')).toBe('Article 01');
  await search.fill('Article 02');
  await expect(page.locator('.browse-article h2')).toHaveText('Article 02');
  await page.waitForTimeout(850);
  await expect(page.locator('.browse-article h2')).toHaveText('Article 02');
  api.setFail(); await search.fill('Article 03');
  await expect(page.getByText('Temporary listing failure')).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.browse-article h2')).toHaveText('Article 03');
});

test('sort saves to the account, restores on reload and resists stale preferences', async ({ page }) => {
  const api = await setup(page); api.setSlowPreference(); await page.goto('/articles');
  const select = page.locator('.sort-field input');
  await page.locator('.sort-field').click();
  for (const icon of ['mdi-sort-calendar-descending', 'mdi-sort-calendar-ascending', 'mdi-sort-alphabetical-ascending', 'mdi-sort-alphabetical-descending']) {
    await expect(page.getByRole('option').locator(`.${icon}`)).toBeVisible();
  }
  await page.getByRole('option', { name: 'Title Z–A', exact: true }).click();
  await expect.poll(() => api.writes.at(-1)?.articleSort).toBe('title-desc');
  await page.waitForTimeout(1100); await expect(select).toHaveValue('title-desc');
  await page.reload(); await expect(select).toHaveValue('title-desc');
  await chooseSort(page, 'oldest');
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('sort')).toBe('oldest');
  await chooseSort(page, 'title-asc');
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('sort')).toBe('title-asc');
  await chooseSort(page, 'newest');
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('sort')).toBe('newest');
});

test('guest sorting uses local storage and mobile filters stay usable', async ({ page }) => {
  const api = await setup(page, 'guest'); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/articles');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
  await dialog.getByRole('button', { name: 'Guides / Beginners', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('categoryId')).toBe('child');
  await chooseSort(page, 'oldest');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('aventyr_article_sort:guest'))).toBe('oldest');
  await page.reload(); await expect(page.locator('.sort-field input')).toHaveValue('oldest');
  const searchBounds = await page.locator('.search-field').boundingBox();
  const sortBounds = await page.locator('.sort-field .v-field').boundingBox();
  expect(Math.abs(searchBounds!.height - sortBounds!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(searchBounds!.width - sortBounds!.width)).toBeLessThanOrEqual(1);
  expect(api.writes).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('owner manages categories, parent choices, ordering and migration prompts', async ({ page }) => {
  const api = await setup(page); await page.goto('/admin/articles/categories');
  await expect(page.getByRole('link', { name: 'Manage Categories', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Resources');
  await dialog.getByRole('textbox', { name: 'Description (optional)' }).fill('Reference material');
  await dialog.locator('.category-parent').click(); await page.getByRole('option', { name: 'Guides / Beginners' }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.category-row')).toHaveCount(4);
  expect(api.categoryWrites.at(-1)).toMatchObject({ method: 'POST', name: 'Resources', parentId: 'child' });
  await page.getByRole('button', { name: 'Edit Guides', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('.category-parent').click();
  await expect(page.getByRole('option', { name: 'Guides / Beginners' })).toHaveCount(0);
  await page.keyboard.press('Escape'); await dialog.getByRole('textbox', { name: 'Name' }).fill('Handbook');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Handbook', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Move Stories up', exact: true }).click();
  await expect.poll(() => api.categoryWrites.at(-1)?.ids?.[0]).toBe('other');
  await page.locator('.category-row').filter({ has: page.getByRole('button', { name: 'Edit Stories', exact: true }) }).dragTo(page.locator('.category-row').filter({ has: page.getByRole('button', { name: 'Edit Handbook', exact: true }) }));
  await expect.poll(() => api.categoryWrites.at(-1)?.ids?.[0]).toBe('root');
  api.categories.find(c => c.id === 'root')!.articleCount = 2;
  await page.reload();
  await page.getByRole('button', { name: 'Delete Handbook', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Delete category', exact: true })).toBeDisabled();
  await dialog.locator('.category-replacement').click(); await page.getByRole('option', { name: 'Stories', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();
  await expect.poll(() => api.categoryWrites.at(-1)?.replacementCategoryId).toBe('other');
});

test('admins cannot open category management', async ({ page }) => {
  await setup(page, 'admin'); await page.goto('/admin/articles');
  await expect(page.getByRole('link', { name: 'Manage Categories', exact: true })).toHaveCount(0);
  await page.goto('/admin/articles/categories');
  await expect(page).not.toHaveURL(/\/admin\/articles\/categories$/);
});

test('account preference failures keep browsing usable and caches isolated', async ({ page }) => {
  const api = await setup(page);
  await page.addInitScript(() => {
    localStorage.setItem('aventyr_article_sort:guest', 'oldest');
    localStorage.setItem('aventyr_article_sort:someone-else', 'title-desc');
    localStorage.setItem('aventyr_article_sort:owner', 'title-asc');
  });
  await page.route('**/api/users/owner/preferences', route => route.fulfill({ status: 503, json: { success: false, error: 'Account unavailable' } }));
  await page.goto('/articles');
  const sort = page.locator('.sort-field input');
  await expect(sort).toHaveValue('title-asc');
  await expect(page.getByText('Your sort preference is saved in this browser.', { exact: false })).toBeVisible();
  await chooseSort(page, 'oldest');
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('sort')).toBe('oldest');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('aventyr_article_sort:owner'))).toBe('oldest');
  expect(await page.evaluate(() => localStorage.getItem('aventyr_article_sort:someone-else'))).toBe('title-desc');
});

for (const theme of ['dark', 'light']) {
  test(`article reader preserves rich content and fits desktop/mobile (${theme})`, async ({ page }, testInfo) => {
    const api = await setup(page, 'guest');
    api.categories.push(category('worlds', 'World building'));
    await page.addInitScript(theme => {
      const state = JSON.parse(localStorage.getItem('aventyr_global_state') ?? '{}');
      state.theme = theme; localStorage.setItem('aventyr_global_state', JSON.stringify(state));
    }, theme);
    const title = 'A practical guide to building worlds your players will remember';
    await page.route('**/api/articles/reader-preview*', route => route.fulfill({ json: { success: true, data: { article: {
      ...article(0), title, authorName: 'Aventyr team', introduction: 'Start with a place, a mystery, and a reason to care. Here are some ideas to bring your next adventure to life.',
      requestedLocale: 'en', resolvedLocale: 'en', tags: [{ id: 'guides', name: 'Guides' }], categories: [category('worlds', 'World building')],
      sanitizedHtml: '<h2>Start with a question</h2><p>Give your players something to discover. <a href="https://example.com">Explore the details</a> at their own pace.</p><blockquote><p>Leave space for surprises around the table.</p></blockquote><h3>Build on the answers</h3><ul><li>A place to call home</li><li>A secret to uncover</li></ul><pre><code>A very long code example '.concat('world-building '.repeat(35), '</code></pre><table style="width:1200px"><tr><th>Location</th><th>Mystery</th></tr><tr><td>The old tower</td><td>A light in the window</td></tr></table>')
    } } } }));
    await page.goto('/article/world-building-worlds/reader-preview');
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('.reader-introduction')).toContainText('Start with a place');
    await expect(page.locator('.reader-metadata')).toContainText('Aventyr team');
    await expect(page.locator('.reader-categories')).toContainText('World building');
    await expect(page.locator('.reader-footer')).toContainText('Guides');
    await expect(page.getByRole('heading', { name: 'Start with a question' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('reader-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('reader-mobile.png') });
    await page.locator('.reader-categories').getByRole('link', { name: 'World building' }).click();
    await expect(page).toHaveURL(/\/articles\/world-building-worlds$/);
  });
}

test('category URLs select nested filters and invalid paths redirect to all articles', async ({ page }) => {
  const api = await setup(page, 'guest');
  await page.goto('/articles/guides-root/beginners-child');
  await expect(page.getByRole('button', { name: 'Guides / Beginners', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('categoryId')).toBe('child');
  await page.reload();
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('categoryId')).toBe('child');
  await page.goto('/articles/beginners-child');
  await expect(page).toHaveURL(/\/articles$/);
  await page.goto('/articles/guides-root/nonexistent');
  await expect(page).toHaveURL(/\/articles$/);
});
