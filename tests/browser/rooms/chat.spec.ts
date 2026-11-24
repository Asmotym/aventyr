import { test, expect } from '@playwright/test';

import { setup, ownedSession } from '../support/rooms.fixture';

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} room header celebration preserves layout and bonus balance stays by composer`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    let send: ((type: string, extra?: Record<string, unknown>) => void) | undefined;
    await setup(page, 'dark', 'creator', false, { onRealtime: sender => { send = sender; } });
    const room = page.locator('.room-panel-host');
    const bounds = (await room.boundingBox())!;
    expect(bounds.x).toBeCloseTo(15, 0);
    expect(page.viewportSize()!.width - bounds.x - bounds.width).toBeCloseTo(15, 0);
    await expect(page.locator('.room-header .bonus-points-counter')).toHaveCount(0);
    await expect(page.locator('.composer-footer .bonus-points-counter')).toContainText('2');
    const session = ownedSession();
    session.configuration.bonusPoints.enabled = true;
    send!('session.started', { session });
    const banner = page.locator('.session-start-banner');
    await expect(banner).toBeVisible();
    const headerHeight = (await page.locator('.room-header-shell').boundingBox())!.height;
    const conversationY = (await page.locator('.messages-container').boundingBox())!.y;
    await expect(banner).not.toBeVisible({ timeout: 6000 });
    expect((await page.locator('.room-header-shell').boundingBox())!.height).toBeCloseTo(headerHeight, 0);
    expect((await page.locator('.messages-container').boundingBox())!.y).toBeCloseTo(conversationY, 0);
    await expect(page.locator('.room-header')).not.toHaveAttribute('inert');
    await expect(page.locator('.room-tools-rail').getByRole('button', { name: 'Room settings', exact: true })).toBeVisible();
  });
}

for (const theme of ['light', 'dark']) {
  test(`matching critical rolls inherit rule colors and animate once (${theme})`, async ({ page }) => {
    let send: ((type: string, extra?: Record<string, unknown>) => void) | undefined;
    await setup(page, theme, 'creator', false, {
      criticals: [{ diceType: 'd20', enabled: true, operator: 'moreThan', threshold: 18, color: '#336699' }],
      onRealtime: sender => { send = sender; },
    });
    await expect(page.locator('.message-row')).toHaveCount(20);
    await expect(page.locator('.bonus-points-counter')).toContainText('2');
    await expect.poll(() => Boolean(send)).toBe(true);
    const message = { id: 'critical-live', roomId: 'room', userId: 'owner', username: 'Owner', type: 'dice', diceNotation: 'd20', diceTotal: 20, diceRolls: [20], createdAt: new Date().toISOString() };
    send!('message.created', { message });
    const bubble = page.locator('.message-content.has-critical');
    await expect(bubble).toHaveCount(1);
    await expect(bubble).toHaveClass(/is-critical-animating/);
    await expect(bubble.locator('.dice-result__value')).toHaveCSS('background-color', 'rgb(51, 102, 153)');
    await expect(bubble.locator('.dice-result__value')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(bubble).not.toHaveClass(/is-critical-animating/);
    send!('message.updated', { message: { ...message, nickname: 'New name' } });
    await expect(bubble).not.toHaveClass(/is-critical-animating/);
    send!('message.updated', { message: { ...message, diceTotal: 19, diceRolls: [19] } });
    await expect(bubble).toHaveClass(/is-critical-animating/);
    send!('message.updated', { message: { ...message, diceTotal: 10, diceRolls: [10] } });
    await expect(page.locator('.message-content.has-critical')).toHaveCount(0);
    await expect(page.locator('.message-content.is-critical-animating')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    send!('message.created', { message: { ...message, id: 'critical-reduced-motion' } });
    const reduced = page.locator('.message-content.has-critical');
    await expect(reduced.locator('.dice-result__value')).toHaveCSS('animation-name', 'none');
    await expect(reduced.locator('.dice-result__value')).toHaveCSS('background-color', 'rgb(51, 102, 153)');
  });
}

test('chat dice suggestions support keyboard selection, dismissal and clicks', async ({ page }) => {
  const writes = await setup(page);
  const input = page.locator('.chat-input input[type="text"]');
  const options = page.getByRole('option');
  await input.fill('d20 Attack');
  await expect(options).toHaveCount(2);
  await input.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('-2d20 Attack');
  await expect(options).toHaveCount(0);
  expect(writes).toHaveLength(0);

  await input.fill('3d100+5  Skill check');
  await options.first().click();
  await expect(input).toHaveValue('+3d100+5  Skill check');
  await expect(input).toBeFocused();
  await input.fill('2d6-1');
  await input.press('ArrowUp');
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
  await input.press('Escape');
  await expect(options).toHaveCount(0);
  await expect(input).toHaveValue('2d6-1');

  await input.fill('Hello d20');
  await expect(options).toHaveCount(0);
  await input.fill('0d20');
  await expect(options).toHaveCount(0);
  await input.fill('Hello there');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect.poll(() => writes.length).toBe(1);
});
