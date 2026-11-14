import { test, expect, type Page } from '@playwright/test';

interface FixtureOptions {
  inspection?: boolean;
  onBagFrame?: (frame: any) => void;
  session?: any;
  diceCount?: number;
  permissionOverrides?: Record<string, boolean>;
  failActions?: string[];
  onRealtime?: (send: (type: string, extra?: Record<string, unknown>) => void) => void;
}
async function setup(page: Page, theme = 'dark', role = 'creator', awardsEnabled = false, options: FixtureOptions = {}) {
  const user = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme, themeStyle: 'default' };
  const settings = { roomId: 'room', enabled: true, maxPointsPerUser: 5, allowExtremeSpend: false };
  const room = { id: 'room', name: 'Test room', inviteCode: 'test', createdBy: 'owner', memberCount: 1, criticals: [{ operator: 'moreThan', threshold: 90, color: '#d32f2f' }], bagEnabled: true, bonusPointSettings: settings, sessionInactivityMinutes: 240 };
  const member = { userId: 'owner', username: 'Owner', avatar: '', role, permissionOverrides: options.permissionOverrides ?? {}, nickname: null };
  const snapshot = { roomId: 'room', version: 2, settings, rules: [], triggers: [] as any[], conditions: [] as any[], effects: [] as any[], balances: [{ userId: 'owner', username: 'Owner', points: 2 }] };
  const writes: any[] = [];
  const members = [member, ...((options.session || options.inspection) ? [{ userId: 'friend', username: 'Friend', nickname: 'Mage', role: 'player', permissionOverrides: {} }, { userId: 'empty', username: 'Empty', role: 'player', permissionOverrides: {} }] : [])];
  const dices = Array.from({ length: options.diceCount ?? 1 }, (_, i) => ({ id: i ? `die-${i}` : 'die', roomId: 'room', notation: 'd20', description: i ? `Attack ${i}` : 'Attack', categoryId: 'cat', categoryName: 'Combat' }));
  const categories = [{ id: 'cat', name: 'Combat' }];
  await page.addInitScript(user => localStorage.setItem('aventyr_global_state', JSON.stringify({ version: 1, locale: 'en', theme: user.theme, themeStyle: 'default', discord: { user, auth: { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, expiresAt: Date.now() + 3600000, scope: 'identify', state: 'test' } }, ui: {} })), user);
  await page.routeWebSocket('**/ws/rooms/**', ws => {
    const send = (type: string, extra = {}) => ws.send(JSON.stringify({ type, eventId: Math.random().toString(), roomId: 'room', occurredAt: new Date().toISOString(), ...extra }));
    options.onRealtime?.(send);
    ws.onMessage(raw => {
      const frame = JSON.parse(String(raw));
      if (frame.type === 'authenticate') send('connection.ready');
      if (frame.type.startsWith('bag.')) options.onBagFrame?.(frame);
      if (frame.type === 'bag.subscribe') send('bag.snapshot', { requestId: frame.requestId, snapshot: {
        id: frame.targetUserId ? 'inspected-bag' : 'bag', scope: frame.scope, targetUserId: frame.targetUserId,
        revision: 1, sections: frame.targetUserId ? [{ id: 'gear', name: 'Equipment', color: '#1565c0', icon: 'mdi-sword', revision: 1 }] : [],
        templates: [], items: frame.targetUserId ? [{ id: 'sword', creatorId: 'friend', sectionId: 'gear', name: 'Flame sword', rarity: 'Legendary',
          icon: 'mdi-sword', imageId: null, revision: 1, favorite: true, description: 'Full description', displayDescription: false,
          fields: [{ name: 'Secret power', type: 'integer', options: [], value: 42, display: false }] }] : [],
      } });
    });
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: any = {};
    if (path.endsWith('/users/friend/profile')) data = { username: 'Friend', avatar: '', aboutMe: 'Adventurer' };
    if (path.endsWith('/users/owner/profile')) data = { username: 'Owner', avatar: '', aboutMe: '' };
    if (path.endsWith('/discord') || path.includes('/users/owner')) data = user;
    if (path.endsWith('/rooms')) {
      if (route.request().method() !== 'POST') data = { rooms: [room] };
      else {
        const body = route.request().postDataJSON();
        if (options.failActions?.includes(body.action)) {
          writes.push(body);
          await route.fulfill({ status: 500, json: { success: false, error: 'Test mutation failed' } });
          return;
        }
        switch (body.action) {
          case 'list': case 'userRooms': data = { rooms: [room] }; break;
          case 'members': data = { members }; break;
          case 'member': data = { member }; break;
          case 'messages': data = { messages: Array.from({ length: 30 }, (_, i) => ({ id: String(i), roomId: 'room', userId: options.inspection && i === 29 ? 'friend' : 'owner', username: options.inspection && i === 29 ? 'Friend' : 'Owner', nickname: options.inspection && i === 29 ? 'Mage' : null, type: 'text', content: `Message ${i}`, createdAt: new Date(1700000000000 + i * 1000).toISOString() })) }; break;
          case 'sessionState': data = { session: options.session ?? null }; break;
          case 'prepareSessionStart': case 'requestSessionStart': data = { preparation: { session: options.session ?? null, previousSessionId: null, candidates: [], request: null } }; break;
          case 'bonusPoints': data = snapshot; break;
          case 'rollAwards': data = { roomId: 'room', rollAwards: awardsEnabled ? [{ id: 'award', roomId: 'room', name: 'Lucky twenty', description: 'A perfect roll', diceResults: [20], diceNotations: ['d20'] }] : [], enabled: awardsEnabled }; break;
          case 'roomDices': data = { dices, categories }; break;
          case 'createDice': { writes.push(body); const dice = { ...body.payload, id: 'new-die', categoryName: 'Combat' }; dices.push(dice); data = { dice }; break; }
          case 'createDiceCategory': { writes.push(body); const category = { id: 'new-category', name: body.payload.name }; categories.push(category); data = { category }; break; }
          case 'deleteDice': writes.push(body); data = { diceId: body.payload.diceId }; break;
          case 'message': writes.push(body); data = { message: { ...body.payload, id: 'new-message', username: 'Owner', createdAt: new Date().toISOString() } }; break;
          case 'useRollAward': {
            writes.push(body);
            const assignment = options.session.ownedAwards.find((award: any) => award.id === body.payload.assignmentId);
            assignment.usedAt = new Date().toISOString(); assignment.usageMessageId = 'usage';
            data = { session: options.session, message: { id: 'usage', roomId: 'room', userId: 'owner', username: 'Owner', sessionId: options.session.id, type: 'roll_award_usage', rollAwardUsage: { assignmentId: assignment.id, award: assignment.award }, createdAt: assignment.usedAt } }; break;
          }
          case 'updateCriticals': writes.push(body); room.criticals = body.payload.criticals; data = { room }; break;
          case 'updateDice': writes.push(body); data = { dice: { id: body.payload.diceId, roomId: 'room', notation: body.payload.notation, description: body.payload.description, categoryId: 'cat', categoryName: 'Combat' } }; break;
          case 'updateRoom': writes.push(body); room.name = body.payload.name; data = { room }; break;
          case 'mutateBonusConfiguration': {
            writes.push(body);
            const list = body.payload.kind === 'trigger' ? snapshot.triggers : body.payload.kind === 'condition' ? snapshot.conditions : snapshot.effects;
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
  const popup = page.locator('.bonus-config-popup');
  await triggers.getByRole('button', { name: 'Add', exact: true }).click(); await popup.locator('input[maxlength="100"]').fill('High result');
  await popup.getByRole('button', { name: 'Add AND condition' }).click(); await popup.getByRole('button', { name: 'Add OR group' }).click();
  await popup.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.filter(w => w.action === 'mutateBonusConfiguration').length).toBe(1);
  expect(writes[0].payload.entry.groups.map((g: unknown[]) => g.length)).toEqual([2,1]);
  const effects = page.locator('.config-section').filter({ has: page.getByRole('heading', { name: 'Effects', exact: true }) });
  for (const name of ['Effect one', 'Effect two']) {
    await effects.getByRole('button', { name: 'Add', exact: true }).click(); await popup.locator('input[maxlength="100"]').fill(name);
    await popup.getByRole('button', { name: 'Add Effect', exact: true }).click();
    await page.locator('.effect-choice').filter({ hasText: 'Send system message' }).click(); await popup.locator('textarea').fill('Literal text');
    await popup.getByRole('button', { name: 'Save', exact: true }).click();
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

for (const mobile of [false, true]) {
  test(`dice management opens focused ${mobile ? 'mobile sheets' : 'desktop dialogs'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await setup(page); await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Dices');
    const panel = page.locator('.room-slide-panel:visible');
    await panel.getByRole('button', { name: 'Manage categories', exact: true }).click();
    const dialog = page.locator('.dice-management-dialog');
    await expect(dialog.getByRole('heading', { name: 'Manage categories', exact: true })).toBeVisible();
    await expect(dialog.locator('input').last()).toHaveValue('Combat');
    if (mobile) { const bounds = await dialog.boundingBox(); expect(bounds!.width).toBe(390); }
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(dialog).not.toBeVisible(); await expect(panel).toBeVisible();
    await panel.locator('.dice-management-toolbar button').first().click();
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
    const dialog = page.locator('.dice-management-dialog');
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
  test(`critical gallery creates rules in a ${mobile ? 'mobile sheet' : 'desktop popup'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes = await setup(page);
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Criticals');
    const gallery = page.locator('.critical-gallery');
    await expect(gallery.locator('.critical-rule-item')).toHaveCount(1);
    await expect(gallery.locator('input')).toHaveCount(0);
    await gallery.locator('.critical-add-tile').click();
    const popup = page.locator('.critical-popup'); await expect(popup).toBeVisible();
    if (mobile) expect((await popup.boundingBox())!.width).toBe(390);
    await popup.locator('input[type="number"]').fill('90');
    await popup.locator('.critical-popup-footer button').last().click();
    await expect(popup.locator('.v-alert')).toBeVisible(); expect(writes).toHaveLength(0);
    await popup.locator('input[type="number"]').fill('95');
    page.once('dialog', d => d.dismiss()); await popup.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(popup).toBeVisible();
    await popup.locator('.critical-popup-footer button').last().click();
    await expect(popup).not.toBeVisible(); await expect(gallery.locator('.critical-rule-item')).toHaveCount(2);
    expect(writes[0].action).toBe('updateCriticals');
  });
}

for (const mobile of [false, true]) {
  test(`critical rules update with color swatches (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes = await setup(page);
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Criticals');
    const gallery = page.locator('.critical-gallery');
    await gallery.getByRole('button', { name: 'Update rule', exact: true }).click();
    const popup = page.locator('.critical-popup');
    await expect(popup.locator('input[type="number"]')).toHaveValue('90');
    await expect(popup.locator('.critical-swatch[aria-pressed="true"]')).toHaveCount(1);
    await popup.locator('.critical-swatch').nth(2).click();
    await popup.locator('input[type="number"]').fill('92');
    await popup.getByRole('button', { name: 'Update rule', exact: true }).click();
    await expect(popup).not.toBeVisible(); await expect(gallery.locator('.critical-rule-item')).toHaveCount(1);
    expect(writes[0].payload.criticals[0]).toMatchObject({ threshold: 92, color: '#fdd835' });
    await gallery.getByRole('button', { name: 'Update rule', exact: true }).click();
    await popup.getByRole('button', { name: 'Custom color', exact: true }).click();
    const picker = page.locator('.app-color-panel');
    await picker.getByRole('textbox', { name: 'Hex color', exact: true }).fill('#123456');
    await picker.getByRole('button', { name: 'Save', exact: true }).click();
    await popup.getByRole('button', { name: 'Update rule', exact: true }).click();
    await expect(popup).not.toBeVisible(); expect(writes[1].payload.criticals[0].color).toBe('#123456');
  });
}

for (const mobile of [false, true]) {
  test(`bonus configuration forms open in ${mobile ? 'mobile sheets' : 'desktop dialogs'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const writes = await setup(page);
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Bonus Points');
    for (const heading of ['Triggers', 'Effects']) {
      const section = page.locator('.config-section').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
      await section.getByRole('button', { name: 'Add', exact: true }).click();
      const popup = page.locator('.bonus-config-popup'); await expect(popup).toBeVisible();
      if (mobile) expect((await popup.boundingBox())!.width).toBe(390);
      await expect(section.locator('input')).toHaveCount(0);
      await popup.locator('input[maxlength="100"]').fill(`New ${heading}`);
      page.once('dialog', d => d.dismiss()); await popup.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(popup).toBeVisible();
      await popup.getByRole('button', { name: 'Save', exact: true }).click(); await expect(popup).not.toBeVisible();
      await section.getByRole('button', { name: 'Edit item', exact: true }).click();
      await expect(popup.locator('input[maxlength="100"]')).toHaveValue(`New ${heading}`);
      await popup.locator('input[maxlength="100"]').fill(`Updated ${heading}`);
      await popup.getByRole('button', { name: 'Save', exact: true }).click(); await expect(popup).not.toBeVisible();
      await expect(section.getByText(`Updated ${heading}`, { exact: true })).toBeVisible();
    }
    expect(writes).toHaveLength(4);
  });
}

test('effect chooser describes actions and saves notification effects', async ({ page }) => {
  const writes = await setup(page);
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Bonus Points');
  const section = page.locator('.config-section').filter({ has: page.getByRole('heading', { name: 'Effects', exact: true }) });
  await section.getByRole('button', { name: 'Add', exact: true }).click();
  const popup = page.locator('.bonus-config-popup');
  await popup.locator('input[maxlength="100"]').fill('Notify player');
  await popup.getByRole('button', { name: 'Add Effect', exact: true }).click();
  await expect(page.locator('.effect-choice')).toHaveCount(3);
  await expect(page.getByText('Show a temporary notification to the player spending the point.', { exact: true })).toBeVisible();
  await page.locator('.effect-choice').filter({ hasText: 'Display Notification' }).click();
  await popup.locator('textarea').fill('Point spent!');
  await popup.getByText('Notification options (optional)', { exact: true }).click();
  await popup.getByRole('spinbutton', { name: /Duration/ }).fill('8000');
  await popup.getByRole('checkbox', { name: /Stay until dismissed/ }).check();
  await popup.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(popup).not.toBeVisible();
  expect(writes[0].payload.entry.actions[1]).toEqual({ type: 'notification', text: 'Point spent!', timeout: -1 });
});

test('bonus spending Conditions sit between Triggers and Effects and save grouped checks', async ({ page }) => {
  const writes = await setup(page);
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Bonus Points');
  await expect(page.locator('.config-section h3')).toHaveText(['Triggers0', 'Conditions0', 'Effects0']);
  const section = page.locator('.config-section').filter({ has: page.getByRole('heading', { name: 'Conditions', exact: true }) });
  await section.getByRole('button', { name: 'Add', exact: true }).click();
  const popup = page.locator('.bonus-config-popup');
  await popup.getByRole('button', { name: 'Add AND condition', exact: true }).click();
  await popup.getByRole('button', { name: 'Add OR group', exact: true }).click();
  await popup.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(popup).not.toBeVisible();
  expect(writes[0].payload.kind).toBe('condition');
  expect(writes[0].payload.entry.groups.map((group: unknown[]) => group.length)).toEqual([2,1]);
  await section.getByRole('button', { name: 'Edit item', exact: true }).click();
  await expect(popup.locator('.condition-group')).toHaveCount(2);
});

function ownedSession() {
  const award = (id: string, name: string) => ({ id, roomId: 'room', name, description: 'An award description. '.repeat(15), diceResults: [20], diceNotations: ['d20'] });
  return {
    id: 'session', roomId: 'room', startedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), startReason: 'manual',
    configuration: { rollAwards: { enabled: true, awards: [] }, criticals: [], bonusPoints: { enabled: false, maxPointsPerUser: 5, rules: [], triggers: [], conditions: [], effects: [] } },
    recap: { messageCount: 0, rollCount: 0, durationSeconds: 0, rollAwards: [], criticals: [], bonusPoints: { awarded: 0, used: 0, users: [] } },
    ownedAwards: [
      { id: 'mine', sessionId: 'session', sourceSessionId: 'previous', userId: 'owner', award: award('a', 'My trophy'), usedAt: null as string | null, usageMessageId: null as string | null },
      { id: 'theirs', sessionId: 'session', sourceSessionId: 'previous', userId: 'friend', award: award('b', 'Mage trophy'), usedAt: null as string | null, usageMessageId: null as string | null },
    ],
  };
}
const tools = (page: Page) => page.locator('.room-tools-panel:visible');
async function openTools(page: Page, name = 'Dices') {
  await page.locator('.room-tools-rail').getByRole('button', { name, exact: true }).click();
  await expect(tools(page)).toBeVisible();
  await expect(tools(page)).not.toHaveClass(/room-slide-enter-active/);
}
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
      await expect(tools(page)).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(tools(page).getByRole('button', { name: 'Manage dices & categories', exact: true })).toBeFocused();
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

for (const width of [1440, 390]) {
  test(`profile opens a live read-only Personal bag in the room container (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const frames: any[] = [];
    let push!: (type: string, extra?: Record<string, unknown>) => void;
    await setup(page, 'dark', 'creator', false, { inspection: true, onBagFrame: frame => frames.push(frame), onRealtime: send => { push = send; } });
    await page.getByRole('button', { name: "Open Owner's profile", exact: true }).last().click();
    await expect(page.getByRole('button', { name: 'View Bag', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    if (width === 1440) {
      await page.getByRole('button', { name: 'Room settings', exact: true }).click();
      await navigate(page, 'Administration');
    } else {
      await page.getByText('1 member', { exact: true }).click();
    }
    const profileHost = width === 1440 ? page.locator('.room-slide-panel:visible') : page.locator('.members-popover:visible');
    await profileHost.getByRole('button', { name: width === 1440 ? "Open Mage's profile" : "Open Mage (Friend)'s profile", exact: true }).click();
    const action = page.getByRole('button', { name: 'View Bag', exact: true });
    await expect(action).toBeVisible();
    await action.hover(); await expect(page.getByRole('tooltip', { name: 'View Bag', exact: true })).toBeVisible();
    await action.click();
    const panel = page.locator('.room-slide-panel:visible');
    await expect(panel).toHaveCount(1); await expect(panel).toHaveAccessibleName('Mage’s Bag');
    await expect(page.locator('.profile-popup:visible')).toHaveCount(0);
    await expect(panel.getByRole('tab', { name: 'Team', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('tab', { name: 'Personal', exact: true })).toHaveCount(0);
    await panel.getByRole('tab', { name: 'Equipment' }).click();
    await expect(panel.getByRole('button', { name: 'Flame sword' })).toBeVisible();
    await expect(panel.locator('.bag-inventory-menu-trigger')).toHaveCount(0);
    await expect(panel.locator('.bag-inventory-add, .bag-add-section')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Custom fields' })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Flame sword' }).click();
    await expect(page.getByRole('tooltip').filter({ hasText: 'Full description' })).toContainText('Secret power');
    await expect(page.getByRole('tooltip').filter({ hasText: 'Full description' })).toContainText('42');
    await panel.getByRole('button', { name: 'Flame sword' }).click();
    await expect(page.getByRole('tooltip').filter({ hasText: 'Full description' })).toHaveCount(0);
    const host = await page.locator('.room-panel-host').boundingBox(), bounds = await panel.boundingBox();
    expect(bounds!.width).toBeCloseTo(host!.width, 0); expect(bounds!.height).toBeCloseTo(host!.height, 0);
    expect(frames.some(f => f.type === 'bag.subscribe' && f.targetUserId === 'friend' && f.scope === 'personal')).toBeTruthy();
    expect(frames.some(f => f.type === 'bag.presence')).toBeFalsy();
    await page.screenshot({ path: info.outputPath(`bag-inspection-${width}.png`), animations: 'disabled' });
    push('bag.snapshot', { snapshot: { id: 'inspected-bag', scope: 'personal', targetUserId: 'friend', revision: 2, sections: [], templates: [], items: [] } });
    await expect(panel.getByRole('tab', { name: 'Equipment' })).toHaveCount(0);
    await expect(panel.getByText('This section is empty.')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible();
    await expect(page.locator('.room-panel-host [data-room-panel-trigger]:focus')).toHaveCount(1);
    await page.getByRole('button', { name: 'Bag', exact: true }).click();
    await expect(page.locator('.room-slide-panel:visible').getByRole('tab', { name: 'Team', exact: true })).toBeVisible();
  });
}

for (const allowed of [false, true]) {
  test(`chat profile inspection follows View Bag permission (${allowed})`, async ({ page }) => {
    const frames: any[] = [];
    await setup(page, 'light', 'player', false, { inspection: true, permissionOverrides: { viewBag: allowed, editBag: false }, onBagFrame: frame => frames.push(frame) });
    await page.locator('.message-row').getByRole('button', { name: "Open Mage (Friend)'s profile", exact: true }).click();
    await expect(page.locator('.profile-popup:visible').getByText('Adventurer')).toBeVisible();
    const action = page.getByRole('button', { name: 'View Bag', exact: true });
    if (!allowed) { await expect(action).toHaveCount(0); return; }
    await action.click();
    await expect(page.getByRole('dialog', { name: 'Mage’s Bag', exact: true })).toBeVisible();
    expect(frames.some(f => f.type === 'bag.subscribe' && f.targetUserId === 'friend')).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(page.locator('.room-slide-panel:visible')).toHaveCount(0);
  });
}

for (const width of [1440, 375]) {
test(`bag gifts show a counted inbox, accept into a section, and reject (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  let push!: (type: string, extra?: Record<string, unknown>) => void;
  await setup(page, 'dark', 'creator', false, { inspection: true, onRealtime: send => { push = send; } });
  const item = { id: 'gift', creatorId: 'friend', sectionId: null, name: 'Moonstone', rarity: 'Rare', icon: 'mdi-diamond-stone', imageId: 'gift-art', revision: 2, description: 'A pale gem that glows under the stars.', displayDescription: false, fields: [] };
  let incomingGifts = [{ item, senderId: 'friend' }, { item: { ...item, id: 'gift-2', name: 'Silver key' }, senderId: 'friend' }];
  await page.route('**/bag/images/gift-art', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="600"><rect width="120" height="600" fill="#8bcbd9"/><path d="M60 200 110 300 60 400 10 300Z" fill="#e0f7ff"/></svg>' }));
  const actions: any[] = [];
  const snapshot = (scope = 'team') => ({ id: 'bag', scope, revision: 2 + actions.length, sections: [{ id: 'keepsakes', name: 'Keepsakes', revision: 1 }], templates: [], items: [], incomingGifts });
  await page.route('**/api/rooms', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON();
    if (!['bag', 'acceptBagItem', 'rejectBagItem'].includes(body.action)) return route.fallback();
    if (body.action !== 'bag') { actions.push(body); incomingGifts = incomingGifts.filter(g => g.item.id !== body.payload.id); }
    await route.fulfill({ json: { success: true, data: { bag: snapshot(body.payload.scope) } } });
  });
  await page.getByRole('button', { name: 'Bag', exact: true }).click();
  push('bag.snapshot', { snapshot: snapshot() });
  const inbox = page.getByRole('button', { name: 'Gift inbox: 2 pending items', exact: true });
  await expect(inbox).toBeVisible();
  await inbox.click();
  const giftDialog = page.getByRole('dialog').filter({ has: page.getByText('Moonstone', { exact: true }) });
  await expect(giftDialog.getByText('From Mage')).toHaveCount(2);
  const row = giftDialog.locator('.bag-gift-row').first();
  await expect(row.locator('img.bag-gift-image')).toBeVisible();
  await expect.poll(async () => (await row.locator('.bag-gift-art').boundingBox())?.height).toBe(36);
  const [art, details, actionsBox, rowBox] = await Promise.all([
    row.locator('.bag-gift-art').boundingBox(), row.locator('.bag-gift-details').boundingBox(),
    row.locator('.bag-gift-actions').boundingBox(), row.boundingBox(),
  ]);
  expect(art!.height).toBe(36); expect(details!.height).toBe(36);
  expect(rowBox!.height).toBeLessThanOrEqual(64);
  expect(Math.abs(art!.y + art!.height / 2 - actionsBox!.y - actionsBox!.height / 2)).toBeLessThan(1);
  expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width);
  await row.locator('.bag-item-link').hover();
  await expect(page.getByRole('tooltip').getByRole('heading', { name: 'Moonstone', exact: true })).toBeVisible();
  await expect(page.getByRole('tooltip').getByText('A pale gem that glows under the stars.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('bag-gift-preview.png'), animations: 'disabled' });
  await giftDialog.locator('.bag-gifts-heading').hover();
  await page.screenshot({ path: info.outputPath('bag-gift-inbox.png'), animations: 'disabled' });
  await giftDialog.getByRole('button', { name: 'Accept', exact: true }).first().click();
  const accepting = page.getByRole('dialog').filter({ has: page.getByText('Store in personal section', { exact: true }) });
  await accepting.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Keepsakes', exact: true }).click();
  await accepting.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByText('Moonstone', { exact: true })).toHaveCount(0);
  expect(actions[0].payload.destinationSectionId).toBe('keepsakes');
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(page.getByText('Your gift inbox is empty.', { exact: true })).toBeVisible();
  expect(actions.map(a => a.action)).toEqual(['acceptBagItem', 'rejectBagItem']);
});
}

test('room test tools open an editable bag as the selected member', async ({ page }) => {
  let push!: (type: string, extra?: Record<string, unknown>) => void;
  await setup(page, 'dark', 'creator', false, { inspection: true, onRealtime: send => { push = send; } });
  await page.getByRole('button', { name: 'Open room test tools', exact: true }).click();
  await page.getByRole('button', { name: 'Open bag as selected user', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Mage’s Bag · Test user', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('tab', { name: 'Personal', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('button', { name: 'Add item', exact: true })).toBeEnabled();
  const item = { id: 'friend-item', creatorId: 'friend', sectionId: null, name: 'Test sword', rarity: 'Rare', icon: 'mdi-sword', imageId: null, revision: 1, description: '', displayDescription: false, fields: [] };
  push('bag.snapshot', { snapshot: { id: 'friend-bag', scope: 'personal', revision: 2, sections: [], templates: [], items: [item] } });
  await expect(panel.getByText('Test sword', { exact: true })).toBeVisible();
  await panel.locator('.bag-inventory-slot').hover();
  await page.getByRole('listbox', { name: 'Actions', exact: true }).getByText('Edit item', { exact: true }).click();
  const editor = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Name', exact: true }) });
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Updated sword');
  let saved: any;
  await page.route('**/api/rooms', async route => {
    const body = route.request().postDataJSON();
    if (body.action !== 'updateBagItem') return route.fallback();
    saved = body;
    await route.fulfill({ json: { success: true, data: { bag: { id: 'friend-bag', scope: 'personal', revision: 3, sections: [], templates: [], items: [{ ...item, name: 'Updated sword', revision: 2 }] } } } });
  });
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(panel.getByText('Updated sword', { exact: true })).toBeVisible();
  expect(saved.devBagUserId).toBe('friend');
  expect(saved.payload.userId).toBe('friend');
  expect(saved.payload.scope).toBe('personal');
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Bag', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bag', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Mage’s Bag · Test user', exact: true })).toHaveCount(0);
});


test('a gift receipt shows a notification while the bag is closed', async ({ page }) => {
  let push!: (type: string, extra?: Record<string, unknown>) => void;
  await setup(page, 'dark', 'creator', false, { inspection: true, onRealtime: send => { push = send; } });
  const gift = { userId: 'owner', senderId: 'friend', itemId: 'moonstone', itemName: 'Moonstone' };
  push('bag.gift_received', { gift });
  await expect(page.locator('.v-snackbar')).toContainText('Mage sent you Moonstone. Open your gift inbox to accept or reject it.');
  await expect(page.getByRole('dialog', { name: 'Bag', exact: true })).toHaveCount(0);
});
