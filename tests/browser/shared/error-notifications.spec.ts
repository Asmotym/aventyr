import { test, expect } from '@playwright/test';
import { setupApp } from '../support/app.fixture';
import { setup, navigate } from '../support/rooms.fixture';

test('repeated save failures notify globally without losing the profile draft', async ({ page }) => {
  await setupApp(page);
  await page.route('**/api/users/owner/profile', route => route.fulfill({ status: 500, json: { success: false, error: 'Profile unavailable' } }));
  await page.goto('/settings');
  const about = page.getByLabel('About me', { exact: false });
  await about.fill('Keep this introduction');
  const save = page.getByRole('button', { name: 'Save About Me', exact: true });
  await save.click();
  const notification = page.locator('.v-snackbar').getByRole('alert');
  await expect(notification).toHaveText('Unable to save About Me.');
  await expect(page.locator('.general-settings-panel')).not.toContainText('Unable to save About Me.');
  await expect(about).toHaveValue('Keep this introduction');
  await page.locator('.v-snackbar').getByRole('button', { name: 'Close', exact: true }).click();
  await save.click(); await expect(notification).toHaveText('Unable to save About Me.');
  await expect(about).toHaveValue('Keep this introduction');
});

test('validation errors notify above the active dialog and retain its editable values', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Room settings', exact: true }).click();
  await navigate(page, 'Criticals');
  await page.locator('.critical-add-tile').click();
  const popup = page.locator('.critical-popup');
  await popup.locator('input[type="number"]').fill('90');
  await popup.locator('.critical-popup-footer button').last().click();
  const notification = page.locator('.v-snackbar');
  await expect(notification.getByRole('alert')).toHaveText('A rule with this comparison and number already exists.');
  await expect(popup).toBeVisible();
  await expect(popup.locator('input[type="number"]')).toHaveValue('90');
  await expect(popup.locator('.v-alert')).toHaveCount(0);
  const zIndex = await notification.evaluate(element => Number(getComputedStyle(element).zIndex));
  const dialogZIndex = await popup.evaluate(element => Number(getComputedStyle(element.closest('.v-overlay')!).zIndex));
  expect(zIndex).toBeGreaterThan(dialogZIndex);
});

test('an error notification does not block Escape or focus restoration in a room panel', async ({ page }) => {
  await setup(page, 'dark', 'creator', false, { failActions: ['deleteDice'] });
  const trigger = page.locator('.room-tools-rail').getByRole('button', { name: 'Dices', exact: true });
  await trigger.click();
  const panel = page.locator('.room-tools-panel:visible');
  await panel.locator('.custom-dice-chip').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByText('Remove', { exact: true }).click();
  await expect(page.locator('.v-snackbar').getByRole('alert')).toHaveText('Test mutation failed');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
