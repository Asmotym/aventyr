import { newTalentTree, emptyTalentPlayer, emptyTalentProgress, emptyConditions } from '../../../server/core/types/talents.types';
import { nodeStates, rankCost, rankPayment, paidTotals, purchasePayment, synchronizeTalentProgress, grantLinkedTrees } from '../../../server/core/utils/talents';
import { resolveRoomRights } from '../../../server/core/utils/room-permissions';
import { expect, type Page } from '@playwright/test';
import type { RoomCriticalRule } from '../../../server/core/types/data.types';

export interface FixtureOptions {
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

export async function setup(page: Page, theme = 'dark', role = 'creator', awardsEnabled = false, options: FixtureOptions = {}) {
  const user = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme, themeStyle: 'default' };
  const settings = { roomId: 'room', enabled: true, maxPointsPerUser: 5, allowExtremeSpend: false };
  const room = { isFavorite: false, id: 'room', name: 'Test room', inviteCode: 'test', createdBy: 'owner', memberCount: 1, criticals: options.criticals ?? [{ diceType: 'd20', enabled: true, operator: 'moreThan', threshold: 90, color: '#d32f2f' }], bagEnabled: true, bonusPointSettings: settings, sessionInactivityMinutes: 240 };
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
    if (path.endsWith('/articles/news')) data = { articles: [] };
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

export async function navigate(page: Page, name: string) {
  const panel = page.locator('.room-slide-panel:visible');
  const menu = panel.getByRole('button', { name: 'Settings sections', exact: true });
  if (await menu.isVisible()) await menu.click();
  await panel.getByRole('navigation').getByText(name, { exact: true }).click();
}

export function ownedSession() {
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

export const tools = (page: Page) => page.locator('.room-tools-panel:visible');

export async function openTools(page: Page, name = 'Dices') {
  await page.locator('.room-tools-rail').getByRole('button', { name, exact: true }).click();
  await expect(tools(page)).toBeVisible();
  await expect(tools(page)).not.toHaveClass(/room-slide-enter-active/);
}
