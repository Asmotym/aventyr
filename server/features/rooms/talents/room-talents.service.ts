import type { RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { parseRoomOverrides, resolveRoomRights, type RoomRole } from '../../../../shared/rooms/room-permissions';
import { nodeStates, normalizeTalentPlayer, paidTotals, purchasePayment, rankPayment, synchronizeAutomaticRanks, synchronizeTalentProgress, treeAccessible, validBuild, validateTalentCatalog, validateTalentTree } from '../../../../shared/rooms/talents';
import { emptyTalentPlayer, emptyTalentProgress, type TalentAction, type TalentPlayer, type TalentResult, type TalentSettings, type TalentSnapshot, type TalentTree } from '../../../../shared/rooms/talents.types';
import { execute, query, transaction } from '../../../infrastructure/database/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../infrastructure/http/errors';
import { normalizeImage } from '../../../infrastructure/images/normalize-image';
type Row = RowDataPacket & {
    data: unknown;
    user_id: string;
    id: string;
    hidden: unknown;
    revision: number;
    role: RoomRole;
    permission_overrides: unknown;
    name: string;
    archived_at: unknown;
};
const decode = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T;
async function access(roomId: string, userId: string) {
    if (typeof roomId !== 'string' || !roomId || typeof userId !== 'string' || !userId)
        throw new BadRequestError('Room and actor required');
    const room = (await query<Row[]>('SELECT archived_at FROM rooms WHERE id = ? FOR UPDATE', [roomId]))[0];
    if (!room || room.archived_at)
        throw new ForbiddenError('Room unavailable');
    const member = (await query<Row[]>('SELECT role, permission_overrides FROM room_members WHERE room_id = ? AND user_id = ? FOR UPDATE', [roomId, userId]))[0];
    if (!member)
        throw new ForbiddenError('Room membership required');
    return resolveRoomRights(member.role, parseRoomOverrides(member.permission_overrides)).manageTalentTrees;
}
function refund(player: TalentPlayer, treeId: string, burn = false) {
    if (!burn) {
        const paid = paidTotals(player.progress[treeId]);
        player.global += paid.global;
        player.trees[treeId] = (player.trees[treeId] ?? 0) + paid.tree;
    }
    player.progress[treeId] = emptyTalentProgress();
}
function incompatible(before: TalentTree, after: TalentTree, player: TalentPlayer): boolean {
    const progress = player.progress[before.id];
    if (!progress)
        return false;
    if (progress.selectedSubtree && !after.subtrees.some(s => s.id === progress.selectedSubtree))
        return true;
    const reconciled = structuredClone(progress);
    synchronizeAutomaticRanks(after, reconciled);
    if (!validBuild(after, reconciled))
        return true;
    for (const [id, paid] of Object.entries(progress.levels))
        for (let i = 0; i < paid.length; i++) {
            if (rankPayment(paid[i]).automatic)
                continue;
            if (before.nodes.find(n => n.id === id)?.levels[i]?.id !== after.nodes.find(n => n.id === id)?.levels[i]?.id)
                return true;
        }
    return false;
}
export async function handleTalentAction(action: TalentAction): Promise<TalentResult> {
    return transaction(async () => {
        const p = action.payload;
        if (!p || !['read', 'settings', 'save', 'delete', 'archive', 'visibility', 'access', 'balance', 'select', 'allocate', 'revert', 'respec'].includes(p.op))
            throw new BadRequestError('Unknown talent operation');
        const canManage = await access(p.roomId, p.userId);
        if (('confirmReset' in p && p.confirmReset !== undefined && typeof p.confirmReset !== 'boolean') || ('confirm' in p && p.confirm !== undefined && typeof p.confirm !== 'boolean'))
            throw new BadRequestError('Confirmation must be boolean');
        const management = ['settings', 'save', 'delete', 'archive', 'visibility', 'access', 'balance'].includes(p.op);
        if (management && !canManage)
            throw new ForbiddenError('Talent management permission required');
        const settingRow = (await query<Row[]>('SELECT revision, data FROM room_talent_settings WHERE room_id = ?', [p.roomId]))[0];
        const revision = settingRow?.revision ?? 0;
        let settings: TalentSettings = settingRow ? decode(settingRow.data) : { enabled: false, globalEnabled: false, maxGlobal: 0 };
        if (p.op !== 'read' && p.revision !== revision)
            throw new ConflictError('Talent data changed. Reload and try again.');
        const rows = await query<Row[]>('SELECT id, data, hidden FROM room_talent_trees WHERE room_id = ? ORDER BY id', [p.roomId]);
        const trees = rows.map(r => decode<TalentTree>(r.data));
        const hidden = Object.fromEntries(rows.map(r => [r.id, decode<string[]>(r.hidden)]));
        const playerRows = await query<Row[]>('SELECT user_id, data FROM room_talent_players WHERE room_id = ?', [p.roomId]);
        const players = new Map(playerRows.map(r => [r.user_id, normalizeTalentPlayer(decode<TalentPlayer>(r.data))]));
        const members = await query<Row[]>(`SELECT m.user_id, COALESCE(NULLIF(m.nickname, ''), u.username, m.user_id) AS name FROM room_members m LEFT JOIN users u ON u.discord_user_id = m.user_id WHERE m.room_id = ? ORDER BY m.user_id`, [p.roomId]);
        const getPlayer = (id: string) => {
            if (!players.has(id))
                players.set(id, emptyTalentPlayer());
            return players.get(id)!;
        };
        const player = getPlayer(p.userId);
        for (const member of members)
            getPlayer(member.user_id);
        const synchronizePlayers = () => {
            for (const [id, state] of players)
                synchronizeTalentProgress(trees, state, settings, trees.filter(tree => hidden[tree.id]?.includes(id)).map(tree => tree.id));
        };
        synchronizePlayers();
        const tree = 'treeId' in p ? trees.find(t => t.id === p.treeId) : undefined;
        if ('treeId' in p && !tree)
            throw new NotFoundError('Talent tree not found');
        if (!management && p.op !== 'read' && (!settings.enabled || !treeAccessible(tree!, player, hidden[tree!.id]?.includes(p.userId))))
            throw new ForbiddenError('Talent tree unavailable');
        let resetRequired: TalentResult['resetRequired'];
        if (p.op === 'settings') {
            const s = p.settings;
            if (!s || typeof s.enabled !== 'boolean' || typeof s.globalEnabled !== 'boolean' || !Number.isSafeInteger(s.maxGlobal) || s.maxGlobal < 0 || s.maxGlobal > 1000000)
                throw new BadRequestError('Invalid talent settings');
            settings = { enabled: s.enabled, globalEnabled: s.globalEnabled, maxGlobal: s.maxGlobal };
        }
        else if (p.op === 'save' || p.op === 'delete') {
            let next: TalentTree | undefined;
            if (p.op === 'save') {
                try {
                    next = validateTalentTree(p.tree);
                }
                catch (error) {
                    throw new BadRequestError(error instanceof Error ? error.message : 'Invalid tree');
                }
            }
            const previous = p.op === 'save' ? trees.find(t => t.id === next!.id) : tree;
            if (previous && next && previous.layout !== next.layout)
                throw new BadRequestError('Layout cannot change after creation');
            if (!previous && trees.length >= 50)
                throw new BadRequestError('A room supports at most 50 talent trees');
            if (next) {
                try {
                    validateTalentCatalog([...trees.filter(tree => tree.id !== next!.id), next]);
                }
                catch (error) {
                    throw new BadRequestError(error instanceof Error ? error.message : String(error));
                }
                const ids = [...new Set([next, ...next.nodes, ...next.subtrees].map(n => n.imageId).filter(Boolean))];
                for (const id of ids)
                    if (!(await query<Row[]>('SELECT id FROM room_talent_images WHERE room_id = ? AND id = ?', [p.roomId, id]))[0])
                        throw new BadRequestError('Image belongs to another room or is unavailable');
            }
            const affected = previous ? [...players].filter(([, player]) => next ? incompatible(previous, next, player) : !!player.progress[previous.id] && (Object.values(player.progress[previous.id]!.levels).some(ranks => ranks.some(rank => !rankPayment(rank).automatic)) || !!player.progress[previous.id]!.selectedSubtree)) : [];
            if (affected.length && !p.confirmReset) {
                resetRequired = affected.map(([id, player]) => ({ userId: id, name: members.find(m => m.user_id === id)?.name ?? id, ...paidTotals(player.progress[previous!.id]) }));
            }
            else {
                for (const [, player] of affected)
                    refund(player, previous!.id);
                if (next) {
                    if (previous)
                        trees.splice(trees.indexOf(previous), 1, next);
                    else {
                        trees.push(next);
                        hidden[next.id] = [];
                    }
                    await execute('INSERT INTO room_talent_trees (room_id, id, data, hidden) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)', [p.roomId, next.id, JSON.stringify(next), JSON.stringify(hidden[next.id])]);
                }
                else {
                    trees.splice(trees.indexOf(tree!), 1);
                    delete hidden[tree!.id];
                    await execute('DELETE FROM room_talent_trees WHERE room_id = ? AND id = ?', [p.roomId, tree!.id]);
                    for (const remaining of trees) {
                        let changed = false;
                        if (remaining.parentTreeId === tree!.id) {
                            remaining.parentTreeId = null;
                            changed = true;
                        }
                        for (const node of remaining.nodes)
                            if (node.linkedTreeId === tree!.id) {
                                node.linkedTreeId = null;
                                changed = true;
                            }
                        if (changed)
                            await execute('UPDATE room_talent_trees SET data = ? WHERE room_id = ? AND id = ?', [JSON.stringify(remaining), p.roomId, remaining.id]);
                    }
                    for (const player of players.values()) {
                        player.grantedTreeIds = player.grantedTreeIds?.filter(id => id !== tree!.id);
                        player.unlockedTreeIds = player.unlockedTreeIds?.filter(id => id !== tree!.id);
                        delete player.progress[tree!.id];
                    }
                }
            }
        }
        else if (p.op === 'archive') {
            if (typeof p.archived !== 'boolean')
                throw new BadRequestError('Archived must be boolean');
            tree!.archived = p.archived;
            await execute('UPDATE room_talent_trees SET data = ? WHERE room_id = ? AND id = ?', [JSON.stringify(tree), p.roomId, tree!.id]);
        }
        else if (p.op === 'visibility' || p.op === 'access' || p.op === 'balance') {
            if (!members.some(m => m.user_id === p.targetUserId))
                throw new BadRequestError('Target must be a current room member');
            if (p.op === 'visibility') {
                if (typeof p.visible !== 'boolean')
                    throw new BadRequestError('Visible must be boolean');
                hidden[tree!.id] = [...new Set([...(hidden[tree!.id] ?? []).filter(id => id !== p.targetUserId), ...(!p.visible ? [p.targetUserId] : [])])];
                await execute('UPDATE room_talent_trees SET hidden = ? WHERE room_id = ? AND id = ?', [JSON.stringify(hidden[tree!.id]), p.roomId, tree!.id]);
            }
            else if (p.op === 'access') {
                if (typeof p.granted !== 'boolean')
                    throw new BadRequestError('Granted must be boolean');
                const target = getPlayer(p.targetUserId);
                target.grantedTreeIds = [...new Set([...(target.grantedTreeIds ?? []).filter(id => id !== p.treeId), ...(p.granted ? [p.treeId] : [])])];
            }
            else {
                if (!Number.isSafeInteger(p.points) || p.points < 0 || p.points > 1000000 || (!p.treeId && settings.maxGlobal > 0 && p.points > settings.maxGlobal))
                    throw new BadRequestError('Invalid point balance');
                const target = getPlayer(p.targetUserId);
                if (p.treeId)
                    target.trees[p.treeId] = p.points;
                else
                    target.global = p.points;
            }
        }
        else if (p.op !== 'read') {
            const progress = player.progress[tree!.id] ??= emptyTalentProgress();
            if (p.op === 'select') {
                if (!tree!.options.selectSubtree || progress.selectedSubtree || !tree!.subtrees.some(s => s.id === p.subtreeId))
                    throw new BadRequestError('Specialization cannot be selected');
                progress.selectedSubtree = p.subtreeId;
            }
            else if (p.op === 'respec') {
                if (typeof p.specialization !== 'boolean' || (p.specialization ? !tree!.options.selectSubtree || !tree!.options.allowSpecializationRespec : !tree!.options.allowRespec))
                    throw new ForbiddenError('Respec is disabled');
                if (!p.confirm)
                    throw new BadRequestError('Confirm respec before continuing');
                const selected = progress.selectedSubtree;
                refund(player, tree!.id, p.specialization && !tree!.options.refundSpecialization);
                if (!p.specialization)
                    player.progress[tree!.id]!.selectedSubtree = selected;
            }
            else {
                const state = nodeStates(tree!, player, settings)[p.nodeId];
                if (!state || !(p.op === 'allocate' ? state.canAllocate : state.canRevert))
                    throw new BadRequestError(p.op === 'allocate' ? `Cannot allocate: ${state?.reason ?? 'unknown node'}` : 'Cannot remove this level: acquired talents depend on it, or reverting is disabled');
                const payments = progress.levels[p.nodeId] ??= [];
                if (p.op === 'allocate') {
                    const payment = purchasePayment(tree!, player, settings, state.cost ?? 1);
                    if (!payment)
                        throw new BadRequestError('Insufficient talent points');
                    player.trees[tree!.id] = (player.trees[tree!.id] ?? 0) - payment.tree;
                    player.global -= payment.global;
                    payments.push(payment);
                }
                else {
                    const payment = rankPayment(payments.pop());
                    player.global += payment.global;
                    player.trees[tree!.id] = (player.trees[tree!.id] ?? 0) + payment.tree;
                }
            }
        }
        if (p.op !== 'read' && !resetRequired) {
            synchronizePlayers();
            await execute('INSERT INTO room_talent_settings (room_id, revision, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE revision = VALUES(revision), data = VALUES(data)', [p.roomId, revision + 1, JSON.stringify(settings)]);
            for (const [id, state] of players)
                await execute('INSERT INTO room_talent_players (room_id, user_id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)', [p.roomId, id, JSON.stringify(state)]);
        }
        const visibleTrees = settings.enabled ? trees.filter(t => treeAccessible(t, player, hidden[t.id]?.includes(p.userId))) : [];
        const states = Object.fromEntries(visibleTrees.map(t => [t.id, nodeStates(t, player, settings)]));
        const visibleIds = new Set(visibleTrees.map(t => t.id));
        const sanitized = visibleTrees.map(t => {
            const visible = new Set(t.nodes.filter(n => !states[t.id]![n.id]!.hidden).map(n => n.id));
            const nodes = t.nodes.filter(n => visible.has(n.id)).map(n => ({ ...n, unlocksTree: !!n.linkedTreeId, linkedTreeId: n.linkedTreeId && visibleIds.has(n.linkedTreeId) ? n.linkedTreeId : null, conditions: { mode: 'all' as const, items: [] }, hide: { mode: 'all' as const, items: [] }, levels: n.levels.map(l => ({ ...l, conditions: { mode: 'all' as const, items: [] } })) }));
            return { ...t, parentTreeId: t.parentTreeId && visibleIds.has(t.parentTreeId) ? t.parentTreeId : null, nodes, edges: t.edges.filter(e => visible.has(e.parent) && visible.has(e.child)) };
        });
        const filteredPlayer = { ...player, grantedTreeIds: player.grantedTreeIds?.filter(id => visibleIds.has(id)), unlockedTreeIds: player.unlockedTreeIds?.filter(id => visibleIds.has(id)), trees: Object.fromEntries(Object.entries(player.trees).filter(([id]) => visibleIds.has(id))), progress: Object.fromEntries(Object.entries(player.progress).filter(([id]) => visibleIds.has(id)).map(([id, progress]) => [id, { ...progress, levels: Object.fromEntries(Object.entries(progress.levels).filter(([nodeId]) => !states[id]?.[nodeId]?.hidden)) }])) };
        const talents: TalentSnapshot = { accessibleTreeIds: [...visibleIds], revision: revision + (p.op !== 'read' && !resetRequired ? 1 : 0), settings, canManage, trees: canManage ? trees : sanitized, player: canManage ? player : filteredPlayer,
            states: canManage ? states : Object.fromEntries(Object.entries(states).map(([id, nodes]) => [id, Object.fromEntries(Object.entries(nodes).filter(([, state]) => !state.hidden))])),
            ...(canManage ? { hidden, members: members.map(m => ({ userId: m.user_id, name: m.name, player: getPlayer(m.user_id) })) } : {}) };
        return { talents, ...(resetRequired ? { resetRequired } : {}) };
    });
}
export async function storeTalentImage(roomId: string, userId: string, bytes: Buffer): Promise<string> {
    return transaction(async () => {
        if (!await access(roomId, userId))
            throw new ForbiddenError('Talent management permission required');
        const image = await normalizeImage(bytes, { maxDimension: 1024, quality: 85 }), id = randomUUID();
        await execute('INSERT INTO room_talent_images (id, room_id, uploader_id, bytes) VALUES (?, ?, ?, ?)', [id, roomId, userId, image.data]);
        return id;
    });
}
export async function readTalentImage(roomId: string, userId: string, id: string): Promise<Buffer> {
    const result = await handleTalentAction({ action: 'talents', payload: { op: 'read', roomId, userId } });
    const referenced = result.talents.trees.some(t => [t, ...t.nodes, ...t.subtrees].some(n => n.imageId === id));
    const rows = await query<(RowDataPacket & {
        bytes: Buffer;
        uploader_id: string;
    })[]>('SELECT bytes, uploader_id FROM room_talent_images WHERE room_id = ? AND id = ?', [roomId, id]);
    if (!rows[0] || (!referenced && !(result.talents.canManage && rows[0].uploader_id === userId)))
        throw new ForbiddenError('Image unavailable');
    return rows[0].bytes;
}
