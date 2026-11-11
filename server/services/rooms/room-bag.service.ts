import { listUserTemplates, mutateUserTemplate, validateTemplateCopy } from './room-bag-templates.service';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../core/database/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/http-errors';
import type { BagAction, BagItem, BagSnapshot, BagScope, BagSection } from '../../core/types/bag.types';
import { bagItemData, bagText, newBagId, object, requireBagRevision } from '../../core/utils/bag-validation';
import { parseRoomOverrides, resolveRoomRights } from '../../core/utils/room-permissions';
import type { RoomRole } from '../../core/utils/room-permissions';
import { insertMessage } from '../../core/database/tables/room-messages.table';
import { ensureSessionForActivity } from './room-sessions.service';
import { mapMessageRecord } from './rooms.mappers';
import { getRoomById } from '../../core/database/tables/rooms.table';
import { mapRoomToSummary } from './rooms.mappers';

interface RecordRow extends RowDataPacket { id: string; revision: number; data: unknown; creator_id: string; section_id: string | null; image_id: string | null }
const decode = <T>(data: unknown): T => (typeof data === 'string' ? JSON.parse(data) : data) as T;
export async function bagRows<T extends RowDataPacket>(connection: PoolConnection, sql: string, values: unknown[] = []): Promise<T[]> {
    return (await connection.query<T[]>(sql, values))[0];
}
// Serialize bag changes with room administration to keep rights and membership checks atomic.
export async function authorizeBag(connection: PoolConnection, roomId: string, userId: string, edit = false, setting = false): Promise<void> {
    if (!roomId || !userId) throw new BadRequestError('Room and actor required');
    const room = (await bagRows<RowDataPacket>(connection, 'SELECT bag_enabled, archived_at FROM rooms WHERE id = ? FOR UPDATE', [roomId]))[0];
    if (!room || room.archived_at) throw new ForbiddenError('Room unavailable');
    const member = (await bagRows<RowDataPacket>(connection, 'SELECT role, permission_overrides FROM room_members WHERE room_id = ? AND user_id = ? FOR UPDATE', [roomId, userId]))[0];
    if (!member) throw new ForbiddenError('Room membership required');
    const rights = resolveRoomRights(member.role as RoomRole, parseRoomOverrides(member.permission_overrides));
    if (setting ? !rights.editRoom : (!room.bag_enabled || !rights.viewBag || (edit && !rights.editBag))) throw new ForbiddenError('Bag access denied');
}
export async function getBagId(connection: PoolConnection, roomId: string, owner: string): Promise<string> {
    await connection.execute('INSERT IGNORE INTO room_bags (id, room_id, owner_id) VALUES (?, ?, ?)', [newBagId(), roomId, owner]);
    return (await bagRows<RowDataPacket>(connection, 'SELECT id FROM room_bags WHERE room_id = ? AND owner_id = ?', [roomId, owner]))[0]!.id as string;
}
async function sectionOrder(connection: PoolConnection, bagId: string): Promise<string[]> {
    const current = (await bagRows<RowDataPacket>(connection, 'SELECT tab_order FROM room_bags WHERE id = ?', [bagId]))[0]!;
    const sections = await bagRows<RowDataPacket>(connection, 'SELECT id FROM room_bag_sections WHERE bag_id = ? ORDER BY id', [bagId]);
    const ids = ['uncategorized', ...sections.map(section => String(section.id))];
    const saved = decode<unknown>(current.tab_order ?? []);
    return [...new Set([...(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && ids.includes(id)) : []), ...ids])];
}
async function snapshot(connection: PoolConnection, id: string, scope: BagScope, userId: string): Promise<BagSnapshot> {
    const rows = await bagRows<RecordRow>(connection, 'SELECT revision, uncategorized FROM room_bags WHERE id = ?', [id]);
    const sections = await bagRows<RecordRow>(connection, 'SELECT * FROM room_bag_sections WHERE bag_id = ? ORDER BY id', [id]);
    const owner = (await bagRows<RowDataPacket>(connection, 'SELECT room_id FROM room_bags WHERE id = ?', [id]))[0]!;
    const templateLists = await listUserTemplates(connection, owner.room_id, userId);
    const items = await bagRows<RecordRow>(connection, 'SELECT * FROM room_bag_items WHERE bag_id = ? ORDER BY id', [id]);
    const order = await sectionOrder(connection, id);
    sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return { id, scope, revision: rows[0]!.revision, tabOrder: order,
        uncategorized: { ...decode<Partial<BagSection>>(rows[0]!.uncategorized ?? {}), id: 'uncategorized', name: decode<Partial<BagSection>>(rows[0]!.uncategorized ?? {}).name ?? '', revision: rows[0]!.revision },
        sections: sections.map(r => ({ ...decode<{ name: string }>(r.data), id: r.id, revision: r.revision })),
        ...templateLists,
        items: items.map(mapItem) };
}
function sectionData(value: unknown, previous: Partial<BagSection> = {}) {
    const input = object(value);
    const color = input.color === undefined ? previous.color ?? null : input.color;
    const icon = input.icon === undefined ? previous.icon ?? null : input.icon;
    if (color !== null && (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) throw new BadRequestError('Invalid section color');
    if (icon !== null && (typeof icon !== 'string' || icon.length > 100 || !/^mdi-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(icon))) throw new BadRequestError('Invalid section icon');
    return { name: bagText(input.name), color, icon };
}
function itemTime(value: unknown): number { return value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value.replace(' ', 'T') + 'Z') : 0; }
function mapItem(row: RecordRow): BagItem { return { favorite: false, ...decode<BagItem>(row.data), id: row.id, revision: row.revision, creatorId: row.creator_id, sectionId: row.section_id, imageId: row.image_id, createdAt: itemTime(row.created_at), updatedAt: itemTime(row.updated_at) }; }
export async function handleBagAction(action: BagAction) {
    const { roomId, userId } = action.payload;
    const scope = action.payload.scope ?? 'team';
    if (!['team', 'personal'].includes(scope)) throw new BadRequestError('Invalid bag scope');
    if (action.action === 'shareBagItem') return shareItem(action);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await authorizeBag(connection, roomId, userId, !['bag', 'setBagEnabled'].includes(action.action), action.action === 'setBagEnabled');
        if (action.action === 'setBagEnabled') {
            if (typeof action.payload.enabled !== 'boolean') throw new BadRequestError('Enabled must be boolean');
            await connection.execute('UPDATE rooms SET bag_enabled = ? WHERE id = ?', [action.payload.enabled ? 1 : 0, roomId]);
            await connection.commit();
            return { room: mapRoomToSummary((await getRoomById(roomId))!) };
        }
        const bagId = await getBagId(connection, roomId, scope === 'team' ? '' : userId);
        const affectedUsers: string[] = scope === 'personal' ? [userId] : [];
        if (['createBagTemplate', 'updateBagTemplate', 'deleteBagTemplate'].includes(action.action)) {
            const affectedUsers = await mutateUserTemplate(connection, action);
            const bag = await snapshot(connection, bagId, scope, userId);
            await connection.commit();
            return { bag, affectedUsers };
        }
        if (action.action === 'reorderBagSections') {
            const current = (await bagRows<RowDataPacket>(connection, 'SELECT revision FROM room_bags WHERE id = ? FOR UPDATE', [bagId]))[0]!;
            requireBagRevision(current.revision, action.payload.revision);
            const order = action.payload.sectionIds, existing = await sectionOrder(connection, bagId);
            if (!Array.isArray(order) || order.length !== existing.length || new Set(order).size !== existing.length || order.some(id => typeof id !== 'string' || !existing.includes(id))) throw new BadRequestError('Tab order must include every tab exactly once');
            await connection.execute('UPDATE room_bags SET tab_order = ?, revision = revision + 1 WHERE id = ?', [JSON.stringify(order), bagId]);
            const bag = await snapshot(connection, bagId, scope, userId);
            await connection.commit();
            return { bag, affectedUsers };
        }
        if (action.action === 'updateBagUncategorized') {
            const current = (await bagRows<RecordRow>(connection, 'SELECT revision, uncategorized FROM room_bags WHERE id = ? FOR UPDATE', [bagId]))[0]!;
            requireBagRevision(current.revision, action.payload.revision);
            const data = sectionData(action.payload.data, decode<Partial<BagSection>>(current.uncategorized ?? {}));
            await connection.execute('UPDATE room_bags SET uncategorized = ?, revision = revision + 1 WHERE id = ?', [JSON.stringify(data), bagId]);
            const bag = await snapshot(connection, bagId, scope, userId);
            await connection.commit();
            return { bag, affectedUsers };
        }
        if (action.action !== 'bag') {
            const isItem = action.action.endsWith('Item') || action.action === 'setBagItemFavorite';
            const table = isItem ? 'room_bag_items' : 'room_bag_sections';
            const creating = action.action.startsWith('create');
            const previousOrder = !isItem ? await sectionOrder(connection, bagId) : null;
            const id = creating ? newBagId() : bagText(action.payload.id, 36);
            let row: RecordRow | undefined;
            if (!creating) {
                row = (await bagRows<RecordRow>(connection, `SELECT * FROM ${table} WHERE id = ? AND bag_id = ? FOR UPDATE`, [id, bagId]))[0];
                if (!row) throw new NotFoundError('Bag entry not found');
                requireBagRevision(row.revision, action.payload.revision);
            }
            if (action.action === 'setBagItemFavorite') {
                if (typeof action.payload.favorite !== 'boolean') throw new BadRequestError('Favorite must be boolean');
                const data = { ...decode<BagItem>(row!.data), favorite: action.payload.favorite };
                await connection.execute('UPDATE room_bag_items SET data = ?, revision = revision + 1 WHERE id = ?', [JSON.stringify(data), id]);
            } else if (action.action === 'moveBagItem') {
                const targetScope = action.payload.destinationScope;
                if (targetScope !== 'team' && targetScope !== 'personal') throw new BadRequestError('Invalid destination bag');
                const targetSection = action.payload.destinationSectionId === null ? null : bagText(action.payload.destinationSectionId, 36);
                const targetBag = await getBagId(connection, roomId, targetScope === 'team' ? '' : userId);
                if (targetSection && !(await bagRows<RowDataPacket>(connection, 'SELECT id FROM room_bag_sections WHERE id = ? AND bag_id = ?', [targetSection, targetBag])).length) throw new BadRequestError('Section does not belong to destination bag');
                if (targetBag === bagId && targetSection === row!.section_id) throw new BadRequestError('Item is already in this tab');
                await connection.execute('UPDATE room_bag_items SET bag_id = ?, section_id = ?, updated_at = CURRENT_TIMESTAMP(3), revision = revision + 1 WHERE id = ?', [targetBag, targetSection, id]);
                if (targetBag !== bagId) {
                    if (row!.image_id) await connection.execute('UPDATE room_bag_images SET owner_id = ? WHERE id = ?', [targetScope === 'team' ? '' : userId, row!.image_id]);
                    await connection.execute('UPDATE room_bags SET revision = revision + 1 WHERE id = ?', [targetBag]);
                }
            } else if (action.action === 'giveBagItem') {
                if (scope !== 'personal') throw new ForbiddenError('Only personal items can be given');
                const target = bagText(action.payload.targetUserId, 64);
                if (target === userId) throw new BadRequestError('Choose another member');
                const recipient = await bagRows<RowDataPacket>(connection, 'SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? FOR UPDATE', [roomId, target]);
                if (!recipient.length) throw new BadRequestError('Recipient is no longer a member');
                const targetBag = await getBagId(connection, roomId, target);
                await connection.execute('UPDATE room_bag_items SET bag_id = ?, section_id = NULL, updated_at = CURRENT_TIMESTAMP(3), revision = revision + 1 WHERE id = ?', [targetBag, id]);
                if (row!.image_id) await connection.execute('UPDATE room_bag_images SET owner_id = ? WHERE id = ?', [target, row!.image_id]);
                await connection.execute('UPDATE room_bags SET revision = revision + 1 WHERE id = ?', [targetBag]);
                for (const field of mapItem(row!).fields) if (field.templateId) await validateTemplateCopy(connection, roomId, target, field.templateId, field, true);
                affectedUsers.push(target);
            } else if (action.action.startsWith('delete')) {
                if (!isItem) await connection.execute('UPDATE room_bag_items SET section_id = NULL, revision = revision + 1 WHERE section_id = ?', [id]);
                await connection.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
            } else {
                let data: unknown;
                if (isItem) {
                    const item = bagItemData(action.payload.data);
                    if (item.sectionId && !(await bagRows<RowDataPacket>(connection, 'SELECT id FROM room_bag_sections WHERE id = ? AND bag_id = ?', [item.sectionId, bagId])).length) throw new BadRequestError('Section does not belong to this bag');
                    if (item.imageId && item.imageId !== row?.image_id && !(await bagRows<RowDataPacket>(connection, 'SELECT id FROM room_bag_images WHERE id = ? AND room_id = ? AND owner_id = ? AND uploader_id = ?', [item.imageId, roomId, scope === 'team' ? '' : userId, userId])).length) throw new ForbiddenError('Image access denied');
                    // Template names/types cannot be forged. Existing copied fields remain independent of template edits.
                    const previous = row ? mapItem(row).fields : [];
                    for (const field of item.fields) if (field.templateId) {
                        const existing = previous.find(f => f.templateId === field.templateId && f.name === field.name && f.type === field.type && JSON.stringify(f.options) === JSON.stringify(field.options));
                        if (!existing) {
                            await validateTemplateCopy(connection, roomId, userId, field.templateId, field);
                        } else await validateTemplateCopy(connection, roomId, userId, field.templateId, field, true);
                    }
                    data = { ...item, favorite: row ? decode<BagItem>(row.data).favorite === true : false };
                    if (creating) await connection.execute(`INSERT INTO room_bag_items (id, bag_id, section_id, creator_id, image_id, data) VALUES (?, ?, ?, ?, ?, ?)`, [id, bagId, item.sectionId, userId, item.imageId, JSON.stringify(data)]);
                    else await connection.execute('UPDATE room_bag_items SET section_id = ?, image_id = ?, data = ?, updated_at = CURRENT_TIMESTAMP(3), revision = revision + 1 WHERE id = ?', [item.sectionId, item.imageId, JSON.stringify(data), id]);
                } else {
                    data = sectionData(action.payload.data, row ? decode<Partial<BagSection>>(row.data) : {});
                    if (creating) await connection.execute(`INSERT INTO ${table} (id, bag_id, data) VALUES (?, ?, ?)`, [id, bagId, JSON.stringify(data)]);
                    else await connection.execute(`UPDATE ${table} SET data = ?, revision = revision + 1 WHERE id = ?`, [JSON.stringify(data), id]);
                }
            }
            if (previousOrder && (creating || action.action === 'deleteBagSection')) await connection.execute('UPDATE room_bags SET tab_order = ? WHERE id = ?', [JSON.stringify(creating ? [...previousOrder, id] : previousOrder.filter(tab => tab !== id)), bagId]);
            await connection.execute('UPDATE room_bags SET revision = revision + 1 WHERE id = ?', [bagId]);
            const bag = await snapshot(connection, bagId, scope, userId);
            await connection.commit();
            return { bag, affectedUsers, selectedId: creating ? id : undefined };
        }
        const bag = await snapshot(connection, bagId, scope, userId);
        await connection.commit();
        return { bag };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}
async function shareItem(action: BagAction) {
    const { roomId, userId, scope = 'team', id } = action.payload;
    // Validate under the session's room lock before any session activity is committed.
    let item: BagItem;
    const lifecycle = await ensureSessionForActivity(roomId, userId, async (connection, session) => {
        return insertMessage({ room_id: roomId, user_id: userId, type: 'item_share', content: item.id, item_snapshot: item, session_id: session.id }, connection);
    }, async connection => {
        await authorizeBag(connection, roomId, userId);
        const bagId = await getBagId(connection, roomId, scope === 'personal' ? userId : '');
        const row = (await bagRows<RecordRow>(connection, 'SELECT * FROM room_bag_items WHERE id = ? AND bag_id = ? FOR UPDATE', [id, bagId]))[0];
        if (!row) throw new NotFoundError('Item not found');
        item = mapItem(row);
    });
    if (!lifecycle.value) throw new Error('Item share was not saved');
    return { message: mapMessageRecord(lifecycle.value), session: lifecycle.session, sessionStarted: lifecycle.started, closedSession: lifecycle.closed };
}
