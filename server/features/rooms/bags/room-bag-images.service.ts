import type { RowDataPacket } from 'mysql2/promise';
import type { BagScope } from '../../../../shared/rooms/bag.types';
import { query, withConnectionTransaction } from '../../../infrastructure/database/client';
import { BadRequestError, ForbiddenError } from '../../../infrastructure/http/errors';
import { normalizeImage } from '../../../infrastructure/images/normalize-image';
import { newBagId } from './bag-validation';
import { accessiblePresetImage } from './room-bag-item-templates.service';
import { authorizeBag, bagRows } from './room-bag.service';
export async function normalizeBagImage(bytes: Buffer) {
    return normalizeImage(bytes, { maxDimension: 1024, quality: 85 });
}
export async function storeBagImage(roomId: string, userId: string, scope: BagScope, bytes: Buffer): Promise<string> {
    if (!['team', 'personal'].includes(scope))
        throw new BadRequestError('Invalid bag scope');
    return withConnectionTransaction(async (connection) => {
        await authorizeBag(connection, roomId, userId, true);
        const image = await normalizeBagImage(bytes);
        const id = newBagId();
        await connection.execute('INSERT INTO room_bag_images (id, room_id, owner_id, uploader_id, bytes, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, roomId, scope === 'team' ? '' : userId, userId, image.data, image.info.width, image.info.height]);
        return id;
    });
}
export async function readBagImage(roomId: string, userId: string, id: string): Promise<Buffer> {
    return withConnectionTransaction(async (connection) => {
        const member = await bagRows<RowDataPacket>(connection, 'SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
        if (!member.length)
            throw new ForbiddenError('Room membership required');
        const image = (await bagRows<RowDataPacket>(connection, 'SELECT * FROM room_bag_images WHERE id = ? AND room_id = ?', [id, roomId]))[0];
        if (!image)
            throw new ForbiddenError('Image unavailable');
        const shared = await bagRows<RowDataPacket>(connection, "SELECT id FROM room_messages WHERE room_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(item_snapshot, '$.imageId')) = ? LIMIT 1", [roomId, id]);
        if (!shared.length) {
            await authorizeBag(connection, roomId, userId);
            const visibleReference = await bagRows<RowDataPacket>(connection, "SELECT i.id FROM room_bag_items i JOIN room_bags b ON b.id = i.bag_id WHERE i.image_id = ? AND b.room_id = ? AND (b.owner_id = '' OR EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = b.room_id AND m.user_id = b.owner_id)) LIMIT 1", [id, roomId]);
            if (!visibleReference.length && !await accessiblePresetImage(connection, roomId, userId, id) && !(image.uploader_id === userId && (image.owner_id === '' || image.owner_id === userId)))
                throw new ForbiddenError('Image access denied');
        }
        return image.bytes as Buffer;
    });
}
export async function cleanupBagImages(): Promise<void> {
    await query(`DELETE image FROM room_bag_images image
        LEFT JOIN room_bag_items item ON item.image_id = image.id
        WHERE item.id IS NULL AND image.created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
        AND NOT EXISTS (SELECT 1 FROM room_bag_item_templates t WHERE t.image_id = image.id)
        AND NOT EXISTS (SELECT 1 FROM room_messages m WHERE m.room_id = image.room_id AND JSON_UNQUOTE(JSON_EXTRACT(m.item_snapshot, '$.imageId')) = image.id)`);
}
