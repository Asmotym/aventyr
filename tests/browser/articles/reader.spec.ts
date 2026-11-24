import { test, expect } from '@playwright/test';

test('public language switching selects whole translations and displays English fallback', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'fr'));
  const locales: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/articles/example')) return route.fulfill({ json: { success: true, data: {} } });
    const requested = url.searchParams.get('locale') ?? 'en'; locales.push(requested);
    const resolved = requested === 'fr' ? 'fr' : 'en';
    await route.fulfill({ json: { success: true, data: { article: { id: 'example', slug: 'example', title: resolved === 'fr' ? 'Titre français' : 'English title', introduction: 'Intro', sanitizedHtml: `<p>${resolved === 'fr' ? 'Bonjour' : 'Hello'}</p>`, tags: [], requestedLocale: requested, resolvedLocale: resolved, availableLocales: ['en','fr'] } } } });
  });
  await page.goto('/article/default/example');
  await expect(page.getByText('Titre français', { exact: true })).toBeVisible();
  await expect(page.locator('.article-card')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'fr', exact: true }).click();
  await page.getByText('DE', { exact: true }).click();
  await expect(page.getByText('English title', { exact: true })).toBeVisible();
  await expect(page.getByText('Dieser Artikel ist nicht in deiner Sprache verfügbar. Die englische Version wird angezeigt.')).toBeVisible();
  await expect(page.locator('.article-card')).toHaveAttribute('lang', 'en');
  expect(locales).toEqual(['fr','de']);
});
