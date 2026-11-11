import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { BagAction, BagFieldDefinition, BagTemplate } from '../../core/types/bag.types';
import { BadRequestError, NotFoundError } from '../../core/errors/http-errors';
import { bagDefinition, bagText, newBagId, object, requireBagRevision } from '../../core/utils/bag-validation';
interface TemplateRow extends RowDataPacket { id: string; owner_id: string; is_public: number; revision: number; data: unknown }
const decode = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T;
export async function listUserTemplates(connection: PoolConnection, roomId: string, userId: string) {
    const [rows] = await connection.query<TemplateRow[]>('SELECT * FROM room_user_bag_templates WHERE room_id = ? AND (owner_id = ? OR (is_public = 1 AND EXISTS (SELECT 1 FROM room_members member WHERE member.room_id = room_user_bag_templates.room_id AND member.user_id = room_user_bag_templates.owner_id))) ORDER BY id', [roomId, userId]);
    const map = (row: TemplateRow): BagTemplate => ({ ...decode<BagFieldDefinition>(row.data), id: row.id, revision: row.revision, ownerId: row.owner_id, public: Boolean(row.is_public) });
    return { templates: rows.filter(row => row.owner_id === userId).map(map), publicTemplates: rows.filter(row => row.owner_id !== userId && row.is_public).map(map) };
}
async function preservePublicUses(connection: PoolConnection, templateId: string, roomId: string) {
    const [uses] = await connection.query<RowDataPacket[]>('SELECT user_id, data FROM room_bag_template_uses WHERE template_id = ?', [templateId]);
    for (const use of uses) await connection.execute('INSERT IGNORE INTO room_user_bag_templates (id, room_id, owner_id, source_id, data) VALUES (?, ?, ?, ?, ?)', [newBagId(), roomId, use.user_id, templateId, JSON.stringify(decode(use.data))]);
}
export async function mutateUserTemplate(connection: PoolConnection, action: BagAction) {
    const { roomId, userId } = action.payload;
    const creating = action.action === 'createBagTemplate';
    const id = creating ? newBagId() : bagText(action.payload.id, 36);
    let row: TemplateRow | undefined;
    if (!creating) {
        const [rows] = await connection.query<TemplateRow[]>('SELECT * FROM room_user_bag_templates WHERE id = ? AND room_id = ? AND owner_id = ? FOR UPDATE', [id, roomId, userId]);
        row = rows[0];
        if (!row) throw new NotFoundError('Custom field not found');
        requireBagRevision(row.revision, action.payload.revision);
    }
    if (action.action === 'deleteBagTemplate') {
        if (row!.is_public) await preservePublicUses(connection, id, roomId);
        await connection.execute('DELETE FROM room_user_bag_templates WHERE id = ?', [id]);
    } else {
        const input = object(action.payload.data), definition = bagDefinition(input);
        if (input.public !== undefined && typeof input.public !== 'boolean') throw new BadRequestError('Public must be boolean');
        const isPublic = input.public === undefined ? Boolean(row?.is_public) : input.public;
        if (row?.is_public && !isPublic) await preservePublicUses(connection, id, roomId);
        if (creating) await connection.execute('INSERT INTO room_user_bag_templates (id, room_id, owner_id, is_public, data) VALUES (?, ?, ?, ?, ?)', [id, roomId, userId, isPublic, JSON.stringify(definition)]);
        else await connection.execute('UPDATE room_user_bag_templates SET is_public = ?, data = ?, revision = revision + 1 WHERE id = ?', [isPublic, JSON.stringify(definition), id]);
    }
    // Each subscriber gets a personalized snapshot; private definitions never enter a room-wide event.
    await connection.execute('UPDATE room_bags SET revision = revision + 1 WHERE room_id = ?', [roomId]);
    const [members] = await connection.query<RowDataPacket[]>('SELECT user_id FROM room_members WHERE room_id = ?', [roomId]);
    return members.map(member => String(member.user_id));
}
export async function validateTemplateCopy(connection: PoolConnection, roomId: string, userId: string, templateId: string, field: BagFieldDefinition, existingCopy = false) {
    const [rows] = await connection.query<TemplateRow[]>('SELECT * FROM room_user_bag_templates WHERE id = ? AND room_id = ? AND (owner_id = ? OR (is_public = 1 AND EXISTS (SELECT 1 FROM room_members member WHERE member.room_id = room_user_bag_templates.room_id AND member.user_id = room_user_bag_templates.owner_id)))', [templateId, roomId, userId]);
    const row = rows[0], definition = row && decode<BagFieldDefinition>(row.data);
    if (!existingCopy && (!definition || definition.name !== field.name || definition.type !== field.type || JSON.stringify(definition.options) !== JSON.stringify(field.options))) throw new BadRequestError('Invalid custom field definition');
    if (row?.is_public && row.owner_id !== userId) await connection.execute('INSERT INTO room_bag_template_uses (template_id, user_id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)', [templateId, userId, JSON.stringify({ name: field.name, type: field.type, options: field.options })]);
}
