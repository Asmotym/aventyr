import { test, expect } from '@playwright/test';

import { setup, navigate } from '../support/rooms.fixture';

test('talents canvas connectors create directed links, reject invalid links and remove selected connections', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentConnectors: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  async function connect(from: string, to: string, fromSide = 'Right', toSide = 'Left') {
    await editor.getByRole('button', { name: from + ': 0/2', exact: true }).hover();
    const source = editor.getByRole('button', { name: `Connect from: ${from} (${fromSide})`, exact: true });
    const target = editor.getByRole('button', { name: `Connect from: ${to} (${toSide})`, exact: true });
    const a = (await source.boundingBox())!, b = (await target.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await expect(editor.locator('.connection-preview')).toHaveCount(1); await page.mouse.up();
  }
  const strength = editor.getByRole('button', { name: 'Strength: 0/2', exact: true });
  const original = (await strength.boundingBox())!;
  const dots = editor.locator('.node-connector[data-node-id="strength"]');
  await page.mouse.move(1, 1); await expect(dots).toHaveCount(4); await expect(dots.first()).toHaveCSS('opacity', '0');
  await strength.hover(); await expect(dots.first()).toHaveCSS('opacity', '1');
  await connect('Strength', 'Wisdom');
  await expect(editor.locator('.connection-hit-target[data-parent="strength"][data-child="wisdom"]')).toHaveCount(1);
  expect((await strength.boundingBox())!.x).toBeCloseTo(original.x, 0); expect((await strength.boundingBox())!.y).toBeCloseTo(original.y, 0);
  await connect('Wisdom', 'Endurance', 'Bottom', 'Top');
  await connect('Endurance', 'Strength'); await expect(editor.getByText('This connection would create a cycle.', { exact: true })).toBeVisible();
  await expect(editor.locator('.connection-hit-target')).toHaveCount(2);
  await connect('Strength', 'Wisdom'); await expect(editor.getByText('These talents are already connected.', { exact: true })).toBeVisible();
  await expect(editor.locator('.connection-hit-target')).toHaveCount(2);
  const line = editor.locator('.connection-hit-target[data-parent="strength"][data-child="wisdom"]');
  const point = await line.evaluate(el => { const path = el as SVGPathElement, p = path.getPointAtLength(path.getTotalLength() / 2), matrix = path.getScreenCTM()!; const screen = new DOMPoint(p.x, p.y).matrixTransform(matrix); return { x: screen.x, y: screen.y }; });
  await page.mouse.click(point.x, point.y);
  await expect(editor.getByRole('button', { name: 'Remove connection', exact: true })).toBeVisible();
  await editor.screenshot({ path: info.outputPath('talents-connectors.png'), animations: 'disabled' });
  await editor.getByRole('button', { name: 'Remove connection', exact: true }).click();
  await expect(line).toHaveCount(0);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.edges).toEqual([{ parent: 'wisdom', child: 'endurance', parentSide: 'bottom', childSide: 'top' }]);
  expect(tree.nodes[0]).toMatchObject({ x: 100, y: 100 });
});

test('talents connectors cancel on empty drops and support keyboard linking with an open sidebar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'light', 'creator', false, { talents: true, talentConnectors: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), source = editor.getByRole('button', { name: 'Connect from: Strength (Right)', exact: true });
  await editor.getByRole('button', { name: 'Strength: 0/2', exact: true }).hover();
  const a = (await source.boundingBox())!, canvas = (await editor.locator('.canvas-viewport').boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(canvas.x + 20, canvas.y + 20, { steps: 6 }); await page.mouse.up();
  await expect(editor.locator('.connection-hit-target')).toHaveCount(0); await expect(editor.locator('.connection-preview')).toHaveCount(0);
  await source.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await expect(editor).toBeVisible(); await expect(editor.locator('.connection-preview')).toHaveCount(0);
  await editor.getByRole('button', { name: 'Endurance: 0/2', exact: true }).click({ button: 'right' });
  const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  await sidebar.getByLabel('Name', { exact: true }).fill('Stamina');
  await source.focus(); await page.keyboard.press('Enter');
  await editor.getByRole('button', { name: 'Connect from: Endurance (Top)', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(editor.locator('.connection-hit-target')).toHaveCount(1);
  await expect(sidebar.getByText('Strength', { exact: true })).toBeVisible();
  await expect(sidebar.getByLabel('Name', { exact: true })).toHaveValue('Stamina');
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await expect(sidebar).toBeHidden();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.edges).toEqual([{ parent: 'strength', child: 'endurance', parentSide: 'right', childSide: 'top' }]); expect(tree.nodes.find((node: any) => node.id === 'endurance').name).toBe('Stamina');
});

test('talents connection dots attach to every source and target border', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await setup(page, 'dark', 'creator', false, { talents: true, talentConnectors: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  for (const from of ['Top', 'Right', 'Bottom', 'Left']) for (const to of ['Top', 'Right', 'Bottom', 'Left']) {
    const source = editor.getByRole('button', { name: `Connect from: Strength (${from})`, exact: true });
    const target = editor.getByRole('button', { name: `Connect from: Wisdom (${to})`, exact: true });
    await source.focus(); await page.keyboard.press('Enter'); await target.focus(); await page.keyboard.press('Enter');
    const line = editor.locator('.connection-hit-target'); await expect(line).toHaveCount(1);
    const endpoints = await line.evaluate(el => {
      const path = el as SVGPathElement, matrix = path.getScreenCTM()!;
      return [0, path.getTotalLength()].map(length => { const p = path.getPointAtLength(length), screen = new DOMPoint(p.x, p.y).matrixTransform(matrix); return { x: screen.x, y: screen.y }; });
    });
    for (const [index, dot] of [source, target].entries()) {
      const box = (await dot.boundingBox())!;
      expect(endpoints[index]!.x).toBeCloseTo(box.x + box.width / 2, 0);
      expect(endpoints[index]!.y).toBeCloseTo(box.y + box.height / 2, 0);
    }
    await line.focus(); await page.keyboard.press('Delete'); await expect(line).toHaveCount(0);
  }
});

test('talents selected connections change styles immediately and preserve them through sidebar edits and saving', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentConnectors: true });
  await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
  await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
  await editor.getByRole('button', { name: 'Connect from: Strength (Bottom)', exact: true }).focus(); await page.keyboard.press('Enter');
  await editor.getByRole('button', { name: 'Connect from: Endurance (Top)', exact: true }).focus(); await page.keyboard.press('Enter');
  const line = editor.locator('.connection-hit-target'); await line.focus(); await page.keyboard.press('Enter');
  const styles = editor.getByRole('group', { name: 'Connection style', exact: true });
  await expect(styles.getByRole('button', { name: 'Rounded', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const rounded = await line.getAttribute('d'); expect(rounded).toContain(' C ');
  await styles.getByRole('button', { name: 'Square', exact: true }).click();
  await expect(styles.getByRole('button', { name: 'Square', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const square = (await line.getAttribute('d'))!; expect(square).not.toContain('C');
  const points = square.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  for (let i = 2; i < points.length; i += 2) expect(points[i] === points[i - 2] || points[i + 1] === points[i - 1]).toBe(true);
  await styles.getByRole('button', { name: 'Straight', exact: true }).click();
  await expect(styles.getByRole('button', { name: 'Straight', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const straight = (await line.getAttribute('d'))!; expect(straight.match(/ L /g)).toHaveLength(1); expect(straight).not.toContain('C');
  await styles.getByRole('button', { name: 'Rounded', exact: true }).click(); await expect(line).toHaveAttribute('d', rounded!);
  await styles.getByRole('button', { name: 'Square', exact: true }).click();
  const arrows = editor.getByRole('group', { name: 'Arrow style', exact: true });
  const rendered = editor.locator('.editor-edge');
  await expect(arrows.getByRole('button', { name: 'Triangle arrow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const defaultMarker = await rendered.getAttribute('marker-end');
  await arrows.getByRole('button', { name: 'Chevron arrow', exact: true }).click();
  await expect(rendered).toHaveAttribute('marker-end', /-chevron\)/);
  await expect(arrows.getByRole('button', { name: 'Chevron arrow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await arrows.getByRole('button', { name: 'Diamond arrow', exact: true }).click();
  await expect(rendered).toHaveAttribute('marker-end', /-diamond\)/);
  await expect(arrows.getByRole('button', { name: 'Diamond arrow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor.screenshot({ path: info.outputPath('talents-connection-styles.png'), animations: 'disabled' });
  await arrows.getByRole('button', { name: 'Triangle arrow', exact: true }).click(); await expect(rendered).toHaveAttribute('marker-end', defaultMarker!);
  await arrows.getByRole('button', { name: 'Hide arrow', exact: true }).click();
  await expect(rendered).toHaveAttribute('marker-end', 'none');
  await expect(arrows.getByRole('button', { name: 'Hide arrow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(line).toHaveAttribute('d', square);
  await editor.getByRole('button', { name: 'Endurance: 0/2', exact: true }).click({ button: 'right' });
  const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
  await sidebar.getByLabel('Name', { exact: true }).fill('Stamina');
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(sidebar).toBeHidden();
  await expect(line).toHaveAttribute('d', square);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  const tree = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
  expect(tree.edges).toEqual([{ parent: 'strength', child: 'endurance', parentSide: 'bottom', childSide: 'top', style: 'square', arrow: 'none' }]);
});

for (const theme of ['dark', 'light']) {
  test(`talents rank names and descriptions save and grey out unreached hover content in ${theme} theme`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1080 });
    const writes = await setup(page, theme, 'creator', false, { talents: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees');
    await page.getByRole('button', { name: 'Edit tree', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    await editor.getByRole('button', { name: 'Strength: 0/2', exact: true }).click({ button: 'right' });
    const sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
    await sidebar.getByRole('button', { name: /^Ranks/ }).click();
    const ranks = sidebar.locator('.level-editor');
    await ranks.nth(0).getByLabel('Rank name', { exact: true }).fill('Novice');
    await ranks.nth(0).getByLabel('Rank description', { exact: true }).fill('Gain one strength.\nTrain every day.');
    await ranks.nth(1).getByLabel('Rank name', { exact: true }).fill('Veteran');
    await ranks.nth(1).getByLabel('Rank description', { exact: true }).fill('Gain two strength.');
    // New ranks receive the same fields before their conditions.
    await sidebar.getByRole('button', { name: 'Add level', exact: true }).click();
    await ranks.nth(2).getByLabel('Rank name', { exact: true }).fill('Legend');
    await ranks.nth(2).getByLabel('Rank description', { exact: true }).fill('Gain three strength.');
    const beforeConditions = await ranks.nth(2).evaluate(el => {
      const name = el.querySelector('input'), description = el.querySelector('textarea'), conditions = el.querySelector('.talent-conditions');
      return !!name && !!description && !!conditions && !!(name.compareDocumentPosition(conditions) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(description.compareDocumentPosition(conditions) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(beforeConditions).toBe(true);
    await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(sidebar).toBeHidden();
    await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
    const saved = writes.findLast(w => w.action === 'talents' && w.payload.op === 'save').payload.tree;
    expect(saved.nodes[0].levels).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Novice', description: 'Gain one strength.\nTrain every day.' }),
      expect.objectContaining({ name: 'Legend', description: 'Gain three strength.' })
    ]));
    await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
    await viewer.getByRole('button', { name: 'Strength: 0/3', exact: true }).hover();
    const tooltip = page.locator('.talent-node-tooltip:visible'), entries = tooltip.locator('.talent-tooltip-rank');
    await expect(entries).toHaveCount(3); await expect(tooltip.getByText('Become stronger', { exact: true })).toBeVisible();
    await expect(entries.filter({ hasText: 'Veteran' })).toHaveClass(/is-unreached/);
    await viewer.getByRole('button', { name: 'Strength: 0/3', exact: true }).click();
    await viewer.getByRole('button', { name: 'Strength: 1/3', exact: true }).hover();
    await expect(entries.nth(0)).not.toHaveClass(/is-unreached/); await expect(entries.nth(1)).toHaveClass(/is-unreached/);
    const titleColor = await entries.nth(1).locator('strong').evaluate(el => getComputedStyle(el).color);
    const descriptionColor = await entries.nth(1).locator('p').evaluate(el => getComputedStyle(el).color);
    expect(titleColor).toBe(descriptionColor);
    expect(titleColor).not.toBe(await entries.nth(0).locator('strong').evaluate(el => getComputedStyle(el).color));
    await page.screenshot({ path: info.outputPath(`talent-rank-tooltip-${theme}.png`), animations: 'disabled' });
    await viewer.getByRole('button', { name: 'Allocate point', exact: true }).click();
    await viewer.getByRole('button', { name: 'Strength: 2/3', exact: true }).hover();
    await expect(entries.nth(1)).not.toHaveClass(/is-unreached/); await expect(entries.nth(2)).toHaveClass(/is-unreached/);
    await viewer.getByRole('button', { name: 'Remove point', exact: true }).click();
    await viewer.getByRole('button', { name: 'Strength: 1/3', exact: true }).hover();
    await expect(entries.nth(1)).toHaveClass(/is-unreached/);
  });
}

test('talents viewer consolidates controls and fills the available height with a margin', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await setup(page, 'dark', 'player', false, { talents: true });
  await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), header = viewer.locator('.canvas-toolbar'), viewport = viewer.locator('.canvas-viewport');
  await expect(header.locator('.canvas-title')).toHaveText('Warrior');
  await expect(header.locator('.canvas-caption')).toContainText('1 talent');
  await expect(header.locator('.talent-build-summary')).toContainText('0 points invested');
  await expect(viewer.getByRole('heading', { name: 'Warrior', exact: true })).toHaveCount(0);
  await expect(viewer.locator('.talent-tree-heading,.talent-build-toolbar')).toHaveCount(0);
  const fit = header.getByRole('button', { name: 'Fit view', exact: true });
  await expect(fit).toBeVisible(); await expect(header.getByRole('button', { name: 'Reset tree', exact: true })).toBeVisible();
  expect(await fit.evaluate(el => el.nextElementSibling?.textContent?.trim().toLowerCase())).toBe('reset tree');
  await expect(viewer.locator('.talent-tree-navigation .talent-wallets')).toContainText('Global points');
  await expect(viewer.locator('.talent-tree-navigation .talent-wallets')).toContainText('Tree points');
  const main = (await viewer.locator('.viewer-main').boundingBox())!;
  const workspace = (await viewer.locator('.talent-play-workspace').boundingBox())!;
  expect(main.y + main.height - workspace.y - workspace.height).toBeLessThanOrEqual(25);
  expect((await viewport.boundingBox())!.height).toBeGreaterThan(500);
  const dimensions = await viewport.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight, worldWidth: el.scrollWidth, worldHeight: el.scrollHeight }));
  expect(dimensions.worldWidth).toBeLessThanOrEqual(dimensions.width + 1); expect(dimensions.worldHeight).toBeLessThanOrEqual(dimensions.height + 1);
  const node = viewer.getByRole('button', { name: 'Strength: 0/2', exact: true });
  await expect.poll(async () => { const a = (await node.boundingBox())!, b = (await viewport.boundingBox())!; return Math.min(a.x - b.x, a.y - b.y, b.x + b.width - a.x - a.width, b.y + b.height - a.y - a.height); }).toBeGreaterThan(35);
  await viewer.screenshot({ path: info.outputPath('talents-viewer-compact.png'), animations: 'disabled' });
  await node.click(); await expect(header.locator('.talent-build-summary')).toContainText('1 points invested');
  page.once('dialog', dialog => dialog.accept()); await header.getByRole('button', { name: 'Reset tree', exact: true }).click();
  await expect(header.locator('.talent-build-summary')).toContainText('0 points invested');
});

for (const width of [1440, 390]) {
  test(`talents viewer fits each selected tree and keeps controls within ${width}px`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 1080 });
    await setup(page, 'light', 'player', false, { talents: true, talentDesign: true });
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true });
    for (const index of [0, 1, 2]) {
      await viewer.locator('.talent-nav-item').nth(index).click();
      await expect.poll(async () => {
        const canvas = (await viewer.locator('.canvas-viewport').boundingBox())!;
        const nodes = await viewer.locator('.talent-node').all();
        for (const node of nodes) { const rect = (await node.boundingBox())!; if (rect.x < canvas.x || rect.y < canvas.y || rect.x + rect.width > canvas.x + canvas.width || rect.y + rect.height > canvas.y + canvas.height) return false; }
        return true;
      }).toBe(true);
      expect(await viewer.locator('.canvas-toolbar').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      expect(await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    }
    await viewer.screenshot({ path: info.outputPath(`talents-viewer-fitted-${width}.png`), animations: 'disabled' });
  });
}

for (const screen of [{ width: 1440, height: 900 }, { width: 1440, height: 600 }, { width: 390, height: 844 }, { width: 390, height: 640 }]) {
  test(`talents viewer keeps its screen fixed without a grid at ${screen.width}x${screen.height}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize(screen);
    await setup(page, 'dark', 'player', false, { talents: true, talentDesign: true, talentLongDescription: true });
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), canvas = viewer.locator('.canvas-viewport');
    await expect(viewer.locator('.canvas-scroll-space')).toHaveCSS('background-image', 'none');
    async function fixedScreen() {
      const box = (await viewer.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(screen.height + 1);
      for (const selector of ['.talent-viewer-body', '.viewer-layout', '.viewer-main', '.talent-play-workspace']) {
        const overflow = await viewer.locator(selector).evaluate(el => el.scrollHeight - el.clientHeight);
        expect(overflow, `${selector} should fit without outer scrolling`).toBeLessThanOrEqual(1);
      }
      expect((await canvas.boundingBox())!.height).toBeGreaterThan(70);
      await expect(viewer.locator('.canvas-toolbar').getByRole('button', { name: 'Reset tree', exact: true })).toBeVisible();
    }
    await fixedScreen();
    await viewer.getByRole('button', { name: 'Strength: 3/3', exact: true }).click(); await page.mouse.move(0, 0);
    await expect(viewer.getByRole('button', { name: 'Remove point', exact: true })).toBeVisible();
    await fixedScreen();
    await expect.poll(async () => {
      const frame = (await canvas.boundingBox())!;
      for (const node of await viewer.locator('.talent-node').all()) {
        const box = (await node.boundingBox())!;
        if (box.x < frame.x || box.y < frame.y || box.x + box.width > frame.x + frame.width || box.y + box.height > frame.y + frame.height) return false;
      }
      return true;
    }).toBe(true);
    const details = viewer.locator('.talent-detail-content');
    expect(await details.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await viewer.screenshot({ path: info.outputPath(`talents-fixed-${screen.width}-${screen.height}.png`), animations: 'disabled' });
    const initial = await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollTop);
    const header = (await viewer.locator('.canvas-toolbar').boundingBox())!;
    await page.mouse.move(header.x + 10, header.y + 10); await page.mouse.wheel(0, 500);
    expect(await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollTop)).toBe(initial);
  });
}
