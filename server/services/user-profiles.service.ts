import { getRoomBonusPointBalance } from '../core/database/tables/room-bonus-points.table';
import { getMember } from '../core/database/tables/room-members.table';
import { getRoomById } from '../core/database/tables/rooms.table';
import { getUser, updateUser } from '../core/database/tables/users.table';
import { ForbiddenError, NotFoundError } from '../core/errors/http-errors';
import type { PublicUserProfile, UserProfileRollAward } from '../core/types/data.types';
import { normalizeAboutMe } from '../core/utils/user-profile';
import { getActiveRoomSession } from './rooms/room-sessions.service';

export async function getPublicUserProfile(params: {
    targetUserId: string;
    requesterUserId: string;
    roomId?: string;
}): Promise<PublicUserProfile> {
    const user = await getUser(params.targetUserId);
    if (!user) throw new NotFoundError('User not found');

    const profile: PublicUserProfile = {
        username: user.username,
        avatar: user.avatar,
        aboutMe: user.about_me ?? ''
    };
    if (!params.roomId) return profile;

    const room = await getRoomById(params.roomId);
    if (!room || room.archived_at) throw new NotFoundError('Active room not found');

    const [requesterMember, targetMember] = await Promise.all([
        getMember(room.id, params.requesterUserId),
        getMember(room.id, params.targetUserId)
    ]);
    if (!requesterMember || !targetMember) {
        throw new ForbiddenError('Both users must be members of this room');
    }

    const [bonusPoints, rollAwards] = await Promise.all([
        getProfileBonusPoints(room.id, params.targetUserId, Boolean(room.bonus_points_enabled), Number(room.bonus_points_max ?? 0)),
        getProfileRollAwards(
            room.id,
            params.targetUserId,
            Boolean(room.roll_awards_enabled)
        )
    ]);
    if (bonusPoints || rollAwards.length) {
        profile.room = {
            roomId: room.id,
            ...(bonusPoints ? { bonusPoints } : {}),
            ...(rollAwards.length ? { rollAwards } : {})
        };
    }
    return profile;
}

export async function updateAboutMe(userId: string, value: unknown): Promise<PublicUserProfile> {
    const user = await getUser(userId);
    if (!user) throw new NotFoundError('User not found');
    const aboutMe = normalizeAboutMe(value);
    await updateUser(userId, { about_me: aboutMe });
    return {
        username: user.username,
        avatar: user.avatar,
        aboutMe
    };
}

async function getProfileBonusPoints(
    roomId: string,
    userId: string,
    enabled: boolean,
    maximum: number
): Promise<{ current: number; maximum: number } | undefined> {
    if (!enabled) return undefined;
    const current = await getRoomBonusPointBalance(roomId, userId);
    return current > 0 ? { current, maximum: Math.max(0, Math.floor(maximum)) } : undefined;
}

async function getProfileRollAwards(
    roomId: string,
    userId: string,
    enabled: boolean
): Promise<UserProfileRollAward[]> {
    if (!enabled) return [];
    const session = await getActiveRoomSession(roomId);
    if (!session) return [];
    return session.recap.rollAwards.flatMap((result) => {
        const user = result.leaders.find((leader) => leader.userId === userId);
        if (!user) return [];
        return [{
            id: result.award.id,
            name: result.award.name,
            description: result.award.description,
            count: user.count
        }];
    });
}
