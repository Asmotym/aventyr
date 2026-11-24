import { test, expect } from '@playwright/test';

import { setup, navigate } from '../support/rooms.fixture';

test('talents viewer fills its panel and preserves zoom beyond 200 percent through resizes', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, 'dark', 'player', false, { talents: true, talentDesign: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), viewport = viewer.locator('.canvas-viewport');
  const zoomLabel = viewer.locator('.canvas-zoom-controls > span');
  await expect.poll(async () => (await viewport.boundingBox())!.height).toBeGreaterThan(500);
  const mainBounds = (await viewer.locator('.viewer-main').boundingBox())!, workspaceBounds = (await viewer.locator('.talent-play-workspace').boundingBox())!;
  expect(mainBounds.y + mainBounds.height - workspaceBounds.y - workspaceBounds.height).toBeLessThanOrEqual(25);
  const initial = parseInt((await zoomLabel.textContent())!);
  for (let i = 0; i < 20; i++) await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const zoomed = parseInt((await zoomLabel.textContent())!); expect(zoomed).toBeGreaterThan(200);
  const box = (await viewport.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -300);
  await expect.poll(async () => parseInt((await zoomLabel.textContent())!)).toBeGreaterThan(zoomed);
  const wheelZoom = await zoomLabel.textContent();
  await page.setViewportSize({ width: 1440, height: 800 });
  await expect.poll(async () => (await viewport.boundingBox())!.height).toBeLessThan(box.height);
  await expect(zoomLabel).toHaveText(wheelZoom!);
  const panning = (await viewport.boundingBox())!, before = await viewport.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.mouse.move(panning.x + panning.width / 2, panning.y + panning.height / 2); await page.mouse.down({ button: 'right' });
  await page.mouse.move(panning.x + panning.width / 2 - 50, panning.y + panning.height / 2 - 40, { steps: 6 }); await page.mouse.up({ button: 'right' });
  const after = await viewport.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  expect(after.x).toBeGreaterThan(before.x); expect(after.y).toBeGreaterThan(before.y);
  await expect(zoomLabel).toHaveText(wheelZoom!);
  await viewer.getByRole('button', { name: 'Fit view', exact: true }).click();
  await expect.poll(async () => parseInt((await zoomLabel.textContent())!)).toBeLessThanOrEqual(initial);
  await expect(viewer.locator('.canvas-scroll-space')).toHaveCSS('background-image', 'none');
  await viewer.screenshot({ path: info.outputPath('talents-full-height-viewer.png'), animations: 'disabled' });
});

for (const theme of ['dark', 'light']) {
  test(`talents viewer distinguishes untouched, partially invested and mastered nodes in ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page, theme, 'player', false, { talents: true, talentDesign: true });
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
    const untouched = viewer.getByRole('button', { name: 'Shield Wall: 0/3', exact: true });
    const partial = viewer.getByRole('button', { name: 'Iron Will: 1/3', exact: true });
    const mastered = viewer.getByRole('button', { name: 'Strength: 3/3', exact: true });
    await expect(untouched).toHaveCSS('border-top-style', 'dashed');
    await expect(partial).toHaveCSS('border-top-style', 'solid');
    await expect(partial).toHaveClass(/is-partial/); await expect(mastered).toHaveClass(/maximum/);
    await expect(partial.locator('.node-state .mdi-circle-half-full')).toBeVisible();
    await expect(mastered.locator('.node-state .mdi-check')).toBeVisible();
    expect(await partial.evaluate(el => getComputedStyle(el).backgroundImage)).not.toBe('none');
    expect(await untouched.locator('.node-progress > span').evaluate(el => (el as HTMLElement).style.width)).toBe('0%');
    expect(parseFloat(await partial.locator('.node-progress > span').evaluate(el => (el as HTMLElement).style.width))).toBeCloseTo(100 / 3, 2);
    expect(await mastered.locator('.node-progress > span').evaluate(el => (el as HTMLElement).style.width)).toBe('100%');
    await expect(viewer.locator('.talent-graph-legend')).toContainText('In progress');
    await page.mouse.move(0, 0); await viewer.screenshot({ path: info.outputPath(`talents-investment-cues-${theme}.png`), animations: 'disabled' });
    await untouched.click();
    const invested = viewer.getByRole('button', { name: 'Shield Wall: 1/3', exact: true });
    await expect(invested).toHaveClass(/is-partial/); await expect(invested).toHaveCSS('border-top-style', 'solid');
    await viewer.getByRole('button', { name: 'Remove point', exact: true }).click();
    await expect(untouched).toHaveClass(/is-unallocated/); await expect(untouched).toHaveCSS('border-top-style', 'dashed');
  });
}

for (const zoomOut of [0, 3]) {
  test(`talents nodes snap to subtree centerlines at zoom step ${zoomOut}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1080 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
    await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
    const node = editor.getByRole('button', { name: 'Strength: 0/3', exact: true }), region = editor.locator('.canvas-subtree[data-subtree-id="path-0"]');
    const guides = editor.locator('.canvas-alignment-guides');
    async function dragNearCenter(dx: number, dy: number) {
      const box = (await node.boundingBox())!, bounds = (await region.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width / 2 + dx, bounds.y + bounds.height / 2 + dy, { steps: 8 });
      return bounds;
    }
    await dragNearCenter(6, -40);
    await expect(guides.locator('line[data-axis="vertical"]')).toHaveCount(1); await expect(guides.locator('line[data-axis="horizontal"]')).toHaveCount(0);
    await page.mouse.up(); await expect(guides).toHaveCount(0);
    await dragNearCenter(40, -6);
    await expect(guides.locator('line[data-axis="horizontal"]')).toHaveCount(1); await expect(guides.locator('line[data-axis="vertical"]')).toHaveCount(0);
    await page.mouse.up();
    const bounds = await dragNearCenter(5, -5);
    await expect(guides.locator('line')).toHaveCount(2);
    const centered = (await node.boundingBox())!;
    expect(centered.x + centered.width / 2).toBeCloseTo(bounds.x + bounds.width / 2, 0);
    expect(centered.y + centered.height / 2).toBeCloseTo(bounds.y + bounds.height / 2, 0);
    await editor.screenshot({ path: info.outputPath(`talents-center-snap-${zoomOut}.png`), animations: 'disabled' });
    // Moving away releases both centerlines and uses the normal grid again.
    await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 35, { steps: 6 });
    await expect(guides).toHaveCount(0); await page.mouse.up();
    await dragNearCenter(4, 4); await expect(guides.locator('line')).toHaveCount(2); await page.mouse.up();
    await expect(guides).toHaveCount(0);
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
    expect(saved.nodes.find((node: any) => node.id === 'strength')).toMatchObject({ x: 108, y: 198, subtreeId: 'path-0' });
  });
}

for (const zoomOut of [0, 3]) {
  test(`talents nodes snap to major grid lines and intersections at zoom step ${zoomOut}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1080 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentConnectors: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
    await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
    const scale = parseInt((await editor.locator('.canvas-zoom-controls > span').textContent())!) / 100;
    const node = editor.getByRole('button', { name: 'Strength: 0/2', exact: true }), guides = editor.locator('.canvas-grid-guides');
    let center = { x: 132, y: 132 };
    async function dragTo(x: number, y: number, dx = 0, dy = 0) {
      const box = (await node.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + (x - center.x) * scale + dx, box.y + box.height / 2 + (y - center.y) * scale + dy, { steps: 8 });
    }
    await dragTo(300, 300, 6, -6); await expect(guides.locator('line')).toHaveCount(2);
    // The guide and the node center share the same rendered major-grid intersection.
    const position = await node.boundingBox();
    const vertical = (await guides.locator('line[data-axis="vertical"]').boundingBox())!;
    const horizontal = (await guides.locator('line[data-axis="horizontal"]').boundingBox())!;
    expect(position!.x + position!.width / 2).toBeCloseTo(vertical.x + vertical.width / 2, 0); expect(position!.y + position!.height / 2).toBeCloseTo(horizontal.y + horizontal.height / 2, 0);
    await editor.screenshot({ path: info.outputPath(`talents-major-grid-snap-${zoomOut}.png`), animations: 'disabled' });
    await page.mouse.up(); center = { x: 300, y: 300 }; await expect(guides).toHaveCount(0);
    await dragTo(340, 340); await expect(guides).toHaveCount(0); await page.mouse.up(); center = { x: 332, y: 332 };
    await dragTo(400, 340, 4, 0); await expect(guides.locator('line[data-axis="vertical"]')).toHaveCount(1); await expect(guides.locator('line[data-axis="horizontal"]')).toHaveCount(0); await page.mouse.up(); center = { x: 400, y: 332 };
    await dragTo(440, 400, 0, -4); await expect(guides.locator('line[data-axis="horizontal"]')).toHaveCount(1); await expect(guides.locator('line[data-axis="vertical"]')).toHaveCount(0); await page.mouse.up(); center = { x: 432, y: 400 };
    await dragTo(500, 500, -5, 5); await expect(guides.locator('line')).toHaveCount(2); await page.mouse.up();
    await expect(guides).toHaveCount(0); await editor.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
    expect(saved.nodes.find((node: any) => node.id === 'strength')).toMatchObject({ x: 468, y: 468 });
  });
}

test('talents appearance connection defaults inherit independently and preserve individual overrides in the viewer', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1600, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentConnectors: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await editor.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(editor.getByRole('region', { name: 'Nodes', exact: true })).toBeVisible();
  await expect(editor.getByRole('region', { name: 'Connections', exact: true })).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'Default connection style', exact: true })).toHaveCount(0);
  async function defaults(line: string, arrow: string) {
    await editor.getByRole('group', { name: 'Default connection style', exact: true }).getByRole('button', { name: line, exact: true }).click();
    await editor.getByRole('group', { name: 'Default arrow style', exact: true }).getByRole('button', { name: arrow, exact: true }).click();
  }
  await defaults('Square', 'Diamond arrow');
  await editor.getByRole('button', { name: 'Connect from: Strength (Bottom)', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(editor.locator('.connection-preview')).toHaveAttribute('marker-end', /-diamond\)/);
  expect(await editor.locator('.connection-preview').getAttribute('d')).not.toContain('C');
  await editor.getByRole('button', { name: 'Connect from: Endurance (Top)', exact: true }).focus(); await page.keyboard.press('Enter');
  const first = editor.locator('.connection-hit-target[data-parent="strength"]'), firstVisible = first.locator('xpath=preceding-sibling::*[1]');
  await first.focus(); await page.keyboard.press('Enter');
  const styles = editor.getByRole('group', { name: 'Connection style', exact: true }), arrows = editor.getByRole('group', { name: 'Arrow style', exact: true });
  await expect(styles.getByRole('button', { name: 'Square', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(arrows.getByRole('button', { name: 'Diamond arrow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await styles.getByRole('button', { name: 'Straight', exact: true }).click(); await arrows.getByRole('button', { name: 'Hide arrow', exact: true }).click();
  await editor.getByRole('button', { name: 'Connect from: Wisdom (Bottom)', exact: true }).focus(); await page.keyboard.press('Enter');
  await editor.getByRole('button', { name: 'Connect from: Endurance (Left)', exact: true }).focus(); await page.keyboard.press('Enter');
  const second = editor.locator('.connection-hit-target[data-parent="wisdom"]'), secondVisible = second.locator('xpath=preceding-sibling::*[1]');
  await defaults('Rounded', 'Chevron arrow');
  expect(await first.getAttribute('d')).not.toContain('C'); await expect(firstVisible).toHaveAttribute('marker-end', 'none');
  expect(await second.getAttribute('d')).toContain('C'); await expect(secondVisible).toHaveAttribute('marker-end', /-chevron\)/);
  await first.focus(); await page.keyboard.press('Enter');
  await styles.getByRole('button', { name: 'Use default line style', exact: true }).click();
  expect(await first.getAttribute('d')).toContain('C'); await expect(firstVisible).toHaveAttribute('marker-end', 'none');
  await expect(styles.getByRole('button', { name: 'Use default line style', exact: true })).toBeDisabled();
  await styles.getByRole('button', { name: 'Square', exact: true }).click();
  await arrows.getByRole('button', { name: 'Use default arrow style', exact: true }).click(); await expect(firstVisible).toHaveAttribute('marker-end', /-chevron\)/);
  await expect(arrows.getByRole('button', { name: 'Use default arrow style', exact: true })).toBeDisabled();
  await defaults('Straight', 'Triangle arrow');
  expect((await first.getAttribute('d'))!.match(/ L /g)!.length).toBeGreaterThan(1);
  expect((await second.getAttribute('d'))!.match(/ L /g)).toHaveLength(1);
  await arrows.getByRole('button', { name: 'Hide arrow', exact: true }).click();
  await editor.screenshot({ path: info.outputPath('talents-connection-defaults.png'), animations: 'disabled' });
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(saved.options).toMatchObject({ connectionStyle: 'straight', connectionArrow: 'triangle' });
  expect(saved.edges[0]).toMatchObject({ style: 'square', arrow: 'none' }); expect(saved.edges[1].style).toBeUndefined(); expect(saved.edges[1].arrow).toBeUndefined();
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), lines = viewer.locator('.connections > path.talent-edge');
  await expect(lines).toHaveCount(2); await expect(lines.nth(0)).toHaveAttribute('marker-end', 'none');
  expect((await lines.nth(0).getAttribute('d'))!.match(/ L /g)!.length).toBeGreaterThan(1);
  expect((await lines.nth(1).getAttribute('d'))!.match(/ L /g)).toHaveLength(1);
  expect(await lines.nth(1).getAttribute('marker-end')).toMatch(/^url\(#/);
});

test('talents hover prerequisites show missing parent ranks, all/any conditions and live point thresholds', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1080 });
  await setup(page, 'dark', 'player', false, { talents: true, talentDesign: true, talentRequirements: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), tooltip = page.locator('.talent-node-tooltip:visible');
  async function hover(name: string) { await page.mouse.move(0, 0); await expect(tooltip).toHaveCount(0); await viewer.getByRole('button', { name, exact: true }).hover(); await expect(tooltip).toHaveCount(1); }
  await hover('Last Stand: 0/3');
  await expect(tooltip.getByText('Needed to unlock', { exact: true })).toBeVisible();
  await expect(tooltip.getByText('Shield Wall · Rank', { exact: true })).toBeVisible(); await expect(tooltip.getByText('0/1', { exact: true })).toBeVisible();
  await expect(tooltip.getByText('4/8', { exact: true })).toBeVisible(); await expect(tooltip.getByText('4/6', { exact: true })).toBeVisible();
  await expect(tooltip.getByText('Node conditions', { exact: true })).toHaveCount(0);
  await expect(tooltip.getByText('Fury · Rank', { exact: true })).toHaveCount(0);
  await viewer.screenshot({ path: info.outputPath('talents-prerequisite-hover.png'), animations: 'disabled' });
  await hover('Fury: 0/3'); await expect(tooltip.getByText('Meet any one', { exact: true })).toBeVisible();
  await expect(tooltip.getByText('0/2', { exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Shield Wall: 0/3', exact: true }).click();
  await hover('Last Stand: 0/3'); await expect(tooltip.getByText('Parent talents', { exact: true })).toHaveCount(0); await expect(tooltip.getByText('5/8', { exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Shield Wall: 1/3', exact: true }).click(); await viewer.getByRole('button', { name: 'Allocate point', exact: true }).click();
  await viewer.getByRole('button', { name: 'Fury: 0/3', exact: true }).click();
  await hover('Last Stand: 0/3'); await expect(tooltip.locator('.talent-unmet-requirements')).toHaveCount(0);
});

test('talents condition and visibility node selectors group nodes by subtree and keep ungrouped nodes selectable', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true, talentDesign: true, talentConditionGroups: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await editor.getByRole('button', { name: 'Strength: 0/3', exact: true }).click({ button: 'right' });
  const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true }); await sidebar.getByRole('button', { name: 'Conditions', exact: true }).click();
  const conditions = sidebar.locator('.talent-conditions');
  for (const [index, selection] of ['Unstoppable', 'Iron Will'].entries()) {
    const field = conditions.nth(index); await field.getByRole('button', { name: 'Add condition', exact: true }).click();
    await field.getByRole('combobox').filter({ has: page.getByRole('textbox', { name: 'Condition type', exact: true }) }).click();
    await page.getByRole('option', { name: 'Node level', exact: true }).click();
    await field.getByRole('combobox').filter({ has: page.getByRole('textbox', { name: 'Node', exact: true }) }).click();
    const menu = page.locator('.v-overlay--active .v-list');
    await expect(menu.getByText('Vanguard', { exact: true })).toBeVisible(); await expect(menu.getByText('Berserker', { exact: true })).toBeVisible(); await expect(menu.getByText('Ungrouped', { exact: true })).toBeVisible();
    await expect(menu.getByRole('option', { name: 'Ungrouped', exact: true })).toHaveCount(0);
    const labels = await menu.locator('.v-list-subheader,.v-list-item[role="option"]').allTextContents();
    expect(labels.findIndex(text => text.trim() === 'Vanguard')).toBeLessThan(labels.findIndex(text => text.includes('Iron Will')));
    expect(labels.findIndex(text => text.trim() === 'Ungrouped')).toBeLessThan(labels.findIndex(text => text.includes('Unstoppable')));
    if (index === 0) await page.screenshot({ path: info.outputPath('talents-grouped-node-select.png'), animations: 'disabled' });
    await menu.getByRole('option', { name: selection, exact: true }).click();
  }
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(sidebar).toBeHidden(); await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree.nodes.find((node: any) => node.id === 'strength');
  expect(saved.conditions.items).toEqual([{ type: 'node', nodeId: 'talent-7', amount: 1 }]); expect(saved.hide.items).toEqual([{ type: 'node', nodeId: 'talent-1', amount: 1 }]);
});

test('talents decorative shapes support text, movement, resizing, deletion and read-only viewer rendering', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentConnectors: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click();
  await expect(editor.getByRole('tab', { name: 'Shapes', exact: true })).toHaveAttribute('aria-selected', 'true');
  const fields = editor.locator('.talent-shape-fields');
  await fields.getByLabel('Shape text', { exact: true }).fill('Warrior path\nStart here');
  await fields.getByRole('group', { name: 'Shape', exact: true }).getByRole('button', { name: 'Ellipse', exact: true }).click();
  await fields.getByRole('group', { name: 'Color', exact: true }).getByRole('button', { name: 'Blue', exact: true }).click();
  const size = fields.getByRole('slider', { name: 'Text size', exact: true }); await size.focus(); await page.keyboard.press('Home'); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  const shape = editor.locator('.canvas-decoration'); await expect(shape).toHaveClass(/decoration-ellipse/);
  const before = (await shape.boundingBox())!, handle = (await shape.getByRole('button', { name: 'Move shape', exact: true }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + 140, handle.y + handle.height / 2 - 80, { steps: 8 }); await page.mouse.up();
  const moved = (await shape.boundingBox())!; expect(moved.x - before.x).toBeCloseTo(140, 0); expect(moved.y - before.y).toBeCloseTo(-80, 0);
  const resize = (await shape.locator('.resize-se').boundingBox())!;
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2); await page.mouse.down(); await page.mouse.move(resize.x + resize.width / 2 + 80, resize.y + resize.height / 2 + 40, { steps: 8 }); await page.mouse.up();
  await expect(fields.getByLabel('Width', { exact: true })).toHaveValue('320'); await expect(fields.getByLabel('Height', { exact: true })).toHaveValue('160');
  await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click();
  await fields.getByLabel('Shape text', { exact: true }).fill('Temporary'); await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Delete shape', exact: true }).click();
  await expect(editor.locator('.canvas-decoration')).toHaveCount(1);
  await shape.getByRole('button', { name: 'Edit shape', exact: true }).click(); await expect(fields.getByLabel('Shape text', { exact: true })).toHaveValue('Warrior path\nStart here');
  await editor.screenshot({ path: info.outputPath('talents-decorative-shapes-editor.png'), animations: 'disabled' });
  await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(saved.decorations).toHaveLength(1); expect(saved.decorations[0]).toMatchObject({ shape: 'ellipse', text: 'Warrior path\nStart here', color: 'blue', fontSize: 20, width: 320, height: 160 });
  expect(saved.edges).toEqual([]); expect(saved.nodes.map((node: any) => [node.id, node.x, node.y])).toEqual([['strength', 100, 100], ['wisdom', 400, 100], ['endurance', 250, 320]]);
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
  await expect(viewer.locator('.canvas-decoration .decoration-text')).toHaveText('Warrior path\nStart here'); await expect(viewer.getByRole('button', { name: 'Move shape', exact: true })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible();
  await page.mouse.move(0, 0); await viewer.screenshot({ path: info.outputPath('talents-decorative-shapes-viewer.png'), animations: 'disabled' });
});

test('talents decorative shapes can move outside subtrees and support all shape types', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click();
  const fields = editor.locator('.talent-shape-fields'); await fields.getByLabel('Shape text', { exact: true }).fill('Outside the paths');
  for (const [label, type] of [['Rectangle', 'rectangle'], ['Ellipse', 'ellipse'], ['Diamond', 'diamond'], ['Rounded rectangle', 'rounded']]) {
    await fields.getByRole('group', { name: 'Shape', exact: true }).getByRole('button', { name: label, exact: true }).click();
    await expect(editor.locator('.canvas-decoration')).toHaveClass(new RegExp('decoration-' + type));
  }
  const move = editor.getByRole('button', { name: 'Move shape', exact: true }); await move.focus(); for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowLeft');
  await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await editor.getByRole('button', { name: 'Fit view', exact: true }).click();
  await expect(editor.locator('.canvas-decoration .decoration-text')).toBeVisible();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(saved.decorations[0].x).toBeLessThan(0); expect(saved.subtrees.map((subtree: any) => [subtree.x, subtree.y, subtree.width, subtree.height])).toEqual([[0, 0, 280, 460], [320, 0, 280, 460]]);
  expect(saved.nodes[0]).toMatchObject({ x: 105, y: 70, subtreeId: 'path-0' });
});
