import { getMember } from '../../core/database/tables/room-members.table';
import { ForbiddenError } from '../../core/errors/http-errors';
import { requireAdmin } from '../roles.service';

// Never enable test-user access on a production backend, even with an admin token.
export async function authorizeDevBagUser(requesterId: string, roomId: string, targetUserId: string): Promise<void> {
    if (process.env.NODE_ENV === 'production' || process.env.ENVIRONMENT !== 'development') throw new ForbiddenError('Room test tools are available only in development');
    if (typeof targetUserId !== 'string' || !targetUserId || targetUserId.length > 255) throw new ForbiddenError('Invalid test user');
    await requireAdmin(requesterId);
    const [requester, target] = await Promise.all([getMember(roomId, requesterId), getMember(roomId, targetUserId)]);
    if (!requester || !target) throw new ForbiddenError('Both users must be current room members');
}
