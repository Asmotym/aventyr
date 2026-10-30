import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../core/database/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/http-errors';
import type { BagAction, BagItem, BagSnapshot, BagScope, BagTemplate } from '../../core/types/bag.types';
import { bagDefinition, bagItemData, bagText, newBagId, object, requireBagRevision } from '../../core/utils/bag-validation';
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
async function snapshot(connection: PoolConnection, id: string, scope: BagScope): Promise<BagSnapshot> {
    const rows = await bagRows<RecordRow>(connection, 'SELECT revision FROM room_bags WHERE id = ?', [id]);
    const sections = await bagRows<RecordRow>(connection, 'SELECT * FROM room_bag_sections WHERE bag_id = ? ORDER BY id', [id]);
    const templates = await bagRows<RecordRow>(connection, 'SELECT * FROM room_bag_templates WHERE bag_id = ? ORDER BY id', [id]);
    const items = await bagRows<RecordRow>(connection, 'SELECT * FROM room_bag_items WHERE bag_id = ? ORDER BY id', [id]);
    return { id, scope, revision: rows[0]!.revision,
        sections: sections.map(r => ({ ...decode<{ name: string }>(r.data), id: r.id, revision: r.revision })),
        templates: templates.map(r => ({ ...decode<BagTemplate>(r.data), id: r.id, revision: r.revision })),
        items: items.map(mapItem) };
}
function mapItem(row: RecordRow): BagItem { return { ...decode<BagItem>(row.data), id: row.id, revision: row.revision, creatorId: row.creator_id, sectionId: row.section_id, imageId: row.image_id }; }
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
        if (action.action !== 'bag') {
            const isItem = action.action.endsWith('Item');
            const isTemplate = action.action.endsWith('Template');
            const table = isItem ? 'room_bag_items' : isTemplate ? 'room_bag_templates' : 'room_bag_sections';
            const creating = action.action.startsWith('create');
            const id = creating ? newBagId() : bagText(action.payload.id, 36);
            let row: RecordRow | undefined;
            if (!creating) {
                row = (await bagRows<RecordRow>(connection, `SELECT * FROM ${table} WHERE id = ? AND bag_id = ? FOR UPDATE`, [id, bagId]))[0];
                if (!row) throw new NotFoundError('Bag entry not found');
                requireBagRevision(row.revision, action.payload.revision);
            }
            if (action.action === 'giveBagItem') {
                if (scope !== 'personal') throw new ForbiddenError('Only personal items can be given');
                const target = bagText(action.payload.targetUserId, 64);
                if (target === userId) throw new BadRequestError('Choose another member');
                const recipient = await bagRows<RowDataPacket>(connection, 'SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? FOR UPDATE', [roomId, target]);
                if (!recipient.length) throw new BadRequestError('Recipient is no longer a member');
                const targetBag = await getBagId(connection, roomId, target);
                await connection.execute('UPDATE room_bag_items SET bag_id = ?, section_id = NULL, revision = revision + 1 WHERE id = ?', [targetBag, id]);
                if (row!.image_id) await connection.execute('UPDATE room_bag_images SET owner_id = ? WHERE id = ?', [target, row!.image_id]);
                await connection.execute('UPDATE room_bags SET revision = revision + 1 WHERE id = ?', [targetBag]);
                affectedUsers.push(target);
            } else if (action.action.startsWith('delete')) {
                if (!isItem && !isTemplate) await connection.execute('UPDATE room_bag_items SET section_id = NULL, revision = revision + 1 WHERE section_id = ?', [id]);
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
                            const template = (await bagRows<RecordRow>(connection, 'SELECT data FROM room_bag_templates WHERE id = ? AND bag_id = ?', [field.templateId, bagId]))[0];
                            const definition = template && decode<BagTemplate>(template.data);
                            if (!definition || definition.name !== field.name || definition.type !== field.type || JSON.stringify(definition.options) !== JSON.stringify(field.options)) throw new BadRequestError('Invalid custom field definition');
                        }
                    }
                    data = item;
                    if (creating) await connection.execute(`INSERT INTO room_bag_items (id, bag_id, section_id, creator_id, image_id, data) VALUES (?, ?, ?, ?, ?, ?)`, [id, bagId, item.sectionId, userId, item.imageId, JSON.stringify(data)]);
                    else await connection.execute('UPDATE room_bag_items SET section_id = ?, image_id = ?, data = ?, revision = revision + 1 WHERE id = ?', [item.sectionId, item.imageId, JSON.stringify(data), id]);
                } else {
                    data = isTemplate ? bagDefinition(action.payload.data) : { name: bagText(object(action.payload.data).name) };
                    if (creating) await connection.execute(`INSERT INTO ${table} (id, bag_id, data) VALUES (?, ?, ?)`, [id, bagId, JSON.stringify(data)]);
                    else await connection.execute(`UPDATE ${table} SET data = ?, revision = revision + 1 WHERE id = ?`, [JSON.stringify(data), id]);
                }
            }
            await connection.execute('UPDATE room_bags SET revision = revision + 1 WHERE id = ?', [bagId]);
            const bag = await snapshot(connection, bagId, scope);
            await connection.commit();
            return { bag, affectedUsers, selectedId: creating ? id : undefined };
        }
        const bag = await snapshot(connection, bagId, scope);
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
