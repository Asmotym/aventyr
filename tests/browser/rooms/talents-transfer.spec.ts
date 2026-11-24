import { newTalentTree } from '../../../server/core/types/talents.types';

import { test, expect } from '@playwright/test';

import { setup, navigate } from '../support/rooms.fixture';

test('talents export downloads and copies a complete tree with images, then file import reviews and renames a duplicate', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1600, height: 1080 }); await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentTransfer: true });
  const uploads: Buffer[] = []; const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await page.route('**/talents/images**', async route => {
    if (route.request().method() === 'POST') { uploads.push(route.request().postDataBuffer()!); await route.fulfill({ json: { success: true, data: { id: 'import-art-' + uploads.length } } }); }
    else await route.fulfill({ contentType: 'image/webp', body: png });
  });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  const card = page.locator('.talent-tree-card').filter({ has: page.getByRole('heading', { name: 'Warrior', exact: true }) });
  await card.getByRole('button', { name: 'Export tree', exact: true }).click(); const downloading = page.waitForEvent('download'); await page.getByText('Download JSON', { exact: true }).click(); const download = await downloading;
  expect(download.suggestedFilename()).toBe('Warrior.json'); const { readFile } = await import('node:fs/promises'); const text = await readFile((await download.path())!, 'utf8'); const exported = JSON.parse(text);
  expect(exported).toMatchObject({ format: 'aventyr-talent-tree', version: 1 }); expect(exported.tree.options).toMatchObject({ connectionStyle: 'square', connectionArrow: 'diamond' }); expect(exported.tree.nodes).toHaveLength(8); expect(exported.tree.subtrees).toHaveLength(2); expect(exported.tree.decorations).toHaveLength(1); expect(Object.keys(exported.images)).toEqual(['tree-art', 'branch-art']); expect(exported).not.toHaveProperty('player');
  await card.getByRole('button', { name: 'Export tree', exact: true }).click(); await page.getByText('Copy JSON', { exact: true }).click(); await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  await page.getByRole('button', { name: 'Add Talent Tree', exact: true }).click(); const layout = page.getByRole('dialog', { name: 'Choose a layout', exact: true });
  const choosing = page.waitForEvent('filechooser'); await layout.getByRole('button', { name: 'Import JSON file', exact: true }).click(); await (await choosing).setFiles({ name: 'Warrior.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  const preview = page.getByRole('dialog', { name: 'Review import', exact: true }); await expect(preview).toBeVisible();
  const counts = await preview.locator('.transfer-summary > div').allTextContents(); expect(counts.map(value => value.replace(/\s+/g, ' ').trim())).toEqual(['8Nodes', '24Ranks', '8Connections', '2Subtrees', '1Shapes', '2Images']);
  expect(uploads).toHaveLength(0); expect(writes.filter(write => write.payload.op === 'save')).toHaveLength(0); await preview.screenshot({ path: info.outputPath('talent-import-review.png'), animations: 'disabled' });
  await preview.getByRole('button', { name: 'Import tree', exact: true }).click(); const naming = page.getByRole('dialog', { name: 'Choose a tree name', exact: true }); await expect(naming).toContainText('already exists'); await expect(naming.getByLabel('Name', { exact: true })).toHaveValue('Warrior (2)');
  await naming.getByLabel('Name', { exact: true }).fill('  WARRIOR  '); await expect(naming.getByRole('button', { name: 'Import tree', exact: true })).toBeDisabled();
  await naming.getByLabel('Name', { exact: true }).fill('Warrior Imported'); await naming.screenshot({ path: info.outputPath('talent-import-duplicate-name.png'), animations: 'disabled' }); await naming.getByRole('button', { name: 'Import tree', exact: true }).click(); await expect(naming).toBeHidden(); await expect(layout).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Warrior Imported', exact: true })).toBeVisible(); expect(uploads).toHaveLength(2);
  const saved = writes.findLast(write => write.payload.op === 'save').payload.tree; expect(saved.id).not.toBe(exported.tree.id); expect(saved.nodes[0].imageId).toBe(saved.imageId); expect(saved.imageId).toBe('import-art-1'); expect(saved.subtrees[0].imageId).toBe('import-art-2');
  const expected = structuredClone(exported.tree); expected.id = saved.id; expected.name = 'Warrior Imported'; expected.imageId = 'import-art-1'; expected.nodes[0].imageId = 'import-art-1'; expected.subtrees[0].imageId = 'import-art-2'; expect(saved).toEqual(expected);
  expect(writes.filter(write => write.payload.op === 'save')).toHaveLength(1); await expect(card).toHaveCount(1);
});

test('talents clipboard import supports manual paste, cancellation, validation, missing links and keeping duplicate names', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true });
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => { throw new Error('Denied'); }, writeText: async () => { throw new Error('Denied'); } } }));
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  const card = page.locator('.talent-tree-card').first(); await card.getByRole('button', { name: 'Export tree', exact: true }).click(); await page.getByText('Copy JSON', { exact: true }).click(); const copying = page.getByRole('dialog', { name: 'Copy JSON', exact: true }); await expect(copying).toBeVisible();
  const text = await copying.getByLabel('Tree JSON', { exact: true }).inputValue(); const data = JSON.parse(text); await copying.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Add Talent Tree', exact: true }).click(); const layout = page.getByRole('dialog', { name: 'Choose a layout', exact: true }); await layout.getByRole('button', { name: 'Import from clipboard', exact: true }).click();
  const paste = page.getByRole('dialog', { name: 'Import from clipboard', exact: true }); await paste.getByLabel('Tree JSON', { exact: true }).fill('{bad'); await paste.getByRole('button', { name: 'Review import', exact: true }).click(); await expect(page.locator('.v-snackbar')).toContainText('not valid');
  await paste.getByLabel('Tree JSON', { exact: true }).fill(JSON.stringify({ ...data, version: 99 })); await paste.getByRole('button', { name: 'Review import', exact: true }).click(); await expect(page.locator('.v-snackbar')).toContainText('not supported');
  data.tree.parentTreeId = 'missing-parent'; data.tree.nodes[0].linkedTreeId = 'missing-target';
  await paste.getByLabel('Tree JSON', { exact: true }).fill(JSON.stringify(data)); await paste.getByRole('button', { name: 'Review import', exact: true }).click(); const preview = page.getByRole('dialog', { name: 'Review import', exact: true }); await expect(preview).toContainText('1 links'); await expect(preview.getByRole('button', { name: 'Import tree', exact: true })).toBeDisabled(); await preview.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(writes.filter(write => write.payload.op === 'save')).toHaveLength(0);
  await layout.getByRole('button', { name: 'Import from clipboard', exact: true }).click(); await paste.getByLabel('Tree JSON', { exact: true }).fill(JSON.stringify(data)); await paste.getByRole('button', { name: 'Review import', exact: true }).click();
  await preview.getByRole('combobox').click(); await page.getByRole('option', { name: 'No parent (top-level tree)', exact: true }).click();
  await preview.screenshot({ path: info.outputPath('talent-import-mobile-review.png'), animations: 'disabled' }); await preview.getByRole('button', { name: 'Import tree', exact: true }).click(); const naming = page.getByRole('dialog', { name: 'Choose a tree name', exact: true }); await naming.getByRole('button', { name: 'Keep original name', exact: true }).click(); await expect(naming).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Warrior', exact: true })).toHaveCount(2); const saved = writes.findLast(write => write.payload.op === 'save').payload.tree; expect(saved.id).not.toBe(data.tree.id); expect(saved.parentTreeId).toBeNull(); expect(saved.nodes[0].linkedTreeId).toBeNull();
  data.tree.name = 'Clipboard tree'; const clipboardJSON = JSON.stringify(data);
  await page.evaluate(text => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => text } }), clipboardJSON);
  await page.getByRole('button', { name: 'Add Talent Tree', exact: true }).click(); await layout.getByRole('button', { name: 'Import from clipboard', exact: true }).click();
  await expect(paste.getByLabel('Tree JSON', { exact: true })).toHaveValue(clipboardJSON); await paste.getByRole('button', { name: 'Review import', exact: true }).click(); await preview.getByRole('combobox').click(); await page.getByRole('option', { name: 'No parent (top-level tree)', exact: true }).click(); await preview.getByRole('button', { name: 'Import tree', exact: true }).click();
  await expect(preview).toBeHidden(); await expect(page.getByRole('heading', { name: 'Clipboard tree', exact: true })).toBeVisible(); expect(writes.filter(write => write.payload.op === 'save')).toHaveLength(2);
});

for (const choice of ['replacement', 'none', 'existing'] as const) {
  test(`talents child import requires a parent decision and preserves ${choice} choice`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1000 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true });
    const imported = newTalentTree('incoming-child', 'classic'); imported.name = choice === 'replacement' ? 'Warrior' : 'Imported child'; imported.parentTreeId = choice === 'existing' ? 'talent-tree' : 'unavailable-parent';
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Add Talent Tree', exact: true }).click();
    const layout = page.getByRole('dialog', { name: 'Choose a layout', exact: true }), choosing = page.waitForEvent('filechooser'); await layout.getByRole('button', { name: 'Import JSON file', exact: true }).click(); await (await choosing).setFiles({ name: 'child.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
    const preview = page.getByRole('dialog', { name: 'Review import', exact: true }), confirm = preview.getByRole('button', { name: 'Import tree', exact: true }); await expect(preview).toBeVisible();
    expect(writes.filter(write => write.payload.op === 'save')).toHaveLength(0);
    if (choice === 'existing') { await expect(preview.getByRole('combobox')).toHaveCount(0); await expect(confirm).toBeEnabled(); }
    else {
      await expect(preview).toContainText('original parent tree is unavailable'); await expect(confirm).toBeDisabled();
      await preview.getByRole('combobox').click(); await expect(page.getByRole('option', { name: 'No parent (top-level tree)', exact: true })).toBeVisible(); await expect(page.getByRole('option', { name: 'Warrior', exact: true })).toBeVisible();
      await page.getByRole('option', { name: choice === 'replacement' ? 'Warrior' : 'No parent (top-level tree)', exact: true }).click(); await expect(confirm).toBeEnabled();
      await preview.screenshot({ path: info.outputPath(`talent-import-parent-${choice}.png`), animations: 'disabled' });
    }
    await confirm.click();
    if (choice === 'replacement') { const naming = page.getByRole('dialog', { name: 'Choose a tree name', exact: true }); await naming.getByLabel('Name', { exact: true }).fill('Imported child'); await naming.getByRole('button', { name: 'Import tree', exact: true }).click(); await expect(naming).toBeHidden(); }
    await expect(preview).toBeHidden();
    const saved = writes.findLast(write => write.payload.op === 'save').payload.tree; expect(saved.parentTreeId).toBe(choice === 'none' ? null : 'talent-tree'); expect(saved.id).not.toBe(imported.id);
    const card = page.locator('.talent-tree-card').filter({ has: page.getByRole('heading', { name: 'Imported child', exact: true }) }); await expect(card).toHaveAttribute('data-depth', choice === 'none' ? '0' : '1');
    expect(writes.filter(write => write.payload.op === 'save')).toHaveLength(1);
  });
}

test('talents archive and restore preserve cards, player ranks and confirmed deletion refund review', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1600, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click(); const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }); await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await viewer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true }), card = page.locator('.talent-tree-card').filter({ has: page.getByRole('heading', { name: 'Warrior', exact: true }) });
  const originalStyle = await card.evaluate(el => { const style = getComputedStyle(el); return { border: style.borderRadius, background: style.backgroundColor }; });
  await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await expect(page.getByText('Archive', { exact: true })).toBeVisible(); await expect(page.getByText('Delete', { exact: true })).toBeVisible(); await page.getByText('Archive', { exact: true }).click(); await expect(card).toHaveCount(0);
  expect(writes.filter(write => write.payload.op === 'delete')).toHaveLength(0); expect(writes.findLast(write => write.payload.op === 'archive').payload.archived).toBe(true);
  await settings.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click(); await expect(viewer.locator('.canvas-title')).toHaveCount(0); await viewer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: /^Open archives/ }).click();
  await expect(page.locator('.talent-feature-hero h2')).toHaveText('Archived talent trees'); await expect(card).toBeVisible(); await expect(card.getByRole('button', { name: 'Export tree', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Add Talent Tree', exact: true })).toHaveCount(0);
  expect(await card.evaluate(el => { const style = getComputedStyle(el); return { border: style.borderRadius, background: style.backgroundColor }; })).toEqual(originalStyle); await settings.screenshot({ path: info.outputPath('talent-archives-gallery.png'), animations: 'disabled' });
  await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await page.getByText('Restore', { exact: true }).click(); await expect(card).toHaveCount(0); await expect(page.getByRole('heading', { name: 'No archived talent trees.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to talent trees', exact: true }).click(); await expect(card).toBeVisible(); expect(writes.findLast(write => write.payload.op === 'archive').payload.archived).toBe(false);
  await settings.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible(); await expect(viewer.locator('.talent-build-summary')).toContainText('1 points invested'); await viewer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await page.getByText('Delete', { exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete talent tree', exact: true }); await expect(confirmation).toContainText('permanently'); expect(writes.filter(write => write.payload.op === 'delete')).toHaveLength(0);
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(confirmation).toContainText('their points refunded'); await expect(confirmation).toContainText('Owner'); await expect(card).toHaveCount(1); await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await page.getByText('Delete', { exact: true }).click(); await confirmation.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(confirmation).toContainText('Owner'); await confirmation.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(confirmation).toBeHidden(); await expect(card).toHaveCount(0);
  expect(writes.findLast(write => write.payload.op === 'delete').payload.confirmReset).toBe(true);
});

test('talents archived cards retain mobile styling and require confirmation for permanent deletion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 }); const writes = await setup(page, 'light', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true }), card = page.locator('.talent-tree-card').first(), confirmation = page.getByRole('dialog', { name: 'Delete talent tree', exact: true });
  await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await page.getByText('Delete', { exact: true }).click(); await expect(confirmation).toBeVisible(); expect(writes.filter(write => write.payload.op === 'delete')).toHaveLength(0); await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await page.getByText('Archive', { exact: true }).click(); await expect(page.locator('.talent-tree-card')).toHaveCount(0); await page.getByRole('button', { name: /^Open archives/ }).click(); await expect(card).toBeVisible();
  const box = (await card.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390); await settings.screenshot({ path: info.outputPath('talent-archives-mobile.png'), animations: 'disabled' });
  await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await page.getByText('Delete', { exact: true }).click(); await expect(confirmation).toContainText('Warrior'); expect(writes.filter(write => write.payload.op === 'delete')).toHaveLength(0); await confirmation.screenshot({ path: info.outputPath('talent-delete-confirmation-mobile.png'), animations: 'disabled' }); await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Tree actions', exact: true }).click(); await page.getByText('Delete', { exact: true }).click(); await confirmation.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(confirmation).toBeHidden(); await expect(page.locator('.talent-tree-card')).toHaveCount(0); await expect(page.getByRole('heading', { name: 'No archived talent trees.', exact: true })).toBeVisible(); expect(writes.filter(write => write.payload.op === 'delete')).toHaveLength(1);
});
