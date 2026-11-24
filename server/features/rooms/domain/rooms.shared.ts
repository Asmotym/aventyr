import type { DatabaseRoom } from '../../../infrastructure/database/records';
import { NotFoundError } from '../../../infrastructure/http/errors';
import { getRoomById } from '../membership/repositories/rooms.table';
export async function requireRoom(roomId: string): Promise<DatabaseRoom> {
    const room = await getRoomById(roomId);
    if (!room) {
        throw new NotFoundError('Room not found');
    }
    return room;
}
