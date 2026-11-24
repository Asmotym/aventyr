import { test, expect } from '@playwright/test';

import { setup, navigate } from '../support/rooms.fixture';

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
    await expect(panel.locator(".room-bag-dialog__inventory-menu-trigger")).toHaveCount(0);
    await expect(panel.locator(".room-bag-dialog__inventory-add, .room-bag-dialog__add-section")).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Custom fields' })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Flame sword' }).click();
    await expect(page.getByRole('tooltip').filter({ hasText: 'Full description' })).toContainText('Secret power');
    await expect(page.getByRole('tooltip').filter({ hasText: 'Full description' })).toContainText('42');
    await panel.getByRole('button', { name: 'Flame sword' }).click();
    await expect(page.getByRole('tooltip').filter({ hasText: 'Full description' })).toHaveCount(0);
    const host = await page.locator(".room-chat-panel__room-panel-host").boundingBox(), bounds = await panel.boundingBox();
    expect(bounds!.width).toBeCloseTo(host!.width, 0); expect(bounds!.height).toBeCloseTo(host!.height, 0);
    expect(frames.some(f => f.type === 'bag.subscribe' && f.targetUserId === 'friend' && f.scope === 'personal')).toBeTruthy();
    expect(frames.some(f => f.type === 'bag.presence')).toBeFalsy();
    await page.screenshot({ path: info.outputPath(`bag-inspection-${width}.png`), animations: 'disabled' });
    push('bag.snapshot', { snapshot: { id: 'inspected-bag', scope: 'personal', targetUserId: 'friend', revision: 2, sections: [], templates: [], items: [] } });
    await expect(panel.getByRole('tab', { name: 'Equipment' })).toHaveCount(0);
    await expect(panel.getByText('This section is empty.')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible();
    await expect(page.locator(".room-chat-panel__room-panel-host [data-room-panel-trigger]:focus")).toHaveCount(1);
    await page.getByRole('button', { name: 'Bag', exact: true }).click();
    await expect(page.locator('.room-slide-panel:visible').getByRole('tab', { name: 'Team', exact: true })).toBeVisible();
  });
}

for (const allowed of [false, true]) {
  test(`chat profile inspection follows View Bag permission (${allowed})`, async ({ page }) => {
    const frames: any[] = [];
    await setup(page, 'light', 'player', false, { inspection: true, permissionOverrides: { viewBag: allowed, editBag: false }, onBagFrame: frame => frames.push(frame) });
    await page.locator(".room-messages-list__row").getByRole('button', { name: "Open Mage (Friend)'s profile", exact: true }).click();
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
  const row = giftDialog.locator(".room-bag-dialog__gift-row").first();
  await expect(row.locator('img.room-bag-dialog__gift-image')).toBeVisible();
  await expect.poll(async () => (await row.locator(".room-bag-dialog__gift-art").boundingBox())?.height).toBe(36);
  const [art, details, actionsBox, rowBox] = await Promise.all([
    row.locator(".room-bag-dialog__gift-art").boundingBox(), row.locator(".room-bag-dialog__gift-details").boundingBox(),
    row.locator(".room-bag-dialog__gift-actions").boundingBox(), row.boundingBox(),
  ]);
  expect(art!.height).toBe(36); expect(details!.height).toBe(36);
  expect(rowBox!.height).toBeLessThanOrEqual(64);
  expect(Math.abs(art!.y + art!.height / 2 - actionsBox!.y - actionsBox!.height / 2)).toBeLessThan(1);
  expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width);
  await row.locator('.bag-item-link').hover();
  await expect(page.getByRole('tooltip').getByRole('heading', { name: 'Moonstone', exact: true })).toBeVisible();
  await expect(page.getByRole('tooltip').getByText('A pale gem that glows under the stars.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('bag-gift-preview.png'), animations: 'disabled' });
  await giftDialog.locator(".room-bag-dialog__gifts-heading").hover();
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
  await panel.locator(".room-bag-dialog__inventory-slot").hover();
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

for (const width of [1440, 390]) test(`item presets manage, preview, merge and retain template fields (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  let push!: (type: string, extra?: Record<string, unknown>) => void;
  await setup(page, 'dark', 'creator', false, { onRealtime: send => { push = send; } });
  const presets: any[] = [];
  const items: any[] = [];
  const publicPreset = { id: 'public-preset', ownerId: 'friend', public: true, revision: 1, name: 'Public sword', description: 'Sharp blade', displayDescription: false, rarity: 'Rare', imageId: null, icon: 'mdi-sword', fields: [{ name: 'Damage', type: 'integer', options: [], value: 7, display: true }] };
  const actions: any[] = [];
  const snapshot = (scope = 'team') => ({ id: 'bag', scope, revision: 2 + actions.length, sections: [], templates: [{ id: 'weight-field', name: 'Weight', type: 'integer', options: [], ownerId: 'owner', revision: 1 }], publicTemplates: [{ id: 'damage-field', name: 'Damage', type: 'integer', options: [], ownerId: 'friend', revision: 1, public: true }], items, itemTemplates: presets, publicItemTemplates: [publicPreset] });
  await page.route('**/api/rooms', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON();
    if (!['createBagItemTemplate', 'importBagItemTemplate', 'createBagItem', 'updateBagItem'].includes(body.action)) return route.fallback();
    actions.push(body);
    if (body.action === 'createBagItemTemplate') presets.push({ ...body.payload.data, id: 'mine', ownerId: 'owner', revision: 1 });
    if (body.action === 'importBagItemTemplate') presets.push({ ...publicPreset, id: 'import', ownerId: 'owner', public: false });
    if (body.action === 'createBagItem') items.push({ ...body.payload.data, id: 'saved', revision: 1 });
    if (body.action === 'updateBagItem') items[0] = { ...body.payload.data, revision: 2 };
    await route.fulfill({ json: { success: true, data: { bag: snapshot(body.payload.scope) } } });
  });
  await page.getByRole('button', { name: 'Bag', exact: true }).click();
  push('bag.snapshot', { snapshot: snapshot() });
  const panel = page.getByRole('dialog', { name: 'Bag', exact: true });
  await panel.getByRole('button', { name: 'Item Templates', exact: true }).click();
  let library = page.locator(".bag-item-templates");
  await library.getByRole('button', { name: 'New item template', exact: true }).click();
  const presetEditor = page.locator('.bag-item-template-editor-dialog');
  await expect(presetEditor).toBeVisible();
  await expect(library.getByRole('tab')).toHaveCount(0);
  await expect(library.getByLabel('Name', { exact: true })).toHaveCount(0);
  await presetEditor.getByLabel('Name', { exact: true }).fill('My preset');
  await expect(presetEditor.getByText('Display in table view', { exact: true })).toHaveCount(0);
  await presetEditor.locator(".bag-rarity-select__rarity-selection").click();
  const legendary = page.getByRole('option', { name: /^Legendary/ });
  await expect(legendary).toHaveClass(/bag-rarity-select__rarity-option/);
  await legendary.click();
  await expect(presetEditor.locator(".bag-rarity-select__rarity-selection")).toHaveText('Legendary');
  const formBounds = await presetEditor.locator(".bag-editor__form").boundingBox();
  const previewBounds = await presetEditor.locator(".bag-editor__preview").boundingBox();
  if (width > 960) expect(previewBounds!.x).toBeGreaterThan(formBounds!.x);
  else expect(previewBounds!.y).toBeGreaterThan(formBounds!.y);
  await page.screenshot({ path: info.outputPath('item-template-editor.png'), animations: 'disabled' });
  await presetEditor.getByRole('button', { name: 'Fields', exact: true }).click();
  await presetEditor.getByRole('button', { name: 'Add field', exact: true }).click();
  const fieldPicker = page.locator(".bag-field-picker");
  await expect(fieldPicker.getByRole('tab', { name: 'My fields', exact: true })).toBeVisible();
  await fieldPicker.locator(".bag-field-picker__field-quick-option").filter({ hasText: 'Text' }).click();
  const firstField = presetEditor.locator(".bag-editor__field-card").first();
  await firstField.getByLabel('Name', { exact: true }).fill('Notes');
  await firstField.getByLabel('Value', { exact: true }).fill('A useful default');
  await presetEditor.getByRole('button', { name: 'Add field', exact: true }).click();
  await fieldPicker.getByLabel('Search fields', { exact: true }).fill('Weight');
  await fieldPicker.locator(".bag-field-picker__field-catalog-entry").filter({ hasText: 'Weight' }).click();
  await expect(presetEditor.locator(".bag-editor__field-card").nth(1).getByLabel('Value', { exact: true })).toHaveValue('0');
  await presetEditor.getByRole('button', { name: 'Add field', exact: true }).click();
  await expect(fieldPicker.getByLabel('Search fields', { exact: true })).toHaveValue('');
  await expect(fieldPicker.locator(".bag-field-picker__field-catalog-entry").filter({ hasText: 'Weight' })).toHaveCount(0);
  await fieldPicker.getByRole('tab', { name: 'Room public fields', exact: true }).click();
  await fieldPicker.locator(".bag-field-picker__field-catalog-entry").filter({ hasText: 'Damage' }).click();
  await expect(presetEditor.locator(".bag-editor__field-card")).toHaveCount(3);

  await presetEditor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(presetEditor).toHaveCount(0);
  expect(presets[0].fields.map((f: any) => f.name)).toEqual(['Notes', 'Weight', 'Damage']);
  expect(presets[0].fields[0].value).toBe('A useful default');
  await expect(library.getByRole('button', { name: 'My preset', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('item-template-library.png'), animations: 'disabled' });
  await library.getByRole('button', { name: 'Close', exact: true }).click();
  await panel.locator(".room-bag-dialog__inventory-add").click();
  const editor = page.locator(".bag-editor__dialog");
  await editor.getByLabel('Name', { exact: true }).fill('My blade');
  await expect(editor.getByText('Display in table view', { exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Item Template', exact: true }).click();
  library = page.locator(".bag-item-templates");
  await library.getByRole('tab', { name: 'Room public templates' }).click();
  await expect.poll(() => library.locator('.v-card-text').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  const templatePickerLayer = await library.evaluate(el => { const original = (el as HTMLElement).style.zIndex; (el as HTMLElement).style.zIndex = '6500'; return original; });
  await library.getByRole('button', { name: 'Public sword', exact: true }).focus();
  await expect(page.getByRole('tooltip').filter({ hasText: 'Sharp blade' })).toBeVisible();
  const templatePreview = page.getByRole('tooltip').filter({ hasText: 'Sharp blade' });
  await expect.poll(() => templatePreview.evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(6500);
  await expect.poll(() => templatePreview.evaluate(el => {
    const card = el as HTMLElement, rect = card.getBoundingClientRect();
    const previous = card.style.pointerEvents;
    card.style.pointerEvents = 'auto';
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    card.style.pointerEvents = previous;
    return top === card || card.contains(top);
  })).toBe(true);
  await library.evaluate((el, original) => { (el as HTMLElement).style.zIndex = original; }, templatePickerLayer);

  await library.getByRole('button', { name: 'Import private copy' }).click();
  await expect(library.getByRole('tab', { name: 'My templates' })).toHaveAttribute('aria-selected', 'true');
  await library.getByRole('tab', { name: 'Room public templates' }).click();
  await library.getByRole('button', { name: 'Use template', exact: true }).click();
  await expect(editor.getByRole('button', { name: /^Template Fields/ })).toBeVisible();
  const templatePanel = editor.locator('.v-expansion-panel').filter({ hasText: 'Template Fields' });
  await expect(templatePanel.getByLabel('Name', { exact: true })).toHaveAttribute('readonly', '');
  await templatePanel.getByLabel('Value', { exact: true }).fill('42');
  await editor.getByRole('button', { name: 'Fields', exact: true }).click();
  await editor.getByRole('button', { name: 'Add field', exact: true }).click();
  await expect(fieldPicker.locator(".bag-field-picker__field-quick-option")).toHaveCount(2);
  await fieldPicker.getByRole('tab', { name: 'Room public fields', exact: true }).click();
  await expect(fieldPicker.locator(".bag-field-picker__field-catalog-entry").filter({ hasText: 'Damage' })).toHaveCount(0);
  await fieldPicker.getByRole('button', { name: 'Close', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect(items[0].name).toBe('My blade');
  expect(items[0].fields[0].value).toBe(42);
  expect(items[0].itemTemplate.name).toBe('Public sword');
  expect(items[0].fields[0].itemTemplateField).toBe(true);
  await panel.locator(".room-bag-dialog__inventory-slot").hover();
  await panel.locator(".room-bag-dialog__inventory-menu-trigger").click();
  await page.getByText('Edit item', { exact: true }).click();
  await editor.getByRole('button', { name: 'Template Fields', exact: false }).click();
  await expect(editor.getByLabel('Value', { exact: true })).toHaveValue('42');
  await editor.getByRole('button', { name: 'Item Template', exact: true }).click();
  await library.getByRole('tab', { name: 'Room public templates' }).click();
  await library.getByRole('button', { name: 'Use template', exact: true }).click();
  const confirmation = page.getByRole('dialog').filter({ hasText: 'Apply this template?' });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await library.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editor.getByLabel('Value', { exact: true })).toHaveValue('42');
});
