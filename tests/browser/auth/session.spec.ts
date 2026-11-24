import { test, expect } from '@playwright/test';
import { setupApp } from '../support/app.fixture';

test('restored authentication can log out and clears persisted credentials', async ({ page }) => {
  await setupApp(page); await page.goto('/');
  await expect(page.locator('.home-hub__username')).toHaveText('Owner');
  await page.locator('.desktop-actions .discord-auth .user-section button').click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByText('Login with Discord', { exact: true })).toBeVisible();
  const discord = await page.evaluate(() => JSON.parse(localStorage.getItem('aventyr_global_state')!).discord);
  expect(discord.auth).toBeNull(); expect(discord.user).toBeNull();
  await page.reload(); await expect(page.getByText('Login with Discord', { exact: true })).toBeVisible();
});
