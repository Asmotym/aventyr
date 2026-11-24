import { test, expect } from '@playwright/test';
import { setupApp } from '../support/app.fixture';
import { setup as setupRoom } from '../support/rooms.fixture';

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`settings appearance (${theme}, ${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupApp(page, { theme }); await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`settings-${theme}-${width}.png`, { animations: 'disabled' });
  });
  test(`room settings appearance (${theme}, ${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupRoom(page, theme);
    await page.getByRole('button', { name: 'Room settings', exact: true }).click();
    const panel = page.locator('.room-slide-panel:visible');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveScreenshot(`room-settings-${theme}-${width}.png`, { animations: 'disabled' });
  });
}
