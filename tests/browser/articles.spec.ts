import { test, expect, type Page } from '@playwright/test';
const empty = () => ({ version: 1, content: { type: 'doc', content: [{ type: 'paragraph' }] } });
async function setup(page: Page, chooseNew = true) {
  await page.addInitScript(() => localStorage.setItem('aventyr_global_state', JSON.stringify({ version: 1, theme: 'dark', themeStyle: 'default', locale: 'en', discord: { user: { id: 'owner', username: 'Owner', avatar: '', role: 'owner' }, auth: { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, expiresAt: Date.now() + 3600000, scope: 'identify', state: 'test' } }, ui: {} })));
  const drafts = new Map<string, Record<string, unknown>>();
  const saves: Record<string, any>[] = [];
  const tags: Array<{ id: string; name: string; slug: string }> = [];
  const images: Array<{ id: string; url: string; library?: boolean }> = [];
  const deletions: string[] = [];
  const colors = { recent: [] as string[], custom: [] as string[] };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown = {};
    if (path.endsWith('/discord') || path.includes('/users/owner')) data = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme: 'dark', themeStyle: 'default' };
    if (path.endsWith('/editor-colors')) {
      if (route.request().method() === 'POST') {
        const color = route.request().postDataJSON().color as string;
        const key = ['#9b9b9b','#a8795a','#e28a43','#d6b64c','#6b9e78','#6395cf','#a381c4','#d27ca5','#da7272','#eeeeee'].includes(color) ? 'recent' : 'custom';
        colors[key] = [color, ...colors[key].filter(c => c !== color)].slice(0, 8);
      }
      data = colors;
    }
    if (path.endsWith('/articles/tags')) {
      if (route.request().method() === 'POST') {
        const name = route.request().postDataJSON().name;
        const tag = { id: `tag-${tags.length + 1}`, name, slug: name.toLowerCase() }; tags.push(tag); data = { tag };
      } else data = { tags };
    }
    if (path.includes('/admin/articles/tags/')) {
      const index = tags.findIndex(tag => tag.id === path.split('/').at(-1));
      if (route.request().method() === 'PATCH') { tags[index].name = route.request().postDataJSON().name; data = { tag: tags[index] }; }
      if (route.request().method() === 'DELETE') tags.splice(index, 1);
    }
    if (path.endsWith('/article-images')) {
      if (route.request().method() === 'POST') {
        const image = { library: url.searchParams.get('library') === 'true', id: '11111111-1111-4111-a111-111111111111', url: '/api/article-images/11111111-1111-4111-a111-111111111111' };
        images.push(image); data = image;
      } else data = { images: images.filter(image => image.library) };
    }
    if (path.includes('/admin/article-images/') && route.request().method() === 'DELETE') {
      const id = path.split('/').at(-1)!; deletions.push(id);
      const index = images.findIndex(image => image.id === id);
      if (index >= 0) images.splice(index, 1);
    }
    if (path.includes('/admin/article-images/') && route.request().method() !== 'DELETE') data = { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=' };
    if (path.endsWith('/articles/drafts')) {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON();
        saves.push(payload);
        const id = payload.id ?? `draft-${drafts.size + 1}`;
        data = { ...payload, id, uid: `UID-${id}`, ownerId: 'owner', title: payload.translations?.en?.title ?? '', introduction: payload.translations?.en?.introduction ?? '', updatedAt: '2026-11-13T10:30:00Z', translations: payload.translations ?? { en: { title: '', introduction: '', document: empty() } } };
        drafts.set(id, data as Record<string, unknown>);
        data = { draft: data };
      } else data = { drafts: [...drafts.values()] };
    }
    if (/\/articles\/drafts\/[^/]+\/preview$/.test(path)) data = { html: '<h2>Rendered section</h2><p>Saved <strong>body text</strong>.</p><ul><li>A list item</li></ul>' };
    if (path.endsWith('/articles') && route.request().method() === 'POST') data = { article: { id: 'article', uid: 'UID-article', slug: 'article' } };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/admin/articles/write');
  await expect(page.getByRole('dialog', { name: 'Choose a draft', exact: true })).toBeVisible();
  if (chooseNew) await page.getByRole('button', { name: 'New article', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Default', exact: true })).toBeVisible();
  return { saves, drafts, deletions, colors, tags };
}

async function openTableActions(page: Page, axis: 'row' | 'column', row = 1, column = 0) {
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.locator('tr').nth(row).locator('td,th').nth(column).hover({ position: { x: 12, y: 10 } });
  await page.getByRole('button', { name: axis === 'row' ? 'Row actions' : 'Column actions', exact: true }).click();
  await expect(page.locator('.table-axis-outline')).toBeVisible();
}

test('live editing, Markdown shortcuts, language selection and JSON draft saving', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { saves } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await page.keyboard.type('## '); await page.keyboard.type('Heading');
  await expect(body.locator('h2')).toHaveText('Heading');
  await page.keyboard.press('Enter'); await page.keyboard.type('/table');
  await expect(page.getByRole('option', { name: 'Table', exact: true })).toBeVisible();
  await page.keyboard.press('Enter'); await expect(body.locator('table')).toBeVisible();
  await openTableActions(page, 'row');
  await page.getByRole('menuitem', { name: 'Insert below', exact: true }).click();
  await expect(body.locator('tr')).toHaveCount(4);
  await openTableActions(page, 'column');
  await page.getByRole('menuitem', { name: 'Insert right', exact: true }).click();
  await expect(body.locator('tr').first().locator('th,td')).toHaveCount(4);
  await openTableActions(page, 'row');
  await page.getByRole('menuitem', { name: 'Delete row', exact: true }).click();
  await expect(body.locator('tr')).toHaveCount(3);
  await openTableActions(page, 'column');
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await expect(body.locator('tr').first().locator('th,td')).toHaveCount(3);
  await page.getByRole('button', { name: 'Add language', exact: true }).click();
  await page.getByText('French (fr)', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'French (fr)' })).toBeVisible();
  await page.getByRole('textbox', { name: /^Title/ }).filter({ visible: true }).fill('Français');
  await page.getByRole('textbox', { name: 'Article body' }).filter({ visible: true }).fill('Bonjour');
  await page.getByRole('tab', { name: 'Default', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Article body' }).filter({ visible: true }).locator('h2')).toHaveText('Heading');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.translations?.fr?.title).toBe('Français');
  expect(saves.at(-1)?.translations.en.document.version).toBe(1);
  await page.getByRole('tab', { name: 'French (fr)' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove language', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'French (fr)' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => Boolean(saves.at(-1)?.translations?.fr)).toBe(false);
  expect(errors).toEqual([]);
});

test('block insertion, movement, image links and table controls work on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 950 });
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('First');
  await body.locator('p').first().hover({ position: { x: 2, y: 4 } });
  await page.getByRole('button', { name: 'Insert paragraph (Alt: before)', exact: true }).click({ modifiers: ['Alt'] });
  await page.keyboard.type('Before');
  await expect(body.locator('p').first()).toHaveText('Before');
  await body.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/image');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Link', exact: true }).click();
  await page.getByRole('textbox', { name: /^Image URL/ }).fill('javascript:alert(1)');
  await expect(page.getByRole('dialog', { name: 'Add an image', exact: true }).getByRole('button', { name: 'Insert image', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: /^Image URL/ }).fill('https://example.com/test.png');
  await expect(page.getByRole('textbox', { name: /^Image description/ })).toHaveCount(0);
  await page.getByRole('dialog', { name: 'Add an image', exact: true }).getByRole('button', { name: 'Insert image', exact: true }).click();
  await expect(body.locator('img')).toHaveAttribute('alt', '');
  await expect(body.locator('img')).toHaveAttribute('src', 'https://example.com/test.png');
});


test('autosave retains edits made while a previous save is pending and recovers from failures', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  let releaseFirst: (() => void) | undefined;
  let count = 0;
  const payloads: any[] = [];
  await page.route('**/api/admin/articles/drafts', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const payload = route.request().postDataJSON(); payloads.push(payload); count++;
    if (count === 1) await new Promise<void>(resolve => { releaseFirst = resolve; });
    if (count === 3) return route.fulfill({ status: 500, json: { success: false, error: 'Temporary draft failure' } });
    await route.fulfill({ json: { success: true, data: { draft: { ...payload, id: 'draft-1', uid: 'UID-draft-1', ownerId: 'owner' } } } });
  });
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('First version');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => count).toBe(1);
  await body.press('ControlOrMeta+a');
  await page.keyboard.type('Newer version');
  // Let ProseMirror's DOM observer and Vue's scheduled updates settle under the mocked clock.
  await page.clock.runFor(100);
  await expect(body).toHaveText('Newer version');
  await page.clock.runFor(15001);
  releaseFirst!();
  await expect.poll(() => count).toBe(2);
  expect(JSON.stringify(payloads[1].translations.en.document)).toContain('Newer version');
  await body.press('ControlOrMeta+a');
  await page.keyboard.type('Must survive failure');
  await page.clock.runFor(100);
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect(page.getByText('Temporary draft failure')).toBeVisible();
  await expect(body).toHaveText('Must survive failure');
  await page.clock.runFor(15001);
  await expect.poll(() => count).toBe(4);
  expect(JSON.stringify(payloads[3].translations.en.document)).toContain('Must survive failure');
});

test('image library uploads and drops storage URLs into JSON', async ({ page }) => {
  const { saves, deletions } = await setup(page);
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await page.locator('.image-library input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  const image = page.getByRole('button', { name: 'Insert image', exact: true });
  await expect(image.locator('img')).toBeVisible();
  const transfer = await page.evaluateHandle(() => { const data = new DataTransfer(); data.setData('application/x-aventyr-image', '/api/article-images/11111111-1111-4111-a111-111111111111'); return data; });
  await page.locator('.editor-surface').dispatchEvent('drop', { dataTransfer: transfer, clientX: 200, clientY: 400 });
  await expect(page.getByRole('textbox', { name: 'Article body' }).locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => JSON.stringify(saves.at(-1)?.translations)).toContain('/api/article-images/11111111-1111-4111-a111-111111111111');
  expect(JSON.stringify(saves.at(-1)?.translations)).not.toContain('data:image');
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await image.hover();
  await page.getByRole('button', { name: 'Delete image', exact: true }).click();
  await expect(page.getByText('Remove this image from every language and save before deleting it.')).toBeVisible();
  expect(deletions).toEqual([]);
  await expect(image).toBeVisible();
});

test('public language switching selects whole translations and displays English fallback', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'fr'));
  const locales: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/articles/example')) return route.fulfill({ json: { success: true, data: {} } });
    const requested = url.searchParams.get('locale') ?? 'en'; locales.push(requested);
    const resolved = requested === 'fr' ? 'fr' : 'en';
    await route.fulfill({ json: { success: true, data: { article: { id: 'example', slug: 'example', title: resolved === 'fr' ? 'Titre français' : 'English title', introduction: 'Intro', sanitizedHtml: `<p>${resolved === 'fr' ? 'Bonjour' : 'Hello'}</p>`, tags: [], requestedLocale: requested, resolvedLocale: resolved, availableLocales: ['en','fr'] } } } });
  });
  await page.goto('/articles/example');
  await expect(page.getByText('Titre français', { exact: true })).toBeVisible();
  await expect(page.locator('.article-card')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'fr', exact: true }).click();
  await page.getByText('DE', { exact: true }).click();
  await expect(page.getByText('English title', { exact: true })).toBeVisible();
  await expect(page.getByText('Dieser Artikel ist nicht in deiner Sprache verfügbar. Die englische Version wird angezeigt.')).toBeVisible();
  await expect(page.locator('.article-card')).toHaveAttribute('lang', 'en');
  expect(locales).toEqual(['fr','de']);
});

test('block drag handle reorders article blocks', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await page.keyboard.type('One'); await page.keyboard.press('Enter');
  await page.keyboard.type('Two'); await page.keyboard.press('Enter'); await page.keyboard.type('Three');
  const grip = page.getByRole('button', { name: 'Drag block', exact: true });
  await body.locator('p').last().hover();
  await expect(grip).toBeHidden();
  await expect(page.getByRole('button', { name: 'Move block up', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Move block down', exact: true })).toHaveCount(0);
  await body.locator('p').last().hover({ position: { x: 2, y: 4 } });
  await expect(grip).toBeVisible();
  await page.getByRole('heading', { name: 'Write article', exact: true }).hover();
  await expect(grip).toBeHidden();
  await body.locator('p').last().hover({ position: { x: 2, y: 4 } });
  await page.getByRole('button', { name: 'Drag block', exact: true }).dragTo(body.locator('p').first(), { targetPosition: { x: 1, y: 1 } });
  await expect(body.locator('p').first()).toHaveText('Three');
  await expect(body.locator('p')).toHaveCount(3);
  await expect(page.getByRole('menu', { name: 'Block actions', exact: true })).toHaveCount(0);
});


test('slash command arrows scroll the selected option and block popup centers beside headings', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await expect(page.getByRole('button', { name: 'Insert block', exact: true })).toHaveCount(0);
  await body.click(); await page.keyboard.type('## Heading');
  await body.locator('h2').hover({ position: { x: 2, y: 4 } });
  await expect(page.locator('.block-controls')).toBeVisible();
  const heading = await body.locator('h2').boundingBox();
  const actions = await page.locator('.block-controls').boundingBox();
  expect(Math.abs(actions!.y + actions!.height / 2 - (heading!.y + heading!.height / 2))).toBeLessThan(1);
  await body.click(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  const spacing = await body.evaluate(el => [...el.children].map(block => {
    const style = getComputedStyle(block);
    return { top: style.paddingTop, bottom: style.paddingBottom, margin: style.marginTop };
  }));
  expect(spacing.length).toBeGreaterThanOrEqual(2);
  expect(spacing.every(block => block.top === '6px' && block.bottom === '6px')).toBe(true);
  expect(spacing.slice(1).every(block => block.margin === '8px')).toBe(true);
  const menu = page.getByRole('listbox', { name: 'Insert block', exact: true });
  const headingOption = menu.getByRole('option', { name: 'Heading 2', exact: true });
  await expect(headingOption.locator('.command-shortcut')).toHaveText('##');
  await headingOption.hover();
  await expect(page.locator('.slash-preview').getByRole('img', { name: 'Heading 2', exact: true })).toBeVisible();
  await menu.getByRole('option', { name: 'Text', exact: true }).hover();
  await page.keyboard.press('ArrowUp');
  await expect(menu.locator('[aria-selected="true"] .command-label')).toHaveText('Image');
  await expect.poll(() => menu.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const selected = await menu.locator('[aria-selected="true"]').boundingBox();
  const popup = await menu.boundingBox();
  expect(selected!.y + selected!.height).toBeLessThanOrEqual(popup!.y + popup!.height + 1);
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('[aria-selected="true"] .command-label')).toHaveText('Text');
  await expect.poll(() => menu.evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.locator('.slash-preview').getByRole('img', { name: 'Text', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 850 });
  await expect(page.locator('.slash-preview')).toHaveCount(0);
  const narrowMenu = await menu.boundingBox();
  expect(narrowMenu!.x).toBeGreaterThanOrEqual(0);
  expect(narrowMenu!.x + narrowMenu!.width).toBeLessThanOrEqual(390);
});


test('uploaded image exposes a hover delete overlay and is removed without inserting it', async ({ page }) => {
  const { deletions } = await setup(page);
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await page.locator('.image-library input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  const image = page.getByRole('button', { name: 'Insert image', exact: true });
  await expect(image.locator('img')).toBeVisible();
  const remove = page.getByRole('button', { name: 'Delete image', exact: true });
  await page.getByRole('heading', { name: 'Write article', exact: true }).hover();
  await expect(remove).toBeHidden();
  await image.hover();
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(image).toHaveCount(0);
  expect(deletions).toEqual(['11111111-1111-4111-a111-111111111111']);
  await expect(page.getByRole('textbox', { name: 'Article body' }).locator('img')).toHaveCount(0);
});


test('row and column menus select cells, duplicate, clear, toggle headers and color cells', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await expect(page.locator('.editor-content')).toHaveClass(/is-empty/);
  await body.click(); await page.keyboard.type('/table'); await page.keyboard.press('Enter');
  await expect(page.locator('.editor-content')).not.toHaveClass(/is-empty/);
  await body.locator('tr').nth(1).locator('td').first().locator('p').fill('Treasure');
  await openTableActions(page, 'row');
  await expect(body.locator('.selectedCell')).toHaveCount(3);
  await expect(page.locator('.block-toolbar').getByRole('button', { name: 'Delete table', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
  await expect(body.locator('tr')).toHaveCount(4);
  await expect(body.locator('tr').nth(2)).toContainText('Treasure');
  await openTableActions(page, 'row', 2);
  await page.getByRole('menuitem', { name: 'Clear contents', exact: true }).click();
  await expect(body.locator('tr').nth(2)).not.toContainText('Treasure');
  await expect(body.locator('tr').nth(1)).toContainText('Treasure');
  await openTableActions(page, 'row', 2);
  await page.getByRole('menuitemcheckbox', { name: 'Header row', exact: true }).click();
  await expect(body.locator('tr').nth(2).locator('th')).toHaveCount(3);
  await openTableActions(page, 'column');
  await expect(body.locator('.selectedCell')).toHaveCount(4);
  await page.getByRole('menuitem', { name: 'Color', exact: true }).click();
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(body.locator('[data-background-color="#6395cf"]')).toHaveCount(4);
  await openTableActions(page, 'row');
  await page.getByRole('menuitem', { name: 'Delete table', exact: true }).click();
  await expect(page.locator('.editor-content')).toHaveClass(/is-empty/);
});

test('text palette preserves selection and stores recent preset and custom colors across reloads', async ({ page }) => {
  const { colors } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('Colorful story'); await body.press('ControlOrMeta+a');
  const openPalette = () => page.locator('.selection-tools').getByRole('button', { name: 'Text color', exact: true }).click();
  await openPalette();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(body.locator('span[style*="color"]')).toHaveText('Colorful story');
  await expect.poll(() => colors.recent).toEqual(['#6395cf']);
  await openPalette();
  await page.getByText('Choose a custom color', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).fill('#123456');
  await page.locator('.article-color-palette').getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => colors.custom).toEqual(['#123456']);
  await page.reload();
  await page.getByRole('button', { name: 'New article', exact: true }).click();
  await body.fill('Another article'); await body.press('ControlOrMeta+a');
  await openPalette();
  await expect(page.getByRole('heading', { name: 'Recent', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Custom', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '#6395cf', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '#123456', exact: true })).toBeVisible();
});

test('cell popup selects and changes only the hovered cell', async ({ page }) => {
  const { saves } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await page.keyboard.type('/table'); await page.keyboard.press('Enter');
  const row = body.locator('tr').nth(1);
  const neighbor = row.locator('td').nth(0);
  const cell = row.locator('td').nth(1);
  await neighbor.locator('p').fill('Neighbor');
  await cell.locator('p').fill('Target');
  await cell.hover({ position: { x: 12, y: 10 } });
  await page.getByRole('button', { name: 'Cell actions', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Cell actions', exact: true });
  await expect(menu).toBeVisible();
  await expect(body.locator('.selectedCell')).toHaveCount(1);
  await expect(cell).toHaveClass(/selectedCell/);
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await menu.getByRole('menuitem', { name: 'Clear contents', exact: true }).click();
  await expect(cell).not.toContainText('Target');
  await expect(neighbor).toHaveText('Neighbor');
  await cell.hover({ position: { x: 12, y: 10 } });
  await page.getByRole('button', { name: 'Cell actions', exact: true }).click();
  await menu.getByRole('menuitem', { name: 'Color', exact: true }).click();
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(cell).toHaveAttribute('data-background-color', '#6395cf');
  await expect(body.locator('[data-background-color="#6395cf"]')).toHaveCount(1);
  await expect(neighbor).toHaveText('Neighbor');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.translations.en.document.content.content[0].content[1].content[1].attrs.backgroundColor).toBe('#6395cf');
});

test('clicking the block grip opens whole-block colors and delete without reordering', async ({ page }) => {
  const { saves } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await page.keyboard.type('First text'); await page.keyboard.press('Enter'); await page.keyboard.type('Second text');
  const openBlock = async () => {
    await body.locator('p').first().hover({ position: { x: 2, y: 4 } });
    await page.getByRole('button', { name: 'Drag block', exact: true }).click();
  };
  await openBlock();
  const menu = page.getByRole('menu', { name: 'Block actions', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await menu.getByRole('menuitem', { name: 'Color', exact: true }).click();
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(body.locator('p').first()).toHaveAttribute('data-background-color', '#6395cf');
  await expect(body.locator('p').nth(1)).not.toHaveAttribute('data-background-color');
  await openBlock();
  await menu.getByRole('menuitem', { name: 'Color', exact: true }).click();
  await page.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(body.locator('p').first()).toHaveAttribute('data-text-color', '#da7272');
  await expect(body.locator('p').first().locator('span')).toHaveText('First text');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.translations.en.document.content.content[0].attrs.backgroundColor).toBe('#6395cf');
  await openBlock();
  await menu.getByRole('menuitem', { name: 'Delete block', exact: true }).click();
  await expect(body.locator('p')).toHaveCount(1);
  await expect(body).toHaveText('Second text');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(body.locator('p').first()).toHaveText('First text');
  await expect(body.locator('p').first()).toHaveAttribute('data-background-color', '#6395cf');
});

test('non-text block menu offers delete without a color action', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await page.keyboard.type('/divider'); await page.keyboard.press('Enter');
  await body.locator('hr').hover({ position: { x: 2, y: 0 } });
  const grip = page.getByRole('button', { name: 'Drag block', exact: true });
  await grip.focus(); await grip.press('Enter');
  const menu = page.getByRole('menu', { name: 'Block actions', exact: true });
  await expect(menu.getByRole('menuitem')).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: 'Color', exact: true })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Delete block', exact: true }).click();
  await expect(body.locator('hr')).toHaveCount(0);
  await expect(page.locator('.editor-content')).toHaveClass(/is-empty/);
});

test('drafts open in a side panel without shrinking the full-width editor', async ({ page }) => {
  const { drafts } = await setup(page);
  expect(drafts.size).toBe(0);
  drafts.set('earlier-draft', { id: 'earlier-draft', uid: 'EARLIER', ownerId: 'owner', title: 'Earlier chapter', introduction: 'Intro', translations: { en: { title: 'Earlier chapter', introduction: 'Intro', document: { version: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved passage' }] }] } } } }, selectedTagIds: [] });
  await page.getByRole('textbox', { name: /^Title/ }).fill('Working chapter');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => [...drafts.values()].some(draft => draft.title === 'Working chapter')).toBe(true);
  const width = await page.locator('.writer-editor-card').evaluate(el => ({ card: el.getBoundingClientRect().width, parent: el.parentElement!.getBoundingClientRect().width }));
  expect(Math.abs(width.card - width.parent)).toBeLessThan(2);
  const toggle = page.getByRole('button', { name: 'Drafts', exact: true });
  await toggle.click();
  const panel = page.getByRole('dialog', { name: 'Drafts', exact: true });
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize()!;
  await expect.poll(async () => { const bounds = await panel.locator('#article-drafts-panel').boundingBox(); return Math.abs(bounds!.x + bounds!.width - viewport.width); }).toBeLessThan(2);
  expect(await page.locator('.writer-editor-card').evaluate(el => el.getBoundingClientRect().width)).toBe(width.card);
  await panel.getByText('Earlier chapter', { exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('textbox', { name: /^Title/ })).toHaveValue('Earlier chapter');
  await expect(page.getByRole('textbox', { name: 'Article body' })).toHaveText('Saved passage');
  await toggle.click();
  await expect(panel.locator('.v-overlay__content')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await page.setViewportSize({ width: 390, height: 850 });
  await toggle.click();
  await expect(panel).toBeVisible();
  const mobileBounds = await panel.locator('#article-drafts-panel').boundingBox();
  expect(mobileBounds!.width).toBeLessThanOrEqual(390);
  expect(mobileBounds!.x).toBeGreaterThanOrEqual(0);
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(panel).toBeHidden();
});

test('entry chooser and blank drafts avoid saving until content exists', async ({ page }) => {
  await page.clock.install();
  const { drafts, saves } = await setup(page, false);
  await page.clock.fastForward(31000);
  expect(saves).toHaveLength(0);
  await page.getByRole('button', { name: 'New article', exact: true }).click();
  await page.clock.fastForward(31000);
  expect(saves).toHaveLength(0);
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  expect(saves).toHaveLength(0);
  await page.getByRole('textbox', { name: /^Title/ }).fill('A new beginning');
  await page.clock.fastForward(16000);
  await expect.poll(() => drafts.size).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'Last saved by Owner' })).toBeVisible();
  await page.getByRole('textbox', { name: /^Introduction/ }).hover();
  await expect(page.getByRole('tooltip')).toContainText('short summary');
  await page.reload();
  const chooser = page.getByRole('dialog', { name: 'Choose a draft', exact: true });
  await expect(chooser).toBeVisible();
  await chooser.getByText('A new beginning', { exact: true }).click();
  await expect(chooser).toBeHidden();
  await expect(page.getByRole('textbox', { name: /^Title/ })).toHaveValue('A new beginning');
});

test('selection tools format only selected text and the image library stays outside the canvas', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await expect(page.locator('.selection-tools')).toHaveCount(0);
  await expect(page.getByText('Main article text', { exact: true })).toBeVisible();
  await body.fill('Selected words'); await body.press('ControlOrMeta+a');
  const tools = page.getByRole('toolbar', { name: 'Formatting', exact: true });
  await expect(tools).toBeVisible();
  await body.press('Alt+F10');
  await expect(tools.getByRole('button').first()).toBeFocused();
  await tools.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(body.locator('strong')).toHaveText('Selected words');
  await tools.getByRole('button', { name: 'Underline', exact: true }).click();
  await expect(body.locator('u')).toHaveText('Selected words');
  await body.press('ArrowRight');
  await expect(tools).toHaveCount(0);
  const width = await body.evaluate(el => el.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Image library', exact: true });
  await expect(library).toBeVisible();
  expect(await body.evaluate(el => el.getBoundingClientRect().width)).toBe(width);
  await library.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 850 });
  await body.press('ControlOrMeta+a');
  await expect(tools).toBeVisible();
  const bounds = await tools.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});

test('slash image creates an inline placeholder, prompts for library storage and replaces the block', async ({ page }) => {
  const { saves } = await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('/image'); await page.keyboard.press('Enter');
  await expect(body.getByRole('button', { name: 'Add an image', exact: true })).toBeVisible();
  const popup = page.getByRole('dialog', { name: 'Add an image', exact: true });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Upload file', exact: true })).toBeVisible();
  await expect(popup.getByRole('textbox')).toHaveCount(0);
  await popup.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  const prompt = page.getByRole('dialog', { name: 'Save to library', exact: true });
  await expect(prompt).toBeVisible();
  const upload = page.waitForRequest(req => req.method() === 'POST' && req.url().includes('/admin/article-images'));
  await prompt.getByRole('button', { name: 'Save to library', exact: true }).click();
  expect(new URL((await upload).url()).searchParams.get('library')).toBe('true');
  await expect(body.locator('img')).toBeVisible();
  await expect(body.locator('.article-image-placeholder')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => JSON.stringify(saves.at(-1)?.translations)).toContain('/api/article-images/');
  expect(JSON.stringify(saves.at(-1)?.translations)).not.toContain('imagePlaceholder');
});

test('scoped image upload stays outside the library and a failed upload can be retried on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await setup(page);
  let attempts = 0;
  await page.route('**/api/admin/article-images?**', async route => {
    if (route.request().method() !== 'POST' || attempts++) return route.fallback();
    await route.fulfill({ status: 500, json: { success: false, error: 'Try the upload again' } });
  });
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('/image'); await page.keyboard.press('Enter');
  const popup = page.getByRole('dialog', { name: 'Add an image', exact: true });
  await expect(popup).toBeVisible();
  const bounds = await popup.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  const file = { name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };
  await popup.locator('input[type="file"]').setInputFiles(file);
  const prompt = page.getByRole('dialog', { name: 'Save to library', exact: true });
  await expect(prompt).toHaveClass(/v-overlay--active/);
  await prompt.getByRole('button', { name: 'Only this article', exact: true }).click();
  await expect(popup.getByText('Try the upload again', { exact: true })).toBeVisible();
  await expect(body.locator('.article-image-placeholder')).toHaveCount(1);
  const upload = page.waitForRequest(req => req.method() === 'POST' && req.url().includes('/admin/article-images'));
  await popup.locator('input[type="file"]').setInputFiles(file);
  await expect(prompt).toHaveClass(/v-overlay--active/);
  await prompt.getByRole('button', { name: 'Only this article', exact: true }).click();
  const request = new URL((await upload).url());
  expect(request.searchParams.get('library')).toBe('false');
  expect(request.searchParams.get('draftId')).toBeTruthy();
  await expect(body.locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await expect(page.getByText('Your image collection starts here.')).toBeVisible();
});

test('formatting shortcuts work while typing and on selected text', async ({ page }) => {
  await setup(page);
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.click(); await body.press('ControlOrMeta+b'); await page.keyboard.type('Bold'); await body.press('ControlOrMeta+b'); await page.keyboard.type(' plain');
  await expect(body.locator('strong')).toHaveText('Bold');
  await body.press('ControlOrMeta+a'); await body.press('ControlOrMeta+i');
  const markedText = (tag: string) => body.locator(tag).allTextContents().then(parts => parts.join(''));
  await expect.poll(() => markedText('em')).toBe('Bold plain');
  await body.press('ControlOrMeta+u'); await expect.poll(() => markedText('u')).toBe('Bold plain');
  await body.press('ControlOrMeta+Shift+s'); await expect.poll(() => markedText('s')).toBe('Bold plain');
  await body.press('ControlOrMeta+e'); await expect(body.locator('code')).toContainText('Bold plain');
  await body.press('ControlOrMeta+z'); await expect(body.locator('code')).toHaveCount(0);
  await body.press('ControlOrMeta+Shift+z'); await expect(body.locator('code')).toContainText('Bold plain');
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
  await expect(page.getByText(/Ctrl\+B|⌘\+B/)).toBeVisible();
});

test('table block alignment changes position, persists in drafts and supports undo', async ({ page }) => {
  const { saves } = await setup(page);
  await page.getByRole('textbox', { name: /^Title/ }).fill('Table layout');
  const body = page.getByRole('textbox', { name: 'Article body' });
  await body.fill('/table'); await body.press('Enter');
  const table = body.locator('table');
  await body.locator('.tableWrapper').hover({ position: { x: 2, y: 10 } });
  const controls = page.locator('.block-controls');
  const initialLeft = (await controls.boundingBox())!.x;
  await page.getByRole('button', { name: 'Drag block', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Table alignment', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Table alignment', exact: true });
  const menuLeft = (await menu.boundingBox())!.x;
  for (const [alignment, label] of [['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['full', 'Full width']]) {
    const option = menu.getByRole('menuitemradio', { name: label, exact: true });
    await option.click();
    await expect(menu).toBeVisible();
    await expect(option).toHaveAttribute('aria-checked', 'true');
    await expect(table).toHaveAttribute('data-table-alignment', alignment);
    expect((await controls.boundingBox())!.x).toBe(initialLeft);
    expect((await menu.boundingBox())!.x).toBe(menuLeft);
    const layout = await table.evaluate(el => { const table = el.getBoundingClientRect(); const parent = el.parentElement!.getBoundingClientRect(); return { width: table.width, parent: parent.width, left: table.left - parent.left, right: parent.right - table.right }; });
    expect(Math.abs(layout.width / layout.parent - (alignment === 'full' ? 1 : .75))).toBeLessThan(.02);
    if (alignment === 'center') expect(Math.abs(layout.left - layout.right)).toBeLessThan(2);
    if (alignment === 'right') expect(layout.right).toBeLessThan(2);
  }
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(() => saves.at(-1)?.translations.en.document.content.content.find((node: any) => node.type === 'table')?.attrs.alignment).toBe('full');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(table).toHaveAttribute('data-table-alignment', 'right');
});

test('draft chooser and side panel open rendered block previews without selecting the draft', async ({ page }) => {
  const { drafts } = await setup(page, false);
  drafts.set('preview-draft', { id: 'preview-draft', uid: 'PREVIEW', ownerId: 'owner', title: 'Preview chapter', selectedTagIds: [], translations: { en: { title: 'Preview chapter', introduction: 'A short introduction.', document: { version: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved body text.' }] }] } } } } });
  await page.reload();
  const chooser = page.getByRole('dialog', { name: 'Choose a draft', exact: true });
  await expect(chooser.locator('.draft-preview')).toHaveCount(0);
  const previewButton = chooser.getByRole('button', { name: 'Preview draft', exact: true });
  await previewButton.hover();
  const popup = page.getByRole('dialog', { name: 'Preview draft', exact: true });
  await expect(popup.getByRole('heading', { name: 'Rendered section', exact: true })).toBeVisible();
  await expect(popup.locator('strong')).toHaveText('body text');
  await expect(popup.locator('li')).toHaveText('A list item');
  await expect(chooser).toBeVisible();
  await popup.getByRole('button', { name: 'Close', exact: true }).click();
  await chooser.getByText('Preview chapter', { exact: true }).click();
  await page.getByRole('button', { name: 'Drafts', exact: true }).click();
  const sidebar = page.getByRole('dialog', { name: 'Drafts', exact: true });
  await sidebar.getByRole('button', { name: 'Preview draft', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(popup.getByRole('heading', { name: 'Rendered section', exact: true })).toBeVisible();
  await expect(popup.getByText('Preview · First 3 blocks', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 850 });
  await page.getByRole('button', { name: 'Drafts', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Preview draft', exact: true }).click();
  await expect(popup.getByRole('heading', { name: 'Rendered section', exact: true })).toBeVisible();
  const bounds = await popup.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
});

test('tag manager creates, renames and removes tags while preserving other edits', async ({ page }) => {
  const { saves } = await setup(page);
  await expect(page.getByRole('textbox', { name: 'Manage tags', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manage tags', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Manage tags', exact: true });
  const newName = modal.getByRole('textbox', { name: /^Tag name/ });
  const add = modal.getByRole('button', { name: 'Create a tag', exact: true });
  await expect(add).toBeDisabled();
  await newName.fill('Lore'); await newName.press('Enter');
  await expect(modal.getByRole('textbox', { name: 'Edit tag: Lore', exact: true })).toBeVisible();
  await newName.fill('Travel'); await add.click();
  await modal.getByRole('textbox', { name: 'Edit tag: Lore', exact: true }).fill('World lore');
  await modal.getByRole('textbox', { name: 'Edit tag: Travel', exact: true }).fill('Journeys');
  await modal.locator('.tag-manager-row').nth(1).getByRole('button', { name: 'Save tag', exact: true }).click();
  await expect(modal.getByRole('textbox', { name: 'Edit tag: Journeys', exact: true })).toBeVisible();
  await expect(modal.getByRole('textbox', { name: 'Edit tag: Lore', exact: true })).toHaveValue('World lore');
  await modal.getByRole('textbox', { name: 'Edit tag: Lore', exact: true }).press('Enter');
  await expect(modal.getByRole('textbox', { name: 'Edit tag: World lore', exact: true })).toBeVisible();
  await newName.fill('world lore');
  await expect(add).toBeDisabled();
  await expect(modal.getByText('A tag with this name already exists.', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.locator('.editor-tags')).toContainText('World lore');
  await expect(page.locator('.editor-tags')).toContainText('Journeys');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.selectedTagIds.length).toBe(2);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.getByRole('button', { name: 'Manage tags', exact: true }).click();
  await modal.locator('.tag-manager-row').first().getByRole('button', { name: 'Remove tag', exact: true }).click();
  await expect(modal.locator('.tag-manager-row')).toHaveCount(1);
  await modal.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.locator('.editor-tags')).not.toContainText('World lore');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.selectedTagIds.length).toBe(1);
});

test('tag creation errors stay in the modal and preserve the entered name for retry', async ({ page }) => {
  await setup(page);
  let failed = false;
  await page.route('**/api/admin/articles/tags', async route => {
    if (route.request().method() !== 'POST' || failed) return route.fallback();
    failed = true;
    await route.fulfill({ status: 500, json: { success: false, error: 'Tag creation failed' } });
  });
  await page.getByRole('button', { name: 'Manage tags', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Manage tags', exact: true });
  const input = modal.getByRole('textbox', { name: /^Tag name/ });
  await input.fill('History');
  await modal.getByRole('button', { name: 'Create a tag', exact: true }).click();
  await expect(modal.getByText('Tag creation failed', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('History');
  await modal.getByRole('button', { name: 'Create a tag', exact: true }).click();
  await expect(modal.getByRole('textbox', { name: 'Edit tag: History', exact: true })).toBeVisible();
});

test('styled tag selector supports search, keyboard selection and removable chips', async ({ page }) => {
  const { tags } = await setup(page);
  tags.push({ id: 'lore', name: 'Lore', slug: 'lore' }, { id: 'travel', name: 'Travel', slug: 'travel' });
  await page.reload();
  await page.getByRole('button', { name: 'New article', exact: true }).click();
  const field = page.locator('.editor-tags');
  const input = field.locator('input');
  await input.click();
  const menu = page.locator('.article-tag-selector-menu');
  await expect(menu.getByText('0 selected', { exact: true })).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(2);
  await expect(menu.getByRole('textbox')).toHaveCount(0);
  await input.fill('tRaV');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await input.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(field.locator('.editor-tag-chip')).toHaveText('Travel');
  await expect(input).toHaveValue('');
  await expect(menu.getByRole('option')).toHaveCount(2);
  await expect(menu.getByText('1 selected', { exact: true })).toBeVisible();
  await input.fill('Lor');
  await menu.getByRole('option', { name: 'Lore', exact: true }).click();
  await expect(field.locator('.editor-tag-chip')).toHaveCount(2);
  await expect(input).toHaveValue('');
  await expect(menu.getByRole('option', { name: 'Lore', exact: true })).toHaveClass(/tag-selector-option-selected/);
  await input.press('Escape');
  await expect(menu).toBeHidden();
  await field.locator('.editor-tag-chip').filter({ hasText: 'Travel' }).locator('.v-chip__close').click();
  await expect(field.locator('.editor-tag-chip')).toHaveText('Lore');
  await input.fill('No matching tag');
  await expect(menu.getByText('No tags match your search.', { exact: true })).toBeVisible();
});

test('translation tabs copy default blocks independently while preserving translated fields', async ({ page }) => {
  const { saves } = await setup(page);
  const body = () => page.getByRole('textbox', { name: 'Article body' }).filter({ visible: true });
  await expect(page.getByRole('button', { name: 'Copy blocks from Default', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add language', exact: true }).click();
  await page.getByText('French (fr)', { exact: true }).click();
  const copy = page.getByRole('button', { name: 'Copy blocks from Default', exact: true });
  await expect(copy).toBeDisabled();
  await page.getByRole('textbox', { name: /^Title/ }).filter({ visible: true }).fill('Titre français');
  await page.getByRole('textbox', { name: /^Introduction/ }).filter({ visible: true }).fill('Introduction française');
  await page.getByRole('tab', { name: 'Default', exact: true }).click();
  await body().fill('## Shared heading');
  await body().press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('/table'); await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'French (fr)', exact: true }).click();
  await copy.click();
  await expect(body().locator('table')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Title/ }).filter({ visible: true })).toHaveValue('Titre français');
  await expect(page.getByRole('textbox', { name: /^Introduction/ }).filter({ visible: true })).toHaveValue('Introduction française');
  await expect(copy).toBeDisabled();
  await body().locator('p').first().fill('French edits');
  page.once('dialog', dialog => dialog.dismiss());
  await copy.click();
  await expect(body()).toContainText('French edits');
  page.once('dialog', dialog => dialog.accept());
  await copy.click();
  await expect(body()).not.toContainText('French edits');
  await body().locator('p').first().fill('Independent French edits');
  await page.getByRole('tab', { name: 'Default', exact: true }).click();
  await expect(body()).not.toContainText('Independent French edits');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => JSON.stringify(saves.at(-1)?.translations.fr.document)).toContain('Independent French edits');
  expect(JSON.stringify(saves.at(-1)?.translations.en.document)).not.toContain('Independent French edits');
});
