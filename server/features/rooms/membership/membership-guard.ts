import { BadRequestError, ForbiddenError } from '../../../infrastructure/http/errors';
import { requireRoom } from '../domain/rooms.shared';
import { getMember } from './repositories/room-members.table';
export async function ensureRoomMembership(roomId: string, userId: string) {
    if (!roomId)
        throw new BadRequestError('Room id missing');
    if (!userId)
        throw new BadRequestError('User id missing');
    const room = await requireRoom(roomId);
    const member = await getMember(roomId, userId);
    if (!member) {
        throw new ForbiddenError('You must join this room to manage dice');
    }
    return { room, member };
}
