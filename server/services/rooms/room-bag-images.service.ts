import sharp from 'sharp';
import { pool, query } from '../../core/database/client';
import { authorizeBag, bagRows } from './room-bag.service';
import { newBagId } from '../../core/utils/bag-validation';
import { BadRequestError, ForbiddenError } from '../../core/errors/http-errors';
import type { RowDataPacket } from 'mysql2/promise';
import type { BagScope } from '../../core/types/bag.types';

export async function normalizeBagImage(bytes: Buffer) {
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new BadRequestError('Image must be at most 5 MB');
    try {
        const source = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
        const metadata = await source.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
        return await source.rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    } catch { throw new BadRequestError('A valid static JPEG, PNG or WebP image is required'); }
}
export async function storeBagImage(roomId: string, userId: string, scope: BagScope, bytes: Buffer): Promise<string> {
    if (!['team', 'personal'].includes(scope)) throw new BadRequestError('Invalid bag scope');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await authorizeBag(connection, roomId, userId, true);
        const image = await normalizeBagImage(bytes);
        const id = newBagId();
        await connection.execute('INSERT INTO room_bag_images (id, room_id, owner_id, uploader_id, bytes, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, roomId, scope === 'team' ? '' : userId, userId, image.data, image.info.width, image.info.height]);
        await connection.commit();
        return id;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}
export async function readBagImage(roomId: string, userId: string, id: string): Promise<Buffer> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const member = await bagRows<RowDataPacket>(connection, 'SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
        if (!member.length) throw new ForbiddenError('Room membership required');
        const image = (await bagRows<RowDataPacket>(connection, 'SELECT * FROM room_bag_images WHERE id = ? AND room_id = ?', [id, roomId]))[0];
        if (!image) throw new ForbiddenError('Image unavailable');
        const shared = await bagRows<RowDataPacket>(connection, "SELECT id FROM room_messages WHERE room_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(item_snapshot, '$.imageId')) = ? LIMIT 1", [roomId, id]);
        if (!shared.length) {
            await authorizeBag(connection, roomId, userId);
            const visibleReference = await bagRows<RowDataPacket>(connection, "SELECT i.id FROM room_bag_items i JOIN room_bags b ON b.id = i.bag_id WHERE i.image_id = ? AND b.room_id = ? AND (b.owner_id = '' OR b.owner_id = ?) LIMIT 1", [id, roomId, userId]);
            if (!visibleReference.length && !(image.uploader_id === userId && (image.owner_id === '' || image.owner_id === userId))) throw new ForbiddenError('Image access denied');
        }
        await connection.commit();
        return image.bytes as Buffer;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}
export async function cleanupBagImages(): Promise<void> {
    await query(`DELETE image FROM room_bag_images image
        LEFT JOIN room_bag_items item ON item.image_id = image.id
        WHERE item.id IS NULL AND image.created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
        AND NOT EXISTS (SELECT 1 FROM room_messages m WHERE m.room_id = image.room_id AND JSON_UNQUOTE(JSON_EXTRACT(m.item_snapshot, '$.imageId')) = image.id)`);
}
