import { test, expect } from '@playwright/test';
import { setup, navigate } from '../support/rooms.fixture';

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`bag and profile styling (${theme}, ${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, theme);
    await page.getByRole('button', { name: "Open Owner's profile", exact: true }).last().click();
    await expect(page.locator('.profile-popup:visible')).toHaveScreenshot(`profile-${theme}-${width}.png`, { animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Bag', exact: true }).click();
    const bag = page.getByRole('dialog', { name: 'Bag', exact: true });
    await expect(bag.getByRole('button', { name: 'Add item', exact: true })).toBeVisible();
    await expect(bag).toHaveScreenshot(`bag-${theme}-${width}.png`, { animations: 'disabled' });
    await bag.getByRole('button', { name: 'Add item', exact: true }).click();
    const editor = page.locator(".bag-editor__dialog");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveScreenshot(`bag-editor-${theme}-${width}.png`, { animations: 'disabled' });
  });
  test(`talent viewer and editor styling (${theme}, ${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, theme, 'creator', false, { talents: true });
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.locator('.room-slide-panel:visible');
    await expect(viewer.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible();
    await expect(viewer).toHaveScreenshot(`talent-viewer-${theme}-${width}.png`, { animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Room settings', exact: true }).click();
    await navigate(page, 'Talent Trees');
    await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    await expect(editor).toBeVisible();
    await expect(editor).toHaveScreenshot(`talent-editor-${theme}-${width}.png`, { animations: 'disabled' });
  });
}
