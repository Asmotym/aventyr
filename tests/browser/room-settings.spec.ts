import { newTalentTree, emptyTalentPlayer, emptyTalentProgress, emptyConditions } from '../../server/core/types/talents.types';
import { nodeStates, rankCost, rankPayment, paidTotals, purchasePayment, synchronizeTalentProgress, grantLinkedTrees, treeAccessible } from '../../server/core/utils/talents';
import { resolveRoomRights } from '../../server/core/utils/room-permissions';
import { test, expect, type Page } from '@playwright/test';
import type { RoomCriticalRule } from '../../server/core/types/data.types';

interface FixtureOptions {
  talents?: boolean;
  talentDesign?: boolean;
  talentFree?: boolean;
  talentCentered?: boolean;
  talentConnectors?: boolean;
  talentLongDescription?: boolean;
  talentRequirements?: boolean;
  talentConditionGroups?: boolean;
  talentProgression?: boolean;
  talentLinkedPaths?: boolean;
  talentTransfer?: boolean;
  criticals?: RoomCriticalRule[];
  history?: any[];
  onHistoryRequest?: (body: any) => void;
  inspection?: boolean;
  onBagFrame?: (frame: any) => void;
  session?: any;
  diceCount?: number;
  roomCount?: number;
  permissionOverrides?: Record<string, boolean>;
  failActions?: string[];
  onRealtime?: (send: (type: string, extra?: Record<string, unknown>) => void) => void;
}
async function setup(page: Page, theme = 'dark', role = 'creator', awardsEnabled = false, options: FixtureOptions = {}) {
  const user = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme, themeStyle: 'default' };
  const settings = { roomId: 'room', enabled: true, maxPointsPerUser: 5, allowExtremeSpend: false };
  const room = { isFavorite: false, id: 'room', name: 'Test room', inviteCode: 'test', createdBy: 'owner', memberCount: 1, criticals: options.criticals ?? [{ operator: 'moreThan', threshold: 90, color: '#d32f2f' }], bagEnabled: true, bonusPointSettings: settings, sessionInactivityMinutes: 240 };
  const listedRooms = [room, ...Array.from({ length: (options.roomCount ?? 1) - 1 }, (_, i) => ({ ...room, id: `room-${i}`, name: `Adventure ${i}` }))];
  const member = { userId: 'owner', username: 'Owner', avatar: '', role, permissionOverrides: options.permissionOverrides ?? {}, nickname: null };
  const snapshot = { roomId: 'room', version: 2, settings, rules: [], triggers: [] as any[], conditions: [] as any[], effects: [] as any[], balances: [{ userId: 'owner', username: 'Owner', points: 2 }] };
  const talentTree = newTalentTree('talent-tree', 'classic'); talentTree.name = 'Warrior'; talentTree.currency = 'both';
  talentTree.nodes.push({ id: 'strength', name: 'Strength', description: 'Become stronger', icon: 'mdi-sword', imageId: null, subtreeId: null, x: 100, y: 100, parentMode: 'all', conditions: emptyConditions(), hide: emptyConditions(), levels: [{ id: 'rank1', conditions: emptyConditions() }, { id: 'rank2', conditions: emptyConditions() }] });
  const talentPlayer = emptyTalentPlayer(); talentPlayer.global = 2; talentPlayer.trees[talentTree.id] = 1; talentPlayer.progress[talentTree.id] = emptyTalentProgress();
  const talents = { revision: 0, settings: { enabled: !!options.talents, globalEnabled: true, maxGlobal: 0 }, canManage: resolveRoomRights(role as any, options.permissionOverrides as any).manageTalentTrees, trees: options.talents ? [talentTree] : [], player: talentPlayer, states: {} as any, members: [{ userId: 'owner', name: 'Owner', player: talentPlayer }], hidden: {} };
  if (options.talentDesign) {
    if (options.talentFree) talentTree.layout = 'free';
    if (options.talentCentered) talentTree.layout = 'centered';
    talentTree.description = 'Stand your ground. Shape a warrior who protects the party and turns the tide of battle.';
    talentTree.subtrees = ['Vanguard', 'Berserker'].map((name, index) => ({ id: 'path-' + index, name, description: 'Choose your path.', icon: index ? 'mdi-axe-battle' : 'mdi-shield-outline', imageId: null, maxPoints: 0, x: index * 320, y: 0, width: 280, height: 460 }));
    const names = ['Strength', 'Iron Will', 'Shield Wall', 'Last Stand', 'Fury', 'Battle Cry', 'Bloodlust', 'Unstoppable'];
    const icons = ['mdi-sword', 'mdi-shield-half-full', 'mdi-shield-outline', 'mdi-castle', 'mdi-axe-battle', 'mdi-bullhorn-outline', 'mdi-fire', 'mdi-lightning-bolt'];
    talentTree.nodes = names.map((name, index) => ({ ...talentTree.nodes[0]!, id: index ? 'talent-' + index : 'strength', name, description: index ? 'Train this talent to strengthen your character and unlock the next step on your chosen path.' : 'Every great warrior starts with a foundation. Increase your strength and open the path to greater resilience.', icon: icons[index]!, subtreeId: 'path-' + Math.floor(index / 4), x: Math.floor(index / 4) * 320 + (index % 4 === 1 ? 35 : index % 4 === 2 ? 180 : 105), y: index % 4 === 0 ? 70 : index % 4 === 3 ? 360 : 215, levels: [{ id: 'rank1', conditions: emptyConditions() }, { id: 'rank2', conditions: emptyConditions() }, { id: 'rank3', conditions: emptyConditions() }] }));
    talentTree.edges = [{ parent: 'strength', child: 'talent-1' }, { parent: 'strength', child: 'talent-2' }, { parent: 'talent-1', child: 'talent-3' }, { parent: 'talent-2', child: 'talent-3' }, { parent: 'talent-4', child: 'talent-5' }, { parent: 'talent-4', child: 'talent-6' }, { parent: 'talent-5', child: 'talent-7' }, { parent: 'talent-6', child: 'talent-7' }];
    talentPlayer.trees[talentTree.id] = 3; talentPlayer.progress[talentTree.id]!.levels.strength = ['tree', 'tree', 'tree']; talentPlayer.progress[talentTree.id]!.levels['talent-1'] = ['global'];
    for (const [name, layout, icon, description] of [['Arcanist', 'centered', 'mdi-auto-fix', 'Explore the arcane arts and weave a different kind of magic.'], ['Wayfinder', 'free', 'mdi-compass-outline', 'Find your own way through uncharted lands.']] as const) {
      const other = newTalentTree(name.toLowerCase(), layout); other.name = name; other.icon = icon; other.description = description; other.nodes = talentTree.nodes.map((node, index) => { const angle = Math.floor(index / 2) * Math.PI / 2 + Math.PI / 4; const radius = index % 2 ? 320 : 160; return { ...node, subtreeId: null, x: layout === 'centered' ? Math.round(600 + Math.cos(angle) * radius - 32) : (index % 4) * 160 + 60, y: layout === 'centered' ? Math.round(500 + Math.sin(angle) * radius - 32) : Math.floor(index / 4) * 200 + (index % 2 ? 120 : 60) }; }); other.edges = [0, 2, 4, 6].map(index => ({ parent: other.nodes[index]!.id, child: other.nodes[index + 1]!.id })); other.currency = 'both'; talents.trees.push(other); talentPlayer.trees[other.id] = 2;
    }
  }
  if (options.talentConnectors) {
    talentTree.nodes.push(...[['wisdom', 'Wisdom', 400, 100], ['endurance', 'Endurance', 250, 320]].map(([id, name, x, y]) => ({ ...talentTree.nodes[0]!, id: String(id), name: String(name), x: Number(x), y: Number(y) })));
  }
  if (options.talentRequirements) {
    talentTree.nodes[3]!.conditions = { mode: 'any', items: [{ type: 'node', nodeId: 'strength', amount: 2 }, { type: 'node', nodeId: 'talent-4', amount: 2 }] };
    talentTree.nodes[3]!.levels[0]!.conditions = { mode: 'all', items: [{ type: 'treePoints', amount: 8 }, { type: 'subtreePoints', subtreeId: 'path-0', amount: 6 }] };
    talentTree.nodes[4]!.conditions = { mode: 'any', items: [{ type: 'node', nodeId: 'talent-2', amount: 2 }, { type: 'node', nodeId: 'talent-3', amount: 1 }] };
  }
  if (options.talentConditionGroups) talentTree.nodes[7]!.subtreeId = null;
  if (options.talentLongDescription) talentTree.nodes[0]!.description = 'A long description of this talent and its effects.\n'.repeat(80);
  if (options.talentProgression) {
    const advanced = newTalentTree('advanced', 'classic'); advanced.name = 'Advanced'; advanced.nodes = [{ ...talentTree.nodes[0]!, id: 'focus', name: 'Focus' }];
    const notes = newTalentTree('notes', 'classic'); notes.name = 'Mastery Notes'; notes.parentTreeId = advanced.id; notes.nodes = [{ ...talentTree.nodes[0]!, id: 'study', name: 'Study' }];
    talents.trees.push(advanced, notes);
  }
  if (options.talentLinkedPaths) {
    talentTree.name = 'Warrior Training'; talentTree.nodes[0]!.linkedTreeId = 'advanced';
    const advanced = talents.trees.find(tree => tree.id === 'advanced')!; advanced.name = 'Advanced Combat'; advanced.accessMode = 'restricted'; advanced.parentTreeId = talentTree.id;
    talentPlayer.trees[advanced.id] = 2; talentPlayer.global = 4;
  }
  if (options.talentTransfer) {
    talentTree.imageId = 'tree-art'; talentTree.nodes[0]!.imageId = 'tree-art'; talentTree.subtrees[0]!.imageId = 'branch-art';
    talentTree.nodes[0]!.autoUnlock = true; talentTree.nodes[0]!.color = 'teal'; talentTree.nodes[0]!.category = 'active'; talentTree.nodes[0]!.linkedTreeId = 'arcanist';
    talentTree.options.connectionStyle = 'square'; talentTree.options.connectionArrow = 'diamond';
    talentTree.nodes[0]!.levels[0]!.name = 'Foundation'; talentTree.nodes[0]!.levels[0]!.description = 'A ranked description'; talentTree.nodes[0]!.levels[1]!.cost = 0;
    talentTree.edges[0]!.parentSide = 'right'; talentTree.edges[0]!.childSide = 'left'; talentTree.edges[0]!.style = 'straight'; talentTree.edges[0]!.arrow = 'none';
    talentTree.decorations = [{ id: 'note', shape: 'diamond', text: 'Branch note', color: 'pink', fontSize: 23, bold: true, italic: true, underline: true, x: -180, y: -120, width: 180, height: 100 }];
  }
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
          case 'talents': {
            const p = body.payload;
            if (p.op === 'delete' && !p.confirmReset) {
              const progress = talentPlayer.progress[p.treeId];
              if (progress && (Object.values(progress.levels).some(ranks => ranks.some(rank => !rankPayment(rank).automatic)) || progress.selectedSubtree)) {
                writes.push(body); await route.fulfill({ json: { success: true, data: { talents, resetRequired: [{ userId: 'owner', name: 'Owner', ...paidTotals(progress) }] } } }); return;
              }
            }
            if (p.op !== 'read') {
              writes.push(body); talents.revision++;
              if (p.op === 'archive') talents.trees.find(tree => tree.id === p.treeId)!.archived = p.archived;
              if (p.op === 'delete') {
                const index = talents.trees.findIndex(tree => tree.id === p.treeId); if (index >= 0) talents.trees.splice(index, 1);
                const paid = paidTotals(talentPlayer.progress[p.treeId]); talentPlayer.global += paid.global; talentPlayer.trees[p.treeId] = (talentPlayer.trees[p.treeId] ?? 0) + paid.tree; delete talentPlayer.progress[p.treeId];
                for (const tree of talents.trees) { if (tree.parentTreeId === p.treeId) tree.parentTreeId = null; for (const node of tree.nodes) if (node.linkedTreeId === p.treeId) node.linkedTreeId = null; }
              }
              if (p.op === 'settings') talents.settings = p.settings;
              if (p.op === 'save') { const index = talents.trees.findIndex(tree => tree.id === p.tree.id); if (index < 0) talents.trees.push(p.tree); else talents.trees[index] = p.tree; }
              if (p.op === 'allocate' || p.op === 'revert') {
                const progress = talentPlayer.progress[p.treeId] ??= emptyTalentProgress(), payments = progress.levels[p.nodeId] ??= [];
                if (p.op === 'allocate') {
                  const tree = talents.trees.find(tree => tree.id === p.treeId)!, node = tree.nodes.find(node => node.id === p.nodeId)!;
                  const payment = purchasePayment(tree, talentPlayer, talents.settings, rankCost(node, payments.length))!;
                  talentPlayer.trees[p.treeId] = (talentPlayer.trees[p.treeId] ?? 0) - payment.tree; talentPlayer.global -= payment.global; payments.push(payment);
                } else { const payment = rankPayment(payments.pop()); talentPlayer.trees[p.treeId] = (talentPlayer.trees[p.treeId] ?? 0) + payment.tree; talentPlayer.global += payment.global; }
              }
              if (p.op === 'respec') { const paid = paidTotals(talentPlayer.progress[p.treeId]); talentPlayer.global += paid.global; talentPlayer.trees[p.treeId] = (talentPlayer.trees[p.treeId] ?? 0) + paid.tree; talentPlayer.progress[p.treeId] = emptyTalentProgress(); }
              if (p.op === 'access') talentPlayer.grantedTreeIds = [...(talentPlayer.grantedTreeIds ?? []).filter(id => id !== p.treeId), ...(p.granted ? [p.treeId] : [])];
              if (p.op === 'visibility') (talents.hidden as Record<string, string[]>)[p.treeId] = p.visible ? [] : ['owner'];
              grantLinkedTrees(talents.trees, talentPlayer);
              if (p.op === 'balance') { if (p.treeId) talentPlayer.trees[p.treeId] = p.points; else talentPlayer.global = p.points; }
            }
            synchronizeTalentProgress(talents.trees, talentPlayer, talents.settings, Object.entries(talents.hidden).filter(([, ids]) => (ids as string[]).includes('owner')).map(([id]) => id));
            talents.states = Object.fromEntries(talents.trees.map(tree => [tree.id, nodeStates(tree, talentPlayer, talents.settings)])); data = { talents }; break;
          }
          case 'list': case 'userRooms': data = { rooms: listedRooms }; break;
          case 'members': data = { members }; break;
          case 'member': data = { member }; break;
          case 'messages': data = { messages: Array.from({ length: 30 }, (_, i) => ({ id: String(i), roomId: 'room', userId: options.inspection && i === 29 ? 'friend' : 'owner', username: options.inspection && i === 29 ? 'Friend' : 'Owner', nickname: options.inspection && i === 29 ? 'Mage' : null, type: 'text', content: `Message ${i}`, createdAt: new Date(1700000000000 + i * 1000).toISOString() })) }; break;
          case 'sessions': {
            options.onHistoryRequest?.(body);
            const sessions = options.history ?? [];
            const start = body.payload.before ? Number(body.payload.before) : 0;
            data = { sessions: sessions.slice(start, start + 25), nextCursor: sessions.length > start + 25 ? String(start + 25) : null }; break;
          }
          case 'sessionRecap': {
            options.onHistoryRequest?.(body);
            data = { session: [options.session, ...(options.history ?? [])].find(session => session?.id === body.payload.sessionId) }; break;
          }
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
          case 'setRoomFavorite': { writes.push(body); const target = listedRooms.find(room => room.id === body.payload.roomId); if (target) target.isFavorite = body.payload.favorite; data = { roomId: body.payload.roomId }; break; }
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
  await expect(page.getByRole('button', { name: 'Room settings', exact: true })).toBeVisible({ timeout: 15000 });
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
    await expect(panel.getByText('Your created items', { exact: true })).toBeVisible();
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

for (const mobile of [false, true]) {
  for (const destination of ['Home', 'Articles', 'Administration']) {
    test(`${mobile ? 'mobile' : 'desktop'} navigation to ${destination} retains the latest room shortcut`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await setup(page);
      if (mobile) {
        await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
        await page.locator('.mobile-menu-card').getByRole('link', { name: destination, exact: true }).click();
      } else {
        await page.locator('.desktop-navigation').getByRole('link', { name: destination, exact: true }).click();
      }
      await expect(page).not.toHaveURL(/\/rooms\/room/);
      await expect(page.locator('.desktop-navigation').getByRole('link', { name: 'Test room', exact: true })).toHaveAttribute('href', '/rooms/room');
      if (mobile) {
        await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
        await page.locator('.mobile-menu-card').getByRole('link', { name: 'Test room', exact: true }).click();
      } else {
        await page.locator('.desktop-navigation').getByRole('link', { name: 'Test room', exact: true }).click();
      }
      await expect(page).toHaveURL(/\/rooms\/room/);
      await expect(page.getByRole('button', { name: 'Room settings', exact: true })).toBeVisible();
    });
  }
}

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} home rooms scroll above pinned actions and open entry dialogs`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await setup(page, 'dark', 'creator', false, { roomCount: 40 });
    if (mobile) {
      await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
      await page.locator('.mobile-menu-card').getByRole('link', { name: 'Home', exact: true }).click();
    } else await page.locator('.desktop-navigation').getByRole('link', { name: 'Home', exact: true }).click();
    if (mobile) {
      await expect(page.locator('.rooms-sidebar')).not.toBeVisible();
      await page.getByRole('button', { name: 'Open rooms', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Rooms', exact: true })).toBeVisible();
    }
    const sidebar = page.locator('.rooms-sidebar');
    const actions = sidebar.locator('.rooms-sidebar__actions');
    await expect(sidebar.getByText('Adventure 38', { exact: true })).toHaveCount(1);
    const scroll = sidebar.locator('.rooms-list > .v-card-text');
    expect(await scroll.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    const before = await actions.boundingBox();
    expect(before!.y + before!.height).toBeLessThanOrEqual((page.viewportSize()!.height) + 1);
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await actions.boundingBox())!.y).toBeCloseTo(before!.y, 0);
    await actions.getByRole('button', { name: 'Create room', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Create a room', exact: true });
    await expect(dialog.getByRole('heading', { name: 'Create a room', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create room', exact: true })).toBeDisabled();
    await dialog.getByLabel('Room name', { exact: true }).fill('New adventure');
    await expect(dialog.getByRole('button', { name: 'Create room', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await actions.getByRole('button', { name: 'Join room', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Join via invite', exact: true });
    await expect(dialog.getByRole('heading', { name: 'Join via invite', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Join room', exact: true })).toBeDisabled();
    await dialog.getByLabel('Invite code', { exact: true }).fill('ABC123');
    await expect(dialog.getByRole('button', { name: 'Join room', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    if (mobile) {
      await page.getByRole('dialog', { name: 'Rooms', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Rooms', exact: true })).not.toBeVisible();
      await expect(page.locator('.home-hub')).toBeVisible();
      await page.getByRole('button', { name: 'Open rooms', exact: true }).click();
      await sidebar.getByText('Test room', { exact: true }).click();
      await expect(page).toHaveURL(/\/rooms\/room/);
      await expect(page.getByRole('dialog', { name: 'Rooms', exact: true })).toHaveCount(0);
    }
  });
}

test('room favorites move first, persist on reload, and do not navigate into the room', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const writes = await setup(page, 'dark', 'creator', false, { roomCount: 12 });
  await page.locator('.desktop-navigation').getByRole('link', { name: 'Home', exact: true }).click();
  const list = page.locator('.rooms-list');
  await list.getByRole('button', { name: 'Favorite Adventure 8', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(list.locator('.v-list-item').first()).toContainText('Adventure 8');
  expect(writes.find(write => write.action === 'setRoomFavorite')?.payload.favorite).toBe(true);
  await page.reload();
  await expect(list.locator('.v-list-item').first()).toContainText('Adventure 8');
  await list.getByRole('button', { name: 'Remove Adventure 8 from favorites', exact: true }).click();
  await expect(list.locator('.v-list-item').first()).toContainText('Test room');
  const panel = page.locator('.home-hub');
  const scroll = panel.locator('.home-hub__scroll');
  await expect(scroll).toHaveCSS('overflow-y', 'auto');
  const sidebarBox = (await page.locator('.rooms-sidebar').boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.height).toBeCloseTo(sidebarBox.height, 0);
});

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} room header celebration preserves layout and bonus balance stays by composer`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    let send: ((type: string, extra?: Record<string, unknown>) => void) | undefined;
    await setup(page, 'dark', 'creator', false, { onRealtime: sender => { send = sender; } });
    const room = page.locator('.room-panel-host');
    const bounds = (await room.boundingBox())!;
    expect(bounds.x).toBeCloseTo(15, 0);
    expect(page.viewportSize()!.width - bounds.x - bounds.width).toBeCloseTo(15, 0);
    await expect(page.locator('.room-header .bonus-points-counter')).toHaveCount(0);
    await expect(page.locator('.composer-footer .bonus-points-counter')).toContainText('2');
    const session = ownedSession();
    session.configuration.bonusPoints.enabled = true;
    send!('session.started', { session });
    const banner = page.locator('.session-start-banner');
    await expect(banner).toBeVisible();
    const headerHeight = (await page.locator('.room-header-shell').boundingBox())!.height;
    const conversationY = (await page.locator('.messages-container').boundingBox())!.y;
    await expect(banner).not.toBeVisible({ timeout: 6000 });
    expect((await page.locator('.room-header-shell').boundingBox())!.height).toBeCloseTo(headerHeight, 0);
    expect((await page.locator('.messages-container').boundingBox())!.y).toBeCloseTo(conversationY, 0);
    await expect(page.locator('.room-header')).not.toHaveAttribute('inert');
    await expect(page.locator('.room-tools-rail').getByRole('button', { name: 'Room settings', exact: true })).toBeVisible();
  });
}

for (const theme of ['light', 'dark']) {
  test(`matching critical rolls inherit rule colors and animate once (${theme})`, async ({ page }) => {
    let send: ((type: string, extra?: Record<string, unknown>) => void) | undefined;
    await setup(page, theme, 'creator', false, {
      criticals: [{ diceType: 'd20', enabled: true, operator: 'moreThan', threshold: 18, color: '#336699' }],
      onRealtime: sender => { send = sender; },
    });
    await expect(page.locator('.message-row')).toHaveCount(30);
    await expect(page.locator('.bonus-points-counter')).toContainText('2');
    await expect.poll(() => Boolean(send)).toBe(true);
    const message = { id: 'critical-live', roomId: 'room', userId: 'owner', username: 'Owner', type: 'dice', diceNotation: 'd20', diceTotal: 20, diceRolls: [20], createdAt: new Date().toISOString() };
    send!('message.created', { message });
    const bubble = page.locator('.message-content.has-critical');
    await expect(bubble).toHaveCount(1);
    await expect(bubble).toHaveClass(/is-critical-animating/);
    await expect(bubble.locator('.dice-result__value')).toHaveCSS('background-color', 'rgb(51, 102, 153)');
    await expect(bubble.locator('.dice-result__value')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(bubble).not.toHaveClass(/is-critical-animating/);
    send!('message.updated', { message: { ...message, nickname: 'New name' } });
    await expect(bubble).not.toHaveClass(/is-critical-animating/);
    send!('message.updated', { message: { ...message, diceTotal: 19, diceRolls: [19] } });
    await expect(bubble).toHaveClass(/is-critical-animating/);
    send!('message.updated', { message: { ...message, diceTotal: 10, diceRolls: [10] } });
    await expect(page.locator('.message-content.has-critical')).toHaveCount(0);
    await expect(page.locator('.message-content.is-critical-animating')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    send!('message.created', { message: { ...message, id: 'critical-reduced-motion' } });
    const reduced = page.locator('.message-content.has-critical');
    await expect(reduced.locator('.dice-result__value')).toHaveCSS('animation-name', 'none');
    await expect(reduced.locator('.dice-result__value')).toHaveCSS('background-color', 'rgb(51, 102, 153)');
  });
}

test('chat dice suggestions support keyboard selection, dismissal and clicks', async ({ page }) => {
  const writes = await setup(page);
  const input = page.locator('.chat-input input[type="text"]');
  const options = page.getByRole('option');
  await input.fill('d20 Attack');
  await expect(options).toHaveCount(2);
  await input.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('-2d20 Attack');
  await expect(options).toHaveCount(0);
  expect(writes).toHaveLength(0);

  await input.fill('3d100+5  Skill check');
  await options.first().click();
  await expect(input).toHaveValue('+3d100+5  Skill check');
  await expect(input).toBeFocused();
  await input.fill('2d6-1');
  await input.press('ArrowUp');
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
  await input.press('Escape');
  await expect(options).toHaveCount(0);
  await expect(input).toHaveValue('2d6-1');

  await input.fill('Hello d20');
  await expect(options).toHaveCount(0);
  await input.fill('0d20');
  await expect(options).toHaveCount(0);
  await input.fill('Hello there');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect.poll(() => writes.length).toBe(1);
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
  let library = page.locator('.bag-item-templates-dialog');
  await library.getByRole('button', { name: 'New item template', exact: true }).click();
  const presetEditor = page.locator('.bag-item-template-editor-dialog');
  await expect(presetEditor).toBeVisible();
  await expect(library.getByRole('tab')).toHaveCount(0);
  await expect(library.getByLabel('Name', { exact: true })).toHaveCount(0);
  await presetEditor.getByLabel('Name', { exact: true }).fill('My preset');
  await expect(presetEditor.getByText('Display in table view', { exact: true })).toHaveCount(0);
  await presetEditor.locator('.bag-rarity-selection').click();
  const legendary = page.getByRole('option', { name: /^Legendary/ });
  await expect(legendary).toHaveClass(/bag-rarity-option/);
  await legendary.click();
  await expect(presetEditor.locator('.bag-rarity-selection')).toHaveText('Legendary');
  const formBounds = await presetEditor.locator('.bag-editor-form').boundingBox();
  const previewBounds = await presetEditor.locator('.bag-editor-preview').boundingBox();
  if (width > 960) expect(previewBounds!.x).toBeGreaterThan(formBounds!.x);
  else expect(previewBounds!.y).toBeGreaterThan(formBounds!.y);
  await page.screenshot({ path: info.outputPath('item-template-editor.png'), animations: 'disabled' });
  await presetEditor.getByRole('button', { name: 'Fields', exact: true }).click();
  await presetEditor.getByRole('button', { name: 'Add field', exact: true }).click();
  const fieldPicker = page.locator('.bag-field-picker-dialog');
  await expect(fieldPicker.getByRole('tab', { name: 'My fields', exact: true })).toBeVisible();
  await fieldPicker.locator('.bag-field-quick-option').filter({ hasText: 'Text' }).click();
  const firstField = presetEditor.locator('.bag-item-field-card').first();
  await firstField.getByLabel('Name', { exact: true }).fill('Notes');
  await firstField.getByLabel('Value', { exact: true }).fill('A useful default');
  await presetEditor.getByRole('button', { name: 'Add field', exact: true }).click();
  await fieldPicker.getByLabel('Search fields', { exact: true }).fill('Weight');
  await fieldPicker.locator('.bag-field-catalog-entry').filter({ hasText: 'Weight' }).click();
  await expect(presetEditor.locator('.bag-item-field-card').nth(1).getByLabel('Value', { exact: true })).toHaveValue('0');
  await presetEditor.getByRole('button', { name: 'Add field', exact: true }).click();
  await expect(fieldPicker.getByLabel('Search fields', { exact: true })).toHaveValue('');
  await expect(fieldPicker.locator('.bag-field-catalog-entry').filter({ hasText: 'Weight' })).toHaveCount(0);
  await fieldPicker.getByRole('tab', { name: 'Room public fields', exact: true }).click();
  await fieldPicker.locator('.bag-field-catalog-entry').filter({ hasText: 'Damage' }).click();
  await expect(presetEditor.locator('.bag-item-field-card')).toHaveCount(3);

  await presetEditor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(presetEditor).toHaveCount(0);
  expect(presets[0].fields.map((f: any) => f.name)).toEqual(['Notes', 'Weight', 'Damage']);
  expect(presets[0].fields[0].value).toBe('A useful default');
  await expect(library.getByRole('button', { name: 'My preset', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('item-template-library.png'), animations: 'disabled' });
  await library.getByRole('button', { name: 'Close', exact: true }).click();
  await panel.locator('.bag-inventory-add').click();
  const editor = page.locator('.bag-editor-dialog');
  await editor.getByLabel('Name', { exact: true }).fill('My blade');
  await expect(editor.getByText('Display in table view', { exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Item Template', exact: true }).click();
  library = page.locator('.bag-item-templates-dialog');
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
  await expect(fieldPicker.locator('.bag-field-quick-option')).toHaveCount(2);
  await fieldPicker.getByRole('tab', { name: 'Room public fields', exact: true }).click();
  await expect(fieldPicker.locator('.bag-field-catalog-entry').filter({ hasText: 'Damage' })).toHaveCount(0);
  await fieldPicker.getByRole('button', { name: 'Close', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect(items[0].name).toBe('My blade');
  expect(items[0].fields[0].value).toBe(42);
  expect(items[0].itemTemplate.name).toBe('Public sword');
  expect(items[0].fields[0].itemTemplateField).toBe(true);
  await panel.locator('.bag-inventory-slot').hover();
  await panel.locator('.bag-inventory-menu-trigger').click();
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
  const rank = sidebar.locator('.level-editor').nth(1);
  await rank.getByRole('checkbox', { name: 'Override point cost', exact: true }).check();
  await rank.getByLabel('Rank point cost', { exact: true }).fill('0');
  await sidebar.screenshot({ path: info.outputPath('talent-rank-cost-editor.png'), animations: 'disabled' });
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(sidebar).toBeHidden();
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
  expect(saved.nodes[0]).toMatchObject({ category: 'active', cost: 3, linkedTreeId: 'advanced' }); expect(saved.nodes[0].levels[1].cost).toBe(0);
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), navigation = viewer.locator('.talent-navigation-list');
  await expect(navigation.getByText('Advanced', { exact: true })).toHaveCount(0); await expect(navigation.getByText('Mastery Notes', { exact: true })).toBeVisible();
  const first = viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }); await expect(first).toHaveAttribute('data-category', 'active'); await expect(first).toHaveCSS('border-radius', '6px'); await first.hover();
  const tooltip = page.locator('.talent-node-tooltip:visible'); await expect(tooltip.getByText('Cost: 3 points', { exact: true })).toBeVisible(); await expect(tooltip.getByText('Active skill', { exact: true })).toBeVisible();
  await first.click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible();
  await expect(navigation.getByText('Advanced', { exact: true })).toBeVisible(); await expect(viewer.getByRole('status')).toContainText('Advanced');
  await expect(viewer.locator('.canvas-title')).toHaveText('Warrior'); await expect(viewer.locator('.talent-build-summary')).toContainText('3 points invested');
  await expect(viewer.getByRole('button', { name: 'Allocate point', exact: true })).toContainText('Free');
  await viewer.getByRole('button', { name: 'Allocate point', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 2/2', exact: true })).toBeVisible();
  await expect(viewer.locator('.talent-build-summary')).toContainText('3 points invested');
  await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await viewer.getByRole('button', { name: 'Remove point', exact: true }).click();
  await expect(viewer.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible(); await expect(navigation.getByText('Advanced', { exact: true })).toHaveCount(0);
  await expect(viewer.locator('.canvas-linked-paths')).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click();
  await viewer.locator('.canvas-linked-paths').getByRole('button', { name: 'Open Advanced', exact: true }).click(); await expect(viewer.locator('.canvas-title')).toHaveText('Advanced');
  await expect(viewer.getByRole('button', { name: 'Focus: 0/2', exact: true })).toHaveCSS('border-radius', '50%');
  await expect(navigation.locator('.talent-tree-nav-row[data-depth="2"]')).toContainText('Mastery Notes');
  await viewer.getByRole('button', { name: 'Collapse Warrior', exact: true }).click(); await expect(navigation.getByText('Advanced', { exact: true })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Expand Warrior', exact: true }).click(); await expect(navigation.getByText('Advanced', { exact: true })).toBeVisible();
  await page.mouse.move(0, 0); await viewer.screenshot({ path: info.outputPath('talent-linked-tree-viewer.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(viewer.getByRole('button', { name: 'Focus: 0/2', exact: true })).toBeVisible();
  expect(await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
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
  await expect(viewer.locator('.talent-navigation-list').getByText('Advanced', { exact: true })).toHaveCount(0);
  await expect(viewer.locator('.canvas-linked-paths')).toHaveCount(0);
  expect(writes.some(write => write.payload.op === 'access' && write.payload.granted)).toBe(true);
});

for (const zoomOut of [0, 3]) {
  test(`talents decorative shape border resizing matches subtree handles at zoom step ${zoomOut}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click();
    const shape = editor.locator('.canvas-decoration'), fields = editor.locator('.talent-shape-fields');
    await shape.getByRole('button', { name: 'Move shape', exact: true }).hover();
    await expect(shape.locator('.decoration-resize-handle')).toHaveCount(8);
    const corner = shape.locator('.resize-nw'), subtreeCorner = editor.locator('.canvas-subtree').first().locator('.resize-nw');
    expect(await corner.evaluate(el => getComputedStyle(el).width)).toBe(await subtreeCorner.evaluate(el => getComputedStyle(el).width));
    expect(await corner.evaluate(el => getComputedStyle(el).cursor)).toBe(await subtreeCorner.evaluate(el => getComputedStyle(el).cursor));
    const initial = await shape.evaluate(el => ({ x: parseFloat((el as HTMLElement).style.left), y: parseFloat((el as HTMLElement).style.top) }));
    const before = (await shape.boundingBox())!, handle = (await corner.boundingBox())!;
    const scale = parseInt((await editor.locator('.canvas-zoom-controls > span').textContent())!) / 100;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 - 40 * scale, handle.y + handle.height / 2 - 20 * scale, { steps: 6 }); await page.mouse.up();
    await expect(fields.getByLabel('Width', { exact: true })).toHaveValue('280'); await expect(fields.getByLabel('Height', { exact: true })).toHaveValue('140');
    const after = (await shape.boundingBox())!; expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0); expect(after.y + after.height).toBeCloseTo(before.y + before.height, 0);
    for (const [edge, key] of [['e', 'ArrowRight'], ['n', 'ArrowDown'], ['w', 'ArrowRight'], ['s', 'ArrowDown']]) { await shape.locator('.resize-' + edge).focus(); await page.keyboard.press(key!); }
    await expect(fields.getByLabel('Width', { exact: true })).toHaveValue('280'); await expect(fields.getByLabel('Height', { exact: true })).toHaveValue('140');
    await shape.locator('.resize-e').focus(); for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowLeft');
    await shape.locator('.resize-s').focus(); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
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
  const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }); await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click();
  const fields = editor.locator('.talent-shape-fields'), shape = editor.locator('.canvas-decoration');
  await fields.getByLabel('Shape text', { exact: true }).fill('Centered\nTwo lines');
  for (const [width, height] of [[500, 80], [120, 300]]) {
    await fields.getByLabel('Width', { exact: true }).fill(String(width)); await fields.getByLabel('Height', { exact: true }).fill(String(height));
    for (const name of ['Rectangle', 'Rounded rectangle', 'Ellipse', 'Diamond']) {
      const button = fields.getByRole('group', { name: 'Shape', exact: true }).getByRole('button', { name, exact: true }); await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
      const box = (await shape.boundingBox())!, text = (await shape.locator('.decoration-text > span').boundingBox())!;
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
  await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click();
  await expect(sidebar).toBeVisible(); expect((await sidebar.boundingBox())!.width).toBe(480);
  await expect(editor.locator('.editor-inspector .talent-shape-fields')).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await sidebar.getByLabel('Shape text', { exact: true }).fill('Formatted path');
  for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough']) await sidebar.getByRole('button', { name, exact: true }).click();
  const text = editor.locator('.decoration-text'); await expect(text).toHaveCSS('font-weight', '700'); await expect(text).toHaveCSS('font-style', 'italic'); await expect(text).toHaveCSS('text-decoration-line', 'underline line-through');
  await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(sidebar).toBeHidden();
  await expect(text).toHaveText('New annotation'); await expect(text).toHaveCSS('font-weight', '400');
  const shape = editor.locator('.canvas-decoration'); await shape.click({ button: 'right', position: { x: 30, y: 60 } }); await expect(sidebar).toBeVisible();
  await sidebar.getByLabel('Shape text', { exact: true }).fill('Formatted path');
  for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough']) { const button = sidebar.getByRole('button', { name, exact: true }); await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true'); }
  await editor.screenshot({ path: info.outputPath('talents-shape-format-sidebar.png'), animations: 'disabled' });
  await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click();
  await editor.locator('.talent-subtree-list-item').filter({ hasText: 'Formatted path' }).click(); await expect(sidebar.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
  expect(saved.decorations[0]).toMatchObject({ text: 'Formatted path', bold: true, italic: true, underline: true, strikethrough: true });
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), rendered = viewer.locator('.decoration-text');
  await expect(rendered).toHaveText('Formatted path'); await expect(rendered).toHaveCSS('font-weight', '700'); await expect(rendered).toHaveCSS('font-style', 'italic'); await expect(rendered).toHaveCSS('text-decoration-line', 'underline line-through');
  await expect(viewer.locator('.decoration-control')).toHaveCount(0);
});

for (const zoomOut of [0, 3]) {
  test(`talents shapes snap to subtree centers and major grid intersections at zoom step ${zoomOut}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
    const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: true });
    await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true });
    for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click(); await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
    const shape = editor.locator('.canvas-decoration'), scale = parseInt((await editor.locator('.canvas-zoom-controls > span').textContent())!) / 100;
    const centerGuides = editor.locator('.canvas-alignment-guides'), gridGuides = editor.locator('.canvas-grid-guides');
    async function dragTo(x: number, y: number, dx = 0, dy = 0) {
      const current = await shape.evaluate(el => { const style = (el as HTMLElement).style; return { x: parseFloat(style.left) - 80 + parseFloat(style.width) / 2, y: parseFloat(style.top) - 80 + parseFloat(style.height) / 2 }; });
      const handle = (await shape.getByRole('button', { name: 'Move shape', exact: true }).boundingBox())!;
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2 + (x - current.x) * scale + dx, handle.y + handle.height / 2 + (y - current.y) * scale + dy, { steps: 8 });
    }
    await dragTo(140, 190, 6, 0); await expect(centerGuides.locator('line[data-axis="vertical"]')).toHaveCount(1); await expect(centerGuides.locator('line[data-axis="horizontal"]')).toHaveCount(0); await page.mouse.up();
    await dragTo(180, 230, 0, -6); await expect(centerGuides.locator('line[data-axis="horizontal"]')).toHaveCount(1); await expect(centerGuides.locator('line[data-axis="vertical"]')).toHaveCount(0); await page.mouse.up();
    await dragTo(140, 230, 5, -5); await expect(centerGuides.locator('line')).toHaveCount(2);
    const bounds = (await shape.boundingBox())!, region = (await editor.locator('.canvas-subtree[data-subtree-id="path-0"]').boundingBox())!;
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
    const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), node = editor.locator('.talent-node[data-node-id="strength"]'), sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
    const originalColor = await node.locator('.node-icon').evaluate(el => getComputedStyle(el).color);
    await node.click({ button: 'right' }); await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click();
    const palette = sidebar.getByRole('group', { name: 'Color', exact: true }); await expect(palette.getByRole('button')).toHaveCount(16);
    for (const name of ['Theme', 'Red', 'Rose', 'Pink', 'Orange', 'Amber', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Purple', 'Brown', 'Neutral']) {
      const swatch = palette.getByRole('button', { name, exact: true }); await swatch.click(); await expect(swatch).toHaveAttribute('aria-pressed', 'true');
      const color = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
      await expect(sidebar.locator('.talent-appearance-preview .v-icon')).toHaveCSS('color', color); await expect(sidebar.locator('.node-appearance-icon .v-icon')).toHaveCSS('color', color);
    }
    await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(node).not.toHaveAttribute('data-color'); await expect(node.locator('.node-icon')).toHaveCSS('color', originalColor);
    await node.click({ button: 'right' });
    // The accordion keeps its state when reopening an editor.
    if (!await palette.isVisible()) await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(palette.getByRole('button', { name: 'Theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await palette.getByRole('button', { name: chosen, exact: true }).click();
    const color = await palette.getByRole('button', { name: chosen, exact: true }).evaluate(el => getComputedStyle(el).backgroundColor);
    await editor.screenshot({ path: info.outputPath(`talents-node-appearance-${theme}.png`), animations: 'disabled' });
    await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(node.locator('.node-icon')).toHaveCSS('color', color); await expect(node).toHaveCSS('border-top-color', color.replace('rgb(', 'rgba(').replace(')', ', 0.4)'));
    await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
    const saved = writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree;
    expect(saved.nodes.find((n: any) => n.id === 'strength').color).toBe(chosen.toLowerCase()); expect(saved.nodes.find((n: any) => n.id === 'wisdom').color).toBeUndefined();
    await page.getByRole('button', { name: 'Edit tree', exact: true }).click(); await node.click({ button: 'right' }); if (!await palette.isVisible()) await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click(); await expect(palette.getByRole('button', { name: chosen, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), rendered = viewer.locator('.talent-node[data-node-id="strength"]');
    await expect(rendered).toHaveClass(/is-unallocated/); await expect(rendered.locator('.node-icon')).toHaveCSS('color', color); await expect(rendered).toHaveCSS('border-top-color', color);
    await rendered.click(); await expect(rendered).toHaveClass(/is-partial/); await expect(rendered.locator('.node-icon')).toHaveCSS('color', color); await expect(viewer.locator('.talent-detail-emblem .v-icon').first()).toHaveCSS('color', color);
    await viewer.screenshot({ path: info.outputPath(`talents-node-color-partial-${theme}.png`), animations: 'disabled' });
    await rendered.click(); await expect(rendered).toHaveClass(/maximum/); await expect(rendered).toHaveCSS('background-color', color);
    const ink = theme === 'dark' ? 'rgb(255, 255, 255)' : await rendered.evaluate(el => getComputedStyle(el).getPropertyValue('--v-theme-surface').trim());
    await expect(rendered.locator('.node-icon')).toHaveCSS('color', theme === 'dark' ? ink : `rgb(${ink.split(',').map(value => value.trim()).join(', ')})`);
    await expect(viewer.locator('.talent-node[data-node-id="wisdom"]')).not.toHaveAttribute('data-color');
  });
}

for (const layout of ['classic', 'free', 'centered'] as const) {
  for (const zoomOut of [0, 3]) {
    test(`talents double-click creates a node at the pointer in ${layout} at zoom step ${zoomOut}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1920, height: 1080 });
      const writes = await setup(page, 'dark', 'creator', false, { talents: true, talentDesign: true, talentFree: layout === 'free', talentCentered: layout === 'centered' });
      await page.getByRole('button', { name: 'Room settings', exact: true }).click(); await navigate(page, 'Talent Trees'); await page.getByRole('button', { name: 'Edit tree: Warrior', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Talent Tree Editor', exact: true }), viewport = editor.locator('.canvas-viewport'), sidebar = editor.getByRole('dialog', { name: 'Edit talent', exact: true });
      for (let i = 0; i < zoomOut; i++) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
      // Pan before creating, so pointer conversion must account for scroll as well as zoom.
      const frame = (await viewport.boundingBox())!;
      await page.mouse.move(frame.x + 80, frame.y + 80); await page.mouse.down({ button: 'right' }); await page.mouse.move(frame.x + 140, frame.y + 115, { steps: 6 }); await page.mouse.up({ button: 'right' });
      const region = (await editor.locator('.canvas-subtree').first().boundingBox())!, reference = (await editor.locator('.talent-node[data-node-id="strength"]').boundingBox())!;
      const scale = parseInt((await editor.locator('.canvas-zoom-controls > span').textContent())!) / 100;
      const point = { x: Math.round(region.x + region.width * .84), y: Math.round(region.y + region.height * .30) };
      const expected = { x: Math.round(105 + (point.x - reference.x) / scale - 32), y: Math.round(70 + (point.y - reference.y) / scale - 32) };
      await page.mouse.dblclick(point.x, point.y); await expect(sidebar).toBeVisible();
      await sidebar.getByLabel('Name', { exact: true }).fill('Placed talent'); await sidebar.getByRole('button', { name: 'Position on the canvas', exact: true }).click();
      await expect(sidebar.getByLabel('X', { exact: true })).toHaveValue(String(expected.x)); await expect(sidebar.getByLabel('Y', { exact: true })).toHaveValue(String(expected.y));
      await sidebar.getByRole('button', { name: 'Apply to tree', exact: true }).click(); await expect(editor.locator('.talent-node')).toHaveCount(9);
      // Existing-node double-click keeps editing that node rather than creating another one.
      await editor.locator('.talent-node[data-node-id="strength"]').dblclick(); await expect(sidebar.getByLabel('Name', { exact: true })).toHaveValue('Strength'); await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(editor.locator('.talent-node')).toHaveCount(9);
      // Toolbar creation still opens its usual draft, and cancel adds nothing.
      await editor.getByRole('button', { name: 'Add node', exact: true }).click(); await expect(sidebar).toBeVisible(); await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(editor.locator('.talent-node')).toHaveCount(9);
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
  await editor.locator('.canvas-toolbar').getByRole('button', { name: 'Add shape', exact: true }).click(); await editor.getByRole('dialog', { name: 'Edit shape', exact: true }).getByRole('button', { name: 'Apply to tree', exact: true }).click();
  const shape = editor.locator('.canvas-decoration'); await shape.getByRole('button', { name: 'Move shape', exact: true }).dblclick(); await expect(sidebar).toBeHidden();
  await shape.dblclick({ position: { x: 30, y: 90 } }); await expect(sidebar).toBeVisible(); await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor.locator('.talent-node')).toHaveCount(1); await expect(editor.locator('.canvas-decoration')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Save', exact: true }).click(); await expect(editor).toBeHidden();
  expect(writes.findLast(write => write.action === 'talents' && write.payload.op === 'save').payload.tree.nodes).toHaveLength(1);
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }); await expect(viewer.locator('.talent-node')).toHaveCount(1);
  await viewer.locator('.canvas-viewport').dblclick({ position: { x: 20, y: 20 } }); await expect(viewer.getByRole('dialog', { name: 'Edit talent', exact: true })).toHaveCount(0); await expect(viewer.locator('.talent-node')).toHaveCount(1);
});

for (const role of ['creator', 'player']) {
  test(`talents viewer titles and canvas paths preserve linked builds through refunds and resets for ${role}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1600, height: 1080 });
    const writes = await setup(page, 'dark', role, false, { talents: true, talentProgression: true, talentLinkedPaths: true });
    await page.getByRole('button', { name: 'Talent Trees', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }), navigation = viewer.locator('.talent-navigation-list'), dock = viewer.getByRole('navigation', { name: 'Unlocked paths', exact: true });
    const source = navigation.locator('.talent-nav-item').filter({ has: page.getByText('Warrior Training', { exact: true }) }), title = source.locator('.talent-nav-title');
    await expect(title).toHaveCSS('white-space', 'nowrap'); expect(await title.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const heading = (await title.boundingBox())!, meta = (await source.locator('.talent-nav-meta').boundingBox())!; expect(heading.y + heading.height).toBeLessThan(meta.y); expect(heading.width).toBeCloseTo(meta.width, 0);
    await expect(navigation.getByText('Advanced Combat', { exact: true })).toHaveCount(0); await expect(dock).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await expect(dock).toBeVisible(); await expect(dock).toContainText('Via Strength'); await expect(viewer.locator('.canvas-title')).toHaveText('Warrior Training');
    const portal = dock.getByRole('button', { name: 'Open Advanced Combat', exact: true }); await expect(portal).toHaveCount(1);
    await page.mouse.move(0, 0); await viewer.screenshot({ path: info.outputPath(`talent-unlocked-path-dock-${role}.png`), animations: 'disabled' });
    await portal.click(); await expect(viewer.locator('.canvas-title')).toHaveText('Advanced Combat'); await viewer.getByRole('button', { name: 'Focus: 0/2', exact: true }).click();
    await source.click(); await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 2/2', exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(dock).toBeVisible(); await expect(navigation.getByText('Advanced Combat', { exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(dock).toHaveCount(0); await expect(navigation.getByText('Advanced Combat', { exact: true })).toHaveCount(0);
    await expect(viewer.getByRole('status')).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await portal.click(); await expect(viewer.getByRole('button', { name: 'Focus: 1/2', exact: true })).toBeVisible(); await expect(viewer.locator('.talent-build-summary')).toContainText('1 points invested');
    await source.click(); page.on('dialog', dialog => dialog.accept()); await viewer.getByRole('button', { name: 'Reset tree', exact: true }).click(); await expect(navigation.getByText('Advanced Combat', { exact: true })).toHaveCount(0); await expect(dock).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Strength: 0/2', exact: true }).click(); await expect(portal).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); await expect(portal).toBeVisible();
    expect(await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1); expect(await viewer.locator('.talent-viewer-body').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    const link = (await portal.boundingBox())!, canvas = (await viewer.locator('.talent-canvas-shell').boundingBox())!; expect(link.x).toBeGreaterThanOrEqual(canvas.x); expect(link.x + link.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    const viewport = (await viewer.locator('.canvas-viewport').boundingBox())!, dockBounds = (await dock.boundingBox())!; expect(dockBounds.y).toBeGreaterThanOrEqual(viewport.y + viewport.height - 1); expect(dockBounds.y + dockBounds.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
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
  const viewer = page.getByRole('dialog', { name: 'Talent Trees', exact: true }); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible(); await expect(viewer.locator('.talent-build-summary')).toContainText('0 points invested');
  expect(writes.filter(write => write.payload.op === 'allocate')).toHaveLength(0);
  await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 2/2', exact: true })).toBeVisible(); await expect(viewer.locator('.talent-build-summary')).toContainText('1 points invested');
  await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 1/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Remove point', exact: true })).toBeDisabled(); await expect(viewer.locator('.talent-build-summary')).toContainText('0 points invested');
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
  await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Wisdom: 1/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Endurance: 1/2', exact: true })).toBeVisible(); await expect(viewer.locator('.talent-build-summary')).toContainText('2 points invested');
  await viewer.getByRole('button', { name: 'Remove point', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Wisdom: 0/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Endurance: 0/2', exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Strength: 1/2', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Wisdom: 1/2', exact: true })).toBeVisible();
  page.on('dialog', dialog => dialog.accept()); await viewer.getByRole('button', { name: 'Reset tree', exact: true }).click(); await expect(viewer.getByRole('button', { name: 'Strength: 0/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Wisdom: 0/2', exact: true })).toBeVisible(); await expect(viewer.getByRole('button', { name: 'Endurance: 0/2', exact: true })).toBeVisible(); await expect(viewer.locator('.talent-build-summary')).toContainText('0 points invested');
});

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
  const paste = page.getByRole('dialog', { name: 'Import from clipboard', exact: true }); await paste.getByLabel('Tree JSON', { exact: true }).fill('{bad'); await paste.getByRole('button', { name: 'Review import', exact: true }).click(); await expect(paste).toContainText('not valid');
  await paste.getByLabel('Tree JSON', { exact: true }).fill(JSON.stringify({ ...data, version: 99 })); await paste.getByRole('button', { name: 'Review import', exact: true }).click(); await expect(paste).toContainText('not supported');
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
