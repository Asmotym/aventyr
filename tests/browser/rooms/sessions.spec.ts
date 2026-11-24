import { test, expect } from '@playwright/test';

import { setup, ownedSession } from '../support/rooms.fixture';

for (const mobile of [false, true]) for (const theme of ['light', 'dark']) {
  test(`session recap browser, bag counters and legacy history (${theme}, ${mobile ? 'mobile' : 'desktop'})`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const active = ownedSession();
    (active.recap as any).bag = { version: 1, team: { created: 12, edited: 3, deleted: 2, gifted: 1 }, personal: { created: 5, edited: 0, deleted: 0, gifted: 2 } };
    const history = Array.from({ length: 30 }, (_, i) => ({ ...ownedSession(), id: `closed-${i}`, startedAt: new Date(1700000000000 - i * 3600000).toISOString(), endedAt: new Date(1700000100000 - i * 3600000).toISOString(), durationSeconds: 100 }));
    const requests: any[] = [];
    let realtime: ((type: string, extra?: Record<string, unknown>) => void) | undefined;
    await setup(page, theme, 'creator', true, { session: active, history, onHistoryRequest: body => requests.push(body), onRealtime: send => realtime = send });
    const rail = page.locator('.room-tools-rail');
    await expect(rail.getByRole('button').nth(4)).toHaveAccessibleName('Session Recaps');
    await rail.getByRole('button', { name: 'Session Recaps', exact: true }).click();
    const panel = page.locator('.session-history-panel');
    await expect(panel).toBeFocused();
    const list = panel.locator('.history-list');
    await expect(list.locator('.v-list-item--active')).toContainText('Active');
    if (mobile) await list.locator('.v-list-item').first().click();
    await expect(panel.locator('.history-detail').getByText('Messages', { exact: true })).toBeVisible();
    await panel.getByRole('tab', { name: 'Bag', exact: true }).click();
    await expect(panel.getByText('Your bag activity', { exact: true })).toBeVisible();
    await expect(panel.locator('.bag-stat strong').first()).toHaveText('12');
    await page.screenshot({ path: info.outputPath('session-recap.png'), animations: 'disabled' });
    if (mobile) await panel.getByRole('button', { name: 'Back to sessions' }).click();
    await list.evaluate(el => el.scrollTop = el.scrollHeight);
    await expect.poll(() => requests.filter(r => r.action === 'sessions' && r.payload.before).length).toBeGreaterThan(0);
    await list.locator('.v-list-item').nth(1).click();
    await expect(panel.getByText('Bag activity tracking is not available for this session.')).toBeVisible();
    if (!mobile) {
      const host = await page.locator('.room-panel-host').boundingBox(), bounds = await panel.boundingBox();
      expect(bounds!.width).toBeCloseTo(Math.min(1040, host!.width), 0);
    }
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(rail.getByRole('button', { name: 'Session Recaps', exact: true })).toBeFocused();
    realtime!('session.closed', { session: { ...active, endedAt: new Date().toISOString() } });
    await expect(panel).toBeVisible();
    await expect(panel.locator('.history-detail')).toBeVisible();
    await expect(page.locator('.v-dialog:visible')).toHaveCount(0);
  });
}

test('session recap retries history failures and ignores stale detail responses', async ({ page }) => {
  const first = { ...ownedSession(), id: 'first', endedAt: new Date().toISOString(), durationSeconds: 1 };
  const second = { ...ownedSession(), id: 'second', endedAt: new Date().toISOString(), durationSeconds: 2 };
  first.recap.messageCount = 111; second.recap.messageCount = 222;
  const failures = ['sessions'];
  await setup(page, 'dark', 'creator', false, { history: [first, second], failActions: failures });
  await page.locator('.room-tools-rail').getByRole('button', { name: 'Session Recaps', exact: true }).click();
  const panel = page.locator('.session-history-panel');
  await expect(panel.getByText('Test mutation failed')).toBeVisible();
  failures.length = 0;
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(panel.locator('.recap-stats strong').first()).toHaveText('111');
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => release = resolve);
  let started = false;
  await page.route('**/api/rooms', async route => {
    const body = route.request().postDataJSON();
    if (body.action === 'sessionRecap' && body.payload.sessionId === 'second') {
      started = true;
      await held;
      await route.fulfill({ json: { success: true, data: { session: second } } });
    } else await route.fallback();
  });
  await panel.locator('.history-list .v-list-item').nth(1).click();
  await expect.poll(() => started).toBe(true);
  await panel.locator('.history-list .v-list-item').first().click();
  await expect(panel.locator('.recap-stats strong').first()).toHaveText('111');
  const delayedResponse = page.waitForResponse(response => response.url().endsWith('/api/rooms') && response.request().postDataJSON()?.payload?.sessionId === 'second');
  release!();
  await delayedResponse;
  await expect(panel.locator('.history-list .v-list-item--active')).toHaveCount(1);
  await expect(panel.locator('.recap-stats strong').first()).toHaveText('111');
});
