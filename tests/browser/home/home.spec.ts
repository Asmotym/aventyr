import { test, expect } from '@playwright/test';
import { setupApp } from '../support/app.fixture';

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`guest home and navigation preserve layout (${theme}, ${width}px)`, async ({ page }) => {
    await setupApp(page, { signedIn: false, theme });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByText('Login with Discord', { exact: true })).toBeVisible();
    await expect(page.locator('.news-section')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator(".news-section__empty")).toBeVisible();
    await expect(page).toHaveScreenshot(`guest-${theme}-${width}.png`, { animations: 'disabled' });
    if (width < 960) await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
    await page.getByRole('link', { name: 'Articles', exact: true }).click();
    await expect(page).toHaveURL(/\/articles$/);
  });
}

for (const themeStyle of ['aventyr', 'arcane', 'explorer', 'kingdom', 'campfire']) {
  test(`authenticated home restores identity and theme (${themeStyle})`, async ({ page }) => {
    await setupApp(page, { themeStyle }); await page.goto('/');
    await expect(page.locator('.home-hub__username')).toHaveText('Owner');
    await expect(page.locator('.v-application')).toHaveClass(new RegExp(`v-theme--${themeStyle}Dark`));
    await page.reload(); await expect(page.locator('.home-hub__username')).toHaveText('Owner');
  });
}
