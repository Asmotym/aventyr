import { test, expect } from '@playwright/test';
import { setup } from '../support/articles.fixture';

test('translation tabs copy default blocks independently while preserving translated fields', async ({ page }) => {
  const { saves } = await setup(page);
  const body = () => page.getByRole('textbox', { name: 'Article body' }).filter({ visible: true });
  await expect(page.getByRole('button', { name: 'Copy blocks from Default', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add language', exact: true }).click();
  await page.getByText('French (fr)', { exact: true }).click();
  const copy = page.getByRole('button', { name: 'Copy blocks from Default', exact: true });
  await expect(copy).toBeDisabled();
  await page.getByRole('textbox', { name: /^Title/ }).filter({ visible: true }).fill('Titre français');
  await page.getByRole('textbox', { name: /^Introduction/ }).filter({ visible: true }).fill('Introduction française');
  await page.getByRole('tab', { name: 'Default', exact: true }).click();
  await body().fill('## Shared heading');
  await body().press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('/table'); await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'French (fr)', exact: true }).click();
  await copy.click();
  await expect(body().locator('table')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Title/ }).filter({ visible: true })).toHaveValue('Titre français');
  await expect(page.getByRole('textbox', { name: /^Introduction/ }).filter({ visible: true })).toHaveValue('Introduction française');
  await expect(copy).toBeDisabled();
  await body().locator('p').first().fill('French edits');
  page.once('dialog', dialog => dialog.dismiss());
  await copy.click();
  await expect(body()).toContainText('French edits');
  page.once('dialog', dialog => dialog.accept());
  await copy.click();
  await expect(body()).not.toContainText('French edits');
  await body().locator('p').first().fill('Independent French edits');
  await page.getByRole('tab', { name: 'Default', exact: true }).click();
  await expect(body()).not.toContainText('Independent French edits');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => JSON.stringify(saves.at(-1)?.translations.fr.document)).toContain('Independent French edits');
  expect(JSON.stringify(saves.at(-1)?.translations.en.document)).not.toContain('Independent French edits');
});

test('category selections autosave, restore and publish with the draft', async ({ page }) => {
  const { saves, drafts } = await setup(page);
  const select = page.locator(".article-editor__categories input");
  await select.click(); await page.getByRole('option', { name: 'Guides / Beginner', exact: true }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.selectedCategoryIds).toEqual(['beginner']);
  expect([...drafts.values()][0]?.selectedCategoryIds).toEqual(['beginner']);
  await page.reload();
  await page.getByRole('dialog', { name: 'Choose a draft', exact: true }).getByText('Untitled draft', { exact: true }).click();
  await expect(page.locator(".article-editor__categories")).toContainText('Guides / Beginner');
  const published = page.waitForRequest(request => request.url().endsWith('/api/admin/articles') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await published).postDataJSON().categoryIds).toEqual(['beginner']);
});

test('category assignments can be explicitly cleared in a draft', async ({ page }) => {
  const { saves } = await setup(page);
  const select = page.locator(".article-editor__categories input");
  await select.click(); await page.getByRole('option', { name: 'Guides', exact: true }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.selectedCategoryIds).toEqual(['guides']);
  await select.click(); await page.getByRole('option', { name: 'Guides', exact: true }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.selectedCategoryIds).toEqual([]);
});

test('editor category labels follow app language and preserve selected IDs across language tabs', async ({ page }) => {
  const { saves } = await setup(page);
  await page.locator(".article-editor__categories input").click();
  await page.getByRole('option', { name: 'Guides / Beginner', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add language', exact: true }).click();
  await page.getByText('French (fr)', { exact: true }).click();
  await expect(page.locator(".article-editor__categories")).toContainText('Guides / Beginner');
  await page.getByRole('button', { name: 'en', exact: true }).click();
  await page.getByText('FR', { exact: true }).click();
  await expect(page.locator(".article-editor__categories")).toContainText('Manuels / Débutants');
  await page.getByRole('tab', { name: 'Default', exact: true }).click();
  await expect(page.locator(".article-editor__categories")).toContainText('Manuels / Débutants');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.selectedCategoryIds).toEqual(['beginner']);
});
