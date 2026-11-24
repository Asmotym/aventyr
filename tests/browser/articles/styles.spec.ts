import { test, expect } from '@playwright/test';
import { setup } from '../support/articles.fixture';

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`article editor styling (${theme}, ${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, true, theme);
    await page.getByRole('textbox', { name: /^Title/ }).fill('A guide for adventurers');
    await page.getByRole('textbox', { name: 'Article body' }).fill('A paragraph with room for a new adventure.');
    await page.getByRole('textbox', { name: 'Article body' }).blur();
    await expect(page).toHaveScreenshot(`article-editor-${theme}-${width}.png`, { animations: 'disabled' });
  });
}
