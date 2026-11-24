import { test, expect } from '@playwright/test';
import { setup } from '../support/articles.fixture';

test('image library uploads and drops storage URLs into JSON', async ({ page }) => {
  const { saves, deletions } = await setup(page);
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await page.locator('.image-library input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  const image = page.getByRole('button', { name: 'Insert image', exact: true });
  await expect(image.locator('img')).toBeVisible();
  const transfer = await page.evaluateHandle(() => { const data = new DataTransfer(); data.setData('application/x-aventyr-image', '/api/article-images/11111111-1111-4111-a111-111111111111'); return data; });
  await page.locator('.editor-surface').dispatchEvent('drop', { dataTransfer: transfer, clientX: 200, clientY: 400 });
  await expect(page.getByRole('textbox', { name: 'Article body' }).locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => JSON.stringify(saves.at(-1)?.translations)).toContain('/api/article-images/11111111-1111-4111-a111-111111111111');
  expect(JSON.stringify(saves.at(-1)?.translations)).not.toContain('data:image');
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await image.hover();
  await page.getByRole('button', { name: 'Delete image', exact: true }).click();
  await expect(page.getByText('Remove this image from every language and save before deleting it.')).toBeVisible();
  expect(deletions).toEqual([]);
  await expect(image).toBeVisible();
});

test('uploaded image exposes a hover delete overlay and is removed without inserting it', async ({ page }) => {
  const { deletions } = await setup(page);
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await page.locator('.image-library input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  const image = page.getByRole('button', { name: 'Insert image', exact: true });
  await expect(image.locator('img')).toBeVisible();
  const remove = page.getByRole('button', { name: 'Delete image', exact: true });
  await page.getByRole('heading', { name: 'Write article', exact: true }).hover();
  await expect(remove).toBeHidden();
  await image.hover();
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(image).toHaveCount(0);
  expect(deletions).toEqual(['11111111-1111-4111-a111-111111111111']);
  await expect(page.getByRole('textbox', { name: 'Article body' }).locator('img')).toHaveCount(0);
});

test('slash image creates an inline placeholder, prompts for library storage and replaces the block', async ({ page }) => {
  const { saves } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('/image'); await page.keyboard.press('Enter');
  await expect(body.getByRole('button', { name: 'Add an image', exact: true })).toBeVisible();
  const popup = page.getByRole('dialog', { name: 'Add an image', exact: true });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Upload file', exact: true })).toBeVisible();
  await expect(popup.getByRole('textbox')).toHaveCount(0);
  await popup.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  const prompt = page.getByRole('dialog', { name: 'Save to library', exact: true });
  await expect(prompt).toBeVisible();
  const upload = page.waitForRequest(req => req.method() === 'POST' && req.url().includes('/admin/article-images'));
  await prompt.getByRole('button', { name: 'Save to library', exact: true }).click();
  expect(new URL((await upload).url()).searchParams.get('library')).toBe('true');
  await expect(body.locator('img')).toBeVisible();
  await expect(body.locator('.article-image-placeholder')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => JSON.stringify(saves.at(-1)?.translations)).toContain('/api/article-images/');
  expect(JSON.stringify(saves.at(-1)?.translations)).not.toContain('imagePlaceholder');
});

test('scoped image upload stays outside the library and a failed upload can be retried on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await setup(page);
  let attempts = 0;
  await page.route('**/api/admin/article-images?**', async route => {
    if (route.request().method() !== 'POST' || attempts++) return route.fallback();
    await route.fulfill({ status: 500, json: { success: false, error: 'Try the upload again' } });
  });
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('/image'); await page.keyboard.press('Enter');
  const popup = page.getByRole('dialog', { name: 'Add an image', exact: true });
  await expect(popup).toBeVisible();
  const bounds = await popup.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  const file = { name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };
  await popup.locator('input[type="file"]').setInputFiles(file);
  const prompt = page.getByRole('dialog', { name: 'Save to library', exact: true });
  await expect(prompt).toHaveClass(/v-overlay--active/);
  await prompt.getByRole('button', { name: 'Only this article', exact: true }).click();
  await expect(popup.getByText('Try the upload again', { exact: true })).toBeVisible();
  await expect(body.locator('.article-image-placeholder')).toHaveCount(1);
  const upload = page.waitForRequest(req => req.method() === 'POST' && req.url().includes('/admin/article-images'));
  await popup.locator('input[type="file"]').setInputFiles(file);
  await expect(prompt).toHaveClass(/v-overlay--active/);
  await prompt.getByRole('button', { name: 'Only this article', exact: true }).click();
  const request = new URL((await upload).url());
  expect(request.searchParams.get('library')).toBe('false');
  expect(request.searchParams.get('draftId')).toBeTruthy();
  await expect(body.locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await expect(page.getByText('Your image collection starts here.')).toBeVisible();
});
