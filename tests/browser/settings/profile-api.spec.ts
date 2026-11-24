import { test, expect } from '@playwright/test';
import { setupApp } from '../support/app.fixture';

test('profile editing preserves drafts after failure, retries and persists across reload', async ({ page }) => {
  const user = await setupApp(page);
  let fail = true;
  await page.route('**/api/users/owner/profile', async route => {
    if (route.request().method() === 'PATCH') {
      if (fail) { fail = false; await route.fulfill({ status: 500, json: { success: false, error: 'Unavailable' } }); return; }
      user.aboutMe = route.request().postDataJSON().aboutMe;
    }
    await route.fulfill({ json: { success: true, data: { ...user, userId: user.id } } });
  });
  await page.goto('/settings');
  const id = page.getByLabel('Discord ID', { exact: true });
  await expect(id).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show Discord ID', exact: true }).click();
  await expect(id).toHaveAttribute('type', 'text');
  const about = page.getByLabel('About me', { exact: false });
  const save = page.getByRole('button', { name: 'Save About Me', exact: true });
  await expect(save).toBeDisabled();
  await about.fill('Adventure awaits'); await save.click();
  await expect(page.getByText('Unable to save About Me.', { exact: true })).toBeVisible();
  await expect(about).toHaveValue('Adventure awaits'); await save.click();
  await expect(page.getByText('About Me saved.', { exact: true })).toBeVisible();
  await page.reload(); await expect(about).toHaveValue('Adventure awaits');
});

test('API keys generate, reveal, regenerate, cancel revocation and revoke', async ({ page }) => {
  await setupApp(page);
  let key: string | null = null;
  let count = 0;
  await page.route('**/api/users/owner/api-key', async route => {
    if (route.request().method() === 'POST') key = `key-${++count}`;
    if (route.request().method() === 'DELETE') key = null;
    await route.fulfill({ json: { success: true, data: { apiKey: key } } });
  });
  await page.goto('/settings'); await page.getByRole('tab', { name: 'API', exact: true }).click();
  await page.getByRole('button', { name: 'Generate API Key', exact: true }).click();
  const field = page.getByLabel('API Key', { exact: true });
  await expect(field).toHaveValue('key-1'); await expect(field).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide', exact: true }).click(); await expect(field).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show', exact: true }).click(); await expect(field).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Regenerate API Key', exact: true }).click(); await expect(field).toHaveValue('key-2');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Revoke API Key', exact: true }).click(); await expect(field).toHaveValue('key-2');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Revoke API Key', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generate API Key', exact: true })).toBeVisible();
  await expect(field).toHaveValue('');
});
