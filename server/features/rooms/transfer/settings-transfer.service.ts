import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { emptySettingsPackage, parseSettingsPackage, type RoomSettingsPackage, type SettingsTransferPayload, type SettingsTransferPreview, type TransferEntry, type TransferSection, type TransferSectionKey } from '../../../../shared/rooms/settings-transfer';
import { parseRoomOverrides, resolveRoomRights } from '../../../../shared/rooms/room-permissions';
import { talentImageIds } from '../../../../shared/rooms/talent-transfer';
import { validateTalentCatalog, validateTalentTree } from '../../../../shared/rooms/talents';
import type { TalentSettings, TalentTree } from '../../../../shared/rooms/talents.types';
import { parseBonusNotation, validateBonusEntry } from '../../../../shared/rooms/bonus-point-config';
import type { RoomBonusPointEffect, RoomBonusPointTrigger, RoomBonusPointRule, RoomCriticalRule } from '../../../../shared/rooms/rooms.types';
import { execute, query, transaction } from '../../../infrastructure/database/client';
import { BadRequestError, ConflictError, ForbiddenError } from '../../../infrastructure/http/errors';
import { normalizeImage } from '../../../infrastructure/images/normalize-image';
import { DICE_CATEGORY_NAME_MAX_LENGTH } from '../domain/rooms.constants';
import { requireRoom } from '../domain/rooms.shared';
import { getMember } from '../membership/repositories/room-members.table';
import { listRoomDices } from '../dice/repositories/room-dices.table';
import { listRoomDiceCategories } from '../dice/repositories/room-dice-categories.table';
import { handleListRollAwards } from '../awards/awards.service';
import { listBonusEntries, migrateRoomBonusConfiguration } from '../bonus-points/repositories/room-bonus-config.table';
import { mapRoomToSummary } from '../domain/rooms.mappers';
import { normalizeBonusPointsMax, normalizeDiceCategoryName, normalizeDiceDescription, normalizeDiceNotation, normalizeRollAwardDescription, normalizeRollAwardDiceNotations, normalizeRollAwardName, normalizeRollAwardResults, normalizeRoomCriticals, normalizeSessionInactivityMinutes, serializeRollAwardDiceNotations } from '../domain/rooms.normalizers';
const secret = process.env.ROOM_SETTINGS_TRANSFER_SECRET?.trim() || randomBytes(32);
const decode = <T>(data: unknown): T => (typeof data === 'string' ? JSON.parse(data) : data) as T;
const entry = (value: object): TransferEntry => value as TransferEntry;
const section = (values: TransferSection['values'], lists: TransferSection['lists'] = {}): TransferSection => ({ values, lists });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sign = (value: unknown) => createHmac('sha256', secret).update(JSON.stringify(value)).digest('hex');

export async function exportRoomSettings(p: SettingsTransferPayload, exporting = false): Promise<RoomSettingsPackage> {
    const room = await requireRoom(p.roomId), member = await getMember(p.roomId, p.userId);
    if (!member || room.archived_at) throw new ForbiddenError('Room unavailable');
    const rights = resolveRoomRights(member.role ?? 'player', parseRoomOverrides(member.permission_overrides));
    const result = emptySettingsPackage(), s = result.sections;
    if (rights.editRoom) s.room = section({ name: room.name, sessionInactivityMinutes: Number(room.session_inactivity_minutes ?? 240) });
    if (rights.manageDice && rights.manageDiceCategories) {
        s.dices = section({}, {
            categories: (await listRoomDiceCategories(p.roomId, p.userId)).map(c => ({ id: c.id, name: c.name })),
            dices: (await listRoomDices(p.roomId, p.userId)).map(d => ({ id: d.id, notation: d.notation, description: d.description, categoryId: d.category_id })),
        });
    }
    if (rights.manageRollAwards && (!exporting || rights.copyRollAwards)) {
        const awards = await handleListRollAwards(p);
        s.rollAwards = section({ enabled: awards.enabled, allowNonLeaders: !!awards.allowNonLeaders }, { awards: awards.awards.map(a => ({ name: a.name, description: a.description, diceResults: a.diceResults, diceNotations: a.diceNotations })) });
    }
    if (rights.manageCriticals) s.criticals = section({}, { rules: (mapRoomToSummary(room).criticals ?? []).map(entry) });
    if (rights.manageBonusPoints) {
        await migrateRoomBonusConfiguration(p.roomId);
        const clean = (items: TransferEntry[]) => items.map(({ roomId: _room, legacyRule, ...value }) => ({ ...value, ...(legacyRule ? { legacyRule: portableLegacyRule(legacyRule as RoomBonusPointRule) } : {}) }));
        s.bonusPoints = section({ enabled: !!room.bonus_points_enabled, maxPointsPerUser: room.bonus_points_max ?? 0, allowExtremeSpend: !!room.bonus_points_allow_extreme_spend }, {
            triggers: clean(await listBonusEntries<RoomBonusPointTrigger>(p.roomId, 'trigger') as unknown as TransferEntry[]),
            conditions: clean(await listBonusEntries<RoomBonusPointTrigger>(p.roomId, 'condition') as unknown as TransferEntry[]),
            effects: clean(await listBonusEntries<RoomBonusPointEffect>(p.roomId, 'effect') as unknown as TransferEntry[]),
        });
    }
    if (rights.manageTalentTrees) {
        const settings = (await query<Array<{ data: unknown }>>('SELECT data FROM room_talent_settings WHERE room_id = ?', [p.roomId]))[0];
        const trees = (await query<Array<{ data: unknown }>>('SELECT data FROM room_talent_trees WHERE room_id = ? ORDER BY id', [p.roomId])).map(row => decode<TalentTree>(row.data));
        const config = settings ? decode<TalentSettings>(settings.data) : { enabled: false, globalEnabled: false, maxGlobal: 0 };
        s.talents = section({ enabled: config.enabled, globalEnabled: config.globalEnabled, maxGlobal: config.maxGlobal }, { trees: trees.map(entry) });
        const ids = new Set(trees.flatMap(talentImageIds));
        for (const id of ids) {
            const image = (await query<Array<{ bytes: Buffer }>>('SELECT bytes FROM room_talent_images WHERE room_id = ? AND id = ?', [p.roomId, id]))[0];
            if (!image) throw new BadRequestError('Talent image unavailable');
            result.images[id] = { type: 'image/webp', data: image.bytes.toString('base64') };
        }
    }
    if (rights.editRoom) s.bag = section({ enabled: !!room.bag_enabled });
    return result;
}

function validateSettings(data: RoomSettingsPackage) {
    for (const [key, s] of Object.entries(data.sections)) {
        for (const [name, value] of Object.entries(s.values)) {
            if (['enabled', 'allowNonLeaders', 'allowExtremeSpend', 'globalEnabled'].includes(name) && typeof value !== 'boolean') throw new BadRequestError('Invalid boolean setting');
            if (name === 'name' && (typeof value !== 'string' || !value.trim() || value.trim().length > 80)) throw new BadRequestError('Room name must contain 1–80 characters');
            if (name === 'name') s.values[name] = String(value).trim();
            if (name === 'sessionInactivityMinutes') s.values[name] = normalizeSessionInactivityMinutes(value as number);
            if (name === 'maxPointsPerUser') s.values[name] = normalizeBonusPointsMax(value as number);
            if (name === 'maxGlobal' && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1000000)) throw new BadRequestError('Invalid global talent limit');
        }
        for (const list of Object.values(s.lists)) {
            const ids = list.filter(item => item.id !== undefined).map(item => item.id);
            if (ids.some(id => typeof id !== 'string' || !id || id.length > 255) || new Set(ids).size !== ids.length) throw new BadRequestError('Invalid or duplicate entry IDs');
        }
        if (key === 'dices') {
            for (const c of s.lists.categories ?? []) { if (typeof c.id !== 'string') throw new BadRequestError('Category ID required'); normalizeDiceCategoryName(c.name as string); }
            for (const d of s.lists.dices ?? []) { d.notation = normalizeDiceNotation(d.notation as string); d.description = normalizeDiceDescription(d.description as string); }
        }
        if (key === 'rollAwards') for (const a of s.lists.awards ?? []) {
            a.name = normalizeRollAwardName(a.name as string); a.description = normalizeRollAwardDescription(a.description as string);
            a.diceResults = normalizeRollAwardResults(a.diceResults as number[]); a.diceNotations = normalizeRollAwardDiceNotations((a.diceNotations ?? a.diceNotation) as string[]);
        }
        if (key === 'criticals') s.lists.rules = normalizeRoomCriticals((s.lists.rules ?? []) as unknown as RoomCriticalRule[]).map(entry);
        if (key === 'bonusPoints') for (const [list, items] of Object.entries(s.lists)) for (const item of items) {
            if (item.legacy !== undefined && typeof item.legacy !== 'boolean') throw new BadRequestError('Invalid legacy effect');
            if (item.legacyRule) {
                if (list !== 'triggers') throw new BadRequestError('Legacy rules belong to triggers');
                item.legacyRule = portableLegacyRule(item.legacyRule as RoomBonusPointRule);
            }
            validateBonusEntry(list === 'effects' ? 'effect' : 'trigger', item as unknown as RoomBonusPointTrigger);
        }
        if (key === 'talents') { const trees = (s.lists.trees ?? []).map(validateTalentTree); validateTalentCatalog(trees); s.lists.trees = trees.map(tree => ({ ...tree, archived: false })); }
    }
}

export async function transferRoomSettings(action: 'exportSettings' | 'previewSettingsImport' | 'importSettings', p: SettingsTransferPayload) {
    if (!p || typeof p.roomId !== 'string' || !p.roomId || typeof p.userId !== 'string' || !p.userId) throw new BadRequestError('Room and user are required');
    return transaction(async () => {
        await query('SELECT id FROM rooms WHERE id = ? FOR UPDATE', [p.roomId]);
        await query('SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? FOR UPDATE', [p.roomId, p.userId]);
        // Lock configuration ranges as well as the room so legacy section writers
        // cannot interleave with a confirmed import. Personal dice remain actor-scoped.
        for (const table of ['room_dices', 'room_dice_categories']) await query(`SELECT id FROM ${table} WHERE room_id = ? AND created_by = ? FOR UPDATE`, [p.roomId, p.userId]);
        for (const table of ['room_roll_awards', 'room_bonus_triggers', 'room_bonus_conditions', 'room_bonus_effects', 'room_talent_trees', 'room_talent_settings']) await query(`SELECT room_id FROM ${table} WHERE room_id = ? FOR UPDATE`, [p.roomId]);
        const current = await exportRoomSettings(p, action === 'exportSettings');
        if (action === 'exportSettings') return { settingsPackage: current };
        let data: RoomSettingsPackage;
        try { data = parseSettingsPackage(JSON.stringify(p.package)); validateSettings(data); } catch (error) { throw new BadRequestError(error instanceof Error ? error.message : 'Invalid settings'); }
        if (p.mode !== 'add' && p.mode !== 'replace') throw new BadRequestError('Choose Add or Replace');
        // Category names are unique per actor. Copies receive visible numbered names.
        const fold = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const names = new Set((p.mode === 'add' ? current.sections.dices?.lists.categories ?? [] : []).map(c => fold(String(c.name))));
        for (const category of data.sections.dices?.lists.categories ?? []) {
            const base = normalizeDiceCategoryName(category.name as string); let name = base, index = 2;
            while (names.has(fold(name))) { const suffix = ` (${index++})`; name = base.slice(0, DICE_CATEGORY_NAME_MAX_LENGTH - suffix.length) + suffix; }
            names.add(fold(name)); category.name = name;
        }
        const preview: SettingsTransferPreview = { token: '', changes: [] };
        for (const [key, selected] of Object.entries(data.sections) as [TransferSectionKey, TransferSection][]) {
            const before = current.sections[key];
            if (!before) throw new ForbiddenError('Missing permission for ' + key);
            const added = Object.entries(selected.lists).flatMap(([list, items]) => items.map(item => ({ ...item, list })));
            const removed = p.mode === 'replace' && key !== 'talents' ? Object.entries(before.lists).flatMap(([list, items]) => items.map(item => ({ ...item, list }))) : [];
            const archived = p.mode === 'replace' && key === 'talents' ? (before.lists.trees ?? []).filter(tree => !tree.archived) : [];
            const values = p.mode === 'replace' ? Object.fromEntries(Object.entries(selected.values).filter(([name, value]) => before.values[name] !== value).map(([name, after]) => [name, { before: before.values[name] ?? null, after }])) : {};
            if (key === 'talents' && (before.lists.trees?.length ?? 0) + (selected.lists.trees?.length ?? 0) > 50) throw new BadRequestError('A room supports at most 50 talent trees, including archives');
            if (key === 'criticals' && p.mode === 'add') normalizeRoomCriticals([...(before.lists.rules ?? []), ...(selected.lists.rules ?? [])] as unknown as RoomCriticalRule[]);
            if (added.length || removed.length || archived.length || Object.keys(values).length) preview.changes.push({ section: key, added, removed, archived, values });
        }
        if (!preview.changes.length) throw new BadRequestError('No settings would change');
        // Token binds the exact selection, mode, actor, target and current saved configuration.
        const fingerprint = { roomId: p.roomId, userId: p.userId, mode: p.mode, data, current: digest(current) };
        if (action === 'previewSettingsImport') {
            // Decode all assets before confirmation, without persisting them.
            for (const image of Object.values(data.images)) await normalizeImage(Buffer.from(image.data, 'base64'), { maxDimension: 1024, quality: 85 });
            const expires = Date.now() + 15 * 60 * 1000;
            preview.token = `${expires}.${sign({ ...fingerprint, expires })}`;
            return { settingsPreview: preview };
        }
        if (typeof p.token !== 'string') throw new BadRequestError('A confirmed preview token is required');
        const [expiry, signature = ''] = p.token.split('.'), expires = Number(expiry);
        const expected = sign({ ...fingerprint, expires });
        if (!Number.isSafeInteger(expires) || expires < Date.now() || !/^[0-9a-f]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new ConflictError('Settings changed or preview expired. Review the import again.');
        await applySettings(p, data, current);
        return { settingsImported: true as const, roomId: p.roomId };
    });
}

async function applySettings(p: SettingsTransferPayload, data: RoomSettingsPackage, current: RoomSettingsPackage) {
    const replace = p.mode === 'replace';
    const scalarColumns: Partial<Record<TransferSectionKey, Record<string, string>>> = {
        room: { name: 'name', sessionInactivityMinutes: 'session_inactivity_minutes' },
        rollAwards: { enabled: 'roll_awards_enabled', allowNonLeaders: 'roll_awards_allow_non_leaders' },
        bonusPoints: { enabled: 'bonus_points_enabled', maxPointsPerUser: 'bonus_points_max', allowExtremeSpend: 'bonus_points_allow_extreme_spend' },
        bag: { enabled: 'bag_enabled' },
    };
    for (const [key, s] of Object.entries(data.sections) as [TransferSectionKey, TransferSection][]) {
        if (replace) for (const [name, value] of Object.entries(s.values)) {
            const column = scalarColumns[key]?.[name];
            if (column) await execute(`UPDATE rooms SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [typeof value === 'boolean' ? Number(value) : value, p.roomId]);
        }
        if (key === 'dices') {
            if (replace) {
                await execute('DELETE FROM room_dices WHERE room_id = ? AND created_by = ?', [p.roomId, p.userId]);
                await execute('DELETE FROM room_dice_categories WHERE room_id = ? AND created_by = ?', [p.roomId, p.userId]);
            }
            const ids = new Map<string, string>();
            let position = replace ? 0 : (current.sections.dices?.lists.categories?.length ?? 0);
            for (const category of s.lists.categories ?? []) {
                const id = randomUUID(); ids.set(category.id as string, id);
                await execute('INSERT INTO room_dice_categories (id, room_id, created_by, name, sort_order, is_default) VALUES (?, ?, ?, ?, ?, ?)', [id, p.roomId, p.userId, normalizeDiceCategoryName(category.name as string), position, position === 0 ? 1 : 0]); position++;
            }
            for (const dice of s.lists.dices ?? []) await execute('INSERT INTO room_dices (id, room_id, created_by, category_id, notation, description) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), p.roomId, p.userId, ids.get(dice.categoryId as string) ?? null, normalizeDiceNotation(dice.notation as string), normalizeDiceDescription(dice.description as string)]);
        }
        if (key === 'rollAwards') {
            if (replace) await execute('DELETE FROM room_roll_awards WHERE room_id = ?', [p.roomId]);
            for (const a of s.lists.awards ?? []) await execute('INSERT INTO room_roll_awards (id, room_id, created_by, name, description, dice_notation, dice_results) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), p.roomId, p.userId, normalizeRollAwardName(a.name as string), normalizeRollAwardDescription(a.description as string), serializeRollAwardDiceNotations(normalizeRollAwardDiceNotations((a.diceNotations ?? a.diceNotation) as string[])), JSON.stringify(normalizeRollAwardResults(a.diceResults as number[]))]);
        }
        if (key === 'criticals') {
            const rules = normalizeRoomCriticals([...(replace ? [] : current.sections.criticals?.lists.rules ?? []), ...(s.lists.rules ?? [])] as unknown as RoomCriticalRule[]);
            await execute('UPDATE rooms SET room_criticals = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(rules), p.roomId]);
        }
        if (key === 'bonusPoints') {
            for (const [list, table] of [['triggers', 'room_bonus_triggers'], ['conditions', 'room_bonus_conditions'], ['effects', 'room_bonus_effects']] as const) {
                if (replace) await execute(`DELETE FROM ${table} WHERE room_id = ?`, [p.roomId]);
                let position = replace ? 0 : (current.sections.bonusPoints?.lists[list]?.length ?? 0);
                for (const item of s.lists[list] ?? []) {
                    const { legacyRule, legacy, ...safe } = item;
                    const id = randomUUID();
                    const definition = list === 'effects'
                        ? { id, roomId: p.roomId, name: String(safe.name).trim(), diceNotation: parseBonusNotation(String(safe.diceNotation)).notation, actions: (safe.actions as RoomBonusPointEffect['actions']).map(action => action.type === 'adjust' ? { type: 'adjust', sign: action.sign, amount: action.amount } : { type: action.type, text: action.text.trim(), ...(action.type === 'notification' ? { severity: action.severity, timeout: action.timeout } : {}) }) }
                        : { id, roomId: p.roomId, name: String(safe.name).trim(), groups: (safe.groups as RoomBonusPointTrigger['groups']).map(group => group.map(condition => ({ diceNotation: parseBonusNotation(condition.diceNotation).notation, operator: condition.operator, threshold: condition.threshold }))) };
                    const compatible = { ...definition, ...(list === 'effects' && legacy === true ? { legacy: true } : {}), ...(list === 'triggers' && legacyRule ? { legacyRule: { ...portableLegacyRule(legacyRule as RoomBonusPointRule), id, roomId: p.roomId } } : {}) };
                    await execute(`INSERT INTO ${table} (id, room_id, position, definition) VALUES (?, ?, ?, ?)`, [id, p.roomId, position++, JSON.stringify(compatible)]);
                }
            }
        }
        if (key === 'talents') await applyTalents(p, s, data, current);
    }
}
async function applyTalents(p: SettingsTransferPayload, s: TransferSection, data: RoomSettingsPackage, current: RoomSettingsPackage) {
    const catalog = (current.sections.talents?.lists.trees ?? []) as unknown as TalentTree[];
    if (p.mode === 'replace') for (const tree of catalog.filter(tree => !tree.archived)) {
        tree.archived = true;
        await execute('UPDATE room_talent_trees SET data = ? WHERE room_id = ? AND id = ?', [JSON.stringify(tree), p.roomId, tree.id]);
    }
    const ids = new Map((s.lists.trees ?? []).map(tree => [tree.id as string, randomUUID()]));
    const images = new Map<string, string>();
    for (const [old, image] of Object.entries(data.images)) {
        const normalized = await normalizeImage(Buffer.from(image.data, 'base64'), { maxDimension: 1024, quality: 85 });
        const id = randomUUID(); images.set(old, id);
        await execute('INSERT INTO room_talent_images (id, room_id, uploader_id, bytes) VALUES (?, ?, ?, ?)', [id, p.roomId, p.userId, normalized.data]);
    }
    for (const raw of s.lists.trees ?? []) {
        const tree = validateTalentTree(raw); tree.id = ids.get(tree.id)!; tree.archived = false;
        if (tree.parentTreeId) tree.parentTreeId = ids.get(tree.parentTreeId)!;
        for (const node of tree.nodes) if (node.linkedTreeId) node.linkedTreeId = ids.get(node.linkedTreeId)!;
        for (const item of [tree, ...tree.nodes, ...tree.subtrees]) if (item.imageId) item.imageId = images.get(item.imageId)!;
        await execute('INSERT INTO room_talent_trees (room_id, id, data, hidden) VALUES (?, ?, ?, ?)', [p.roomId, tree.id, JSON.stringify(tree), '[]']);
    }
    const settings = { ...current.sections.talents!.values, ...(p.mode === 'replace' ? s.values : {}) };
    await execute('INSERT INTO room_talent_settings (room_id, revision, data) VALUES (?, 1, ?) ON DUPLICATE KEY UPDATE revision = revision + 1, data = VALUES(data)', [p.roomId, JSON.stringify(settings)]);
}

/** Preserve legacy raw-face evaluation without carrying source room/user metadata. */
function portableLegacyRule(rule: RoomBonusPointRule) {
    const condition = rule?.condition, adjustment = rule?.spendAdjustment;
    if (!rule || typeof rule.name !== 'string' || !rule.name.trim() || rule.name.length > 100 || typeof rule.diceNotation !== 'string' || !/^d[1-9]\d*$/.test(rule.diceNotation) || !condition || !['moreThan', 'lessThan', 'between'].includes(condition.operator) || !Number.isFinite(condition.threshold) || (condition.operator === 'between' && !Number.isFinite(condition.thresholdMax)) || !adjustment || !['+', '-'].includes(adjustment.sign) || !Number.isSafeInteger(adjustment.amount) || adjustment.amount < 1) throw new BadRequestError('Invalid legacy bonus rule');
    return { name: rule.name, diceNotation: rule.diceNotation, condition: { operator: condition.operator, threshold: condition.threshold, ...(condition.operator === 'between' ? { thresholdMax: condition.thresholdMax } : {}) }, spendAdjustment: { sign: adjustment.sign, amount: adjustment.amount } };
}
