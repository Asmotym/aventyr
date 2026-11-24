import { test, expect } from '@playwright/test';

import { setup, ownedSession, tools, openTools } from '../support/rooms.fixture';

for (const mobile of [false, true]) {
  for (const theme of ['light', 'dark']) {
    test(`room tools overlay chat and preserve drafts (${mobile ? 'mobile' : 'desktop'}, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await setup(page, theme, 'creator', false, { diceCount: 60 });
      const input = page.locator('.chat-input').getByRole('textbox'); await input.fill('Keep this draft');
      const messages = page.locator('.messages-container');
      const scrollTop = await messages.evaluate(el => el.scrollTop);
      const chatBounds = await messages.boundingBox();
      await openTools(page);
      await expect(tools(page)).toHaveAttribute('aria-modal', 'true');
      await expect(tools(page)).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(tools(page).locator('button:visible:not([disabled])').last()).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(tools(page).getByRole('button', { name: 'Close', exact: true })).toBeFocused();
      const host = await page.locator('.room-panel-host').boundingBox(), bounds = await tools(page).boundingBox();
      expect(bounds!.width).toBeCloseTo(mobile ? host!.width : 468, 0);
      expect(bounds!.x + bounds!.width).toBeCloseTo(host!.x + host!.width, 0);
      expect((await messages.boundingBox())!.width).toBeCloseTo(chatBounds!.width, 0);
      const list = tools(page).locator('.dice-panel-scroll');
      expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
      await list.evaluate(el => el.scrollTop = el.scrollHeight);
      await expect(tools(page).getByRole('button', { name: 'Add category', exact: true })).toBeInViewport();
      await page.screenshot({ path: info.outputPath(`tools-${theme}-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' });
      await page.locator('.room-tools-rail').getByRole('button', { name: 'Roll Awards', exact: true }).click();
      await expect(tools(page).getByText('Start a session to see owned Roll Awards.')).toBeVisible();
      await page.keyboard.press('Escape'); await expect(tools(page)).toHaveCount(0);
      await expect(page.locator('.room-tools-rail').getByRole('button', { name: 'Dices', exact: true })).toBeFocused();
      await expect(input).toHaveValue('Keep this draft');
      expect(await messages.evaluate(el => el.scrollTop)).toBe(scrollTop);
    });
  }
  test(`dice shortcuts share editors and preserve the tools panel (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes = await setup(page, 'dark', 'creator', false, { diceCount: 0 });
    await openTools(page);
    const dialog = page.locator('.dice-management-dialog');
    await tools(page).getByRole('button', { name: 'Add category', exact: true }).click();
    await dialog.locator('input').first().fill('Magic');
    await dialog.getByRole('button', { name: 'Create category', exact: true }).click();
    await expect.poll(() => writes.filter(w => w.action === 'createDiceCategory').length).toBe(1);
    await expect(dialog.getByRole('button', { name: 'Create category', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(tools(page)).toBeVisible();
    await tools(page).getByRole('button', { name: 'Add dice', exact: true }).click();
    await dialog.locator('input').first().fill('d6');
    await dialog.getByRole('button', { name: 'Add dice', exact: true }).click();
    await expect.poll(() => writes.filter(w => w.action === 'createDice').length).toBe(1);
    await expect(dialog.getByRole('button', { name: 'Add dice', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape'); await expect(tools(page).getByText('d6', { exact: true })).toBeVisible();
    await tools(page).getByRole('button', { name: 'Manage dices & categories', exact: true }).click();
    await expect(tools(page)).toHaveCount(0);
    await expect(page.locator('.room-slide-panel:visible .dice-workshop')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Bag', exact: true }).click();
    await expect(page.locator('.room-slide-panel:visible')).toHaveCount(1);
  });
  test(`dice menus edit, validate, confirm removal, and roll explicitly (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes = await setup(page, 'dark', 'creator', true, { session: ownedSession() });
    await openTools(page);
    const chip = tools(page).locator('.custom-dice-chip').first();
    await chip.click(); await expect(page.getByText('Modify', { exact: true })).toBeVisible(); expect(writes).toHaveLength(0);
    await page.getByText('Modify', { exact: true }).click();
    const dialog = page.locator('.dice-management-dialog');
    await expect(dialog.locator('input').first()).toHaveValue('d20');
    await dialog.locator('input').first().fill('bad'); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeVisible(); expect(writes).toHaveLength(0);
    page.once('dialog', d => d.dismiss()); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill('2d20'); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).not.toBeVisible(); await expect(chip).toContainText('2d20');
    await chip.click(); page.once('dialog', d => d.dismiss()); await page.getByText('Remove', { exact: true }).click();
    expect(writes.filter(w => w.action === 'deleteDice')).toHaveLength(0);
    await expect(page.getByText('Remove', { exact: true })).not.toBeVisible();
    await chip.click(); await page.getByText('Roll', { exact: true }).click();
    await expect.poll(() => writes.filter(w => w.action === 'message').length).toBe(1);
    await chip.click(); page.once('dialog', d => d.accept()); await page.getByText('Remove', { exact: true }).click();
    await expect(chip).toHaveCount(0); expect(writes.filter(w => w.action === 'deleteDice')).toHaveLength(1);
  });
}

test('room tools respect permission overrides and show mutation failures', async ({ page }) => {
  await setup(page, 'dark', 'player', false, { permissionOverrides: { manageDice: false, manageDiceCategories: false, viewRollAwards: false } });
  await expect(page.locator('.room-tools-rail').getByRole('button', { name: 'Roll Awards' })).toHaveCount(0);
  await openTools(page);
  await expect(tools(page).getByRole('button', { name: 'Add dice', exact: true })).toHaveCount(0);
  await expect(tools(page).getByRole('button', { name: 'Add category', exact: true })).toHaveCount(0);
  await tools(page).locator('.custom-dice-chip').click();
  await expect(page.getByText('Roll', { exact: true })).toBeVisible();
  await expect(page.getByText('Modify', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Remove', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await setup(page, 'dark', 'creator', false, { failActions: ['deleteDice'] });
  await openTools(page); await tools(page).locator('.custom-dice-chip').click();
  page.once('dialog', d => d.accept()); await page.getByText('Remove', { exact: true }).click();
  await expect(tools(page).getByRole('alert')).toContainText('Test mutation failed');
  await expect(tools(page).locator('.custom-dice-chip')).toHaveCount(1);
});

test('Escape preserves a dice draft until discard is confirmed', async ({ page }) => {
  await setup(page);
  await openTools(page);
  await tools(page).getByRole('button', { name: 'Add dice', exact: true }).click();
  const dialog = page.locator('.dice-management-dialog');
  await dialog.locator('input').first().fill('d12');
  page.once('dialog', d => d.dismiss());
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input').first()).toHaveValue('d12');
  page.once('dialog', d => d.accept());
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(dialog).not.toBeVisible(); await expect(tools(page)).toBeVisible();
});

test('only the tools panel moves while opening, and its backdrop closes either panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  const room = page.locator('.room-panel-host');
  const initial = await room.boundingBox();
  const chatInitial = await page.locator('.room-chat-panel').boundingBox();
  await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('.room-panel-host')!;
    const chat = document.querySelector<HTMLElement>('.room-chat-panel')!;
    const frames: Array<{ x: number; scroll: number; panelTransform: string }> = [];
    (window as any).roomPanelFrames = frames;
    const record = () => {
      frames.push({ x: chat.getBoundingClientRect().x, scroll: host.scrollLeft, panelTransform: getComputedStyle(document.querySelector('.room-tools-panel')!).transform });
      if (frames.length < 60) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await openTools(page);
  await expect(tools(page)).not.toHaveClass(/room-slide-enter-active/);
  const frames = await page.evaluate(() => (window as any).roomPanelFrames as Array<{ x: number; scroll: number; panelTransform: string }>);
  expect(frames.length).toBeGreaterThan(2);
  expect(frames.some(frame => frame.panelTransform !== 'none')).toBe(true);
  for (const frame of frames) { expect(frame.scroll).toBe(0); expect(frame.x).toBeCloseTo(chatInitial!.x, 0); }
  expect((await room.boundingBox())!.x).toBeCloseTo(initial!.x, 0);
  for (const name of ['Dices', 'Roll Awards', 'Open room test tools']) {
    if (name !== 'Dices') await openTools(page, name);
    const heading = tools(page).locator('.tools-heading');
    await expect(heading.getByRole('button')).toHaveCount(1);
    await heading.getByRole('heading').click();
    await expect(tools(page)).toBeVisible();
    await page.locator('.room-panel-backdrop:visible').click({ position: { x: 20, y: 20 } });
    await expect(tools(page)).toHaveCount(0);
    await expect(page.locator('.room-panel-backdrop:visible')).toHaveCount(0);
    await expect(page).toHaveURL(/\/rooms\/room$/);
  }
});

for (const mobile of [false, true]) {
  test(`room test tools use the shared panel and keep send-as actions (${mobile ? 'mobile' : 'desktop'})`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes = await setup(page, 'dark', 'creator', true, { session: ownedSession() });
    await openTools(page, 'Open room test tools');
    await expect(tools(page).getByRole('heading', { name: 'Room test tools', exact: true })).toBeVisible();
    await expect(page.locator('.v-dialog .room-dev-test-panel')).toHaveCount(0);
    await expect(page.locator('.room-slide-panel:visible')).toHaveCount(1);
    const body = tools(page).locator('.room-dev-test-panel');
    await expect(body).toBeVisible();
    const notice = body.getByRole('alert').first();
    expect(await notice.evaluate(el => {
      const box = el.getBoundingClientRect();
      const content = el.querySelector('.v-alert__content')!.getBoundingClientRect();
      return content.top >= box.top && content.bottom <= box.bottom && el.scrollHeight <= el.clientHeight + 1;
    })).toBe(true);
    await page.screenshot({ path: info.outputPath(`dev-notice-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' });
    await body.getByRole('textbox', { name: /^Message/ }).fill('Testing from the panel');
    await body.getByRole('button', { name: 'Send as member', exact: true }).click();
    await expect.poll(() => writes.filter(w => w.action === 'message').length).toBe(1);
    expect(writes.find(w => w.action === 'message').payload).toMatchObject({ userId: 'friend', type: 'text', content: 'Testing from the panel' });
    const notation = body.getByRole('textbox', { name: /^Dice notation/ });
    await notation.fill('bad');
    await body.getByRole('button', { name: 'Roll as member', exact: true }).click();
    await expect(body.getByText('Enter a valid dice notation, such as 1d20+3.')).toBeVisible();
    expect(writes.filter(w => w.action === 'message')).toHaveLength(1);
    await notation.fill('d6');
    await body.getByRole('button', { name: 'Roll as member', exact: true }).click();
    await expect.poll(() => writes.filter(w => w.action === 'message').length).toBe(2);
    expect(writes.filter(w => w.action === 'message')[1].payload).toMatchObject({ userId: 'friend', type: 'dice', dice: { notation: 'd6' } });
    await page.locator('.room-tools-rail').getByRole('button', { name: 'Dices', exact: true }).click();
    await expect(body).not.toBeVisible();
    await expect(tools(page).locator('.dice-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tools(page)).toHaveCount(0);
    await expect(page.locator('.room-tools-rail').getByRole('button', { name: 'Open room test tools', exact: true })).toBeFocused();
  });
}
