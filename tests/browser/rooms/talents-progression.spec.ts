import { test, expect, type Page } from '@playwright/test';

import { setup, navigate } from '../support/rooms.fixture';

test('talents progression editor configures hierarchy, linked access, rank costs and active skills end to end', async ({ page }, info) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1600, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentProgression: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  async function select(root: ReturnType<Page['locator']>, label: string, value: string) {
    await root.getByRole('combobox').filter({ has: page.getByRole('textbox', { name: label, exact: true }) }).click();
    await page.getByRole('option', { name: value, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Edit tree: Advanced', exact: true }).click();
  await select(editor, 'Parent tree', 'Warrior'); await select(editor, 'Tree access', 'Requires access');
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  await editor.getByRole('button', { name: 'Strength: 0/2', exact: true }).click({ button: 'right' });
  const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  await sidebar.getByRole('button', { name: 'Active skill', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Talent Tree Connection', exact: true }).click();
  await select(sidebar, 'Unlock talent tree', 'Advanced');
  await sidebar.getByRole('button', { name: 'Conditions', exact: true }).click();
  await sidebar.getByLabel('Points per rank', { exact: true }).fill('3');
  await sidebar.getByRole('button', { name: /^Ranks/ }).click();
  const rank = sidebar.locator(".talent-editor__level-editor").nth(1);
  await rank.getByRole('checkbox', { name: 'Override point cost', exact: true }).check();
  await rank.getByLabel('Rank point cost', { exact: true }).fill('0');
  await sidebar.screenshot({ path: info.outputPath('talent-rank-cost-editor.png'), animations: 'disabled' });
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(sidebar).toBeHidden();
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
  expect(saved.nodes[0]).toMatchObject({ category: 'active', cost: 3, linkedTreeId: 'advanced' }); expect(saved.nodes[0].levels[1].cost).toBe(0);
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), navigation = viewer.locator(".room-talents-viewer__talent-navigation-list");
  await expect(navigation.getByText('Advanced', { exact: true })).toHaveCount(0); await expect(navigation.getByText('Mastery Notes', { exact: true })).toBeVisible();
  const first = viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }); await expect(first).toHaveAttribute('data-category', 'active'); await expect(first).toHaveCSS('border-radius', '6px'); await first.hover();
  const tooltip = page.locator('.talent-node-tooltip:visible'); await expect(tooltip.getByText('Cost: 3 points', { exact: true })).toBeVisible(); await expect(tooltip.getByText('Active skill', { exact: true })).toBeVisible();
  await first.click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible();
  await expect(navigation.getByText('Advanced', { exact: true })).toBeVisible(); await expect(viewer.getByRole('status')).toContainText('Advanced');
  await expect(viewer.locator(".talent-canvas__title")).toHaveText('Warrior'); await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('3 points invested');
  await expect(viewer.getByRole('button', { name: 'Allocate point', exact: true })).toContainText('Free');
  await viewer.getByRole('button', { name: 'Allocate point', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 2/2', exact: true })).toBeVisible();
  await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('3 points invested');
  await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await viewer.getByRole('button', { name: 'Remove point', exact: true }).click();
  await expect(viewer.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible(); await expect(navigation.getByText('Advanced', { exact: true })).toHaveCount(0);
  await expect(viewer.locator(".talent-canvas__linked-paths")).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click();
  await viewer.locator(".talent-canvas__linked-paths").getByRole('button', { name: 'Open Advanced', exact: true }).click(); await expect(viewer.locator(".talent-canvas__title")).toHaveText('Advanced');
  await expect(viewer.getByRole('button', { name: 'Focus: 0/2', exact: true })).toHaveCSS('border-radius', '50%');
  await expect(navigation.locator(".room-talents-viewer__talent-tree-nav-row[data-depth=\"2\"]")).toContainText('Mastery Notes');
  await viewer.getByRole('button', { name: 'Collapse Warrior', exact: true }).click(); await expect(navigation.getByText('Advanced', { exact: true })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Expand Warrior', exact: true }).click(); await expect(navigation.getByText('Advanced', { exact: true })).toBeVisible();
  await page.mouse.move(0, 0); await viewer.screenshot({ path: info.outputPath('talent-linked-tree-viewer.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(viewer.getByRole('button', { name: 'Focus: 0/2', exact: true })).toBeVisible();
  expect(await viewer.locator(".room-talents-viewer__talent-viewer-body").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await viewer.locator(".room-talents-viewer__talent-viewer-body").evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await viewer.screenshot({ path: info.outputPath('talent-linked-tree-mobile.png'), animations: 'disabled' });
});

test('talents manual access controls and retroactive node links preserve earned grants under hiding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true, talentProgression: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click(); const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
  await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await viewer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await page.getByRole('button', { name: 'Edit tree: Advanced', exact: true }).click();
  await editor.getByRole('combobox').filter({ has: page.getByRole('textbox', { name: 'Tree access', exact: true }) }).click(); await page.getByRole('option', { name: 'Requires access', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  const card = page.locator('.talent-tree-card').filter({ has: page.getByRole('heading', { name: 'Advanced', exact: true }) });
  await card.getByRole('button', { name: 'Member visibility', exact: true }).click();
  const visibility = page.getByRole('dialog', { name: 'Member visibility', exact: true });
  await visibility.getByRole('button', { name: 'Grant access Owner', exact: true }).click(); await expect(visibility.getByRole('button', { name: 'Remove manual access Owner', exact: true })).toBeVisible();
  await visibility.getByRole('button', { name: 'Remove manual access Owner', exact: true }).click(); await expect(visibility.getByRole('button', { name: 'Grant access Owner', exact: true })).toBeVisible();
  await visibility.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click(); await editor.getByRole('button', { name: 'Strength: 0/2', exact: true }).click({ button: 'right' });
  const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true }); await sidebar.getByRole('button', { name: 'Talent Tree Connection', exact: true }).click();
  await sidebar.getByRole('combobox').filter({ has: page.getByRole('textbox', { name: 'Unlock talent tree', exact: true }) }).click(); await page.getByRole('option', { name: 'Advanced', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await sidebar.waitFor({ state: 'hidden' }); await editor.getByRole('button', { name: 'Save', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
  await card.getByRole('button', { name: 'Member visibility', exact: true }).click(); await expect(visibility.getByText('Unlocked by talent', { exact: true })).toBeVisible();
  await visibility.getByRole('button', { name: 'Hide tree for Owner', exact: true }).click(); await visibility.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  await expect(viewer.locator(".room-talents-viewer__talent-navigation-list").getByText('Advanced', { exact: true })).toHaveCount(0);
  await expect(viewer.locator(".talent-canvas__linked-paths")).toHaveCount(0);
  expect(writes.some(write => write.payload.op === 'access' && write.payload.granted)).toBe(true);
});

for (const zoomOut of [0, 3]) {
  test(`talents decorative shape border resizing matches subtree handles at zoom step ${zoomOut}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await editor.locator(".talent-canvas__toolbar").getByRole('button', { name: 'Add shape', exact: true }).click();
    const shape = editor.locator(".talent-decorations"), fields = editor.locator('.talent-shape-fields');
    await shape.getByRole('button', { name: 'Move shape', exact: true }).hover();
    await expect(shape.locator(".talent-decorations__decoration-resize-handle")).toHaveCount(8);
    const corner = shape.locator('.talent-decorations__decoration-resize-handle--resize-nw'), subtreeCorner = editor.locator(".talent-canvas__subtree").first().locator('.talent-canvas__subtree-resize-handle--resize-nw');
    expect(await corner.evaluate(el => getComputedStyle(el).width)).toBe(await subtreeCorner.evaluate(el => getComputedStyle(el).width));
    expect(await corner.evaluate(el => getComputedStyle(el).cursor)).toBe(await subtreeCorner.evaluate(el => getComputedStyle(el).cursor));
    const initial = await shape.evaluate(el => ({ x: parseFloat(getComputedStyle(el).left), y: parseFloat(getComputedStyle(el).top) }));
    const before = (await shape.boundingBox())!, handle = (await corner.boundingBox())!;
    const scale = parseInt((await editor.locator(".talent-canvas__zoom-controls > span").textContent())!) / 100;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 - 40 * scale, handle.y + handle.height / 2 - 20 * scale, { steps: 6 }); await page.mouse.up();
    await expect(fields.getByLabel('Width', { exact: true })).toHaveValue('280'); await expect(fields.getByLabel('Height', { exact: true })).toHaveValue('140');
    const after = (await shape.boundingBox())!; expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0); expect(after.y + after.height).toBeCloseTo(before.y + before.height, 0);
    for (const [edge, key] of [['e', 'ArrowRight'], ['n', 'ArrowDown'], ['w', 'ArrowRight'], ['s', 'ArrowDown']]) { await shape.locator('.talent-decorations__decoration-resize-handle--resize-' + edge).focus(); await page.keyboard.press(key!); }
    await expect(fields.getByLabel('Width', { exact: true })).toHaveValue('280'); await expect(fields.getByLabel('Height', { exact: true })).toHaveValue('140');
    await shape.locator('.talent-decorations__decoration-resize-handle--resize-e').focus(); for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowLeft');
    await shape.locator('.talent-decorations__decoration-resize-handle--resize-s').focus(); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
    await expect(fields.getByLabel('Width', { exact: true })).toHaveValue('80'); await expect(fields.getByLabel('Height', { exact: true })).toHaveValue('48');
    await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
    expect(saved.decorations[0]).toMatchObject({ x: initial.x - 80 - 20, y: initial.y - 80, width: 80, height: 48 }); expect(saved.nodes[0]).toMatchObject({ x: 105, y: 70 });
  });
}

test('talents shape style buttons, palette and size slider keep text centered in wide and tall forms', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }); await editor.locator(".talent-canvas__toolbar").getByRole('button', { name: 'Add shape', exact: true }).click();
  const fields = editor.locator('.talent-shape-fields'), shape = editor.locator(".talent-decorations");
  await fields.getByLabel('Shape text', { exact: true }).fill('Centered\nTwo lines');
  for (const [width, height] of [[500, 80], [120, 300]]) {
    await fields.getByLabel('Width', { exact: true }).fill(String(width)); await fields.getByLabel('Height', { exact: true }).fill(String(height));
    for (const name of ['Rectangle', 'Rounded rectangle', 'Ellipse', 'Diamond']) {
      const button = fields.getByRole('group', { name: 'Shape', exact: true }).getByRole('button', { name, exact: true }); await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
      const box = (await shape.boundingBox())!, text = (await shape.locator(".talent-decorations__decoration-text > span").boundingBox())!;
      expect(text.y + text.height / 2).toBeCloseTo(box.y + box.height / 2, 0); expect(text.x + text.width / 2).toBeCloseTo(box.x + box.width / 2, 0);
    }
  }
  const palette = fields.getByRole('group', { name: 'Color', exact: true }); await expect(palette.getByRole('button')).toHaveCount(16);
  await palette.getByRole('button', { name: 'Purple', exact: true }).click(); await expect(palette.getByRole('button', { name: 'Purple', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const slider = fields.getByRole('slider', { name: 'Text size', exact: true }); await slider.focus(); await page.keyboard.press('End'); await expect(slider).toHaveAttribute('aria-valuenow', '48'); await page.keyboard.press('Home'); await expect(slider).toHaveAttribute('aria-valuenow', '10');
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight'); await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await fields.getByLabel('Width', { exact: true }).fill('400'); await fields.getByLabel('Height', { exact: true }).fill('160');
  await shape.getByRole('button', { name: 'Move shape', exact: true }).hover(); await editor.screenshot({ path: info.outputPath('talents-shape-style-controls.png'), animations: 'disabled' });
  await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
  expect(saved.decorations[0]).toMatchObject({ shape: 'diamond', color: 'purple', fontSize: 20 });
});

test('talents shape sidebar previews formatting, cancels edits and persists text styles in the viewer', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), sidebar = editor.getByRole('dialog', { name: 'Edit shape', exact: true });
  await editor.locator(".talent-canvas__toolbar").getByRole('button', { name: 'Add shape', exact: true }).click();
  await expect(sidebar).toBeVisible(); expect((await sidebar.boundingBox())!.width).toBe(480);
  await expect(editor.locator(".talent-editor__inspector .talent-shape-fields")).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await sidebar.getByLabel('Shape text', { exact: true }).fill('Formatted path');
  for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough']) await sidebar.getByRole('button', { name, exact: true }).click();
  const text = editor.locator(".talent-decorations__decoration-text"); await expect(text).toHaveCSS('font-weight', '700'); await expect(text).toHaveCSS('font-style', 'italic'); await expect(text).toHaveCSS('text-decoration-line', 'underline line-through');
  await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(sidebar).toBeHidden();
  await expect(text).toHaveText('New annotation'); await expect(text).toHaveCSS('font-weight', '400');
  const shape = editor.locator(".talent-decorations"); await shape.click({ button: 'right', position: { x: 30, y: 60 } }); await expect(sidebar).toBeVisible();
  await sidebar.getByLabel('Shape text', { exact: true }).fill('Formatted path');
  for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough']) { const button = sidebar.getByRole('button', { name, exact: true }); await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true'); }
  await editor.screenshot({ path: info.outputPath('talents-shape-format-sidebar.png'), animations: 'disabled' });
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await editor.locator(".talent-editor__subtree-list-item").filter({ hasText: 'Formatted path' }).click(); await expect(sidebar.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
  expect(saved.decorations[0]).toMatchObject({ text: 'Formatted path', bold: true, italic: true, underline: true, strikethrough: true });
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), rendered = viewer.locator(".talent-decorations__decoration-text");
  await expect(rendered).toHaveText('Formatted path'); await expect(rendered).toHaveCSS('font-weight', '700'); await expect(rendered).toHaveCSS('font-style', 'italic'); await expect(rendered).toHaveCSS('text-decoration-line', 'underline line-through');
  await expect(viewer.locator(".talent-decorations__decoration-control")).toHaveCount(0);
});

for (const zoomOut of [0, 3]) {
  test(`talents shapes snap to subtree centers and major grid intersections at zoom step ${zoomOut}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await editor.locator(".talent-canvas__toolbar").getByRole('button', { name: 'Add shape', exact: true }).click(); await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
    const shape = editor.locator(".talent-decorations"), scale = parseInt((await editor.locator(".talent-canvas__zoom-controls > span").textContent())!) / 100;
    const centerGuides = editor.locator(".talent-canvas__alignment-guides"), gridGuides = editor.locator(".talent-canvas__grid-guides");
    async function dragTo(x: number, y: number, dx = 0, dy = 0) {
      const current = await shape.evaluate(el => { const style = getComputedStyle(el); return { x: parseFloat(style.left) - 80 + parseFloat(style.width) / 2, y: parseFloat(style.top) - 80 + parseFloat(style.height) / 2 }; });
      const handle = (await shape.getByRole('button', { name: 'Move shape', exact: true }).boundingBox())!;
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2 + (x - current.x) * scale + dx, handle.y + handle.height / 2 + (y - current.y) * scale + dy, { steps: 8 });
    }
    await dragTo(140, 190, 6, 0); await expect(centerGuides.locator('line[data-axis="vertical"]')).toHaveCount(1); await expect(centerGuides.locator('line[data-axis="horizontal"]')).toHaveCount(0); await page.mouse.up();
    await dragTo(180, 230, 0, -6); await expect(centerGuides.locator('line[data-axis="horizontal"]')).toHaveCount(1); await expect(centerGuides.locator('line[data-axis="vertical"]')).toHaveCount(0); await page.mouse.up();
    await dragTo(140, 230, 5, -5); await expect(centerGuides.locator('line')).toHaveCount(2);
    const bounds = (await shape.boundingBox())!, region = (await editor.locator(".talent-canvas__subtree[data-subtree-id=\"path-0\"]").boundingBox())!;
    expect(bounds.x + bounds.width / 2).toBeCloseTo(region.x + region.width / 2, 0); expect(bounds.y + bounds.height / 2).toBeCloseTo(region.y + region.height / 2, 0);
    await page.mouse.up(); await expect(centerGuides).toHaveCount(0);
    await dragTo(700, 500, -5, 5); await expect(gridGuides.locator('line')).toHaveCount(2);
    const snapped = (await shape.boundingBox())!, vertical = (await gridGuides.locator('line[data-axis="vertical"]').boundingBox())!, horizontal = (await gridGuides.locator('line[data-axis="horizontal"]').boundingBox())!;
    expect(snapped.x + snapped.width / 2).toBeCloseTo(vertical.x + vertical.width / 2, 0); expect(snapped.y + snapped.height / 2).toBeCloseTo(horizontal.y + horizontal.height / 2, 0);
    await editor.screenshot({ path: info.outputPath(`talents-shape-snap-${zoomOut}.png`), animations: 'disabled' }); await page.mouse.up(); await expect(gridGuides).toHaveCount(0);
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
    expect(saved.decorations[0]).toMatchObject({ x: 580, y: 440 }); expect(saved.nodes[0]).toMatchObject({ x: 105, y: 70 });
  });
}

for (const [theme, chosen] of [['dark', 'Indigo'], ['light', 'Neutral']] as const) {
  test(`talents node appearance palette persists scheme and icon colors across investment states in ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
    const writes = await setup(page, theme, 'creator', false, { talents: true, talentConnectors: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), node = editor.locator(".talent-canvas__node[data-node-id=\"strength\"]"), sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
    const originalColor = await node.locator(".talent-canvas__node-icon").evaluate(el => getComputedStyle(el).color);
    await node.click({ button: 'right' }); await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click();
    const palette = sidebar.getByRole('group', { name: 'Color', exact: true }); await expect(palette.getByRole('button')).toHaveCount(16);
    for (const name of ['Theme', 'Red', 'Rose', 'Pink', 'Orange', 'Amber', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Purple', 'Brown', 'Neutral']) {
      const swatch = palette.getByRole('button', { name, exact: true }); await swatch.click(); await expect(swatch).toHaveAttribute('aria-pressed', 'true');
      const color = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
      await expect(sidebar.locator(".talent-appearance__preview .v-icon")).toHaveCSS('color', color); await expect(sidebar.locator(".talent-editor__node-appearance-icon .v-icon")).toHaveCSS('color', color);
    }
    await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(node).not.toHaveAttribute('data-color'); await expect(node.locator(".talent-canvas__node-icon")).toHaveCSS('color', originalColor);
    await node.click({ button: 'right' });
    // The accordion keeps its state when reopening an editor.
    if (!await palette.isVisible()) await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(palette.getByRole('button', { name: 'Theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await palette.getByRole('button', { name: chosen, exact: true }).click();
    const color = await palette.getByRole('button', { name: chosen, exact: true }).evaluate(el => getComputedStyle(el).backgroundColor);
    await editor.screenshot({ path: info.outputPath(`talents-node-appearance-${theme}.png`), animations: 'disabled' });
    await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(node.locator(".talent-canvas__node-icon")).toHaveCSS('color', color); await expect(node).toHaveCSS('border-top-color', color.replace('rgb(', 'rgba(').replace(')', ', 0.4)'));
    await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
    const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
    expect(saved.nodes.find((n: any) => n.id === 'strength').color).toBe(chosen.toLowerCase()); expect(saved.nodes.find((n: any) => n.id === 'wisdom').color).toBeUndefined();
    await page.getByRole('button', { name: 'Edit tree', exact: true }).click(); await node.click({ button: 'right' }); if (!await palette.isVisible()) await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click(); await expect(palette.getByRole('button', { name: chosen, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), rendered = viewer.locator(".talent-canvas__node[data-node-id=\"strength\"]");
    await expect(rendered).toHaveClass(/--unallocated/); await expect(rendered.locator(".talent-canvas__node-icon")).toHaveCSS('color', color); await expect(rendered).toHaveCSS('border-top-color', color);
    await rendered.click(); await expect(rendered).toHaveClass(/--partial/); await expect(rendered.locator(".talent-canvas__node-icon")).toHaveCSS('color', color); await expect(viewer.locator(".room-talents-viewer__talent-detail-emblem .v-icon").first()).toHaveCSS('color', color);
    await viewer.screenshot({ path: info.outputPath(`talents-node-color-partial-${theme}.png`), animations: 'disabled' });
    await rendered.click(); await expect(rendered).toHaveClass(/maximum/); await expect(rendered).toHaveCSS('background-color', color);
    const ink = theme === 'dark' ? 'rgb(255, 255, 255)' : await rendered.evaluate(el => getComputedStyle(el).getPropertyValue('--v-theme-surface').trim());
    await expect(rendered.locator(".talent-canvas__node-icon")).toHaveCSS('color', theme === 'dark' ? ink : `rgb(${ink.split(',').map(value => value.trim()).join(', ')})`);
    await expect(viewer.locator(".talent-canvas__node[data-node-id=\"wisdom\"]")).not.toHaveAttribute('data-color');
  });
}

for (const layout of ['classic', 'free', 'centered'] as const) {
  for (const zoomOut of [0, 3]) {
    test(`talents double-click creates a node at the pointer in ${layout} at zoom step ${zoomOut}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
      const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: layout === 'free', talentCentered: layout === 'centered' });
      await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), viewport = editor.locator(".talent-canvas__viewport"), sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
      for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
      // Pan before creating, so pointer conversion must account for scroll as well as zoom.
      const frame = (await viewport.boundingBox())!;
      await page.mouse.move(frame.x + 80, frame.y + 80); await page.mouse.down({ button: 'right' }); await page.mouse.move(frame.x + 140, frame.y + 115, { steps: 6 }); await page.mouse.up({ button: 'right' });
      const region = (await editor.locator(".talent-canvas__subtree").first().boundingBox())!, reference = (await editor.locator(".talent-canvas__node[data-node-id=\"strength\"]").boundingBox())!;
      const scale = parseInt((await editor.locator(".talent-canvas__zoom-controls > span").textContent())!) / 100;
      const point = { x: Math.round(region.x + region.width * .84), y: Math.round(region.y + region.height * .30) };
      const expected = { x: Math.round(105 + (point.x - reference.x) / scale - 32), y: Math.round(70 + (point.y - reference.y) / scale - 32) };
      await page.mouse.dblclick(point.x, point.y); await expect(sidebar).toBeVisible();
      await sidebar.getByLabel('Name', { exact: true }).fill('Placed talent'); await sidebar.getByRole('button', { name: 'Position on the canvas', exact: true }).click();
      await expect(sidebar.getByLabel('X', { exact: true })).toHaveValue(String(expected.x)); await expect(sidebar.getByLabel('Y', { exact: true })).toHaveValue(String(expected.y));
      await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(editor.locator(".talent-canvas__node")).toHaveCount(9);
      // Existing-node double-click keeps editing that node rather than creating another one.
      await editor.locator(".talent-canvas__node[data-node-id=\"strength\"]").dblclick(); await expect(sidebar.getByLabel('Name', { exact: true })).toHaveValue('Strength'); await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(editor.locator(".talent-canvas__node")).toHaveCount(9);
      // Toolbar creation still opens its usual draft, and cancel adds nothing.
      await editor.getByRole('button', { name: 'Add node', exact: true }).click(); await expect(sidebar).toBeVisible(); await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(editor.locator(".talent-canvas__node")).toHaveCount(9);
      await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
      const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
      expect(saved.nodes.find((node: any) => node.name === 'Placed talent')).toMatchObject(expected);
      expect(saved.nodes.find((node: any) => node.id === 'strength')).toMatchObject({ x: 105, y: 70 });
      expect(saved.nodes.filter((node: any) => node.name === 'Placed talent')).toHaveLength(1);
    });
  }
}

test('talents double-click supports decorative backgrounds, ignores controls and stays read-only in the viewer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  await editor.locator(".talent-canvas__toolbar").getByRole('button', { name: 'Add shape', exact: true }).click(); await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
  const shape = editor.locator(".talent-decorations"); await shape.getByRole('button', { name: 'Move shape', exact: true }).dblclick(); await expect(sidebar).toBeHidden();
  await shape.dblclick({ position: { x: 30, y: 90 } }); await expect(sidebar).toBeVisible(); await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor.locator(".talent-canvas__node")).toHaveCount(1); await expect(editor.locator(".talent-decorations")).toHaveCount(1);
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  expect(writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree.nodes).toHaveLength(1);
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }); await expect(viewer.locator(".talent-canvas__node")).toHaveCount(1);
  await viewer.locator(".talent-canvas__viewport").dblclick({ position: { x: 20, y: 20 } }); await expect(viewer.getByRole('dialog', { name: 'Edit talent', exact: true })).toHaveCount(0); await expect(viewer.locator(".talent-canvas__node")).toHaveCount(1);
});

for (const role of ['creator', 'player']) {
  test(`talents viewer titles and canvas paths preserve linked builds through refunds and resets for ${role}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1600, height: 1080 });
    const writes = await setup(page, 'dark', role, false, { talents: true, talentProgression: true, talentLinkedPaths: true });
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), navigation = viewer.locator(".room-talents-viewer__talent-navigation-list"), dock = viewer.getByRole('navigation', { name: 'Unlocked paths', exact: true });
    const source = navigation.locator(".room-talents-viewer__talent-nav-item").filter({ has: page.getByText('Warrior Training', { exact: true }) }), title = source.locator(".room-talents-viewer__talent-nav-title");
    await expect(title).toHaveCSS('white-space', 'nowrap'); expect(await title.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const heading = (await title.boundingBox())!, meta = (await source.locator(".room-talents-viewer__talent-nav-meta").boundingBox())!; expect(heading.y + heading.height).toBeLessThan(meta.y); expect(heading.width).toBeCloseTo(meta.width, 0);
    await expect(navigation.getByText('Advanced Combat', { exact: true })).toHaveCount(0); await expect(dock).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await expect(dock).toBeVisible(); await expect(dock).toContainText('Via Strength'); await expect(viewer.locator(".talent-canvas__title")).toHaveText('Warrior Training');
    const portal = dock.getByRole('button', { name: 'Open Advanced Combat', exact: true }); await expect(portal).toHaveCount(1);
    await page.mouse.move(0, 0); await viewer.screenshot({ path: info.outputPath(`talent-unlocked-path-dock-${role}.png`), animations: 'disabled' });
    await portal.click(); await expect(viewer.locator(".talent-canvas__title")).toHaveText('Advanced Combat'); await viewer.getByRole('button', { name: 'Focus: 0/2', exact: true }).click();
    await source.click(); await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 2/2', exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(dock).toBeVisible(); await expect(navigation.getByText('Advanced Combat', { exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(dock).toHaveCount(0); await expect(navigation.getByText('Advanced Combat', { exact: true })).toHaveCount(0);
    await expect(viewer.getByRole('status')).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await portal.click(); await expect(viewer.getByRole('button', { name: 'Focus: 1/2', exact: true })).toBeVisible(); await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('1 points invested');
    await source.click(); page.on('dialog', dialog => dialog.accept()); await viewer.getByRole('button', { name: 'Reset tree', exact: true }).click(); await expect(navigation.getByText('Advanced Combat', { exact: true })).toHaveCount(0); await expect(dock).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await expect(portal).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); await expect(portal).toBeVisible();
    expect(await viewer.locator(".room-talents-viewer__talent-viewer-body").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1); expect(await viewer.locator(".room-talents-viewer__talent-viewer-body").evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    const link = (await portal.boundingBox())!, canvas = (await viewer.locator(".talent-canvas").boundingBox())!; expect(link.x).toBeGreaterThanOrEqual(canvas.x); expect(link.x + link.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    const viewport = (await viewer.locator(".talent-canvas__viewport").boundingBox())!, dockBounds = (await dock.boundingBox())!; expect(dockBounds.y).toBeGreaterThanOrEqual(viewport.y + viewport.height - 1); expect(dockBounds.y + dockBounds.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
    await page.mouse.move(0, 0); await viewer.screenshot({ path: info.outputPath(`talent-unlocked-path-mobile-${role}.png`), animations: 'disabled' });
    await portal.click(); await expect(viewer.getByRole('button', { name: 'Focus: 1/2', exact: true })).toBeVisible();
    expect(writes.filter(write => write.action === 'talents' && write.payload.op === 'respec').map(write => write.payload.treeId)).toEqual(['talent-tree']);
    expect(writes.filter(write => write.action === 'talents' && write.payload.op === 'revert').map(write => write.payload.treeId)).toEqual(['talent-tree', 'talent-tree']);
  });
}

test('talents automatic unlock toggle grants a free first rank immediately and retains paid later rank behavior', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  await editor.getByRole('button', { name: 'Strength: 0/2', exact: true }).click({ button: 'right' }); await sidebar.getByRole('button', { name: 'Conditions', exact: true }).click();
  const toggle = sidebar.getByRole('checkbox', { name: 'Automatic unlock', exact: true }); await expect(toggle).not.toBeChecked(); await toggle.check();
  const cost = (await sidebar.getByLabel('Points per rank', { exact: true }).boundingBox())!, control = (await toggle.boundingBox())!; expect(control.y).toBeGreaterThan(cost.y + cost.height);
  await expect(sidebar).toContainText('Grants the first rank for free'); await editor.screenshot({ path: info.outputPath('talent-automatic-unlock-toggle.png'), animations: 'disabled' });
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  expect(writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree.nodes[0].autoUnlock).toBe(true);
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click(); await editor.getByRole('button', { name: 'Strength: 0/2', exact: true }).click({ button: 'right' }); await expect(toggle).toBeChecked(); await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible(); await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('0 points invested');
  expect(writes.filter(write => write.payload.op === 'allocate')).toHaveLength(0);
  await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 2/2', exact: true })).toBeVisible(); await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('1 points invested');
  await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Remove point', exact: true })).toBeDisabled(); await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('0 points invested');
  page.on('dialog', dialog => dialog.accept()); await viewer.getByRole('button', { name: 'Reset tree', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible();
  expect(writes.filter(write => write.payload.op === 'allocate')).toHaveLength(1); expect(writes.filter(write => write.payload.op === 'revert')).toHaveLength(1);
});

test('talents automatic descendants wait for conditions and follow parent allocation, refunds and reset', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
  await setup(page, 'light', 'creator', false, { talents: true, talentConnectors: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  for (const [parent, child] of [['Strength', 'Wisdom'], ['Wisdom', 'Endurance']]) {
    await editor.getByRole('button', { name: `Connect from: ${parent} (Right)`, exact: true }).focus(); await page.keyboard.press('Enter'); await editor.getByRole('button', { name: `Connect from: ${child} (Left)`, exact: true }).focus(); await page.keyboard.press('Enter');
  }
  for (const name of ['Wisdom', 'Endurance']) {
    await editor.getByRole('button', { name: `${name}: 0/2`, exact: true }).click({ button: 'right' });
    const toggle = sidebar.getByRole('checkbox', { name: 'Automatic unlock', exact: true }); if (!await toggle.isVisible()) await sidebar.getByRole('button', { name: 'Conditions', exact: true }).click();
    await sidebar.getByLabel('Points per rank', { exact: true }).fill('9'); await toggle.check();
    if (name === 'Wisdom') { const conditions = sidebar.locator('.talent-conditions').first(); await conditions.getByRole('button', { name: 'Add condition', exact: true }).click(); await conditions.getByLabel('Minimum', { exact: true }).fill('2'); }
    await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  }
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
  await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Wisdom: 0/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Endurance: 0/2', exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Wisdom: 1/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Endurance: 1/2', exact: true })).toBeVisible(); await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('2 points invested');
  await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Wisdom: 0/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Endurance: 0/2', exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Wisdom: 1/2', exact: true })).toBeVisible();
  page.on('dialog', dialog => dialog.accept()); await viewer.getByRole('button', { name: 'Reset tree', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Wisdom: 0/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Endurance: 0/2', exact: true })).toBeVisible(); await expect(viewer.locator(".room-talents-viewer__talent-build-summary")).toContainText('0 points invested');
});
