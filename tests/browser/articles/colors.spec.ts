import { test, expect } from '@playwright/test';
import { setup } from '../support/articles.fixture';

test('text palette preserves selection and stores recent preset and custom colors across reloads', async ({ page }) => {
  const { colors } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('Colorful story'); await body.press('ControlOrMeta+a');
  const openPalette = () => page.locator('.selection-tools').getByRole('button', { name: 'Text color', exact: true }).click();
  await openPalette();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(body.locator('span[style*="color"]')).toHaveText('Colorful story');
  await expect.poll(() => colors.recent).toEqual(['#6395cf']);
  await openPalette();
  await page.getByText('Choose a custom color', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).fill('#123456');
  await page.locator('.article-color-palette').getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => colors.custom).toEqual(['#123456']);
  await page.reload();
  await page.getByRole('button', { name: 'New article', exact: true }).click();
  await body.fill('Another article'); await body.press('ControlOrMeta+a');
  await openPalette();
  await expect(page.getByRole('heading', { name: 'Recent', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Custom', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '#6395cf', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '#123456', exact: true })).toBeVisible();
});

test('clicking the block grip opens whole-block colors and delete without reordering', async ({ page }) => {
  const { saves } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await page.keyboard.type('First text'); await page.keyboard.press('Enter'); await page.keyboard.type('Second text');
  const openBlock = async () => {
    await body.locator('p').first().hover({ position: { x: 2, y: 4 } });
    await page.getByRole('button', { name: 'Drag block', exact: true }).click();
  };
  await openBlock();
  const menu = page.getByRole('menu', { name: 'Block actions', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await menu.getByRole('menuitem', { name: 'Color', exact: true }).click();
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(body.locator('p').first()).toHaveAttribute('data-background-color', '#6395cf');
  await expect(body.locator('p').nth(1)).not.toHaveAttribute('data-background-color');
  await openBlock();
  await menu.getByRole('menuitem', { name: 'Color', exact: true }).click();
  await page.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(body.locator('p').first()).toHaveAttribute('data-text-color', '#da7272');
  await expect(body.locator('p').first().locator('span')).toHaveText('First text');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.translations.en.document.content.content[0].attrs.backgroundColor).toBe('#6395cf');
  await openBlock();
  await menu.getByRole('menuitem', { name: 'Delete block', exact: true }).click();
  await expect(body.locator('p')).toHaveCount(1);
  await expect(body).toHaveText('Second text');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(body.locator('p').first()).toHaveText('First text');
  await expect(body.locator('p').first()).toHaveAttribute('data-background-color', '#6395cf');
});

test('non-text block menu offers delete without a color action', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await page.keyboard.type('/divider'); await page.keyboard.press('Enter');
  await body.locator('hr').hover({ position: { x: 2, y: 0 } });
  const grip = page.getByRole('button', { name: 'Drag block', exact: true });
  await grip.focus(); await grip.press('Enter');
  const menu = page.getByRole('menu', { name: 'Block actions', exact: true });
  await expect(menu.getByRole('menuitem')).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: 'Color', exact: true })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Delete block', exact: true }).click();
  await expect(body.locator('hr')).toHaveCount(0);
  await expect(page.locator('.editor-content')).toHaveClass(/is-empty/);
});
