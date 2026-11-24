import { test, expect } from '@playwright/test';

import { setup, navigate } from '../support/rooms.fixture';

for (const layout of ['Classic', 'Centered', 'Free Positions']) {
  test(`talents editor creates and saves ${layout} trees`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
    await page.getByRole('button', { name: 'Add Talent Tree', exact: true }).click();
    await page.getByRole('button', { name: layout, exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByLabel('Name', { exact: true }).fill(layout + ' build');
    await editor.getByRole('button', { name: 'Add node', exact: true }).click();
    const nodePopup = page.getByRole('dialog', { name: 'Edit talent', exact: true });
    await nodePopup.getByLabel('Name', { exact: true }).fill('First talent');
    await nodePopup.getByRole('button', { name: 'Apply to tree', exact: true }).click();
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor).not.toBeVisible();
    expect(writes.some(w => w.action === 'talents' && w.payload.op === 'save' && w.payload.tree.nodes[0].name === 'First talent')).toBeTruthy();
  });
}

test('talents viewer allocates, reaches maximum, reverts and refunds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); const writes = await setup(page, 'dark', 'player', false, { talents: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const panel = page.locator('.room-slide-panel:visible');
  await panel.getByRole('button', { name: 'Strength: 0/2', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Allocate point', exact: true }).click();
  await expect(panel.getByText('Maximum level reached.', { exact: true }).last()).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Allocate point', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Remove point', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await panel.getByRole('button', { name: 'Reset tree', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible();
  expect(writes.filter(w => w.action === 'talents' && w.payload.op === 'allocate')).toHaveLength(2);
});

test('talents editor confirms unsaved changes and enforces manager access', async ({ page }) => {
  await setup(page, 'light', 'dm', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await editor.getByLabel('Name', { exact: true }).fill('Unsaved');
  page.once('dialog', dialog => dialog.dismiss()); await editor.getByRole('button', { name: 'Close', exact: true }).click(); await expect(editor).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await editor.getByRole('button', { name: 'Close', exact: true }).click(); await expect(editor).not.toBeVisible();
});

test('talents manual distribution updates the selected wallet', async ({ page }) => {
  const writes = await setup(page, 'light', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Manage global point distribution', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Add point Owner', exact: true }) });
  await dialog.getByRole('button', { name: 'Add point Owner', exact: true }).click();
  await expect(dialog.getByRole('spinbutton', { name: 'Points Owner', exact: true })).toHaveValue('3');
  expect(writes.some(w => w.action === 'talents' && w.payload.op === 'balance' && w.payload.points === 3 && !w.payload.treeId)).toBeTruthy();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Manage point distribution', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add point Owner', exact: true }).click();
  await expect(dialog.getByRole('spinbutton', { name: 'Points Owner', exact: true })).toHaveValue('2');
  expect(writes.some(w => w.action === 'talents' && w.payload.op === 'balance' && w.payload.treeId === 'talent-tree')).toBeTruthy();
});

test('talents viewer fits mobile and offers explicit touch controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page, 'dark', 'player', false, { talents: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
  await expect(panel).toBeVisible();
  expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(390);
  await panel.getByRole('button', { name: 'Strength: 0/2', exact: true }).click();
  await panel.getByRole('button', { name: 'Remove point', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Room settings', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByText('Talent Trees', { exact: true })).toHaveCount(0);
});

for (const [theme, width] of [['light', 1440], ['dark', 1440], ['dark', 390]] as const) {
  test(`talents visual review uses native room surfaces (${theme}, ${width})`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1080 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await setup(page, theme, 'creator', false, { talents: true, talentDesign: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
    const settingsPanel = page.getByRole('dialog', { name: 'Settings', exact: true });
    await expect(settingsPanel.locator('.talent-tree-card')).toHaveCount(3);
    expect(await settingsPanel.locator('.talent-settings').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await settingsPanel.screenshot({ path: info.outputPath('talents-gallery.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Add Talent Tree', exact: true }).click();
    const layoutDialog = page.getByRole('dialog', { name: 'Choose a layout', exact: true });
    await layoutDialog.screenshot({ path: info.outputPath('talents-layouts.png'), animations: 'disabled' });
    await layoutDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await settingsPanel.getByRole('button', { name: 'Manage global point distribution', exact: true }).click();
    const distribution = page.getByRole('dialog', { name: 'Manage point distribution', exact: true });
    await distribution.screenshot({ path: info.outputPath('talents-points.png'), animations: 'disabled' });
    await distribution.getByRole('button', { name: 'Close', exact: true }).click();
    await settingsPanel.locator('.talent-tree-card').filter({ hasText: 'Warrior' }).getByRole('button', { name: 'Member visibility', exact: true }).click();
    const visibility = page.getByRole('dialog', { name: 'Member visibility', exact: true });
    await visibility.screenshot({ path: info.outputPath('talents-visibility.png'), animations: 'disabled' });
    await visibility.getByRole('button', { name: 'Close', exact: true }).click();
    await settingsPanel.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    await expect(editor.getByRole('button', { name: 'Strength: 0/3', exact: true })).toBeVisible();
    expect((await editor.locator('.talent-inspector-tabs').boundingBox())!.height).toBeLessThanOrEqual(48);
    await editor.screenshot({ path: info.outputPath('talents-editor.png'), animations: 'disabled' });
    expect((await editor.boundingBox())!.width).toBeCloseTo((await page.locator('.room-panel-host').boundingBox())!.width, 0);
    await editor.getByRole('button', { name: 'Strength: 0/3', exact: true }).click({ button: 'right' });
    const nodePopup = page.getByRole('dialog', { name: 'Edit talent', exact: true });
    await expect(nodePopup.getByLabel('Name', { exact: true })).toHaveValue('Strength');
    await nodePopup.screenshot({ path: info.outputPath('talents-node-inspector.png'), animations: 'disabled' });
    await nodePopup.getByRole('button', { name: 'Close', exact: true }).click();
    await editor.getByRole('button', { name: 'Close', exact: true }).click();
    for (const [name, layout] of [['Arcanist', 'centered'], ['Wayfinder', 'free']] as const) {
      await settingsPanel.getByRole('button', { name: 'Edit tree: ' + name, exact: true }).click();
      await expect(editor.getByRole('button', { name: 'Strength: 0/3', exact: true })).toBeVisible();
      if (layout === 'centered') await expect(editor.locator('.talent-hub-edge')).toHaveCount(4);
      if (width < 600) await expect.poll(async () => {
        const target = await editor.getByRole('button', { name: 'Strength: 0/3', exact: true }).boundingBox();
        const canvas = await editor.locator('.canvas-viewport').boundingBox();
        return !!target && !!canvas && target.x >= canvas.x && target.y >= canvas.y && target.x + target.width <= canvas.x + canvas.width && target.y + target.height <= canvas.y + canvas.height;
      }).toBe(true);
      await editor.screenshot({ path: info.outputPath('talents-editor-' + layout + '.png'), animations: 'disabled' });
      await editor.getByRole('button', { name: 'Close', exact: true }).click();
    }
    await settingsPanel.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
    await expect(viewer.getByRole('button', { name: 'Strength: 3/3', exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'Strength: 3/3', exact: true }).click();
    await page.mouse.move(0, 0);
    await viewer.screenshot({ path: info.outputPath('talents-viewer.png'), animations: 'disabled' });
    expect(await viewer.locator('.viewer-main').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect((await viewer.locator('.viewer-main').boundingBox())!.width).toBeLessThanOrEqual((await viewer.boundingBox())!.width);
    expect(await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('talents canvas has navigation space, pointer-anchored wheel zoom and right-button panning', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await setup(page, 'dark', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  const canvas = editor.locator('.canvas-viewport'), zoom = editor.locator('.canvas-zoom-controls > span');
  await expect(zoom).toHaveText('100%');
  await expect.poll(() => canvas.evaluate(el => el.scrollLeft)).toBeGreaterThan(1000);
  const space = await canvas.evaluate(el => ({ width: el.scrollWidth - el.clientWidth, height: el.scrollHeight - el.clientHeight }));
  expect(space.width).toBeGreaterThanOrEqual(3000); expect(space.height).toBeGreaterThanOrEqual(3000);
  const node = editor.getByRole('button', { name: 'Strength: 0/2', exact: true });
  const before = (await node.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.wheel(0, -160);
  await expect.poll(async () => Number((await zoom.textContent())!.replace('%', ''))).toBeGreaterThan(100);
  const after = (await node.boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - before.x - before.width / 2)).toBeLessThan(2);
  expect(Math.abs(after.y + after.height / 2 - before.y - before.height / 2)).toBeLessThan(2);
  await page.mouse.wheel(0, 160); await expect(zoom).toHaveText('100%');
  const bounds = (await canvas.boundingBox())!, origin = await canvas.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.mouse.move(bounds.x + 20, bounds.y + 20); await page.mouse.down({ button: 'right' });
  await page.mouse.move(bounds.x + 140, bounds.y + 100, { steps: 6 });
  await expect(canvas).toHaveClass(/is-panning/); await page.mouse.up({ button: 'right' });
  await expect(canvas).not.toHaveClass(/is-panning/);
  const panned = await canvas.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  expect(panned.x).toBeCloseTo(origin.x - 120, 0); expect(panned.y).toBeCloseTo(origin.y - 80, 0);
  await canvas.focus(); await editor.getByRole('heading', { name: 'Talent Tree Editor', exact: true }).hover();
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => Number((await zoom.textContent())!.replace('%', ''))).toBeGreaterThan(100);
});

test('talents right-dragging over a node pans without spending or refunding points', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'player', false, { talents: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
  await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click();
  const node = viewer.getByRole('button', { name: 'Strength: 1/2', exact: true });
  await expect(node).toBeVisible();
  const bounds = (await node.boundingBox())!, canvas = viewer.locator('.canvas-viewport');
  const origin = await canvas.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down({ button: 'right' });
  await page.mouse.move(bounds.x + bounds.width / 2 + 60, bounds.y + bounds.height / 2 + 50, { steps: 6 }); await page.mouse.up({ button: 'right' });
  await expect(node).toBeVisible();
  const panned = await canvas.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  expect(panned.x).toBeCloseTo(Math.max(0, origin.x - 60), 0); expect(panned.y).toBeCloseTo(Math.max(0, origin.y - 50), 0);
  expect(writes.filter(w => w.action === 'talents' && w.payload.op === 'revert')).toHaveLength(0);
  await node.click({ button: 'right' });
  await expect(viewer.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible();
  expect(writes.filter(w => w.action === 'talents' && w.payload.op === 'allocate')).toHaveLength(1);
  expect(writes.filter(w => w.action === 'talents' && w.payload.op === 'revert')).toHaveLength(1);
});

test('talents node context popup applies or cancels edits without opening during right-drag', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), node = editor.getByRole('button', { name: 'Strength: 0/2', exact: true });
  await expect(editor.getByRole('tab', { name: 'Node', exact: true })).toHaveCount(0);
  const popup = page.getByRole('dialog', { name: 'Edit talent', exact: true });
  const position = (await node.boundingBox())!;
  await page.mouse.move(position.x + 20, position.y + 20); await page.mouse.down({ button: 'right' }); await page.mouse.move(position.x + 80, position.y + 60, { steps: 6 }); await page.mouse.up({ button: 'right' });
  await expect(popup).not.toBeVisible();
  await node.click({ button: 'right' }); await expect(popup).toBeVisible();
  await popup.getByLabel('Name', { exact: true }).fill('Cancelled talent'); await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
  await node.click({ button: 'right' }); await expect(popup.getByLabel('Name', { exact: true })).toHaveValue('Strength');
  await popup.getByLabel('Name', { exact: true }).fill('Fortitude'); await popup.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Fortitude: 0/2', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect(writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree.nodes[0].name).toBe('Fortitude');
});

test('talents subtree context popup and drag handle move the complete group on the grid', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true, talentDesign: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  const region = editor.locator('.canvas-subtree[data-subtree-id="path-0"]');
  await region.getByRole('button', { name: 'Edit subtree: Vanguard', exact: true }).click({ button: 'right' });
  const popup = page.getByRole('dialog', { name: 'Edit subtree', exact: true });
  await expect(popup.getByLabel('Name', { exact: true })).toHaveValue('Vanguard');
  await expect(popup.getByLabel('X', { exact: true })).toHaveCount(0); await expect(popup.getByLabel('Y', { exact: true })).toHaveCount(0);
  await popup.getByLabel('Name', { exact: true }).fill('Cancelled path'); await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
  await region.getByRole('button', { name: 'Edit subtree: Vanguard', exact: true }).click({ button: 'right' });
  await expect(popup.getByLabel('Name', { exact: true })).toHaveValue('Vanguard');
  await popup.getByLabel('Name', { exact: true }).fill('Defenders'); await popup.screenshot({ path: info.outputPath('talents-subtree-popup.png'), animations: 'disabled' });
  await popup.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await expect(popup).not.toBeVisible();
  const node = editor.getByRole('button', { name: 'Strength: 0/3', exact: true }), stationary = editor.getByRole('button', { name: 'Fury: 0/3', exact: true });
  const handle = region.getByRole('button', { name: 'Move subtree: Defenders', exact: true }); await handle.scrollIntoViewIfNeeded();
  const before = (await node.boundingBox())!, otherBefore = (await stationary.boundingBox())!, grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down(); await expect(region).toHaveClass(/is-dragging/); await page.mouse.move(grip.x + grip.width / 2 + 80, grip.y + grip.height / 2 + 40, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => Math.round((await node.boundingBox())!.x - before.x)).toBe(80);
  expect((await node.boundingBox())!.y - before.y).toBeCloseTo(40, 0);
  expect((await stationary.boundingBox())!.x).toBeCloseTo(otherBefore.x, 0);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.subtrees[0]).toMatchObject({ name: 'Defenders', x: 80, y: 40 });
  expect(tree.nodes[0]).toMatchObject({ x: 185, y: 110, subtreeId: 'path-0' });
  expect(tree.nodes[4]).toMatchObject({ x: 425, y: 70, subtreeId: 'path-1' });
});

test('talents free subtree drops reject overlap and preserve member nodes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  const handle = editor.getByRole('button', { name: 'Move subtree: Vanguard', exact: true });
  async function drag(dx: number, dy: number) {
    await handle.scrollIntoViewIfNeeded(); const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 }); await page.mouse.up();
  }
  const firstNode = editor.getByRole('button', { name: 'Strength: 0/3', exact: true });
  await handle.scrollIntoViewIfNeeded(); const original = (await firstNode.boundingBox())!;
  await drag(80, 0);
  await expect(editor.getByText('Subtrees cannot overlap. The subtree has been returned to its previous position.', { exact: true })).toBeVisible();
  expect((await firstNode.boundingBox())!.x).toBeCloseTo(original.x, 0);
  await drag(-80, 40); await expect(editor.getByText('Subtrees cannot overlap. The subtree has been returned to its previous position.', { exact: true })).toHaveCount(0);
  await handle.focus(); await page.keyboard.press('ArrowRight');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.subtrees[0]).toMatchObject({ x: -60, y: 40 });
  expect(tree.nodes.filter((node: any) => node.subtreeId === 'path-0')).toHaveLength(4);
  expect(tree.nodes[0]).toMatchObject({ x: 45, y: 110, subtreeId: 'path-0' });
  expect(tree.nodes[4]).toMatchObject({ x: 425, y: 70, subtreeId: 'path-1' });
});

test('talents context sidebar docks on the right, leaves the canvas usable and preserves canvas moves', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  const node = editor.getByRole('button', { name: 'Strength: 0/3', exact: true });
  await node.click({ button: 'right' });
  const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  await expect(sidebar).toBeVisible(); await expect(sidebar).not.toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('.v-overlay--active:not(.v-tooltip)')).toHaveCount(0);
  await expect.poll(async () => { const body = (await editor.locator('.talent-editor-body').boundingBox())!, pane = (await sidebar.boundingBox())!; return Math.abs(pane.x + pane.width - body.x - body.width); }).toBeLessThan(1);
  const body = (await editor.locator('.talent-editor-body').boundingBox())!, pane = (await sidebar.boundingBox())!;
  expect(pane.x + pane.width).toBeCloseTo(body.x + body.width, 0); expect(pane.y).toBeCloseTo(body.y, 0); expect(pane.height).toBeCloseTo(body.height, 0);
  expect(pane.width).toBeCloseTo(480, 0);
  await sidebar.getByLabel('Name', { exact: true }).fill('Steadfast');
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  const before = (await node.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 40, before.y + before.height / 2 + 20, { steps: 6 }); await page.mouse.up();
  await expect(sidebar.getByLabel('Name', { exact: true })).toHaveValue('Steadfast');
  await expect.poll(async () => Math.round((await node.boundingBox())!.x - before.x)).toBe(35);
  await editor.screenshot({ path: info.outputPath('talents-right-sidebar.png'), animations: 'disabled' });
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await expect(sidebar).not.toBeVisible();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.nodes[0]).toMatchObject({ name: 'Steadfast', x: 140, y: 100 });
});

test('talents sidebar Escape closes only the sidebar and mobile panels stay inside the room', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await editor.getByRole('button', { name: 'Strength: 0/3', exact: true }).click({ button: 'right' });
  const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  await expect(sidebar).toBeVisible();
  await expect.poll(async () => { const body = (await editor.locator('.talent-editor-body').boundingBox())!, pane = (await sidebar.boundingBox())!; return Math.abs(pane.x + pane.width - body.x - body.width); }).toBeLessThan(1);
  const body = (await editor.locator('.talent-editor-body').boundingBox())!, pane = (await sidebar.boundingBox())!;
  expect(pane.width).toBeCloseTo(body.width, 0); expect(pane.height).toBeCloseTo(body.height, 0);
  await sidebar.getByLabel('Name', { exact: true }).fill('Cancelled');
  await page.keyboard.press('Escape'); await expect(sidebar).not.toBeVisible(); await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Strength: 0/3', exact: true }).click({ button: 'right' });
  await expect(sidebar.getByLabel('Name', { exact: true })).toHaveValue('Strength');
  await page.keyboard.press('Escape'); await expect(sidebar).not.toBeVisible();
  await editor.getByRole('tab', { name: 'Subtrees', exact: true }).click();
  await editor.locator('.talent-subtree-list-item').filter({ hasText: 'Vanguard' }).click();
  const subtreeSidebar = editor.getByRole('dialog', { name: 'Edit subtree', exact: true });
  await expect(subtreeSidebar).toBeVisible();
  await expect(subtreeSidebar).not.toHaveAttribute('aria-modal', 'true');
  await page.keyboard.press('Escape'); await expect(subtreeSidebar).not.toBeVisible(); await expect(editor).toBeVisible();
});

test('talents subtree borders resize corners on the grid at different zoom levels without moving talents', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  const region = editor.locator('.canvas-subtree[data-subtree-id="path-0"]');
  await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(editor.locator('.canvas-zoom-controls > span')).toHaveText('85%');
  async function resize(corner: string, dx: number, dy: number) {
    const handle = region.getByRole('button', { name: `Resize subtree: Vanguard (${corner})`, exact: true });
    await handle.scrollIntoViewIfNeeded(); const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await expect(region).toHaveClass(/is-resizing/);
    await page.mouse.move(box.x + box.width / 2 + dx * .85, box.y + box.height / 2 + dy * .85, { steps: 8 }); await page.mouse.up();
  }
  await resize('bottom-right corner', 40, 80);
  await expect.poll(() => region.evaluate(el => (el as HTMLElement).style.width)).toBe('320px');
  await expect.poll(() => region.evaluate(el => (el as HTMLElement).style.height)).toBe('540px');
  await resize('top-left corner', -40, -20);
  await expect.poll(() => region.evaluate(el => (el as HTMLElement).style.width)).toBe('360px');
  await expect.poll(() => region.evaluate(el => (el as HTMLElement).style.height)).toBe('560px');
  await region.hover(); await editor.screenshot({ path: info.outputPath('talents-subtree-resize.png'), animations: 'disabled' });
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.subtrees[0]).toMatchObject({ x: -40, y: -20, width: 360, height: 560 });
  expect(tree.nodes[0]).toMatchObject({ x: 105, y: 70, subtreeId: 'path-0' });
  expect(tree.nodes[4]).toMatchObject({ x: 425, y: 70, subtreeId: 'path-1' });
});

test('talents subtree resize rejects overlapping drops and clamps to the minimum size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), region = editor.locator('.canvas-subtree[data-subtree-id="path-0"]');
  const edge = region.getByRole('button', { name: 'Resize subtree: Vanguard (right edge)', exact: true });
  await edge.scrollIntoViewIfNeeded(); const box = (await edge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
  await expect(editor.getByText('Subtrees cannot overlap. The subtree has been returned to its previous position.', { exact: true })).toBeVisible();
  expect(await region.evaluate(el => (el as HTMLElement).style.width)).toBe('280px');
  await edge.focus(); for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowLeft');
  await expect.poll(() => region.evaluate(el => (el as HTMLElement).style.width)).toBe('80px');
  const bottom = region.getByRole('button', { name: 'Resize subtree: Vanguard (bottom edge)', exact: true });
  await bottom.focus(); for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowUp');
  await expect.poll(() => region.evaluate(el => (el as HTMLElement).style.height)).toBe('80px');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.nodes).toHaveLength(8); expect(tree.nodes[0]).toMatchObject({ x: 105, y: 70 });
  expect(tree.subtrees[0]).toMatchObject({ x: 0, y: 0, width: 80, height: 80 });
});

test('talents canvas resizing updates an open subtree sidebar and survives applying its fields', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), region = editor.locator('.canvas-subtree[data-subtree-id="path-0"]');
  await region.getByRole('button', { name: 'Edit subtree: Vanguard', exact: true }).click();
  const sidebar = editor.getByRole('dialog', { name: 'Edit subtree', exact: true });
  await sidebar.getByLabel('Name', { exact: true }).fill('Expanded path');
  const canvas = (await editor.locator('.canvas-viewport').boundingBox())!;
  await page.mouse.move(canvas.x + 220, canvas.y + 60); await page.mouse.down({ button: 'right' });
  await page.mouse.move(canvas.x + 40, canvas.y + 60, { steps: 6 }); await page.mouse.up({ button: 'right' });
  const edge = region.getByRole('button', { name: 'Resize subtree: Vanguard (right edge)', exact: true });
  await edge.hover();
  await edge.scrollIntoViewIfNeeded(); const box = (await edge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await expect(region).toHaveClass(/is-resizing/);
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
  await expect(sidebar.getByLabel('Width', { exact: true })).toHaveValue('320');
  await expect(sidebar.getByLabel('Name', { exact: true })).toHaveValue('Expanded path');
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect(writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree.subtrees[0]).toMatchObject({ name: 'Expanded path', width: 320, height: 460 });
});

test('talents centered subtree manual dimensions persist after reopening the editor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentCentered: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), region = editor.locator('.canvas-subtree[data-subtree-id="path-0"]');
  const size = await region.evaluate(el => ({ width: parseFloat((el as HTMLElement).style.width), height: parseFloat((el as HTMLElement).style.height) }));
  const edge = region.getByRole('button', { name: 'Resize subtree: Vanguard (bottom-right corner)', exact: true });
  await edge.scrollIntoViewIfNeeded(); const box = (await edge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 6 }); await page.mouse.up();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree.subtrees[0];
  expect(saved).toMatchObject({ width: size.width + 60, height: size.height + 40, boundsMode: 'manual' });
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  await expect.poll(() => region.evaluate(el => parseFloat((el as HTMLElement).style.width))).toBe(saved.width);
  await expect.poll(() => region.evaluate(el => parseFloat((el as HTMLElement).style.height))).toBe(saved.height);
});
