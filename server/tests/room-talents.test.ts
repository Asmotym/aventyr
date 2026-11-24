import assert from 'node:assert/strict';
import test from 'node:test';
import { TALENT_COLORS, emptyConditions, emptyTalentPlayer, emptyTalentProgress, newTalentTree, type TalentNode } from '../core/types/talents.types';
import { synchronizeAutomaticRanks, synchronizeTalentProgress, rankCost, paidTotals, conditionsMet, hiddenNodes, nodeStates, validBuild, validateTalentTree, talentConnectionError } from '../core/utils/talents';
import { resolveRoomRights } from '../core/utils/room-permissions';
const settings = { enabled: true, globalEnabled: true, maxGlobal: 0 };
function fixture() {
    const tree = newTalentTree('tree', 'classic'); tree.name = 'Talents'; tree.currency = 'both';
    const node = (id: string): TalentNode => ({ id, name: id, description: '', icon: null, imageId: null, subtreeId: null, x: 0, y: 0, parentMode: 'all', conditions: emptyConditions(), hide: emptyConditions(), levels: [{ id: id + '_1', conditions: emptyConditions() }, { id: id + '_2', conditions: emptyConditions() }] });
    tree.nodes = ['root', 'other', 'child'].map(node); tree.edges = [{ parent: 'root', child: 'child' }, { parent: 'other', child: 'child' }];
    const player = emptyTalentPlayer(); player.global = 4; player.progress.tree = emptyTalentProgress();
    return { tree, player, progress: player.progress.tree };
}
test('Talent permissions include managers and honor player overrides', () => {
    for (const role of ['creator', 'admin', 'dm'] as const) assert.equal(resolveRoomRights(role).manageTalentTrees, true);
    assert.equal(resolveRoomRights('player').manageTalentTrees, false);
    assert.equal(resolveRoomRights('player', { manageTalentTrees: true }).manageTalentTrees, true);
});
test('Roots, parent groups, levels and tree/global enablement determine availability', () => {
    const { tree, player, progress } = fixture();
    assert.equal(nodeStates(tree, player, settings).root!.canAllocate, true);
    assert.equal(nodeStates(tree, player, settings).child!.reason, 'prerequisites');
    progress.levels.root = ['global'];
    assert.equal(nodeStates(tree, player, settings).child!.canAllocate, false);
    tree.nodes[2]!.parentMode = 'any';
    assert.equal(nodeStates(tree, player, settings).child!.canAllocate, true);
    tree.nodes[2]!.levels[1]!.conditions.items = [{ type: 'node', nodeId: 'root', amount: 2 }];
    progress.levels.child = ['global'];
    assert.equal(nodeStates(tree, player, settings).child!.reason, 'prerequisites');
    progress.levels.root.push('tree');
    assert.equal(nodeStates(tree, player, settings).child!.canAllocate, true);
    progress.levels.child.push('tree');
    assert.equal(nodeStates(tree, player, settings).child!.reason, 'maximum');
    assert.equal(nodeStates(tree, player, { ...settings, enabled: false }).root!.canRevert, false);
    player.global = 0; player.trees.tree = 1;
    assert.equal(nodeStates(tree, player, settings).other!.canAllocate, true);
    tree.currency = 'global';
    assert.equal(nodeStates(tree, player, settings).other!.reason, 'points');
    player.global = 1;
    assert.equal(nodeStates(tree, player, { ...settings, globalEnabled: false }).other!.reason, 'points');
});
test('Conditions combine all/any and count spent points', () => {
    const { tree, progress } = fixture(); progress.levels.root = ['tree'];
    assert.equal(conditionsMet({ mode: 'all', items: [{ type: 'treePoints', amount: 1 }, { type: 'node', nodeId: 'other', amount: 1 }] }, progress, tree), false);
    assert.equal(conditionsMet({ mode: 'any', items: [{ type: 'treePoints', amount: 1 }, { type: 'node', nodeId: 'other', amount: 1 }] }, progress, tree), true);
});
test('Revert rejects dependent builds, thresholds and subtree caps', () => {
    const { tree, player, progress } = fixture(); progress.levels.root = ['global']; progress.levels.other = ['tree']; progress.levels.child = ['global'];
    assert.equal(validBuild(tree, progress), true);
    assert.equal(nodeStates(tree, player, settings).root!.canRevert, false);
    assert.equal(nodeStates(tree, player, settings).child!.canRevert, true);
    tree.subtrees = [{ id: 'sub', name: 'Subtree', description: '', icon: null, imageId: null, maxPoints: 1, x: 0, y: 0, width: 100, height: 100 }]; tree.nodes[0]!.subtreeId = 'sub';
    assert.equal(nodeStates(tree, player, settings).root!.reason, 'subtreeCap');
    tree.options.selectSubtree = true; progress.selectedSubtree = 'sub';
    assert.equal(nodeStates(tree, player, settings).other!.reason, 'specialization');
});
test('Hidden ancestors hide all descendants despite alternate parents', () => {
    const { tree, progress } = fixture(); tree.nodes[0]!.hide.items = [{ type: 'treePoints', amount: 2 }]; progress.levels.other = ['global'];
    assert.deepEqual([...hiddenNodes(tree, progress)].sort(), ['child', 'root']);
    progress.levels.other.push('global'); assert.equal(hiddenNodes(tree, progress).size, 0);
});
test('Validation rejects malformed graphs, cycles, references and overlapping free regions', () => {
    const { tree } = fixture(); assert.equal(validateTalentTree(tree).name, 'Talents');
    for (const change of [
        (t: typeof tree) => t.edges.push({ parent: 'child', child: 'root' }),
        (t: typeof tree) => t.nodes.push(t.nodes[0]!),
        (t: typeof tree) => { t.options.startingNodes = 1; },
        (t: typeof tree) => { t.nodes[0]!.x = Infinity; },
        (t: typeof tree) => { t.nodes[0]!.conditions.items.push({ type: 'node', nodeId: 'missing', amount: 1 }); },
        (t: typeof tree) => { t.nodes[0]!.id = '__proto__'; }
    ]) { const next = structuredClone(tree); change(next); assert.throws(() => validateTalentTree(next)); }
    tree.layout = 'free'; tree.subtrees = ['a', 'b'].map(id => ({ id, name: id, description: '', icon: null, imageId: null, maxPoints: 0, x: 0, y: 0, width: 100, height: 100 }));
    assert.throws(() => validateTalentTree(tree), /overlap/);
});

test('Subtree manual bounds preserve saved dimensions and reject unknown modes', () => {
    const { tree } = fixture();
    tree.subtrees = [{ id: 'sub', name: 'Subtree', description: '', icon: null, imageId: null, maxPoints: 0, x: -40, y: -20, width: 360, height: 560, boundsMode: 'manual' }];
    assert.deepEqual(validateTalentTree(tree).subtrees[0], tree.subtrees[0]);
    const legacy = structuredClone(tree); delete legacy.subtrees[0]!.boundsMode;
    assert.equal(validateTalentTree(legacy).subtrees[0]!.boundsMode, undefined);
    assert.throws(() => validateTalentTree({ ...tree, subtrees: [{ ...tree.subtrees[0], boundsMode: 'unknown' }] }), /Invalid subtree/);
});

test('Canvas connections reject self links, duplicates and indirect cycles while allowing multiple parents', () => {
    const { tree } = fixture();
    assert.equal(talentConnectionError(tree, 'root', 'root'), 'self');
    assert.equal(talentConnectionError(tree, 'root', 'child'), 'duplicate');
    assert.equal(talentConnectionError(tree, 'child', 'root'), 'cycle');
    assert.equal(talentConnectionError(tree, 'missing', 'root'), 'missing');
    assert.equal(talentConnectionError(tree, 'root', 'other'), null);
    tree.edges.push({ parent: 'root', child: 'other' });
    assert.equal(talentConnectionError(tree, 'child', 'root'), 'cycle');
    assert.equal(talentConnectionError(tree, 'other', 'root'), 'cycle');
    tree.edges = [{ parent: 'root', child: 'other' }, { parent: 'other', child: 'child' }];
    assert.equal(talentConnectionError(tree, 'child', 'root'), 'cycle');
});


test('Connection border choices survive validation and reject unknown borders', () => {
    const { tree } = fixture();
    tree.edges[0] = { parent: 'root', child: 'child', parentSide: 'bottom', childSide: 'top' };
    assert.deepEqual(validateTalentTree(tree).edges[0], tree.edges[0]);
    assert.throws(() => validateTalentTree({ ...tree, edges: [{ ...tree.edges[0], childSide: 'middle' }] }), /Invalid connection border/);
});


test('Connection styles preserve legacy defaults and validate saved choices', () => {
    for (const style of ['rounded', 'square', 'straight'] as const) {
        const { tree } = fixture(); tree.edges[0]!.style = style;
        assert.equal(validateTalentTree(tree).edges[0]!.style, style);
    }
    const { tree } = fixture();
    assert.equal(validateTalentTree(tree).edges[0]!.style, undefined);
    assert.throws(() => validateTalentTree({ ...tree, edges: [{ ...tree.edges[0], style: 'unknown' }] }), /Invalid connection style/);
});


test('Arrow choices preserve legacy defaults and validate saved shapes and hidden arrows', () => {
    for (const arrow of ['triangle', 'chevron', 'diamond', 'none'] as const) {
        const { tree } = fixture(); tree.edges[0]!.arrow = arrow;
        assert.equal(validateTalentTree(tree).edges[0]!.arrow, arrow);
    }
    const { tree } = fixture();
    assert.equal(validateTalentTree(tree).edges[0]!.arrow, undefined);
    assert.throws(() => validateTalentTree({ ...tree, edges: [{ ...tree.edges[0], arrow: 'unknown' }] }), /Invalid connection arrow/);
});


test('Rank names and descriptions round-trip while legacy ranks remain valid', () => {
    const { tree } = fixture();
    tree.nodes[0]!.levels[0] = { ...tree.nodes[0]!.levels[0]!, name: 'Novice', description: 'Gain one strength.\nTrain every day.' };
    assert.deepEqual(validateTalentTree(tree).nodes[0]!.levels, tree.nodes[0]!.levels);
    tree.nodes[0]!.levels[1]!.name = ''; tree.nodes[0]!.levels[1]!.description = '';
    assert.doesNotThrow(() => validateTalentTree(tree));
    for (const invalid of [{ name: 'x'.repeat(201) }, { description: 'x'.repeat(10001) }, { name: null }, { description: 12 }]) {
        const malformed = structuredClone(tree); Object.assign(malformed.nodes[0]!.levels[0]!, invalid);
        assert.throws(() => validateTalentTree(malformed), /Invalid level/);
    }
});

test('Tree connection defaults validate without requiring legacy definitions to change', () => {
    const { tree } = fixture();
    assert.equal(tree.options.connectionStyle, 'rounded'); assert.equal(tree.options.connectionArrow, 'triangle');
    for (const connectionStyle of ['rounded', 'square', 'straight'] as const) for (const connectionArrow of ['triangle', 'chevron', 'diamond', 'none'] as const) {
        const result = validateTalentTree({ ...tree, options: { ...tree.options, connectionStyle, connectionArrow } });
        assert.equal(result.options.connectionStyle, connectionStyle); assert.equal(result.options.connectionArrow, connectionArrow);
    }
    delete tree.options.connectionStyle; delete tree.options.connectionArrow;
    assert.doesNotThrow(() => validateTalentTree(tree));
    for (const invalid of [{ connectionStyle: 'invalid' }, { connectionArrow: null }]) {
        assert.throws(() => validateTalentTree({ ...tree, options: { ...tree.options, ...invalid } }), /Invalid default connection style/);
    }
});

test('Unmet prerequisite groups preserve all/any logic and next-rank progress', () => {
    const { tree, player, progress } = fixture();
    tree.nodes[0]!.subtreeId = 'path'; tree.nodes[2]!.subtreeId = 'path';
    tree.subtrees = [{ id: 'path', name: 'Vanguard', description: '', icon: null, imageId: null, maxPoints: 0, x: 0, y: 0, width: 300, height: 300 }];
    const child = tree.nodes[2]!; child.parentMode = 'any';
    child.conditions = { mode: 'any', items: [{ type: 'node', nodeId: 'root', amount: 1 }, { type: 'node', nodeId: 'other', amount: 2 }] };
    child.levels[0]!.conditions = { mode: 'all', items: [{ type: 'treePoints', amount: 4 }, { type: 'subtreePoints', subtreeId: 'path', amount: 2 }] };
    progress.levels.root = ['tree'];
    let state = nodeStates(tree, player, settings).child!;
    assert.equal(state.reason, 'prerequisites');
    assert.deepEqual(state.requirementGroups, [{ source: 'rank', mode: 'all', items: [{ type: 'treePoints', name: '', current: 1, amount: 4 }, { type: 'subtreePoints', name: 'Vanguard', current: 1, amount: 2 }] }]);
    progress.levels.root = [];
    state = nodeStates(tree, player, settings).child!;
    assert.deepEqual(state.requirementGroups!.map(group => [group.source, group.mode]), [['parents', 'any'], ['node', 'any'], ['rank', 'all']]);
    assert.equal(state.requirementGroups![0]!.items.length, 2);
    tree.nodes[0]!.hide.items = [{ type: 'treePoints', amount: 99 }];
    assert.equal(nodeStates(tree, player, settings).child!.requirementGroups![0]!.items[0]!.name, '');
});

test('Decorative shapes validate and do not affect talent allocation or builds', () => {
    const { tree, player, progress } = fixture(), before = nodeStates(tree, player, settings), valid = validBuild(tree, progress);
    const decoration = { id: 'note', shape: 'rounded' as const, text: 'Warrior path\nStart here', color: 'primary' as const, fontSize: 16, bold: true, italic: true, underline: true, strikethrough: false, x: -200, y: 300, width: 240, height: 120 };
    for (const shape of ['rectangle', 'rounded', 'ellipse', 'diamond'] as const) {
        tree.decorations = [{ ...decoration, shape }];
        assert.deepEqual(validateTalentTree(tree).decorations, tree.decorations);
        assert.deepEqual(nodeStates(tree, player, settings), before); assert.equal(validBuild(tree, progress), valid);
    }
    for (const invalid of [{ bold: 'true' }, { italic: 1 }, { underline: null }, { strikethrough: [] }, { shape: 'triangle' }, { color: 'url(invalid)' }, { text: 'x'.repeat(4001) }, { fontSize: 0 }, { width: 79 }, { height: Infinity }, { x: NaN }]) {
        assert.throws(() => validateTalentTree({ ...tree, decorations: [{ ...decoration, ...invalid }] }), /Invalid decorative shape/);
    }
    assert.throws(() => validateTalentTree({ ...tree, decorations: [decoration, decoration] }), /Invalid decorative shapes/);
    assert.throws(() => validateTalentTree({ ...tree, decorations: Array.from({ length: 101 }, (_, i) => ({ ...decoration, id: 'shape_' + i })) }), /Invalid decorative shapes/);
    delete tree.decorations; assert.doesNotThrow(() => validateTalentTree(tree));
});

test('Variable rank prices preserve rank counts, historical spending and exact mixed payments', async () => {
    const { rankCost, rankPayment, purchasePayment, paidTotals, normalizeTalentPlayer, spent } = await import('../core/utils/talents');
    const { tree, player, progress } = fixture(); tree.nodes[0]!.cost = 3; tree.nodes[0]!.levels[1]!.cost = 0;
    player.trees.tree = 1; player.global = 2;
    assert.equal(rankCost(tree.nodes[0]!, 0), 3); assert.equal(rankCost(tree.nodes[0]!, 1), 0);
    const paid = purchasePayment(tree, player, settings, 3)!; assert.deepEqual(paid, { tree: 1, global: 2 });
    progress.levels.root = [paid]; player.trees.tree = 0; player.global = 0;
    assert.equal(nodeStates(tree, player, settings).root!.canAllocate, true); assert.equal(nodeStates(tree, player, settings).root!.cost, 0);
    progress.levels.root.push({ tree: 0, global: 0 });
    assert.equal(nodeStates(tree, player, settings).root!.level, 2); assert.equal(spent(progress, tree), 3);
    tree.nodes[0]!.cost = 20; assert.deepEqual(paidTotals(progress), paid);
    assert.equal(purchasePayment(tree, player, settings, 1), null);
    tree.currency = 'tree'; assert.equal(purchasePayment(tree, { ...player, global: 99 }, settings, 1), null);
    tree.currency = 'global'; assert.equal(purchasePayment(tree, { ...player, global: 99 }, { ...settings, globalEnabled: false }, 1), null);
    assert.deepEqual(purchasePayment(tree, player, { ...settings, globalEnabled: false }, 0), { tree: 0, global: 0 });
    const normalized = normalizeTalentPlayer({ ...player, progress: { tree: { selectedSubtree: null, levels: { root: ['tree', 'global', { tree: 2, global: 4 }] } } } });
    assert.deepEqual(normalized.progress.tree!.levels.root, [{ tree: 1, global: 0 }, { tree: 0, global: 1 }, { tree: 2, global: 4 }]);
    assert.deepEqual(rankPayment('global'), { tree: 0, global: 1 });
});

test('Variable costs enforce subtree caps using paid points, including free-rank specialization safety', () => {
    const { tree, player, progress } = fixture(); tree.edges = [];
    tree.subtrees = [{ id: 'path', name: 'Path', description: '', icon: null, imageId: null, x: 0, y: 0, width: 300, height: 300, maxPoints: 3 }];
    tree.nodes[0]!.subtreeId = 'path'; tree.nodes[0]!.cost = 2; player.global = 9;
    progress.levels.root = [{ tree: 0, global: 2 }];
    assert.equal(nodeStates(tree, player, settings).root!.reason, 'subtreeCap');
    tree.nodes[0]!.levels[1]!.cost = 0; assert.equal(nodeStates(tree, player, settings).root!.canAllocate, true);
    progress.levels.root.push({ tree: 0, global: 0 }); tree.options.selectSubtree = true;
    assert.equal(validBuild(tree, progress), false);
    progress.selectedSubtree = 'path'; assert.equal(validBuild(tree, progress), true);
});

test('Active linked-tree access, manual grants and hierarchy remain independent of saved builds', async () => {
    const { grantLinkedTrees, treeAccessible, validateTalentCatalog, talentTreeRows } = await import('../core/utils/talents');
    const { tree, player, progress } = fixture(), target = newTalentTree('target', 'classic'), child = newTalentTree('child-tree', 'classic');
    target.name = 'Target'; target.accessMode = 'restricted'; child.name = 'Child'; target.parentTreeId = tree.id; child.parentTreeId = target.id;
    tree.nodes[0]!.linkedTreeId = target.id; progress.levels.root = [{ tree: 0, global: 0 }];
    assert.equal(treeAccessible(target, player), false); grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), true);
    player.progress[target.id] = { selectedSubtree: null, levels: { saved: [{ tree: 1, global: 0 }] } }; player.trees[target.id] = 4;
    const retained = structuredClone(player.progress[target.id]);
    progress.levels.root!.push({ tree: 0, global: 1 }); progress.levels.root!.pop(); grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), true);
    progress.levels.root = []; grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), false);
    assert.deepEqual(player.progress[target.id], retained); assert.equal(player.trees[target.id], 4);
    player.unlockedTreeIds = [target.id]; grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), false);
    progress.levels.root = [{ tree: 0, global: 0 }]; grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), true);
    tree.nodes[1]!.linkedTreeId = target.id; progress.levels.other = [{ tree: 1, global: 0 }]; progress.levels.root = []; grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), true);
    tree.nodes[1]!.linkedTreeId = null; grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), false);
    assert.deepEqual(player.progress[target.id], retained);
    progress.levels.root = [{ tree: 0, global: 0 }]; grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player, true), false);
    tree.nodes[0]!.linkedTreeId = null; grantLinkedTrees([tree, target, child], player); assert.equal(treeAccessible(target, player), false);
    assert.equal(treeAccessible(target, player, true), false);
    const manual = emptyTalentPlayer(); manual.grantedTreeIds = [target.id]; assert.equal(treeAccessible(target, manual), true); manual.grantedTreeIds = []; assert.equal(treeAccessible(target, manual), false);
    assert.doesNotThrow(() => validateTalentCatalog([tree, target, child]));
    assert.deepEqual(talentTreeRows([tree, target, child]).map(row => [row.tree.id, row.depth]), [['tree', 0], ['target', 1], ['child-tree', 2]]);
    assert.deepEqual(talentTreeRows([child]).map(row => [row.tree.id, row.depth]), [['child-tree', 0]]);
    assert.deepEqual(talentTreeRows([tree, target, child], new Set(['target'])).map(row => row.tree.id), ['tree', 'target']);
    tree.parentTreeId = child.id; assert.throws(() => validateTalentCatalog([tree, target, child]), /cycle/);
    tree.parentTreeId = null; tree.nodes[0]!.linkedTreeId = 'missing'; assert.throws(() => validateTalentCatalog([tree, target, child]), /Linked tree/);
    for (const invalid of [{ cost: -1 }, { cost: 0.5 }, { category: 'other' }]) { const malformed = structuredClone(tree); Object.assign(malformed.nodes[0]!, invalid); assert.throws(() => validateTalentTree(malformed)); }
});

test('Node colors accept the shared palette without changing allocation or existing builds', () => {
    const { tree, player, progress } = fixture(), before = nodeStates(tree, player, settings), valid = validBuild(tree, progress);
    for (const color of TALENT_COLORS) {
        tree.nodes[0]!.color = color;
        assert.equal(validateTalentTree(tree).nodes[0]!.color, color);
        tree.decorations = [{ id: 'palette-sample', shape: 'rounded', text: 'Palette', color, fontSize: 16, x: 0, y: 0, width: 240, height: 120 }]; assert.equal(validateTalentTree(tree).decorations![0]!.color, color);
        assert.deepEqual(nodeStates(tree, player, settings), before); assert.equal(validBuild(tree, progress), valid);
    }
    for (const color of ['url(invalid)', '#ffffff', '', null, 1, {}]) {
        const invalid = structuredClone(tree); Object.assign(invalid.nodes[0]!, { color });
        assert.throws(() => validateTalentTree(invalid), /Invalid node color/);
    }
    delete tree.nodes[0]!.color; assert.doesNotThrow(() => validateTalentTree(tree));
});

test('Automatic first ranks unlock without spending points, chain from parents and preserve later rank costs', () => {
    const { tree, player, progress } = fixture(); tree.edges = [{ parent: 'root', child: 'other' }, { parent: 'other', child: 'child' }];
    tree.nodes[1]!.autoUnlock = true; tree.nodes[1]!.cost = 9; tree.nodes[2]!.autoUnlock = true;
    synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.other?.length ?? 0, 0);
    progress.levels.root = [{ tree: 1, global: 0 }]; synchronizeTalentProgress([tree], player, settings);
    assert.deepEqual(progress.levels.other, [{ tree: 0, global: 0, automatic: true }]); assert.equal(progress.levels.child!.length, 1);
    assert.equal(player.global, 4); assert.deepEqual(paidTotals(progress), { tree: 1, global: 0 }); assert.equal(rankCost(tree.nodes[1]!, 0), 0); assert.equal(rankCost(tree.nodes[1]!, 1), 9);
    assert.equal(nodeStates(tree, player, settings).other!.canRevert, false); assert.equal(nodeStates(tree, player, settings).root!.canRevert, true);
    progress.levels.root = []; synchronizeTalentProgress([tree], player, settings); assert.deepEqual(progress.levels.other, []); assert.deepEqual(progress.levels.child, []);
    tree.nodes[0]!.autoUnlock = true; player.global = 0; synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.root!.length, 1); assert.equal(progress.levels.child!.length, 1); assert.equal(player.global, 0);
});

test('Automatic unlock respects parent modes, node and rank conditions, visibility and specialization', () => {
    const { tree, player, progress } = fixture(); const child = tree.nodes[2]!; child.autoUnlock = true;
    progress.levels.root = [{ tree: 0, global: 0 }]; synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.child?.length ?? 0, 0);
    child.parentMode = 'any'; child.conditions = { mode: 'all', items: [{ type: 'treePoints', amount: 2 }] }; synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.child?.length ?? 0, 0);
    progress.levels.root = [{ tree: 2, global: 0 }]; child.levels[0]!.conditions = { mode: 'all', items: [{ type: 'node', nodeId: 'other', amount: 1 }] };
    synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.child?.length ?? 0, 0);
    progress.levels.other = [{ tree: 0, global: 0 }]; child.hide = { mode: 'all', items: [{ type: 'node', nodeId: 'root', amount: 2 }] };
    synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.child?.length ?? 0, 0);
    progress.levels.root!.push({ tree: 0, global: 0 }); synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.child!.length, 1);
    tree.options.selectSubtree = true; child.subtreeId = 'chosen'; progress.selectedSubtree = 'other'; synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.child!.length, 0);
    progress.selectedSubtree = 'chosen'; synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.child!.length, 1);
});

test('Paid descendants still protect parent refunds and automatic ranks never inflate a refund', () => {
    const { tree, player, progress } = fixture(); tree.edges = [{ parent: 'root', child: 'child' }]; tree.nodes[2]!.autoUnlock = true;
    progress.levels.root = [{ tree: 1, global: 0 }]; synchronizeTalentProgress([tree], player, settings); progress.levels.child!.push({ tree: 2, global: 1 });
    assert.equal(nodeStates(tree, player, settings).root!.canRevert, false); assert.equal(nodeStates(tree, player, settings).child!.canRevert, true);
    assert.deepEqual(paidTotals(progress), { tree: 3, global: 1 });
    progress.levels.child!.pop(); assert.equal(nodeStates(tree, player, settings).root!.canRevert, true);
    const changed = structuredClone(tree); changed.nodes[2]!.autoUnlock = false; const reconciled = structuredClone(progress); synchronizeAutomaticRanks(changed, reconciled);
    assert.equal(reconciled.levels.child!.length, 0); assert.equal(validBuild(changed, reconciled), true);
    progress.levels.child!.push({ tree: 2, global: 1 }); const paid = structuredClone(progress); synchronizeAutomaticRanks(changed, paid); assert.equal(validBuild(changed, paid), false); assert.deepEqual(paidTotals(paid), { tree: 3, global: 1 });
});

test('Automatic ranks do not bypass tree access, stay bounded for condition cycles and unlock linked roots', () => {
    const { tree, player, progress } = fixture(); tree.edges = []; tree.nodes[0]!.autoUnlock = true;
    tree.nodes[0]!.conditions.items = [{ type: 'node', nodeId: 'other', amount: 1 }]; tree.nodes[1]!.autoUnlock = true; tree.nodes[1]!.conditions.items = [{ type: 'node', nodeId: 'root', amount: 1 }];
    synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.root?.length ?? 0, 0); assert.equal(progress.levels.other?.length ?? 0, 0);
    const target = newTalentTree('auto-target', 'classic'); target.name = 'Target'; target.accessMode = 'restricted'; target.nodes = [{ ...structuredClone(tree.nodes[2]!), id: 'target-root', autoUnlock: true }];
    tree.nodes[0]!.conditions = emptyConditions(); tree.nodes[0]!.linkedTreeId = target.id;
    synchronizeTalentProgress([target, tree], player, { ...settings, enabled: false }); assert.equal(progress.levels.root?.length ?? 0, 0);
    synchronizeTalentProgress([target, tree], player, settings, [tree.id]); assert.equal(player.progress[target.id], undefined);
    synchronizeTalentProgress([target, tree], player, settings); assert.equal(progress.levels.root!.length, 1); assert.equal(player.progress[target.id]!.levels['target-root']!.length, 1);
    const saved = structuredClone(player.progress[target.id]); synchronizeTalentProgress([target, tree], player, settings, [target.id]); assert.deepEqual(player.progress[target.id], saved);
});

test('Automatic unlock validates optional booleans and retains historical paid first ranks', () => {
    const { tree, player, progress } = fixture(); tree.nodes[0]!.autoUnlock = true; assert.doesNotThrow(() => validateTalentTree(tree));
    for (const value of [null, 'true', 1, []]) { const invalid = structuredClone(tree); Object.assign(invalid.nodes[0]!, { autoUnlock: value }); assert.throws(() => validateTalentTree(invalid), /Invalid automatic unlock/); }
    progress.levels.root = [{ tree: 2, global: 1 }]; synchronizeTalentProgress([tree], player, settings); assert.deepEqual(progress.levels.root, [{ tree: 2, global: 1 }]);
    assert.equal(nodeStates(tree, player, settings).root!.canRevert, true); delete tree.nodes[0]!.autoUnlock; assert.doesNotThrow(() => validateTalentTree(tree));
});

test('Archived trees retain definitions and builds while blocking access and automatic grants', async () => {
    const { tree, player, progress } = fixture(); const { treeAccessible } = await import('../core/utils/talents');
    tree.archived = true; player.grantedTreeIds = [tree.id]; player.unlockedTreeIds = [tree.id];
    progress.levels.root = [{ tree: 1, global: 0 }]; const before = structuredClone(progress); tree.nodes[1]!.autoUnlock = true;
    assert.equal(treeAccessible(tree, player), false); assert.doesNotThrow(() => validateTalentTree(tree)); synchronizeTalentProgress([tree], player, settings); assert.deepEqual(progress, before);
    tree.archived = false; assert.equal(treeAccessible(tree, player), true); synchronizeTalentProgress([tree], player, settings); assert.equal(progress.levels.other!.length, 1); assert.deepEqual(progress.levels.root, before.levels.root);
    for (const archived of [null, 'true', 1]) { const invalid = structuredClone(tree); Object.assign(invalid, { archived }); assert.throws(() => validateTalentTree(invalid), /Invalid archive state/); }
    delete tree.archived; assert.equal(treeAccessible(tree, player), true);
});
