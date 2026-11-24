import { test, expect } from '@playwright/test';

import { setup, navigate, ownedSession, tools, openTools } from '../support/rooms.fixture';

for (const mobile of [false, true]) {
  test(`award gallery opens a ${mobile ? 'mobile sheet' : 'desktop popup'} for creation and editing`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await setup(page, 'dark', 'creator', true);
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Roll Awards');
    const gallery = page.locator('.awards-gallery');
    await expect(gallery.getByText('Lucky twenty', { exact: true })).toBeVisible();
    await expect(gallery.locator('.v-expansion-panel')).toHaveCount(0);
    await gallery.locator('.award-create-tile').click();
    const popup = page.locator('.award-popup'); await expect(popup).toBeVisible();
    if (mobile) expect((await popup.boundingBox())!.width).toBe(390);
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(popup).not.toBeVisible();
    await gallery.getByRole('button', { name: 'Edit item', exact: true }).click();
    await expect(popup.locator('input').last()).toHaveValue('Lucky twenty');
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(popup).not.toBeVisible();
  });
}

for (const mobile of [false, true]) {
  test(`members awards popup lists chips above its pinned footer (${mobile ? 'mobile' : 'desktop'})`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const session = ownedSession();
    let sendEvent!: (type: string, extra?: Record<string, unknown>) => void;
    const writes = await setup(page, 'dark', 'player', true, { session, onRealtime: send => { sendEvent = send; } });
    await openTools(page, 'Roll Awards');
    await expect(tools(page).getByRole('combobox')).toHaveCount(0);
    await expect(tools(page).getByText('My trophy', { exact: true })).toBeVisible();
    await expect(tools(page).getByText('Mage trophy', { exact: true })).toHaveCount(0);
    const membersButton = tools(page).getByRole('button', { name: 'Members Roll Awards', exact: true });
    await expect(membersButton).toBeInViewport();
    await membersButton.click();
    const popup = page.getByRole('region', { name: 'Members Roll Awards', exact: true });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('heading', { name: 'Owner', exact: true })).toBeVisible();
    await expect(popup.getByRole('heading', { name: 'Mage (Friend)', exact: true })).toBeVisible();
    await expect(popup.locator('.member-awards').filter({ has: page.getByRole('heading', { name: 'Empty', exact: true }) })).toContainText('No Roll Awards');
    await expect(popup.getByRole('button', { name: 'Use', exact: true })).toHaveCount(0);
    const popupBounds = await popup.boundingBox(), buttonBounds = await membersButton.boundingBox();
    expect(popupBounds!.y + popupBounds!.height).toBeLessThanOrEqual(buttonBounds!.y);
    expect(popupBounds!.x).toBeGreaterThanOrEqual(0);
    expect(popupBounds!.x + popupBounds!.width).toBeLessThanOrEqual(mobile ? 390 : 1440);
    await page.screenshot({ path: info.outputPath(`members-awards-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' });
    await popup.getByText('Mage trophy', { exact: true }).hover();
    await expect(page.locator('.v-tooltip.v-overlay--active')).toContainText('An award description.');
    await page.mouse.move(10, 10);
    await sendEvent('member.removed', { userId: 'friend', memberCount: 2 });
    await expect(popup.getByRole('heading', { name: 'Mage (Friend)', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape'); await expect(popup).not.toBeVisible();
    await expect(tools(page)).toBeVisible();
    await tools(page).getByRole('button', { name: 'Use', exact: true }).click();
    await expect(tools(page).getByRole('button', { name: 'Use', exact: true })).toBeDisabled();
    expect(writes.filter(w => w.action === 'useRollAward')).toHaveLength(1);
    await membersButton.click();
    await expect(popup.locator('.v-chip').filter({ hasText: 'My trophy' })).toHaveAttribute('aria-label', /Used/);
    session.ownedAwards = [];
    sendEvent('session.updated', { session });
    await expect(popup.locator('.v-chip')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(tools(page).getByText('You do not own any Roll Awards in this session.')).toBeVisible();
    sendEvent('session.closed', { session: { ...session, endedAt: new Date().toISOString(), closeReason: 'manual' } });
    await expect(tools(page).getByText('Start a session to see owned Roll Awards.')).toBeVisible();
  });
}
