import { TALENT_COLORS, emptyTalentProgress, type TalentConditions, type TalentNode, type TalentNodeState, type TalentPayment, type TalentPlayer, type TalentProgress, type TalentRankPayment, type TalentRequirementGroup, type TalentSettings, type TalentTree } from './talents.types';
export function rankPayment(payment?: TalentPayment): TalentRankPayment {
    return typeof payment === 'string' ? { tree: payment === 'tree' ? 1 : 0, global: payment === 'global' ? 1 : 0 } : payment ?? { tree: 0, global: 0 };
}
export function paidTotals(progress?: TalentProgress): TalentRankPayment {
    return Object.values(progress?.levels ?? {}).flat().reduce<TalentRankPayment>((sum, value) => { const payment = rankPayment(value); return { tree: sum.tree + payment.tree, global: sum.global + payment.global }; }, { tree: 0, global: 0 });
}
export function normalizeTalentPlayer(value: TalentPlayer): TalentPlayer {
    const player = structuredClone(value);
    player.grantedTreeIds = [...new Set(player.grantedTreeIds ?? [])];
    player.unlockedTreeIds = [...new Set(player.unlockedTreeIds ?? [])];
    for (const progress of Object.values(player.progress))
        for (const id of Object.keys(progress.levels))
            progress.levels[id] = progress.levels[id]!.map(rankPayment);
    return player;
}
export function rankCost(node: TalentNode, level: number): number { return node.autoUnlock && level === 0 ? 0 : node.levels[level]?.cost ?? node.cost ?? 1; }
export function purchasePayment(tree: TalentTree, player: TalentPlayer, settings: TalentSettings, cost: number): TalentRankPayment | null {
    const treePaid = tree.currency !== 'global' ? Math.min(player.trees[tree.id] ?? 0, cost) : 0;
    const globalPaid = cost - treePaid;
    return globalPaid === 0 || (tree.currency !== 'tree' && settings.globalEnabled && player.global >= globalPaid) ? { tree: treePaid, global: globalPaid } : null;
}
export function treeAccessible(tree: TalentTree, player: TalentPlayer, hidden = false): boolean {
    return !tree.archived && !hidden && (tree.accessMode !== 'restricted' || !!player.grantedTreeIds?.includes(tree.id) || !!player.unlockedTreeIds?.includes(tree.id));
}
export function grantLinkedTrees(trees: TalentTree[], player: TalentPlayer): void {
    const ids = new Set(trees.map(tree => tree.id)), unlocked = new Set<string>();
    for (const tree of trees)
        for (const node of tree.nodes)
            if (node.linkedTreeId && ids.has(node.linkedTreeId) && (player.progress[tree.id]?.levels[node.id]?.length ?? 0) > 0)
                unlocked.add(node.linkedTreeId);
    player.unlockedTreeIds = [...unlocked];
}
/** Rebuild free first ranks from paid ranks, so automatic chains cannot sustain themselves. */
export function synchronizeAutomaticRanks(tree: TalentTree, progress: TalentProgress): void {
    const automatic = tree.nodes.filter(node => node.autoUnlock);
    const previous = new Map<string, TalentPayment[]>();
    for (const [id, ranks] of Object.entries(progress.levels))
        if (rankPayment(ranks[0]).automatic) {
            previous.set(id, ranks);
            progress.levels[id] = [];
        }
    if (!automatic.length && !previous.size)
        return;
    let changed = true;
    while (changed) {
        changed = false;
        const hidden = hiddenNodes(tree, progress);
        for (const node of automatic) {
            if (progress.levels[node.id]?.length || hidden.has(node.id) || (tree.options.selectSubtree && node.subtreeId !== progress.selectedSubtree) || !prerequisitesMet(node, progress, tree, 0))
                continue;
            progress.levels[node.id] = [{ tree: 0, global: 0, automatic: true }, ...(previous.get(node.id)?.slice(1) ?? [])];
            changed = true;
        }
    }
    // Keep purchased later ranks when a prerequisite disappears: validation must
    // block the parent refund or request a reset rather than discard paid ranks.
    for (const [id, ranks] of previous)
        if (!progress.levels[id]?.length && ranks.length > 1)
            progress.levels[id] = ranks;
}
export function synchronizeTalentProgress(trees: TalentTree[], player: TalentPlayer, settings: TalentSettings, hiddenTreeIds: string[] = []): void {
    grantLinkedTrees(trees, player);
    if (!settings.enabled)
        return;
    for (let pass = 0; pass <= trees.length; pass++) {
        const before = JSON.stringify([player.progress, player.unlockedTreeIds]);
        for (const tree of trees)
            if (treeAccessible(tree, player, hiddenTreeIds.includes(tree.id))) {
                const progress = player.progress[tree.id] ?? (tree.nodes.some(node => node.autoUnlock) ? player.progress[tree.id] = emptyTalentProgress() : undefined);
                if (progress)
                    synchronizeAutomaticRanks(tree, progress);
            }
        grantLinkedTrees(trees, player);
        if (JSON.stringify([player.progress, player.unlockedTreeIds]) === before)
            break;
    }
}
export function validateTalentCatalog(trees: TalentTree[]): void {
    const ids = new Set(trees.map(tree => tree.id));
    for (const tree of trees) {
        if (tree.parentTreeId && !ids.has(tree.parentTreeId))
            throw new Error('Parent tree is unavailable');
        for (const node of tree.nodes)
            if (node.linkedTreeId && (node.linkedTreeId === tree.id || !ids.has(node.linkedTreeId)))
                throw new Error('Linked tree is unavailable');
        const seen = new Set([tree.id]);
        let parent = tree.parentTreeId;
        while (parent) {
            if (seen.has(parent))
                throw new Error('Tree hierarchy cannot form a cycle');
            seen.add(parent);
            parent = trees.find(candidate => candidate.id === parent)?.parentTreeId;
        }
    }
}
export function talentTreeRows(trees: TalentTree[], collapsed = new Set<string>()): {
    tree: TalentTree;
    depth: number;
    hasChildren: boolean;
}[] {
    const ids = new Set(trees.map(tree => tree.id)), result: {
        tree: TalentTree;
        depth: number;
        hasChildren: boolean;
    }[] = [], visited = new Set<string>();
    const visit = (tree: TalentTree, depth: number) => {
        if (visited.has(tree.id))
            return;
        visited.add(tree.id);
        const children = trees.filter(child => child.parentTreeId === tree.id);
        result.push({ tree, depth, hasChildren: children.length > 0 });
        if (!collapsed.has(tree.id))
            children.forEach(child => visit(child, depth + 1));
    };
    trees.filter(tree => !tree.parentTreeId || !ids.has(tree.parentTreeId)).forEach(tree => visit(tree, 0));
    return result;
}
export function spent(progress: TalentProgress, tree: TalentTree, subtreeId?: string): number {
    return tree.nodes.filter(n => !subtreeId || n.subtreeId === subtreeId).reduce((sum, n) => sum + (progress.levels[n.id] ?? []).reduce((total, value) => { const paid = rankPayment(value); return total + paid.tree + paid.global; }, 0), 0);
}
export function conditionsMet(conditions: TalentConditions, progress: TalentProgress, tree: TalentTree): boolean {
    const matches = conditions.items.map(c => (c.type === 'node' ? progress.levels[c.nodeId]?.length ?? 0 : spent(progress, tree, c.type === 'subtreePoints' ? c.subtreeId : undefined)) >= c.amount);
    return !matches.length || (conditions.mode === 'all' ? matches.every(Boolean) : matches.some(Boolean));
}
export function prerequisitesMet(node: TalentNode, progress: TalentProgress, tree: TalentTree, level: number): boolean {
    const parents = tree.edges.filter(e => e.child === node.id).map(e => (progress.levels[e.parent]?.length ?? 0) > 0);
    return (!parents.length || (node.parentMode === 'all' ? parents.every(Boolean) : parents.some(Boolean))) && conditionsMet(node.conditions, progress, tree) && conditionsMet(node.levels[level]?.conditions ?? { mode: 'all', items: [] }, progress, tree);
}
export function hiddenNodes(tree: TalentTree, progress: TalentProgress): Set<string> {
    const hidden = new Set(tree.nodes.filter(n => !conditionsMet(n.hide, progress, tree)).map(n => n.id));
    let changed = true;
    while (changed) {
        changed = false;
        for (const edge of tree.edges)
            if (hidden.has(edge.parent) && !hidden.has(edge.child)) {
                hidden.add(edge.child);
                changed = true;
            }
    }
    return hidden;
}
export function validBuild(tree: TalentTree, progress: TalentProgress): boolean {
    if (tree.options.selectSubtree && !tree.subtrees.some(s => s.id === progress.selectedSubtree))
        return !Object.values(progress.levels).some(levels => levels.length > 0);
    for (const [id, levels] of Object.entries(progress.levels)) {
        if (!levels.length)
            continue;
        const node = tree.nodes.find(n => n.id === id);
        if (!node || levels.length > node.levels.length || (tree.options.selectSubtree && node.subtreeId !== progress.selectedSubtree))
            return false;
        if (rankPayment(levels[0]).automatic && !node.autoUnlock)
            return false;
        // Check each purchased level against the build with that level and later levels removed.
        for (let level = 0; level < levels.length; level++) {
            const before = { ...progress, levels: { ...progress.levels, [id]: levels.slice(0, level) } };
            if (!prerequisitesMet(node, before, tree, level))
                return false;
        }
    }
    return tree.subtrees.every(s => !s.maxPoints || spent(progress, tree, s.id) <= s.maxPoints);
}
export function nodeStates(tree: TalentTree, player: TalentPlayer, settings: TalentSettings): Record<string, TalentNodeState> {
    const progress = player.progress[tree.id] ?? emptyTalentProgress(), hidden = hiddenNodes(tree, progress);
    return Object.fromEntries(tree.nodes.map(node => {
        const level = progress.levels[node.id]?.length ?? 0;
        const cost = rankCost(node, level);
        let reason = '';
        if (!settings.enabled)
            reason = 'disabled';
        else if (hidden.has(node.id))
            reason = 'hidden';
        else if (level >= node.levels.length)
            reason = 'maximum';
        else if (tree.options.selectSubtree && node.subtreeId !== progress.selectedSubtree)
            reason = 'specialization';
        else if (!prerequisitesMet(node, progress, tree, level))
            reason = 'prerequisites';
        else if (node.autoUnlock && level === 0)
            reason = 'automatic';
        else if (tree.subtrees.some(s => s.id === node.subtreeId && s.maxPoints > 0 && spent(progress, tree, s.id) + cost > s.maxPoints))
            reason = 'subtreeCap';
        else if (!purchasePayment(tree, player, settings, cost))
            reason = 'points';
        const reduced = { ...progress, levels: { ...progress.levels, [node.id]: (progress.levels[node.id] ?? []).slice(0, -1) } };
        synchronizeAutomaticRanks(tree, reduced);
        const groups: {
            source: TalentRequirementGroup['source'];
            conditions: TalentConditions;
        }[] = [
            { source: 'parents', conditions: { mode: node.parentMode, items: tree.edges.filter(e => e.child === node.id).map(e => ({ type: 'node', nodeId: e.parent, amount: 1 })) } },
            { source: 'node', conditions: node.conditions },
            { source: 'rank', conditions: node.levels[level]?.conditions ?? { mode: 'all', items: [] } }
        ];
        const requirementGroups: TalentRequirementGroup[] = groups.filter(group => !conditionsMet(group.conditions, progress, tree)).map(group => ({
            source: group.source, mode: group.conditions.mode, items: group.conditions.items.map(c => {
                const current = c.type === 'node' ? progress.levels[c.nodeId]?.length ?? 0 : spent(progress, tree, c.type === 'subtreePoints' ? c.subtreeId : undefined);
                const name = c.type === 'node' ? (hidden.has(c.nodeId) ? '' : tree.nodes.find(n => n.id === c.nodeId)?.name ?? '') : c.type === 'subtreePoints' ? tree.subtrees.find(s => s.id === c.subtreeId)?.name ?? '' : '';
                return { type: c.type, name, current, amount: c.amount };
            }).filter(c => c.current < c.amount)
        }));
        const requirements = requirementGroups.flatMap(group => group.items);
        const buildValidAfterRemoval = level > 0 && validBuild(tree, reduced);
        const dependents = level > 0 && !buildValidAfterRemoval ? tree.nodes.filter(n => !hidden.has(n.id) && (reduced.levels[n.id]?.length ?? 0) > 0 && (reduced.levels[n.id] ?? []).some((_, rank) => !prerequisitesMet(n, { ...reduced, levels: { ...reduced.levels, [n.id]: reduced.levels[n.id]!.slice(0, rank) } }, tree, rank))).map(n => n.name) : [];
        return [node.id, { cost, requirements, requirementGroups, dependents, level, maximum: node.levels.length, hidden: hidden.has(node.id), canAllocate: !reason, canRevert: settings.enabled && !hidden.has(node.id) && tree.options.allowRevert && level > 0 && !rankPayment(progress.levels[node.id]?.[level - 1]).automatic && buildValidAfterRemoval, reason }];
    }));
}
/** Parse untrusted definitions without permitting arbitrary object keys or executable expressions. */
export function validateTalentTree(value: unknown): TalentTree {
    const tree = structuredClone(value) as TalentTree;
    const fail = (message: string): never => { throw new Error(message); };
    const text = (v: unknown, max = 200, optional = false) => typeof v === 'string' && v.length <= max && (optional || v.trim().length > 0);
    const id = (v: unknown) => text(v, 80) && /^[a-zA-Z0-9_-]+$/.test(v as string) && !['__proto__', 'constructor', 'prototype'].includes(v as string);
    const integer = (v: unknown, max = 1000000) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= max;
    const coordinate = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100000;
    const icon = (v: {
        icon: unknown;
        imageId: unknown;
    }) => (v.icon === null || (text(v.icon, 100) && /^mdi-[a-z0-9-]+$/.test(v.icon as string))) && (v.imageId === null || id(v.imageId));
    if (!tree || !id(tree.id) || !text(tree.name) || !text(tree.description, 10000, true) || !icon(tree) || !['classic', 'centered', 'free'].includes(tree.layout) || !['global', 'tree', 'both'].includes(tree.currency))
        fail('Invalid tree');
    if (tree.archived !== undefined && typeof tree.archived !== 'boolean')
        fail('Invalid archive state');
    if ((tree.parentTreeId != null && (!id(tree.parentTreeId) || tree.parentTreeId === tree.id)) || (tree.accessMode !== undefined && !['available', 'restricted'].includes(tree.accessMode)))
        fail('Invalid tree organization');
    if (!Array.isArray(tree.nodes) || tree.nodes.length > 500 || !Array.isArray(tree.subtrees) || tree.subtrees.length > 50 || !Array.isArray(tree.edges) || tree.edges.length > 2500)
        fail('Invalid graph size');
    if (tree.decorations !== undefined) {
        if (!Array.isArray(tree.decorations) || tree.decorations.length > 100 || new Set(tree.decorations.map(shape => shape?.id)).size !== tree.decorations.length)
            fail('Invalid decorative shapes');
        for (const shape of tree.decorations) {
            if (!shape || !id(shape.id) || !['rectangle', 'rounded', 'ellipse', 'diamond'].includes(shape.shape) || !text(shape.text, 4000, true) || !TALENT_COLORS.includes(shape.color) || !Number.isInteger(shape.fontSize) || shape.fontSize < 10 || shape.fontSize > 48 || [shape.bold, shape.italic, shape.underline, shape.strikethrough].some(value => value !== undefined && typeof value !== 'boolean') || ![shape.x, shape.y, shape.width, shape.height].every(coordinate) || shape.width < 80 || shape.height < 48 || shape.width > 5000 || shape.height > 5000)
                fail('Invalid decorative shape');
        }
    }
    const nodes = new Set(tree.nodes.map(n => n?.id)), subtrees = new Set(tree.subtrees.map(s => s?.id));
    if (nodes.size !== tree.nodes.length || subtrees.size !== tree.subtrees.length)
        fail('Duplicate identifiers');
    const conditions = (c: TalentConditions) => {
        if (!c || !['all', 'any'].includes(c.mode) || !Array.isArray(c.items) || c.items.length > 50)
            fail('Invalid conditions');
        for (const item of c.items) {
            if (!item || !integer(item.amount) || !['node', 'treePoints', 'subtreePoints'].includes(item.type))
                fail('Invalid condition');
            if (item.type === 'node' && !nodes.has(item.nodeId))
                fail('Condition references missing node');
            if (item.type === 'subtreePoints' && !subtrees.has(item.subtreeId))
                fail('Condition references missing subtree');
        }
    };
    for (const s of tree.subtrees)
        if (!s || (s.boundsMode !== undefined && !['auto', 'manual'].includes(s.boundsMode)) || !id(s.id) || !text(s.name) || !text(s.description, 10000, true) || !icon(s) || !integer(s.maxPoints) || ![s.x, s.y, s.width, s.height].every(coordinate) || s.width < 80 || s.height < 80)
            fail('Invalid subtree');
    for (const n of tree.nodes) {
        if (!n || !id(n.id) || !text(n.name) || !text(n.description, 10000, true) || !icon(n) || !coordinate(n.x) || !coordinate(n.y) || (n.subtreeId !== null && !subtrees.has(n.subtreeId)) || !['all', 'any'].includes(n.parentMode) || !Array.isArray(n.levels) || !n.levels.length || n.levels.length > 100 || new Set(n.levels.map(l => l?.id)).size !== n.levels.length)
            fail('Invalid node');
        if (n.autoUnlock !== undefined && typeof n.autoUnlock !== 'boolean')
            fail('Invalid automatic unlock');
        if (n.color !== undefined && !TALENT_COLORS.includes(n.color))
            fail('Invalid node color');
        if ((n.cost !== undefined && !integer(n.cost)) || (n.category !== undefined && !['passive', 'active'].includes(n.category)) || (n.linkedTreeId != null && (!id(n.linkedTreeId) || n.linkedTreeId === tree.id)))
            fail('Invalid node cost, category or tree connection');
        conditions(n.conditions);
        conditions(n.hide);
        for (const l of n.levels) {
            if (!l || !id(l.id) || (l.cost !== undefined && !integer(l.cost)) || (l.name !== undefined && !text(l.name, 200, true)) || (l.description !== undefined && !text(l.description, 10000, true)))
                fail('Invalid level');
            conditions(l.conditions);
        }
    }
    const pairs = new Set<string>();
    for (const edge of tree.edges) {
        if (!edge || !nodes.has(edge.parent) || !nodes.has(edge.child) || edge.parent === edge.child || pairs.has(`${edge.parent}:${edge.child}`))
            fail('Invalid connection');
        if ([edge.parentSide, edge.childSide].some(side => side !== undefined && !['top', 'right', 'bottom', 'left'].includes(side)))
            fail('Invalid connection border');
        if (edge.style !== undefined && !['rounded', 'square', 'straight'].includes(edge.style))
            fail('Invalid connection style');
        if (edge.arrow !== undefined && !['triangle', 'chevron', 'diamond', 'none'].includes(edge.arrow))
            fail('Invalid connection arrow');
        pairs.add(`${edge.parent}:${edge.child}`);
    }
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (node: string) => {
        if (visiting.has(node))
            fail('Connections cannot form a cycle');
        if (visited.has(node))
            return;
        visiting.add(node);
        for (const edge of tree.edges.filter(e => e.parent === node))
            visit(edge.child);
        visiting.delete(node);
        visited.add(node);
    };
    for (const node of nodes)
        visit(node);
    const o = tree.options;
    if (!o || !['top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(o.levelPosition) || !integer(o.startingNodes, 50) || o.startingNodes === 1 || ['iconsOnly', 'allowRevert', 'allowRespec', 'selectSubtree', 'allowSpecializationRespec', 'refundSpecialization', 'separators'].some(k => typeof o[k as keyof typeof o] !== 'boolean'))
        fail('Invalid tree options');
    if ((o.connectionStyle !== undefined && !['rounded', 'square', 'straight'].includes(o.connectionStyle)) || (o.connectionArrow !== undefined && !['triangle', 'chevron', 'diamond', 'none'].includes(o.connectionArrow)))
        fail('Invalid default connection style');
    if (tree.layout === 'centered' && o.startingNodes > 0 && tree.nodes.filter(n => !tree.edges.some(e => e.child === n.id)).length !== o.startingNodes)
        fail('Root count must match the configured starting nodes');
    if (o.selectSubtree && (!tree.subtrees.length || tree.nodes.some(n => !n.subtreeId)))
        fail('Specialization requires every node to have a subtree');
    if (tree.layout === 'free') {
        for (const a of tree.subtrees)
            for (const b of tree.subtrees)
                if (a.id !== b.id && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y)
                    fail('Subtree rectangles cannot overlap');
        for (const n of tree.nodes) {
            const region = tree.subtrees.find(s => n.x >= s.x && n.x < s.x + s.width && n.y >= s.y && n.y < s.y + s.height);
            if (n.subtreeId !== (region?.id ?? null))
                fail('Node subtree must match its rectangle');
        }
    }
    return tree;
}
/** A connector is directed from a prerequisite parent to its child. */
export function talentConnectionError(tree: TalentTree, parent: string, child: string): 'missing' | 'self' | 'duplicate' | 'cycle' | 'limit' | null {
    if (!tree.nodes.some(node => node.id === parent) || !tree.nodes.some(node => node.id === child))
        return 'missing';
    if (parent === child)
        return 'self';
    if (tree.edges.some(edge => edge.parent === parent && edge.child === child))
        return 'duplicate';
    if (tree.edges.length >= 2500)
        return 'limit';
    const pending = [child], visited = new Set<string>();
    while (pending.length) {
        const id = pending.pop()!;
        if (id === parent)
            return 'cycle';
        if (visited.has(id))
            continue;
        visited.add(id);
        for (const edge of tree.edges)
            if (edge.parent === id)
                pending.push(edge.child);
    }
    return null;
}
