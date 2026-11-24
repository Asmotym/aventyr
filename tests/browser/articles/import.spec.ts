import { importArticleText } from '../../../server/features/articles/documents/import-text';
import { test, expect } from '@playwright/test';
import { setup } from '../support/articles.fixture';

test('text import replaces selection, supports undo/redo and autosaves JSON', async ({ page }) => {
  const { saves } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('Replace me');
  await body.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Import text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import text', exact: true });
  await dialog.getByRole('textbox', { name: 'Text to import' }).fill('Imported\nline\n\nSecond paragraph');
  await dialog.getByRole('button', { name: 'Import text', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(body).toContainText('Imported');
  await expect(body).not.toContainText('Replace me');
  await expect(body.locator('br')).toHaveCount(1);
  await body.press('ControlOrMeta+z');
  await expect(body).toHaveText('Replace me');
  await body.press('ControlOrMeta+Shift+z');
  await expect(body).toContainText('Second paragraph');
  await expect.poll(() => JSON.stringify(saves.at(-1)?.translations.en.document), { timeout: 15000 }).toContain('Imported');
});

test('file import detects Markdown and leaves default language unchanged', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Add language', exact: true }).click();
  await page.getByText('French (fr)', { exact: true }).click();
  await page.getByRole('button', { name: 'Import text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import text', exact: true });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'article.md', mimeType: 'text/markdown', buffer: Buffer.from('# Imported heading\n\n- Item') });
  await expect(dialog.getByRole('textbox', { name: 'Text to import' })).toHaveValue('# Imported heading\n\n- Item');
  await dialog.getByRole('button', { name: 'Import text', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Article body' }).locator('h1')).toHaveText('Imported heading');
  await page.getByRole('tab', { name: 'Default', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Article body' })).not.toContainText('Imported heading');
});

test('clipboard failure permits manual paste; cancel and conversion errors preserve content', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.reject(new Error('denied')) } }));
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('Original');
  await page.getByRole('button', { name: 'Import text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import text', exact: true });
  await dialog.getByRole('button', { name: 'Read clipboard' }).click();
  await expect(page.locator('.v-snackbar')).toContainText('Paste text');
  await dialog.getByRole('textbox', { name: 'Text to import' }).fill('Manual input');
  await page.route('**/api/admin/articles/import-text', route => route.fulfill({ status: 400, json: { success: false, error: 'Conversion failed' } }));
  await dialog.getByRole('button', { name: 'Import text', exact: true }).click();
  await expect(page.locator('.v-snackbar')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Text to import' })).toHaveValue('Manual input');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(body).toHaveText('Original');
});

test('clipboard and file imports detect Markdown automatically at the cursor', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => '# Detected heading' } }));
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('BeforeAfter');
  await body.press('Home');
  for (let i = 0; i < 6; i++) await body.press('ArrowRight');
  await page.getByRole('button', { name: 'Import text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import text', exact: true });
  await dialog.getByRole('button', { name: 'Read clipboard' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Text to import' })).toHaveValue('# Detected heading');
  await dialog.getByRole('button', { name: 'Import text', exact: true }).click();
  await expect(body).toContainText('Before');
  await expect(body).toContainText('Detected heading');
  await expect(body).toContainText('After');
  await expect(body.locator('h1')).toHaveText('Detected heading');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Import text', exact: true }).click();
  await dialog.locator('input[type=file]').setInputFiles({ name: 'plain.txt', mimeType: 'text/markdown', buffer: Buffer.from('**Detected bold**') });
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Text to import' })).toHaveValue('**Detected bold**');
  await dialog.getByRole('button', { name: 'Import text', exact: true }).click();
  await expect(body.locator('strong')).toHaveText('Detected bold');
});

test('invalid UTF-8 and oversized combined documents fail without mutation', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  const original = 'a'.repeat(130000);
  await body.fill(original);
  await body.press('ControlOrMeta+End');
  await page.getByRole('button', { name: 'Import text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import text', exact: true });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from([0xff, 0xfe, 0xff]) });
  await expect(page.locator('.v-snackbar')).toContainText('UTF-8');
  await dialog.getByRole('textbox', { name: 'Text to import' }).fill('b'.repeat(130000));
  await dialog.getByRole('button', { name: 'Import text', exact: true }).click();
  await expect(page.locator('.v-snackbar')).toContainText('oversized');
  await expect(body).toHaveText(original);
});

test('closing an import ignores a late conversion response', async ({ page }) => {
  await setup(page);
  let resolveRequest!: () => void;
  const pending = new Promise<void>(resolve => { resolveRequest = resolve; });
  let requested = false;
  await page.route('**/api/admin/articles/import-text', async route => {
    requested = true;
    await pending;
    await route.fulfill({ json: { success: true, data: { document: importArticleText({ text: 'Late text' }) } } });
  });
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('Original');
  await page.getByRole('button', { name: 'Import text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import text', exact: true });
  await dialog.getByRole('textbox', { name: 'Text to import' }).fill('Late text');
  await dialog.getByRole('button', { name: 'Import text', exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const response = page.waitForResponse('**/api/admin/articles/import-text');
  resolveRequest(); await response;
  await expect(body).toHaveText('Original');
});
