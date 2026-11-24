import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, { empty = false, theme = 'dark', themeStyle = 'aventyr' } = {}) {
  const user = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme, themeStyle };
  await page.addInitScript(user => localStorage.setItem('aventyr_global_state', JSON.stringify({
    version: 1, locale: user.locale, theme: user.theme, themeStyle: user.themeStyle,
    discord: { user, auth: { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, scope: 'identify', state: 'test', expiresAt: Date.now() + 3600000 } }, ui: {},
  })), user);
  const writes: unknown[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path.endsWith('/discord') || path.includes('/users/owner')) data = user;
    if (path.endsWith('/preferences')) data = user;
    if (path.endsWith('/admin/users')) data = { users: [user, { id: 'other', username: 'Other', role: 'user' }] };
    if (path.endsWith('/role')) {
      const body = route.request().postDataJSON(); writes.push(body);
      data = { user: { id: 'other', username: 'Other', role: body.role } };
    }
    if (path.endsWith('/articles/tags')) data = { tags: empty ? [] : [
      { id: 'news', slug: 'news', name: 'News' }, { id: 'guides', slug: 'guides', name: 'Guides' },
    ] };
    if (path.endsWith('/articles/categories')) data = { categories: [] };
    if (path.endsWith('/admin/articles')) data = { articles: [] };
    await route.fulfill({ json: { success: true, data } });
  });
  return writes;
}

test('shared multiple selector tracks selections, removable chips and clearing', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/articles');
  const field = page.locator('.app-dropdown').getByRole('combobox');
  await field.click();
  await expect(page.getByRole('status').filter({ hasText: '0 selected' })).toBeVisible();
  await page.getByRole('option', { name: 'News', exact: true }).click();
  await page.getByRole('option', { name: 'Guides', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 selected' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'News', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  const chip = page.locator('.app-dropdown .v-chip').filter({ hasText: 'News' });
  await chip.getByRole('button').click();
  await expect(page.locator('.app-dropdown .v-chip')).toHaveCount(1);
  await field.click();
  await expect(page.getByRole('status').filter({ hasText: '1 selected' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.app-dropdown .v-field__clearable').click();
  await expect(page.locator('.app-dropdown .v-chip')).toHaveCount(0);
});

test('single selector supports keyboard selection and persists its value', async ({ page }) => {
  const writes = await setup(page);
  await page.goto('/admin/users');
  const field = page.getByRole('combobox');
  await field.locator('input').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'user', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect.poll(() => writes).toEqual([{ role: 'admin' }]);
  await expect(field.locator('input')).toHaveValue('admin');
});

test('empty selectors provide a useful empty state', async ({ page }) => {
  await setup(page, { empty: true });
  await page.goto('/admin/articles');
  await page.locator('.app-dropdown').getByRole('combobox').click();
  await expect(page.getByText('No options available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
  test(`custom theme previews and menus fit mobile screens (${theme})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, { theme, themeStyle: 'arcane' });
    await page.goto('/settings');
    await page.locator('.theme-select').click();
    const option = page.getByRole('option', { name: 'Arcane', exact: true });
    await expect(option.locator('.theme-color-preview')).toBeVisible();
    await expect(option).toHaveCSS('border-radius', '10px');
    const menu = page.locator('.v-select__content');
    await expect(menu).toHaveCSS('border-radius', '14px');
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('dropdown.png') });
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
  });
}
