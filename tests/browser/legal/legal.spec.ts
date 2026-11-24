import { test, expect } from '@playwright/test';
import { setupApp } from '../support/app.fixture';

for (const [path, title] of [['/terms-of-service', 'Terms of Service'], ['/privacy-policy', 'Privacy Policy']]) {
  test(`${title} is readable and accessible without authentication`, async ({ page }) => {
    await setupApp(page, { signedIn: false }); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  });
}
