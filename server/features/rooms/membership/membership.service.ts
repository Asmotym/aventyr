import type { RoomDetails, RoomMemberDetails, RoomSession } from '../../../../shared/rooms/rooms.types';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../infrastructure/http/errors';
import { createRoomId, generateInviteCode } from '../../../infrastructure/ids/id';
import { getUser } from '../../accounts/repositories/users.table';
import { NICKNAME_MAX_LENGTH, ROOM_NAME_MAX_LENGTH } from '../domain/rooms.constants';
import { mapMemberRecord, mapRoomToSummary } from '../domain/rooms.mappers';
import { normalizeSessionInactivityMinutes } from '../domain/rooms.normalizers';
import { requireRoom } from '../domain/rooms.shared';
import { closeRoomSession, getActiveRoomSession } from '../sessions/room-sessions.service';
import { hashPassword, verifyPassword } from './password';
import { countMembers, getMember, listMembers, removeMember, updateMemberNickname, upsertMember } from './repositories/room-members.table';
import { getRoomById, getRoomByInviteCode, insertRoom, listUserRooms, setRoomArchived, updateRoomGeneralSettings } from './repositories/rooms.table';
import { requireRoomPermission } from './room-access.service';
export async function listRoomsForUser(userId: string): Promise<RoomDetails[]> {
    return handleListUserRooms({ userId });
}
export async function listRoomMembersForUser(params: {
    roomId: string;
    userId: string;
}): Promise<RoomMemberDetails[]> {
    const { roomId, userId } = params;
    if (!roomId) {
        throw new BadRequestError('Room id is required');
    }
    if (!userId) {
        throw new BadRequestError('User id is required');
    }
    await requireRoom(roomId);
    const member = await getMember(roomId, userId);
    if (!member) {
        throw new ForbiddenError('You are not a member of this room');
    }
    const rows = await listMembers(roomId);
    return rows.map(mapMemberRecord);
}
export async function getRoomMemberDetails(roomId: string, userId: string): Promise<RoomMemberDetails | null> {
    const member = await getMember(roomId, userId);
    return member ? mapMemberRecord(member) : null;
}
export async function getRoomDetailsForRealtime(roomId: string): Promise<RoomDetails> {
    const room = await getRoomById(roomId);
    if (!room)
        throw new NotFoundError('Room not found');
    const memberCount = await countMembers(roomId);
    return mapRoomToSummary({ ...room, member_count: memberCount });
}
export async function getRoomMemberCount(roomId: string): Promise<number> {
    return countMembers(roomId);
}
export async function handleCreateRoom(payload: {
    name: string;
    password?: string | null;
    userId: string;
}): Promise<RoomDetails> {
    if (!payload.name?.trim()) {
        throw new BadRequestError('Room name is required');
    }
    if (!payload.userId) {
        throw new BadRequestError('User id is required');
    }
    const creator = await getUser(payload.userId);
    if (!creator) {
        throw new NotFoundError('Unknown user');
    }
    const inviteCode = await generateUniqueInviteCode();
    const roomId = createRoomId();
    const trimmedName = payload.name.trim();
    if (trimmedName.length > ROOM_NAME_MAX_LENGTH) {
        throw new BadRequestError(`Room name is too long (max ${ROOM_NAME_MAX_LENGTH} characters)`);
    }
    const normalizedPassword = payload.password?.trim();
    if (normalizedPassword && normalizedPassword.length < 4) {
        throw new BadRequestError('Password must be at least 4 characters long');
    }
    const passwordData = normalizedPassword ? hashPassword(normalizedPassword) : undefined;
    const room = await insertRoom({
        id: roomId,
        name: trimmedName,
        invite_code: inviteCode,
        password_hash: passwordData?.hash ?? null,
        password_salt: passwordData?.salt ?? null,
        created_by: payload.userId
    });
    await upsertMember(room.id, payload.userId);
    const memberCount = await countMembers(room.id);
    return mapRoomToSummary({ ...room, member_count: memberCount }, { currentUserId: payload.userId });
}
export async function handleJoinRoom(payload: {
    inviteCode: string;
    password?: string | null;
    userId: string;
}): Promise<RoomDetails> {
    if (!payload.inviteCode?.trim())
        throw new BadRequestError('Invite code is required');
    if (!payload.userId)
        throw new BadRequestError('User id is required');
    const room = await getRoomByInviteCode(payload.inviteCode.trim().toUpperCase());
    if (!room)
        throw new NotFoundError('Room not found');
    if (room.archived_at)
        await requireRoomPermission(room.id, payload.userId, 'archiveRoom');
    if (room.password_hash) {
        const providedPassword = payload.password?.trim();
        if (!providedPassword)
            throw new BadRequestError('Password required');
        const valid = verifyPassword(providedPassword, room.password_hash, room.password_salt);
        if (!valid)
            throw new ForbiddenError('Invalid password');
    }
    await upsertMember(room.id, payload.userId);
    const memberCount = await countMembers(room.id);
    return mapRoomToSummary({ ...room, member_count: memberCount }, { currentUserId: payload.userId });
}
export async function handleListUserRooms(payload: {
    userId: string;
}): Promise<RoomDetails[]> {
    if (!payload.userId) {
        throw new BadRequestError('User id is required');
    }
    const rooms = await listUserRooms(payload.userId);
    return rooms.map((room) => mapRoomToSummary(room, { currentUserId: payload.userId })).filter(room => !room.isArchived || room.canArchive);
}
export async function handleLeaveRoom(payload: {
    roomId: string;
    userId: string;
}): Promise<void> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    const room = await requireRoom(payload.roomId);
    if (room.created_by === payload.userId) {
        throw new ConflictError('Room creators cannot leave their own room');
    }
    const member = await getMember(payload.roomId, payload.userId);
    if (!member) {
        throw new ForbiddenError('You are not a member of this room');
    }
    await removeMember(payload.roomId, payload.userId);
}
export async function handleArchiveRoom(payload: {
    roomId: string;
    userId: string;
}): Promise<{
    room: RoomDetails;
    closedSession?: RoomSession;
}> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    await requireRoom(payload.roomId);
    const activeSession = await getActiveRoomSession(payload.roomId);
    const closedSession = activeSession
        ? await closeRoomSession(payload.roomId, payload.userId, 'room_archived')
        : undefined;
    const updated = await setRoomArchived(payload.roomId, true);
    if (!updated) {
        throw new globalThis.Error('Failed to delete room');
    }
    const memberCount = await countMembers(payload.roomId);
    return {
        room: mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId }),
        closedSession
    };
}
export async function handleUnarchiveRoom(payload: {
    roomId: string;
    userId: string;
}): Promise<RoomDetails> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    await requireRoom(payload.roomId);
    const updated = await setRoomArchived(payload.roomId, false);
    if (!updated) {
        throw new globalThis.Error('Failed to restore room');
    }
    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}
export async function handleListMembers(payload: {
    roomId: string;
}): Promise<RoomMemberDetails[]> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    await requireRoom(payload.roomId);
    const rows = await listMembers(payload.roomId);
    return rows.map(mapMemberRecord);
}
export async function handleGetMember(payload: {
    roomId: string;
    userId: string;
}): Promise<RoomMemberDetails> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    await requireRoom(payload.roomId);
    let member = await getMember(payload.roomId, payload.userId);
    if (!member) {
        await upsertMember(payload.roomId, payload.userId);
        member = await getMember(payload.roomId, payload.userId);
    }
    if (!member)
        throw new NotFoundError('Member not found');
    return mapMemberRecord(member);
}
export async function handleUpdateRoom(payload: {
    roomId: string;
    userId: string;
    name: string;
    sessionInactivityMinutes?: number;
}): Promise<RoomDetails> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    const trimmedName = payload.name?.trim();
    if (!trimmedName) {
        throw new BadRequestError('Room name is required');
    }
    if (trimmedName.length > ROOM_NAME_MAX_LENGTH) {
        throw new BadRequestError(`Room name is too long (max ${ROOM_NAME_MAX_LENGTH} characters)`);
    }
    const room = await requireRoom(payload.roomId);
    const sessionInactivityMinutes = normalizeSessionInactivityMinutes(payload.sessionInactivityMinutes ?? Number(room.session_inactivity_minutes ?? 240));
    const updated = await updateRoomGeneralSettings(payload.roomId, { name: trimmedName, sessionInactivityMinutes });
    if (!updated)
        throw new globalThis.Error('Failed to update room');
    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}
export async function handleUpdateNickname(payload: {
    roomId: string;
    userId: string;
    nickname?: string | null;
}): Promise<RoomMemberDetails> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    await requireRoom(payload.roomId);
    const normalizedNickname = payload.nickname?.trim() ?? '';
    if (normalizedNickname.length > NICKNAME_MAX_LENGTH) {
        throw new BadRequestError(`Nickname is too long (max ${NICKNAME_MAX_LENGTH} characters)`);
    }
    let member = await getMember(payload.roomId, payload.userId);
    if (!member) {
        await upsertMember(payload.roomId, payload.userId);
        member = await getMember(payload.roomId, payload.userId);
    }
    if (!member)
        throw new NotFoundError('Member not found');
    const nicknameValue = normalizedNickname.length > 0 ? normalizedNickname : null;
    await updateMemberNickname(payload.roomId, payload.userId, nicknameValue);
    const refreshed = await getMember(payload.roomId, payload.userId);
    if (!refreshed)
        throw new globalThis.Error('Failed to update nickname');
    return mapMemberRecord(refreshed);
}
export async function generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateInviteCode().toUpperCase();
        const existing = await getRoomByInviteCode(code);
        if (!existing)
            return code;
    }
    throw new globalThis.Error('Failed to generate invite code, please retry');
}
