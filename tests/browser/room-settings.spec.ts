import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, theme = 'dark', role = 'creator') {
  const user = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme, themeStyle: 'default' };
  const settings = { roomId: 'room', enabled: true, maxPointsPerUser: 5, allowExtremeSpend: false };
  const room = { id: 'room', name: 'Test room', inviteCode: 'test', createdBy: 'owner', memberCount: 1, bagEnabled: true, bonusPointSettings: settings, sessionInactivityMinutes: 240 };
  const member = { userId: 'owner', username: 'Owner', avatar: '', role, permissionOverrides: {}, nickname: null };
  const snapshot = { roomId: 'room', version: 2, settings, rules: [], triggers: [] as any[], effects: [] as any[], balances: [{ userId: 'owner', username: 'Owner', points: 2 }] };
  const writes: any[] = [];
  await page.addInitScript(user => localStorage.setItem('aventyr_global_state', JSON.stringify({ version: 1, locale: 'en', theme: user.theme, themeStyle: 'default', discord: { user, auth: { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, expiresAt: Date.now() + 3600000, scope: 'identify', state: 'test' } }, ui: {} })), user);
  await page.routeWebSocket('**/ws/rooms/**', ws => {
    const send = (type: string, extra = {}) => ws.send(JSON.stringify({ type, eventId: Math.random().toString(), roomId: 'room', occurredAt: new Date().toISOString(), ...extra }));
    ws.onMessage(raw => {
      const frame = JSON.parse(String(raw));
      if (frame.type === 'authenticate') send('connection.ready');
      if (frame.type === 'bag.subscribe') send('bag.snapshot', { requestId: frame.requestId, snapshot: { id: 'bag', scope: frame.scope, revision: 1, sections: [], templates: [], items: [] } });
    });
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: any = {};
    if (path.endsWith('/discord') || path.includes('/users/owner')) data = user;
    if (path.endsWith('/rooms')) {
      if (route.request().method() !== 'POST') data = { rooms: [room] };
      else {
        const body = route.request().postDataJSON();
        switch (body.action) {
          case 'list': case 'userRooms': data = { rooms: [room] }; break;
          case 'members': data = { members: [member] }; break;
          case 'member': data = { member }; break;
          case 'messages': data = { messages: Array.from({ length: 30 }, (_, i) => ({ id: String(i), roomId: 'room', userId: 'owner', username: 'Owner', type: 'text', content: `Message ${i}`, createdAt: new Date(1700000000000 + i * 1000).toISOString() })) }; break;
          case 'sessionState': data = { session: null }; break;
          case 'bonusPoints': data = snapshot; break;
          case 'rollAwards': data = { roomId: 'room', rollAwards: [], enabled: false }; break;
          case 'roomDices': data = { dices: [{ id: 'die', roomId: 'room', notation: 'd20', description: 'Attack', categoryId: 'cat', categoryName: 'Combat' }], categories: [{ id: 'cat', name: 'Combat' }] }; break;
          case 'updateRoom': writes.push(body); room.name = body.payload.name; data = { room }; break;
          case 'mutateBonusConfiguration': {
            writes.push(body);
            const list = body.payload.kind === 'trigger' ? snapshot.triggers : snapshot.effects;
            if (body.payload.operation === 'save') { const entry = { ...body.payload.entry, id: body.payload.entry.id || `entry-${writes.length}` }; const i = list.findIndex(e => e.id === entry.id); if (i < 0) list.push(entry); else list[i] = entry; }
            data = snapshot; break;
          }
        }
      }
    }
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/rooms/room');
  await expect(page.getByRole('button', { name: 'Room settings', exact: true })).toBeVisible();
  return writes;
}
async function navigate(page: Page, name: string) {
  const panel = page.locator('.room-slide-panel:visible');
  const menu = panel.getByRole('button', { name: 'Settings sections', exact: true });
  if (await menu.isVisible()) await menu.click();
  await panel.getByRole('navigation').getByText(name, { exact: true }).click();
}
for (const theme of ['light', 'dark']) {
  test(`room panels preserve chat and fit their host (${theme})`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page, theme);
    const activator = page.getByRole('button', { name: 'Room settings', exact: true });
    const scrollTop = await page.locator('.messages-container').evaluate(el => el.scrollTop);
    await activator.click();
    const panel = page.locator('.room-slide-panel:visible');
    await expect(panel).toBeFocused();
    const host = await page.locator('.room-panel-host').boundingBox(), bounds = await panel.boundingBox();
    expect(bounds!.width).toBeCloseTo(host!.width, 0); expect(bounds!.height).toBeCloseTo(host!.height, 0);
    await navigate(page, 'Dices');
    await expect(panel.getByText('Attack', { exact: true })).toBeVisible();
    await navigate(page, 'General');
    await page.screenshot({ path: info.outputPath(`settings-${theme}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible(); await expect(activator).toBeFocused();
    expect(await page.locator('.messages-container').evaluate(el => el.scrollTop)).toBe(scrollTop);
    await page.getByRole('button', { name: 'Bag', exact: true }).click();
    await expect(page.locator('.room-slide-panel:visible')).toHaveCount(1);
    await expect(page.locator('.room-slide-panel:visible').getByRole('tab', { name: 'Team', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Message 29', { exact: true })).toBeVisible();
  });
}
test('mobile navigation retains drafts and confirms before discarding', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole('button', { name: 'Room settings', exact: true }).click();
  const panel = page.locator('.room-slide-panel:visible');
  await expect(panel.getByRole('button', { name: 'Settings sections', exact: true })).toBeVisible();
  const name = panel.locator('input[maxlength="80"]'); await name.fill('Draft room');
  await navigate(page, 'Dices'); await navigate(page, 'General'); await expect(name).toHaveValue('Draft room');
  page.once('dialog', dialog => dialog.dismiss()); await page.keyboard.press('Escape'); await expect(panel).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible();
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await expect(name).toHaveValue('Test room'); await expect(name).toBeVisible();
  await page.screenshot({ path: info.outputPath('settings-mobile.png'), animations: 'disabled' });
  const bounds = await panel.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
test('bonus editor saves condition groups and warns about stacking effects', async ({ page }) => {
  const writes = await setup(page);
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Bonus Points');
  const triggers = page.locator('.config-section').filter({ has: page.getByRole('heading', { name: 'Triggers', exact: true }) });
  await triggers.getByRole('button', { name: 'Add', exact: true }).click(); await triggers.locator('input[maxlength="100"]').fill('High result');
  await triggers.getByRole('button', { name: 'Add AND condition' }).click(); await triggers.getByRole('button', { name: 'Add OR group' }).click();
  await triggers.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.filter(w => w.action === 'mutateBonusConfiguration').length).toBe(1);
  expect(writes[0].payload.entry.groups.map((g: unknown[]) => g.length)).toEqual([2,1]);
  const effects = page.locator('.config-section').filter({ has: page.getByRole('heading', { name: 'Effects', exact: true }) });
  for (const name of ['Effect one', 'Effect two']) {
    await effects.getByRole('button', { name: 'Add', exact: true }).click(); await effects.locator('input[maxlength="100"]').fill(name);
    await effects.getByRole('button', { name: 'Send system message', exact: true }).click(); await effects.locator('textarea').fill('Literal text');
    await effects.getByRole('button', { name: 'Save', exact: true }).click();
  }
  await expect(effects.getByText('Other effects use this notation. All matching effects run in order.')).toHaveCount(2);
});
test('restricted members only see permitted settings sections', async ({ page }) => {
  await setup(page, 'dark', 'player'); await page.getByRole('button', { name: 'Room settings', exact: true }).click();
  const panel = page.locator('.room-slide-panel:visible');
  const menu = panel.getByRole('button', { name: 'Settings sections', exact: true }); if (await menu.isVisible()) await menu.click();
  await expect(panel.getByRole('navigation').getByText('Bonus Points', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('navigation').getByText('Administration', { exact: true })).toHaveCount(0);
});

test('Escape closes the rights dialog before the room panel', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: 'Room settings', exact: true }).click();
  await navigate(page, 'Administration');
  const panel = page.locator('.room-slide-panel:visible');
  await panel.getByRole('button', { name: 'Rights', exact: true }).click();
  const nested = page.locator('.v-dialog .v-card').filter({ hasText: 'Owner' });
  await expect(nested).toBeVisible(); await page.keyboard.press('Escape');
  await expect(nested).not.toBeVisible(); await expect(panel).toBeVisible();
  await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible();
});

test('leaving a room confirms before discarding settings drafts', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: 'Room settings', exact: true }).click();
  await page.locator('.room-slide-panel:visible input[maxlength="80"]').fill('Unsaved room');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/rooms\/room$/);
  await expect(page.locator('.room-slide-panel:visible')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).not.toHaveURL(/\/rooms\/room$/);
});
