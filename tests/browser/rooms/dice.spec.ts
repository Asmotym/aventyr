import { test, expect } from '@playwright/test';

import { setup, navigate } from '../support/rooms.fixture';

for (const mobile of [false, true]) {
  test(`dice management opens focused ${mobile ? 'mobile sheets' : 'desktop dialogs'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await setup(page); await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Dices');
    const panel = page.locator('.room-slide-panel:visible');
    await panel.getByRole('button', { name: 'Manage categories', exact: true }).click();
    const dialog = page.locator(".room-dice-management-dialog__management-dialog");
    await expect(dialog.getByRole('heading', { name: 'Manage categories', exact: true })).toBeVisible();
    await expect(dialog.locator('input').last()).toHaveValue('Combat');
    if (mobile) { const bounds = await dialog.boundingBox(); expect(bounds!.width).toBe(390); }
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(dialog).not.toBeVisible(); await expect(panel).toBeVisible();
    await panel.locator(".room-settings-dice-tab__management-toolbar button").first().click();
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill('2d20');
    page.once('dialog', d => d.dismiss()); await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(dialog).toBeVisible();
    page.once('dialog', d => d.accept()); await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(dialog).not.toBeVisible(); await expect(panel).toBeVisible();
  });
}

for (const mobile of [false, true]) {
  test(`dice editing uses a ${mobile ? 'mobile sheet' : 'desktop popup'} and saves back to its card`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes = await setup(page);
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Dices');
    const card = page.locator('.custom-dice-card').first();
    await card.getByRole('button', { name: 'Edit item', exact: true }).click();
    const dialog = page.locator(".room-dice-management-dialog__management-dialog");
    await expect(dialog.locator('input').first()).toHaveValue('d20');
    await expect(card.locator('input')).toHaveCount(0);
    await dialog.locator('input').first().fill('bad');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeVisible(); expect(writes).toHaveLength(0);
    await dialog.locator('input').first().fill('2d20');
    page.once('dialog', d => d.dismiss()); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).not.toBeVisible(); await expect(card.getByText('2d20', { exact: true })).toBeVisible();
    expect(writes[0].action).toBe('updateDice');
  });
}
