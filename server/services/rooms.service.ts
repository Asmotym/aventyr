import type { StartRoomSessionPayload, RoomSessionStartPreparation, RoomSessionStartRequest } from '../core/types/data.types';
import {
    insertRoom,
    listRooms,
    listUserRooms,
    getRoomById,
    getRoomByInviteCode,
    updateRoomGeneralSettings,
    setRoomArchived,
    updateRollAwardsSettings,
    updateBonusPointsSettings,
    updateRoomCriticals as updateRoomCriticalsRecord
} from '../core/database/tables/rooms.table';
import {
    capRoomBonusPointBalances,
    deleteRoomBonusPointRule,
    getRoomBonusPointBalance,
    getRoomBonusPointRule,
    insertRoomBonusPointRule,
    listRoomBonusPointBalances,
    listRoomBonusPointRules,
    setRoomBonusPointBalance,
    updateRoomBonusPointRule
} from '../core/database/tables/room-bonus-points.table';
import { getMessageById, updateMessageBonusPointUsage } from '../core/database/tables/room-messages.table';
import { upsertMember, countMembers, listMembers, getMember, updateMemberNickname, removeMember } from '../core/database/tables/room-members.table';
import { deleteRoomDice, getRoomDice, insertRoomDice, listRoomDices, updateRoomDice as updateRoomDiceRecord } from '../core/database/tables/room-dices.table';
import {
    assignCategoryToUncategorizedDice,
    getNextDiceCategorySortOrder,
    insertRoomDiceCategory,
    listRoomDiceCategories,
    setDefaultRoomDiceCategory
} from '../core/database/tables/room-dice-categories.table';
import {
    deleteRoomRollAward,
    getRoomRollAward,
    insertRoomRollAward,
    listRoomRollAwards,
    updateRoomRollAward
} from '../core/database/tables/room-roll-awards.table';
import { getUser } from '../core/database/tables/users.table';
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError
} from '../core/errors/http-errors';
import type { DatabaseRoomDiceCategory, DatabaseRoomMessage } from '../core/types/database.types';
import type { RoomBonusPointBalance, RoomBonusPointRule, RoomBonusPointSettings, RoomBonusPointSnapshot, RoomCriticalRule, RoomDetails, RoomDice, RoomDiceCategory, RoomMemberDetails, RoomMessage, RoomRollAward, RoomRollAwardsSnapshot, RoomSession, RoomSessionListItem } from '../core/types/data.types';
import { clampTotalToDiceFace, getDiceFaceInfo, isNaturalExtremeRoll } from '../core/utils/bonus-point-dice';
import { createRoomId, generateInviteCode } from '../core/utils/id';
import { hashPassword, verifyPassword } from '../core/utils/password';
import { handleListMessages, handleSendMessage, listRoomDiceRolls as listRoomDiceRollsForRoom } from './rooms/room-messages.service';
import { DEFAULT_DICE_CATEGORY_NAME, NICKNAME_MAX_LENGTH, ROOM_NAME_MAX_LENGTH } from './rooms/rooms.constants';
import {
    normalizeDiceCategoryName,
    normalizeDiceDescription,
    normalizeDiceNotation,
    ensureUniqueBonusPointRules,
    normalizeBonusPointRulePayload,
    normalizeBonusPointsMax,
    normalizeRollAwardDescription,
    normalizeRollAwardDiceNotations,
    normalizeRollAwardName,
    normalizeRollAwardResults,
    normalizeSessionInactivityMinutes,
    normalizeRoomCriticals,
    serializeRollAwardDiceNotations
} from './rooms/rooms.normalizers';
import {
    isDefaultCategoryFlag,
    mapBonusPointBalanceRecord,
    mapBonusPointRuleRecord,
    mapMemberRecord,
    mapMessageRecord,
    mapRollAwardRecord,
    mapRoomDiceCategoryRecord,
    mapRoomDiceRecord,
    mapRoomToSummary
} from './rooms/rooms.mappers';
import { requireRoom } from './rooms/rooms.shared';
import { prepareRoomSessionStart, cancelRoomSessionStart, useRoomRollAward, closeRoomSession, getActiveRoomSession, getRoomSessionRecap, listClosedRoomSessions, recordSessionBonusEvent, startRoomSession } from './rooms/room-sessions.service';

export type RoomsAction =
    | { action: 'list' }
    | { action: 'create'; payload: { name: string; password?: string | null; userId: string } }
    | { action: 'join'; payload: { inviteCode: string; password?: string | null; userId: string } }
    | { action: 'userRooms'; payload: { userId: string } }
    | { action: 'messages'; payload: { roomId: string; userId?: string; limit?: number; since?: string; before?: string } }
    | { action: 'members'; payload: { roomId: string } }
    | { action: 'member'; payload: { roomId: string; userId: string } }
    | { action: 'updateRoom'; payload: { roomId: string; userId: string; name: string; sessionInactivityMinutes?: number } }
    | { action: 'sessionState'; payload: { roomId: string } }
    | { action: 'startSession'; payload: StartRoomSessionPayload }
    | { action: 'prepareSessionStart' | 'requestSessionStart'; payload: { roomId: string; userId: string } }
    | { action: 'cancelSessionStart'; payload: { roomId: string; userId: string; requestId: string } }
    | { action: 'useRollAward'; payload: { roomId: string; userId: string; sessionId: string; assignmentId: string } }
    | { action: 'closeSession'; payload: { roomId: string; userId: string } }
    | { action: 'sessions'; payload: { roomId: string; before?: string; date?: string; limit?: number } }
    | { action: 'sessionRecap'; payload: { roomId: string; sessionId: string } }
    | { action: 'updateCriticals'; payload: { roomId: string; userId: string; criticals: RoomCriticalRule[] } }
    | { action: 'bonusPoints'; payload: { roomId: string } }
    | { action: 'updateBonusPointSettings'; payload: { roomId: string; userId: string; enabled?: boolean; maxPointsPerUser?: number; allowExtremeSpend?: boolean } }
    | { action: 'createBonusPointRule'; payload: { roomId: string; userId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] } }
    | { action: 'updateBonusPointRule'; payload: { roomId: string; userId: string; ruleId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] } }
    | { action: 'deleteBonusPointRule'; payload: { roomId: string; userId: string; ruleId: string } }
    | { action: 'useBonusPointOnRoll'; payload: { roomId: string; userId: string; messageId: string } }
    | { action: 'updateBonusPointBalance'; payload: { roomId: string; userId: string; targetUserId: string; points: number } }
    | { action: 'updateNickname'; payload: { roomId: string; userId: string; nickname?: string | null } }
    | { action: 'leaveRoom'; payload: { roomId: string; userId: string } }
    | { action: 'archiveRoom'; payload: { roomId: string; userId: string } }
    | { action: 'unarchiveRoom'; payload: { roomId: string; userId: string } }
    | { action: 'message'; payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] }; skipBonusPointRules?: boolean } }
    | { action: 'roomDices'; payload: { roomId: string; userId: string } }
    | { action: 'createDice'; payload: { roomId: string; userId: string; notation: string; description?: string | null; categoryId?: string | null } }
    | { action: 'updateDice'; payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null; categoryId?: string | null } }
    | { action: 'deleteDice'; payload: { roomId: string; userId: string; diceId: string } }
    | { action: 'createDiceCategory'; payload: { roomId: string; userId: string; name: string } }
    | { action: 'rollAwards'; payload: { roomId: string } }
    | { action: 'setRollAwardsEnabled'; payload: { roomId: string; userId: string; enabled: boolean } }
    | { action: 'createRollAward'; payload: { roomId: string; userId: string; name: string; description?: string | null; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] } }
    | { action: 'updateRollAward'; payload: { roomId: string; userId: string; awardId: string; name: string; description?: string | null; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] } }
    | { action: 'deleteRollAward'; payload: { roomId: string; userId: string; awardId: string } };

export type RoomsActionResponse =
    | { preparation: RoomSessionStartPreparation }
    | { startRequest: RoomSessionStartRequest }
    | { rooms: RoomDetails[] }
    | { room: RoomDetails; closedSession?: RoomSession }
    | { roomId: string; messages: RoomMessage[] }
    | { roomId: string; members: RoomMemberDetails[] }
    | { member: RoomMemberDetails }
    | { message: RoomMessage; session?: RoomSession; sessionStarted?: boolean; closedSession?: RoomSession }
    | { session: RoomSession | null }
    | { sessions: RoomSessionListItem[]; nextCursor: string | null }
    | { roomId: string; settings: RoomBonusPointSettings; rules: RoomBonusPointRule[]; balances: RoomBonusPointBalance[] }
    | { bonusPointSettings: RoomBonusPointSettings }
    | { bonusPointRule: RoomBonusPointRule }
    | { bonusPointRuleId: string }
    | { bonusPointBalance: RoomBonusPointBalance }
    | { roomId: string; dices: RoomDice[]; categories: RoomDiceCategory[] }
    | { dice: RoomDice }
    | { diceId: string }
    | { roomId: string }
    | { category: RoomDiceCategory }
    | { roomId: string; rollAwards: RoomRollAward[]; enabled: boolean }
    | { rollAwardsEnabled: { roomId: string; enabled: boolean } }
    | { rollAward: RoomRollAward }
    | { rollAwardId: string };

export async function handleRoomsAction(payload: RoomsAction): Promise<RoomsActionResponse> {
    switch (payload.action) {
        case 'list': {
            const rooms = await listRooms();
            return { rooms: rooms.map((room) => mapRoomToSummary(room)) };
        }
        case 'create':
            return { room: await handleCreateRoom(payload.payload) };
        case 'join':
            return { room: await handleJoinRoom(payload.payload) };
        case 'userRooms':
            return { rooms: await handleListUserRooms(payload.payload) };
        case 'messages':
            return { roomId: payload.payload.roomId, messages: await handleListMessages(payload.payload) };
        case 'members':
            return { roomId: payload.payload.roomId, members: await handleListMembers(payload.payload) };
        case 'member':
            return { member: await handleGetMember(payload.payload) };
        case 'updateRoom':
            return { room: await handleUpdateRoom(payload.payload) };
        case 'sessionState':
            return { session: await getActiveRoomSession(payload.payload.roomId) };
        case 'prepareSessionStart':
        case 'requestSessionStart':
            return { preparation: await prepareRoomSessionStart({ ...payload.payload, request: payload.action === 'requestSessionStart' }) };
        case 'cancelSessionStart':
            return { startRequest: await cancelRoomSessionStart(payload.payload) };
        case 'useRollAward':
            return useRoomRollAward(payload.payload);
        case 'startSession':
            return { session: await startRoomSession(payload.payload.roomId, payload.payload.userId, payload.payload) };
        case 'closeSession':
            return { session: await closeRoomSession(payload.payload.roomId, payload.payload.userId) };
        case 'sessions':
            return await listClosedRoomSessions(payload.payload);
        case 'sessionRecap':
            return { session: await getRoomSessionRecap(payload.payload.roomId, payload.payload.sessionId) };
        case 'updateCriticals':
            return { room: await handleUpdateCriticals(payload.payload) };
        case 'bonusPoints':
            return await handleListBonusPoints(payload.payload);
        case 'updateBonusPointSettings':
            return { bonusPointSettings: await handleUpdateBonusPointSettings(payload.payload) };
        case 'createBonusPointRule':
            return { bonusPointRule: await handleCreateBonusPointRule(payload.payload) };
        case 'updateBonusPointRule':
            return { bonusPointRule: await handleUpdateBonusPointRule(payload.payload) };
        case 'deleteBonusPointRule':
            return { bonusPointRuleId: await handleDeleteBonusPointRule(payload.payload) };
        case 'useBonusPointOnRoll':
            return { message: await handleUseBonusPointOnRoll(payload.payload) };
        case 'updateBonusPointBalance':
            return { bonusPointBalance: await handleUpdateBonusPointBalance(payload.payload) };
        case 'updateNickname':
            return { member: await handleUpdateNickname(payload.payload) };
        case 'leaveRoom':
            await handleLeaveRoom(payload.payload);
            return { roomId: payload.payload.roomId };
        case 'archiveRoom':
            return await handleArchiveRoom(payload.payload);
        case 'unarchiveRoom':
            return { room: await handleUnarchiveRoom(payload.payload) };
        case 'message':
            return await handleSendMessage(payload.payload);
        case 'roomDices': {
            const { dices, categories } = await handleListRoomDices(payload.payload);
            return { roomId: payload.payload.roomId, dices, categories };
        }
        case 'createDice':
            return { dice: await handleCreateRoomDice(payload.payload) };
        case 'updateDice':
            return { dice: await handleUpdateRoomDice(payload.payload) };
        case 'deleteDice':
            await handleDeleteRoomDice(payload.payload);
            return { diceId: payload.payload.diceId };
        case 'createDiceCategory':
            return { category: await handleCreateDiceCategory(payload.payload) };
        case 'rollAwards': {
            const { awards, enabled } = await handleListRollAwards(payload.payload);
            return { roomId: payload.payload.roomId, rollAwards: awards, enabled };
        }
        case 'setRollAwardsEnabled': {
            const result = await handleSetRollAwardsEnabled(payload.payload);
            return { rollAwardsEnabled: result };
        }
        case 'createRollAward':
            return { rollAward: await handleCreateRollAward(payload.payload) };
        case 'updateRollAward':
            return { rollAward: await handleUpdateRollAward(payload.payload) };
        case 'deleteRollAward':
            return { rollAwardId: await handleDeleteRollAward(payload.payload) };
        default:
            throw new BadRequestError('Unknown action');
    }
}

export async function listRoomsForUser(userId: string): Promise<RoomDetails[]> {
    return handleListUserRooms({ userId });
}

export async function listRoomMembersForUser(params: { roomId: string; userId: string }): Promise<RoomMemberDetails[]> {
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
    if (!room) throw new NotFoundError('Room not found');
    const memberCount = await countMembers(roomId);
    return mapRoomToSummary({ ...room, member_count: memberCount });
}

export async function getRoomMemberCount(roomId: string): Promise<number> {
    return countMembers(roomId);
}

export async function getRoomBonusPointSnapshot(roomId: string): Promise<RoomBonusPointSnapshot> {
    return handleListBonusPoints({ roomId });
}

export async function getRoomRollAwardsSnapshot(roomId: string): Promise<RoomRollAwardsSnapshot> {
    const result = await handleListRollAwards({ roomId });
    return {
        roomId,
        awards: result.awards,
        enabled: result.enabled
    };
}

async function handleCreateRoom(payload: { name: string; password?: string | null; userId: string }): Promise<RoomDetails> {
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

async function handleJoinRoom(payload: { inviteCode: string; password?: string | null; userId: string }): Promise<RoomDetails> {
    if (!payload.inviteCode?.trim()) throw new BadRequestError('Invite code is required');
    if (!payload.userId) throw new BadRequestError('User id is required');

    const room = await getRoomByInviteCode(payload.inviteCode.trim().toUpperCase());
    if (!room) throw new NotFoundError('Room not found');
    if (room.archived_at && room.created_by !== payload.userId) {
        throw new ConflictError('This room is no longer available');
    }

    if (room.password_hash) {
        const providedPassword = payload.password?.trim();
        if (!providedPassword) throw new BadRequestError('Password required');
        const valid = verifyPassword(providedPassword, room.password_hash, room.password_salt);
        if (!valid) throw new ForbiddenError('Invalid password');
    }

    await upsertMember(room.id, payload.userId);
    const memberCount = await countMembers(room.id);

    return mapRoomToSummary({ ...room, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleListUserRooms(payload: { userId: string }): Promise<RoomDetails[]> {
    if (!payload.userId) {
        throw new BadRequestError('User id is required');
    }

    const rooms = await listUserRooms(payload.userId);
    return rooms.map((room) => mapRoomToSummary(room, { currentUserId: payload.userId }));
}

async function handleLeaveRoom(payload: { roomId: string; userId: string }): Promise<void> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');

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

async function handleArchiveRoom(payload: { roomId: string; userId: string }): Promise<{ room: RoomDetails; closedSession?: RoomSession }> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');

    const room = await requireRoom(payload.roomId);
    if (room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can delete this room');
    }

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

async function handleUnarchiveRoom(payload: { roomId: string; userId: string }): Promise<RoomDetails> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');

    const room = await requireRoom(payload.roomId);
    if (room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can restore this room');
    }

    const updated = await setRoomArchived(payload.roomId, false);
    if (!updated) {
        throw new globalThis.Error('Failed to restore room');
    }

    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleListMembers(payload: { roomId: string }): Promise<RoomMemberDetails[]> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    await requireRoom(payload.roomId);

    const rows = await listMembers(payload.roomId);
    return rows.map(mapMemberRecord);
}

async function handleGetMember(payload: { roomId: string; userId: string }): Promise<RoomMemberDetails> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');

    await requireRoom(payload.roomId);

    let member = await getMember(payload.roomId, payload.userId);
    if (!member) {
        await upsertMember(payload.roomId, payload.userId);
        member = await getMember(payload.roomId, payload.userId);
    }
    if (!member) throw new NotFoundError('Member not found');

    return mapMemberRecord(member);
}

async function handleUpdateRoom(payload: { roomId: string; userId: string; name: string; sessionInactivityMinutes?: number }): Promise<RoomDetails> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');

    const trimmedName = payload.name?.trim();
    if (!trimmedName) {
        throw new BadRequestError('Room name is required');
    }
    if (trimmedName.length > ROOM_NAME_MAX_LENGTH) {
        throw new BadRequestError(`Room name is too long (max ${ROOM_NAME_MAX_LENGTH} characters)`);
    }

    const room = await requireRoom(payload.roomId);
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can rename this room');
    }

    const sessionInactivityMinutes = normalizeSessionInactivityMinutes(
        payload.sessionInactivityMinutes ?? Number(room.session_inactivity_minutes ?? 240)
    );
    const updated = await updateRoomGeneralSettings(payload.roomId, { name: trimmedName, sessionInactivityMinutes });
    if (!updated) throw new globalThis.Error('Failed to update room');

    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleUpdateCriticals(payload: { roomId: string; userId: string; criticals: RoomCriticalRule[] }): Promise<RoomDetails> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');

    const room = await requireRoom(payload.roomId);
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can update criticals');
    }

    const criticals = normalizeRoomCriticals(payload.criticals);
    const updated = await updateRoomCriticalsRecord(
        payload.roomId,
        criticals.length ? JSON.stringify(criticals) : null
    );
    if (!updated) throw new globalThis.Error('Failed to update criticals');

    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleListBonusPoints(payload: { roomId: string }): Promise<{ roomId: string; settings: RoomBonusPointSettings; rules: RoomBonusPointRule[]; balances: RoomBonusPointBalance[] }> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    const room = await requireRoom(payload.roomId);
    const rules = (await listRoomBonusPointRules(room.id)).map(mapBonusPointRuleRecord);
    const balances = (await listRoomBonusPointBalances(room.id)).map(mapBonusPointBalanceRecord);
    return {
        roomId: room.id,
        settings: {
            roomId: room.id,
            enabled: Boolean(room.bonus_points_enabled),
            maxPointsPerUser: normalizeMappedBonusPointsMax(room.bonus_points_max),
            allowExtremeSpend: Boolean(room.bonus_points_allow_extreme_spend)
        },
        rules,
        balances
    };
}

async function handleUpdateBonusPointSettings(payload: { roomId: string; userId: string; enabled?: boolean; maxPointsPerUser?: number; allowExtremeSpend?: boolean }): Promise<RoomBonusPointSettings> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');
    const room = await requireRoom(payload.roomId);
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can update bonus point settings');
    }
    const maxPointsPerUser = typeof payload.maxPointsPerUser === 'undefined'
        ? normalizeMappedBonusPointsMax(room.bonus_points_max)
        : normalizeBonusPointsMax(payload.maxPointsPerUser);
    const updated = await updateBonusPointsSettings(room.id, {
        enabled: payload.enabled,
        maxPointsPerUser,
        allowExtremeSpend: payload.allowExtremeSpend,
    });
    if (!updated) throw new globalThis.Error('Failed to update bonus point settings');
    if (!(await getActiveRoomSession(room.id))) {
        await capRoomBonusPointBalances(room.id, maxPointsPerUser);
    }
    return {
        roomId: room.id,
        enabled: Boolean(updated.bonus_points_enabled),
        maxPointsPerUser: normalizeMappedBonusPointsMax(updated.bonus_points_max),
        allowExtremeSpend: Boolean(updated.bonus_points_allow_extreme_spend)
    };
}

async function handleCreateBonusPointRule(payload: { roomId: string; userId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] }): Promise<RoomBonusPointRule> {
    const room = await ensureCanManageBonusPoints(payload.roomId, payload.userId);
    const normalized = normalizeBonusPointRulePayload(payload);
    const existing = (await listRoomBonusPointRules(room.id)).map(mapBonusPointRuleRecord);
    ensureUniqueBonusPointRules([...existing, {
        id: '',
        roomId: room.id,
        createdBy: payload.userId,
        ...normalized
    }]);
    const created = await insertRoomBonusPointRule({
        room_id: room.id,
        created_by: payload.userId,
        name: normalized.name,
        dice_notation: normalized.diceNotation,
        condition_operator: normalized.condition.operator,
        threshold: normalized.condition.threshold,
        threshold_max: normalized.condition.thresholdMax ?? null,
        adjustment_sign: normalized.spendAdjustment.sign,
        adjustment_amount: normalized.spendAdjustment.amount
    });
    return mapBonusPointRuleRecord(created);
}

async function handleUpdateBonusPointRule(payload: { roomId: string; userId: string; ruleId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] }): Promise<RoomBonusPointRule> {
    const room = await ensureCanManageBonusPoints(payload.roomId, payload.userId);
    if (!payload.ruleId) throw new BadRequestError('Bonus point rule id missing');
    const existingRule = await getRoomBonusPointRule(payload.ruleId);
    if (!existingRule || existingRule.room_id !== room.id) {
        throw new NotFoundError('Bonus point rule not found');
    }
    const normalized = normalizeBonusPointRulePayload(payload);
    const existing = (await listRoomBonusPointRules(room.id))
        .map(mapBonusPointRuleRecord)
        .filter((rule) => rule.id !== payload.ruleId);
    ensureUniqueBonusPointRules([...existing, {
        id: payload.ruleId,
        roomId: room.id,
        createdBy: payload.userId,
        ...normalized
    }]);
    const updated = await updateRoomBonusPointRule({
        id: payload.ruleId,
        name: normalized.name,
        dice_notation: normalized.diceNotation,
        condition_operator: normalized.condition.operator,
        threshold: normalized.condition.threshold,
        threshold_max: normalized.condition.thresholdMax ?? null,
        adjustment_sign: normalized.spendAdjustment.sign,
        adjustment_amount: normalized.spendAdjustment.amount
    });
    return mapBonusPointRuleRecord(updated);
}

async function handleDeleteBonusPointRule(payload: { roomId: string; userId: string; ruleId: string }): Promise<string> {
    const room = await ensureCanManageBonusPoints(payload.roomId, payload.userId);
    if (!payload.ruleId) throw new BadRequestError('Bonus point rule id missing');
    const existing = await getRoomBonusPointRule(payload.ruleId);
    if (!existing || existing.room_id !== room.id) {
        throw new NotFoundError('Bonus point rule not found');
    }
    await deleteRoomBonusPointRule(payload.ruleId);
    return payload.ruleId;
}

async function handleUseBonusPointOnRoll(payload: { roomId: string; userId: string; messageId: string }): Promise<RoomMessage> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');
    if (!payload.messageId) throw new BadRequestError('Message id missing');

    await requireRoom(payload.roomId);
    const activeSession = await getActiveRoomSession(payload.roomId);
    if (!activeSession) {
        throw new ConflictError('Bonus points can only be used during an active session.');
    }
    const sessionBonusConfiguration = activeSession.configuration.bonusPoints;
    if (!sessionBonusConfiguration.enabled) {
        throw new ConflictError('Bonus Points are disabled for this room.');
    }

    const message = await getMessageById(payload.messageId);
    if (!message || message.room_id !== payload.roomId) {
        throw new NotFoundError('Dice message not found');
    }
    if (!message.session_id || message.session_id !== activeSession.id) {
        throw new ConflictError('Bonus points can only modify rolls in the current session.');
    }
    if (message.type !== 'dice') {
        throw new ConflictError('Bonus points can only be used on dice rolls');
    }
    if (message.user_id !== payload.userId) {
        throw new ForbiddenError('You can only use bonus points on your own rolls');
    }

    const balance = await getRoomBonusPointBalance(payload.roomId, payload.userId);
    if (balance < 1) {
        throw new ConflictError('Not enough bonus points available.');
    }

    const diceInfo = getDiceFaceInfo(message.dice_notation);
    if (!diceInfo) {
        throw new globalThis.Error('Unable to determine dice bounds for this roll.');
    }

    const spendRule = sessionBonusConfiguration.rules
        .find((rule) => rule.diceNotation === diceInfo.faceNotation);
    if (!spendRule) {
        throw new ConflictError('No bonus point rule is configured for this dice type.');
    }

    const adjustment = getSignedBonusPointAdjustment(spendRule);
    const currentTotal = Number(message.dice_total ?? 0);
    if (currentTotal === 1 || currentTotal === diceInfo.sides) {
        throw new ConflictError('Bonus points cannot be used when the roll is already at its minimum or maximum.');
    }
    if (!sessionBonusConfiguration.allowExtremeSpend && isNaturalExtremeRoll(message.dice_notation, parseMessageRolls(message.dice_rolls))) {
        throw new ConflictError('Bonus points cannot be used on natural minimum or maximum rolls.');
    }
    const nextTotal = clampTotalToDiceFace(currentTotal + adjustment, diceInfo.sides);
    const previousAdjustment = Number(message.bonus_point_adjustment ?? 0);
    const previousPointsUsed = Number(message.bonus_points_used ?? 0);
    const baseTotal = message.dice_base_total === null || message.dice_base_total === undefined
        ? currentTotal
        : Number(message.dice_base_total);

    await setRoomBonusPointBalance(payload.roomId, payload.userId, balance - 1);

    const updated = await updateMessageBonusPointUsage({
        messageId: payload.messageId,
        diceTotal: nextTotal,
        diceBaseTotal: baseTotal,
        bonusPointAdjustment: previousAdjustment + adjustment,
        bonusPointsUsed: previousPointsUsed + 1,
        bonusPointRuleUsed: JSON.stringify({ id: spendRule.id, name: spendRule.name })
    });

    await recordSessionBonusEvent({
        sessionId: activeSession.id,
        roomId: payload.roomId,
        userId: payload.userId,
        type: 'used',
        amount: 1,
        messageId: payload.messageId
    });

    return mapMessageRecord(updated);
}

async function handleUpdateBonusPointBalance(payload: { roomId: string; userId: string; targetUserId: string; points: number }): Promise<RoomBonusPointBalance> {
    const room = await ensureCanManageBonusPoints(payload.roomId, payload.userId);
    if (!payload.targetUserId) throw new BadRequestError('Target user id missing');
    const member = await getMember(room.id, payload.targetUserId);
    if (!member) {
        throw new NotFoundError('Target user is not a member of this room');
    }

    const maxPoints = normalizeMappedBonusPointsMax(room.bonus_points_max);
    const requestedPoints = normalizeBonusPointBalanceValue(payload.points);
    const nextPoints = Math.min(maxPoints, requestedPoints);
    await setRoomBonusPointBalance(room.id, payload.targetUserId, nextPoints);

    const balances = (await listRoomBonusPointBalances(room.id)).map(mapBonusPointBalanceRecord);
    const updated = balances.find((balance) => balance.userId === payload.targetUserId);
    if (!updated) {
        throw new globalThis.Error('Failed to update bonus point balance');
    }
    return updated;
}

function getSignedBonusPointAdjustment(rule: RoomBonusPointRule): number {
    const amount = Math.abs(rule.spendAdjustment.amount);
    return rule.spendAdjustment.sign === '-' ? -amount : amount;
}

async function ensureCanManageBonusPoints(roomId: string, userId: string) {
    if (!roomId) throw new BadRequestError('Room id missing');
    if (!userId) throw new BadRequestError('User id missing');
    const room = await requireRoom(roomId);
    if (!room.created_by || room.created_by !== userId) {
        throw new ForbiddenError('Only the room creator can manage bonus points');
    }
    return room;
}

function normalizeBonusPointBalanceValue(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new BadRequestError('Bonus point balance must be a whole number.');
    }
    return Math.max(0, parsed);
}

function parseMessageRolls(value: DatabaseRoomMessage['dice_rolls']): number[] {
    if (Array.isArray(value)) {
        return value.map((roll) => Number(roll)).filter((roll) => Number.isFinite(roll));
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? parsed.map((roll) => Number(roll)).filter((roll) => Number.isFinite(roll))
                : [];
        } catch {
            return [];
        }
    }
    return [];
}

function normalizeMappedBonusPointsMax(value?: number | string | null): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.floor(parsed);
}

async function handleUpdateNickname(payload: { roomId: string; userId: string; nickname?: string | null }): Promise<RoomMemberDetails> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');

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
    if (!member) throw new NotFoundError('Member not found');

    const nicknameValue = normalizedNickname.length > 0 ? normalizedNickname : null;
    await updateMemberNickname(payload.roomId, payload.userId, nicknameValue);

    const refreshed = await getMember(payload.roomId, payload.userId);
    if (!refreshed) throw new globalThis.Error('Failed to update nickname');
    return mapMemberRecord(refreshed);
}

async function handleListRoomDices(payload: { roomId: string; userId: string }): Promise<{ dices: RoomDice[]; categories: RoomDiceCategory[] }> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const categoryRecords = await ensureDiceCategoriesForUser(room.id, payload.userId);
    const categories = categoryRecords.map(mapRoomDiceCategoryRecord);
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const rows = await listRoomDices(room.id, payload.userId);
    const dices = rows.map((record) => mapRoomDiceRecord(record, categoryMap));
    return { dices, categories };
}

async function handleCreateRoomDice(payload: { roomId: string; userId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const categoryRecords = await ensureDiceCategoriesForUser(room.id, payload.userId);
    const selectedCategory = selectDiceCategory(categoryRecords, payload.categoryId);
    const notation = normalizeDiceNotation(payload.notation);
    const description = normalizeDiceDescription(payload.description);
    const created = await insertRoomDice({
        room_id: room.id,
        created_by: payload.userId,
        category_id: selectedCategory?.id ?? null,
        notation,
        description,
    });
    const categoryMap = new Map(categoryRecords.map((record) => {
        const mapped = mapRoomDiceCategoryRecord(record);
        return [mapped.id, mapped] as const;
    }));
    return mapRoomDiceRecord(created, categoryMap);
}

async function handleUpdateRoomDice(payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
    if (!payload.diceId) throw new BadRequestError('Dice id missing');
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const existing = await getRoomDice(payload.diceId);
    if (!existing || existing.room_id !== room.id || existing.created_by !== payload.userId) {
        throw new NotFoundError('Dice not found');
    }
    const categoryRecords = await ensureDiceCategoriesForUser(room.id, payload.userId);
    const requestedCategoryId = payload.categoryId ?? existing.category_id ?? undefined;
    const selectedCategory = selectDiceCategory(categoryRecords, requestedCategoryId);
    const notation = normalizeDiceNotation(payload.notation);
    const description = normalizeDiceDescription(payload.description);
    const updated = await updateRoomDiceRecord(payload.diceId, {
        notation,
        description,
        category_id: selectedCategory?.id ?? null
    });
    if (!updated) throw new globalThis.Error('Failed to update dice');
    const categoryMap = new Map(categoryRecords.map((record) => {
        const mapped = mapRoomDiceCategoryRecord(record);
        return [mapped.id, mapped] as const;
    }));
    return mapRoomDiceRecord(updated, categoryMap);
}

async function handleDeleteRoomDice(payload: { roomId: string; userId: string; diceId: string }): Promise<void> {
    if (!payload.diceId) throw new BadRequestError('Dice id missing');
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const existing = await getRoomDice(payload.diceId);
    if (!existing || existing.room_id !== room.id || existing.created_by !== payload.userId) {
        throw new NotFoundError('Dice not found');
    }
    await deleteRoomDice(payload.diceId);
}

async function handleCreateDiceCategory(payload: { roomId: string; userId: string; name: string }): Promise<RoomDiceCategory> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const normalizedName = normalizeDiceCategoryName(payload.name);
    await ensureDiceCategoriesForUser(room.id, payload.userId);
    const sortOrder = await getNextDiceCategorySortOrder(room.id, payload.userId);
    const created = await insertRoomDiceCategory({
        room_id: room.id,
        created_by: payload.userId,
        name: normalizedName,
        sort_order: sortOrder,
        is_default: false
    });
    return mapRoomDiceCategoryRecord(created);
}

async function handleListRollAwards(payload: { roomId: string }): Promise<{ awards: RoomRollAward[]; enabled: boolean }> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    const room = await requireRoom(payload.roomId);
    const rows = await listRoomRollAwards(room.id);
    const awards = rows.map(mapRollAwardRecord);
    return {
        awards,
        enabled: Boolean(room.roll_awards_enabled)
    };
}

async function handleSetRollAwardsEnabled(payload: { roomId: string; userId: string; enabled: boolean }): Promise<{ roomId: string; enabled: boolean }> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');
    const room = await requireRoom(payload.roomId);
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can update this setting');
    }
    const updated = await updateRollAwardsSettings(room.id, { enabled: payload.enabled });
    if (!updated) throw new globalThis.Error('Failed to update setting');
    return {
        roomId: room.id,
        enabled: Boolean(updated.roll_awards_enabled)
    };
}

async function handleCreateRollAward(payload: { roomId: string; userId: string; name: string; description?: string | null; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] }): Promise<RoomRollAward> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');
    const room = await requireRoom(payload.roomId);
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can create awards');
    }
    if (!room.roll_awards_enabled) {
        throw new ConflictError('Enable Roll Awards before creating entries');
    }
    const name = normalizeRollAwardName(payload.name);
    const description = normalizeRollAwardDescription(payload.description);
    const diceNotations = normalizeRollAwardDiceNotations(payload.diceNotations ?? payload.diceNotation);
    const diceResults = normalizeRollAwardResults(payload.diceResults);
    const created = await insertRoomRollAward({
        room_id: room.id,
        created_by: payload.userId,
        name,
        description,
        dice_notation: serializeRollAwardDiceNotations(diceNotations),
        dice_results: JSON.stringify(diceResults)
    });
    return mapRollAwardRecord(created);
}

async function handleUpdateRollAward(payload: { roomId: string; userId: string; awardId: string; name: string; description?: string | null; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] }): Promise<RoomRollAward> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');
    if (!payload.awardId) throw new BadRequestError('Award id missing');
    const room = await requireRoom(payload.roomId);
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can update awards');
    }
    if (!room.roll_awards_enabled) {
        throw new ConflictError('Enable Roll Awards before editing entries');
    }
    const existing = await getRoomRollAward(payload.awardId);
    if (!existing || existing.room_id !== room.id) {
        throw new NotFoundError('Award not found');
    }
    const name = normalizeRollAwardName(payload.name);
    const description = normalizeRollAwardDescription(payload.description);
    const diceNotations = normalizeRollAwardDiceNotations(payload.diceNotations ?? payload.diceNotation);
    const diceResults = normalizeRollAwardResults(payload.diceResults);
    const updated = await updateRoomRollAward({
        id: payload.awardId,
        name,
        description,
        dice_notation: serializeRollAwardDiceNotations(diceNotations),
        dice_results: JSON.stringify(diceResults)
    });
    return mapRollAwardRecord(updated);
}

async function handleDeleteRollAward(payload: { roomId: string; userId: string; awardId: string }): Promise<string> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');
    if (!payload.awardId) throw new BadRequestError('Award id missing');
    const room = await requireRoom(payload.roomId);
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new ForbiddenError('Only the room creator can delete awards');
    }
    const existing = await getRoomRollAward(payload.awardId);
    if (!existing || existing.room_id !== room.id) {
        throw new NotFoundError('Award not found');
    }
    await deleteRoomRollAward(payload.awardId);
    return payload.awardId;
}

export async function listRoomDiceRolls(payload: { roomId: string; limit?: number; since?: string }): Promise<RoomMessage[]> {
    return listRoomDiceRollsForRoom(payload);
}

async function generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateInviteCode().toUpperCase();
        const existing = await getRoomByInviteCode(code);
        if (!existing) return code;
    }
    throw new globalThis.Error('Failed to generate invite code, please retry');
}

async function ensureRoomMembership(roomId: string, userId: string) {
    if (!roomId) throw new BadRequestError('Room id missing');
    if (!userId) throw new BadRequestError('User id missing');

    const room = await requireRoom(roomId);

    const member = await getMember(roomId, userId);
    if (!member) {
        throw new ForbiddenError('You must join this room to manage dice');
    }

    return { room, member };
}

async function ensureDiceCategoriesForUser(roomId: string, userId: string): Promise<DatabaseRoomDiceCategory[]> {
    let categories = await listRoomDiceCategories(roomId, userId);
    if (!categories.length) {
        const created = await insertRoomDiceCategory({
            room_id: roomId,
            created_by: userId,
            name: DEFAULT_DICE_CATEGORY_NAME,
            sort_order: 0,
            is_default: true
        });
        categories = [created];
    }

    const hasDefault = categories.some((category) => isDefaultCategoryFlag(category.is_default));
    if (!hasDefault && categories.length > 0) {
        await setDefaultRoomDiceCategory(categories[0].id, roomId, userId);
        categories = await listRoomDiceCategories(roomId, userId);
    }

    const defaultCategory = categories.find((category) => isDefaultCategoryFlag(category.is_default));
    if (defaultCategory) {
        await assignCategoryToUncategorizedDice(roomId, userId, defaultCategory.id);
    }

    return categories;
}

function selectDiceCategory(categories: DatabaseRoomDiceCategory[], categoryId?: string | null): DatabaseRoomDiceCategory | undefined {
    if (categoryId) {
        const match = categories.find((category) => category.id === categoryId);
        if (!match) {
            throw new NotFoundError('Category not found');
        }
        return match;
    }
    return categories.find((category) => isDefaultCategoryFlag(category.is_default)) ?? categories[0];
}
