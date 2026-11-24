import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { BagAction, BagItem, BagItemTemplate, BagItemTemplateCopy, BagItemTemplateData } from '../../../../shared/rooms/bag.types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../infrastructure/http/errors';
import { bagItemData, bagText, newBagId, object, requireBagRevision } from './bag-validation';
interface PresetRow extends RowDataPacket {
    id: string;
    owner_id: string;
    is_public: number;
    revision: number;
    image_id: string | null;
    data: unknown;
}
const decode = (row: PresetRow): BagItemTemplate => ({ ...(typeof row.data === 'string' ? JSON.parse(row.data) : row.data), id: row.id, ownerId: row.owner_id, public: Boolean(row.is_public), revision: row.revision, imageId: row.image_id });
const accessible = `(owner_id = ? OR (is_public = 1 AND EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = room_bag_item_templates.room_id AND m.user_id = owner_id)))`;
export async function listItemTemplates(connection: PoolConnection, roomId: string, userId: string) {
    const [rows] = await connection.query<PresetRow[]>(`SELECT * FROM room_bag_item_templates WHERE room_id = ? AND ${accessible} ORDER BY id`, [roomId, userId]);
    return { itemTemplates: rows.filter(r => r.owner_id === userId).map(decode), publicItemTemplates: rows.filter(r => r.owner_id !== userId).map(decode) };
}
export async function accessiblePresetImage(connection: PoolConnection, roomId: string, userId: string, imageId: string): Promise<boolean> {
    const [rows] = await connection.query<PresetRow[]>(`SELECT id FROM room_bag_item_templates WHERE room_id = ? AND image_id = ? AND ${accessible} LIMIT 1`, [roomId, imageId, userId]);
    return rows.length > 0;
}
export async function mutateItemTemplate(connection: PoolConnection, action: BagAction) {
    const { roomId, userId } = action.payload;
    const creating = action.action === 'createBagItemTemplate', importing = action.action === 'importBagItemTemplate';
    let source: BagItemTemplate | undefined;
    if (!creating) {
        const [rows] = await connection.query<PresetRow[]>(`SELECT * FROM room_bag_item_templates WHERE id = ? AND room_id = ? AND ${importing ? accessible : 'owner_id = ?'} FOR UPDATE`, [bagText(action.payload.id, 36), roomId, userId]);
        if (!rows[0])
            throw new NotFoundError('Item template not found');
        source = decode(rows[0]);
        requireBagRevision(source.revision, action.payload.revision);
    }
    const id = creating || importing ? newBagId() : source!.id;
    if (action.action === 'deleteBagItemTemplate')
        await connection.execute('DELETE FROM room_bag_item_templates WHERE id = ?', [id]);
    else {
        const input = importing ? source! : object(action.payload.data);
        if (input.public !== undefined && typeof input.public !== 'boolean')
            throw new BadRequestError('Public must be boolean');
        if (input.fields !== undefined && !Array.isArray(input.fields))
            throw new BadRequestError('Invalid template fields');
        const parsed = bagItemData({ ...input, sectionId: null, itemTemplate: undefined, fields: (Array.isArray(input.fields) ? input.fields : []).map(field => ({ ...object(field), templateId: undefined, itemTemplateField: undefined })) });
        const names = parsed.fields.map(f => f.name.trim().toLowerCase());
        if (new Set(names).size !== names.length)
            throw new BadRequestError('Template field names must be unique');
        const { name, description, displayDescription, rarity, imageId, icon, fields } = parsed;
        const data: BagItemTemplateData = { name, description, displayDescription, rarity, imageId, icon, fields };
        if (imageId && imageId !== source?.imageId && !await accessiblePresetImage(connection, roomId, userId, imageId)) {
            const [images] = await connection.query<RowDataPacket[]>('SELECT id FROM room_bag_images WHERE id = ? AND room_id = ? AND uploader_id = ?', [imageId, roomId, userId]);
            if (!images.length)
                throw new ForbiddenError('Image access denied');
        }
        const isPublic = importing ? false : input.public === true;
        if (creating || importing)
            await connection.execute('INSERT INTO room_bag_item_templates (id, room_id, owner_id, is_public, image_id, data) VALUES (?, ?, ?, ?, ?, ?)', [id, roomId, userId, isPublic, imageId, JSON.stringify(data)]);
        else
            await connection.execute('UPDATE room_bag_item_templates SET is_public = ?, image_id = ?, data = ?, revision = revision + 1 WHERE id = ?', [isPublic, imageId, JSON.stringify(data), id]);
    }
    await connection.execute('UPDATE room_bags SET revision = revision + 1 WHERE room_id = ?', [roomId]);
    const [members] = await connection.query<RowDataPacket[]>('SELECT user_id FROM room_members WHERE room_id = ?', [roomId]);
    return { selectedId: id, affectedUsers: members.map(m => String(m.user_id)) };
}
const copySignature = (copy?: BagItemTemplateCopy) => copy ? JSON.stringify({ id: copy.id, name: copy.name, fields: copy.fields.map(({ name, type, options }) => ({ name, type, options })) }) : '';
export async function validateItemTemplateCopy(connection: PoolConnection, roomId: string, userId: string, item: Pick<BagItem, 'itemTemplate'>, previous?: BagItem) {
    const copy = item.itemTemplate;
    if (!copy || copySignature(copy) === copySignature(previous?.itemTemplate))
        return;
    const [rows] = await connection.query<PresetRow[]>(`SELECT * FROM room_bag_item_templates WHERE id = ? AND room_id = ? AND ${accessible}`, [copy.id, roomId, userId]);
    const source = rows[0] && decode(rows[0]);
    const definitions = source?.fields.map(({ name, type, options }) => ({ name, type, options }));
    if (!source || copy.name !== source.name || JSON.stringify(copy.fields) !== JSON.stringify(definitions))
        throw new BadRequestError('Item template changed or is unavailable. Select it again.');
}
