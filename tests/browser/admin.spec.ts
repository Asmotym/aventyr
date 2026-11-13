import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, role = 'owner', locale = 'en', theme = 'dark', themeStyle = 'aventyr') {
  const user = { id: 'owner', username: 'Owner', avatar: '', role, locale, theme, themeStyle };
  await page.addInitScript(({ user, locale, theme, themeStyle }) => localStorage.setItem('aventyr_global_state', JSON.stringify({ version: 1, theme, themeStyle, locale, discord: { user, auth: { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, scope: 'identify', state: 'test', expiresAt: Date.now() + 3600000 } }, ui: {} })), { user, locale, theme, themeStyle });
  const requests: string[] = [];
  const article = { id: 'article', uid: 'UID-article', title: 'Test article', excerpt: 'Preview', status: 'unpublished', createdAt: '2026-11-13T10:00:00Z', tags: [], translations: { en: { title: 'Test article', introduction: '', document: { version: 1, content: { type: 'doc', content: [{ type: 'paragraph' }] } } } }, sanitizedHtml: '<p>Article content</p>' };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(route.request().method() + ' ' + route.request().url());
    let data: unknown = {};
    if (path.endsWith('/discord') || path.includes('/users/owner')) data = user;
    if (path.endsWith('/admin/users')) data = { users: [user, { id: 'other', username: 'Other user', role: 'user' }] };
    if (path.endsWith('/role')) data = { user: { id: 'other', username: 'Other user', role: route.request().postDataJSON().role } };
    if (path.endsWith('/articles/tags')) data = { tags: [{ id: 'news', slug: 'news', name: 'News' }] };
    if (path.endsWith('/admin/articles')) data = { articles: [article] };
    if (path.includes('/articles/detail/')) data = { article };
    if (path.endsWith('/publication')) { article.status = 'published'; data = { article }; }
    if (path.endsWith('/articles/drafts')) data = { drafts: [] };
    await route.fulfill({ json: { success: true, data } });
  });
  return requests;
}

test('desktop sidebar, redirects, nested routes and history', async ({ page }) => {
  await setup(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/users$/);
  const nav = page.getByRole('navigation', { name: 'Administration navigation' });
  await nav.getByRole('link', { name: 'Articles', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(nav.getByRole('link', { name: 'Manage Articles' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Write article', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a draft', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New article', exact: true }).click();
  await expect(nav.getByRole('link', { name: 'Articles', exact: true })).toHaveClass(/v-list-item--active/);
  await expect(nav.getByRole('link', { name: 'Manage Articles' })).not.toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/articles\/write$/);
});

for (const theme of ['dark', 'light']) {
  test(`mobile drawer keyboard, focus, current-route selection and overflow (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, 'owner', 'en', theme);
    await page.goto('/admin/articles');
    const toggle = page.getByRole('button', { name: 'Admin menu', exact: true });
    await expect(toggle).toBeVisible();
    await expect.poll(() => page.locator('h1').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);
    await page.screenshot({ animations: 'disabled', path: `/tmp/admin-rework-mobile-${theme}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await toggle.click();
    const drawer = page.getByRole('dialog', { name: 'Administration navigation' });
    await expect(drawer).toBeVisible();
    await expect.poll(() => page.locator('#admin-mobile-navigation').evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(844);
    await page.screenshot({ animations: 'disabled', path: `/tmp/admin-rework-drawer-${theme}.png` });
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await drawer.getByRole('link', { name: 'Manage Articles' }).click();
    await expect(drawer).not.toBeVisible();
    await toggle.click();
    await drawer.getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(drawer).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('owner can update roles and use existing article actions', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const requests = await setup(page);
  await page.goto('/admin/users');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'admin', exact: true }).click();
  await expect.poll(() => requests.some(r => r.includes('PATCH') && r.includes('/other/role'))).toBe(true);
  await page.goto('/admin/articles');
  await page.getByRole('textbox', { name: 'Search by title' }).fill('test');
  await expect.poll(() => requests.some(r => r.includes('search=test'))).toBe(true);
  await page.getByRole('checkbox', { name: 'Published', exact: true }).uncheck();
  await expect.poll(() => requests.some(r => r.includes('statuses=unpublished'))).toBe(true);
  await page.getByRole('checkbox', { name: 'Archived', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Unarchived', exact: true }).uncheck();
  await expect.poll(() => requests.some(r => r.includes('archived=true'))).toBe(true);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'News' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => requests.some(r => r.includes('tags=news'))).toBe(true);
  await page.getByText('Test article', { exact: true }).click();
  await expect(page.getByText('Article content', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy article UID', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('UID-article');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Article body' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => requests.some(r => r.startsWith('PATCH') && r.endsWith('/admin/articles/article'))).toBe(true);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect.poll(() => requests.some(r => r.includes('POST') && r.includes('/article/archive'))).toBe(true);
});

test('admin restrictions and ordinary-user route guard', async ({ page }) => {
  await setup(page, 'admin');
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await page.goto('/admin/articles');
  await expect(page.getByRole('link', { name: 'Write article', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(0);
  await page.goto('/admin/articles/write');
  await expect(page).toHaveURL('/');
});

test('ordinary users cannot enter administration', async ({ page }) => {
  await setup(page, 'user');
  await page.goto('/admin/users');
  await expect(page).toHaveURL('/');
});

for (const [locale, label, theme, style] of [['en', 'Manage Articles', 'light', 'aventyr'], ['fr', 'Gérer les articles', 'dark', 'arcane'], ['de', 'Artikel verwalten', 'light', 'kingdom'], ['es', 'Gestionar artículos', 'dark', 'campfire']]) {
  test(`navigation renders in ${locale} with ${theme} ${style}`, async ({ page }) => {
    await setup(page, 'owner', locale, theme, style);
    await page.goto('/admin/articles');
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    await expect.poll(() => page.locator('h1').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);
    await page.screenshot({ animations: 'disabled', path: `/tmp/admin-rework-${locale}.png`, fullPage: true });
  });
}
