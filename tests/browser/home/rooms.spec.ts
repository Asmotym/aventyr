import { test, expect } from '@playwright/test';

import { setup } from '../support/rooms.fixture';

for (const mobile of [false, true]) {
  for (const destination of ['Home', 'Articles', 'Administration']) {
    test(`${mobile ? 'mobile' : 'desktop'} navigation to ${destination} retains the latest room shortcut`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await setup(page);
      if (mobile) {
        await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
        await page.locator('.mobile-menu-card').getByRole('link', { name: destination, exact: true }).click();
      } else {
        await page.locator('.desktop-navigation').getByRole('link', { name: destination, exact: true }).click();
      }
      await expect(page).not.toHaveURL(/\/rooms\/room/);
      if (mobile) {
        await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
        const shortcut = page.locator('.mobile-menu-card').getByRole('link', { name: 'Test room', exact: true });
        await expect(shortcut).toHaveAttribute('href', '/rooms/room');
        await shortcut.click();
      } else {
        const shortcut = page.locator('.desktop-navigation').getByRole('link', { name: 'Test room', exact: true });
        await expect(shortcut).toHaveAttribute('href', '/rooms/room');
        await shortcut.click();
      }
      await expect(page).toHaveURL(/\/rooms\/room/);
      await expect(page.getByRole('button', { name: 'Room settings', exact: true })).toBeVisible();
    });
  }
}

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} home rooms scroll above pinned actions and open entry dialogs`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await setup(page, 'dark', 'creator', false, { roomCount: 40 });
    if (mobile) {
      await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
      await page.locator('.mobile-menu-card').getByRole('link', { name: 'Home', exact: true }).click();
    } else await page.locator('.desktop-navigation').getByRole('link', { name: 'Home', exact: true }).click();
    if (mobile) {
      await expect(page.locator('.rooms-sidebar')).not.toBeVisible();
      await page.getByRole('button', { name: 'Open rooms', exact: true }).click();
      const mobileRooms = page.getByRole('dialog', { name: 'Rooms', exact: true });
      await expect(mobileRooms).toBeVisible();
      await expect(mobileRooms.locator('.v-overlay__content')).not.toHaveClass(/-enter-active/);
    }
    const sidebar = page.locator('.rooms-sidebar');
    const actions = sidebar.locator('.rooms-sidebar__actions');
    await expect(sidebar.getByText('Adventure 38', { exact: true })).toHaveCount(1);
    const scroll = sidebar.locator('.rooms-list > .v-card-text');
    expect(await scroll.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect.poll(async () => { const box = (await actions.boundingBox())!; return box.y + box.height; }).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    const before = await actions.boundingBox();
    expect(before!.y + before!.height).toBeLessThanOrEqual((page.viewportSize()!.height) + 1);
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect(Math.abs((await actions.boundingBox())!.y - before!.y)).toBeLessThanOrEqual(1);
    await actions.getByRole('button', { name: 'Create room', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Create a room', exact: true });
    await expect(dialog.getByRole('heading', { name: 'Create a room', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create room', exact: true })).toBeDisabled();
    await dialog.getByLabel('Room name', { exact: true }).fill('New adventure');
    await expect(dialog.getByRole('button', { name: 'Create room', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog.locator('.room-entry-dialog')).toBeHidden();
    await actions.getByRole('button', { name: 'Join room', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Join via invite', exact: true });
    await expect(dialog.getByRole('heading', { name: 'Join via invite', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Join room', exact: true })).toBeDisabled();
    await dialog.getByLabel('Invite code', { exact: true }).fill('ABC123');
    await expect(dialog.getByRole('button', { name: 'Join room', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog.locator('.room-entry-dialog')).toBeHidden();
    if (mobile) {
      await page.getByRole('dialog', { name: 'Rooms', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.locator('.mobile-rooms-view')).toBeHidden();
      await expect(page.locator('.home-hub')).toBeVisible();
      await page.getByRole('button', { name: 'Open rooms', exact: true }).click();
      await sidebar.getByText('Test room', { exact: true }).click();
      await expect(page).toHaveURL(/\/rooms\/room/);
      await expect(page.getByRole('dialog', { name: 'Rooms', exact: true })).toHaveCount(0);
    }
  });
}

test('room favorites move first, persist on reload, and do not navigate into the room', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const writes = await setup(page, 'dark', 'creator', false, { roomCount: 12 });
  await page.locator('.desktop-navigation').getByRole('link', { name: 'Home', exact: true }).click();
  const list = page.locator('.rooms-list');
  await list.getByRole('button', { name: 'Favorite Adventure 8', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(list.locator('.v-list-item').first()).toContainText('Adventure 8');
  expect(writes.find(write => write.action === 'setRoomFavorite')?.payload.favorite).toBe(true);
  await page.reload();
  await expect(list.locator('.v-list-item').first()).toContainText('Adventure 8');
  await list.getByRole('button', { name: 'Remove Adventure 8 from favorites', exact: true }).click();
  await expect(list.locator('.v-list-item').first()).toContainText('Test room');
  const panel = page.locator('.home-hub');
  const scroll = panel.locator('.home-hub__scroll');
  await expect(scroll).toHaveCSS('overflow-y', 'auto');
  const sidebarBox = (await page.locator('.rooms-sidebar').boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.height).toBeCloseTo(sidebarBox.height, 0);
});
