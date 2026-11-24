import { test, expect, type Page } from '@playwright/test';

test.use({ locale: 'en-US' });

async function setup(page: Page, options: {
  stored?: string | null;
  profile?: string | null;
  guest?: boolean;
  delayAccount?: Promise<void>;
  failSave?: boolean;
} = {}) {
  const user = { id: 'language-user', username: 'Language User', avatar: '', role: 'user', theme: 'dark', themeStyle: 'aventyr', locale: options.profile ?? null };
  const writes: string[] = [];
  let failSave = options.failSave;
  await page.addInitScript(({ user, stored, guest }) => {
    if (localStorage.getItem('aventyr_global_state')) return;
    localStorage.setItem('aventyr_global_state', JSON.stringify({
      version: 1, theme: 'dark', themeStyle: 'aventyr', locale: stored,
      discord: {
        user: guest ? null : user,
        auth: guest ? null : { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, expiresAt: Date.now() + 3600000, scope: 'identify', state: 'test' },
        oauthState: null,
      }, ui: {},
    }));
  }, { user, stored: options.stored ?? null, guest: options.guest ?? false });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path.endsWith('/discord')) {
      const snapshot = { ...user };
      await options.delayAccount;
      data = snapshot;
    } else if (path.endsWith('/preferences')) {
      if (route.request().method() === 'PATCH') {
        const locale = route.request().postDataJSON().locale;
        if (locale) {
          writes.push(locale);
          if (failSave) {
            failSave = false;
            await route.fulfill({ status: 500, json: { success: false, error: 'Unable to save' } });
            return;
          }
          user.locale = locale;
        }
      }
      data = { locale: user.locale, theme: user.theme, themeStyle: user.themeStyle, articleSort: 'newest' };
    } else if (path.endsWith('/articles/tags')) data = { tags: [] };
    else if (path.endsWith('/articles/categories')) data = { categories: [] };
    else if (path.includes('/articles')) data = { articles: [] };
    await route.fulfill({ json: { success: true, data } });
  });
  return { user, writes };
}

async function cachedLocale(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('aventyr_global_state')!).locale);
}

for (const choice of ['keep', 'browser']) {
  test(`one-time choice: ${choice}, keyboard selection and reload`, async ({ page }) => {
    const { writes } = await setup(page, { stored: 'fr' });
    await page.goto('/articles');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName('Choisissez votre langue');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    const button = dialog.getByRole('button', { name: choice === 'keep' ? 'Conserver Français' : 'Utiliser English' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible();
    const selected = choice === 'keep' ? 'fr' : 'en';
    await expect(page.locator('html')).toHaveAttribute('lang', selected);
    expect(await cachedLocale(page)).toBe(selected);
    expect(writes).toEqual([selected]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', selected);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(writes).toEqual([selected]);
  });
}

test('cached locale renders first; fresh profile wins without prompting or writing', async ({ page }) => {
  let release!: () => void;
  const delayAccount = new Promise<void>(resolve => { release = resolve; });
  const { writes } = await setup(page, { stored: 'fr', profile: 'de', delayAccount });
  await page.goto('/articles');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(writes).toEqual([]);
  release();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  expect(await cachedLocale(page)).toBe('de');
  expect(writes).toEqual([]);
});

for (const stored of [null, 'en']) {
  test(`missing profile with ${stored} cache saves detection without prompting`, async ({ page }) => {
    const { writes } = await setup(page, { stored });
    await page.goto('/articles');
    await expect.poll(() => writes).toEqual(['en']);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(await cachedLocale(page)).toBe('en');
  });
}

test('failed confirmation remains open and retries successfully', async ({ page }) => {
  const { writes } = await setup(page, { stored: 'fr', failSave: true });
  await page.goto('/articles');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Utiliser English' }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be saved');
  await dialog.getByRole('button', { name: 'Use English' }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toEqual(['en', 'en']);
});

test('guest detection and manual changes persist across reload without profile requests', async ({ page }) => {
  const { writes } = await setup(page, { guest: true });
  await page.goto('/articles');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await cachedLocale(page)).toBe('en');
  await page.locator('.language-switcher').first().click();
  await page.getByText('ES', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  expect(writes).toEqual([]);
});

test('manual change while loading account wins over the earlier response', async ({ page }) => {
  let release!: () => void;
  const delayAccount = new Promise<void>(resolve => { release = resolve; });
  const { writes } = await setup(page, { stored: 'fr', profile: 'de', delayAccount });
  await page.goto('/articles');
  await page.locator('.language-switcher').first().click();
  await page.getByText('ES', { exact: true }).click();
  await expect.poll(() => writes).toEqual(['es']);
  const accountResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api/discord'));
  release();
  await accountResponse;
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  expect(await cachedLocale(page)).toBe('es');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('aventyr_global_state')!).discord.user.locale)).toBe('es');
});

for (const failSave of [false, true]) {
  test(`signed-in manual change ${failSave ? 'reports failed profile save' : 'updates the profile'}`, async ({ page }) => {
    const { writes } = await setup(page, { stored: 'en', profile: 'en', failSave });
    await page.goto('/articles');
    await page.locator('.language-switcher').first().click();
    await page.getByText('ES', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect.poll(() => writes).toEqual(['es']);
    expect(await cachedLocale(page)).toBe('es');
    if (failSave) await expect(page.locator('.v-snackbar')).toBeVisible();
    else await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('aventyr_global_state')!).discord.user.locale)).toBe('es');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', failSave ? 'en' : 'es');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
}
