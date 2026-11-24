import type { RoomPermission } from '../../../shared/rooms/room-permissions';
import { execute } from '../../infrastructure/database/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../infrastructure/http/errors';
import { handleCreateRollAward, handleDeleteRollAward, handleListRollAwards, handleSetRollAwardsEnabled, handleUpdateRollAward } from './awards/awards.service';
import { handleBagAction } from './bags/room-bag.service';
import { handleListBonusPoints, handleUpdateBonusPointBalance, handleUpdateBonusPointSettings, handleUseBonusPointOnRoll } from './bonus-points/bonus-points.service';
import { mutateBonusEntry } from './bonus-points/repositories/room-bonus-config.table';
import { handleListMessages, handleSendMessage } from './chat/room-messages.service';
import { handleCreateDiceCategory, handleCreateRoomDice, handleDeleteRoomDice, handleListRoomDices, handleUpdateCriticals, handleUpdateRoomDice } from './dice/dice.service';
import { getRoomDiceCategory, updateRoomDiceCategory } from './dice/repositories/room-dice-categories.table';
import { mapRoomDiceCategoryRecord, mapRoomToSummary } from './domain/rooms.mappers';
import { normalizeDiceCategoryName } from './domain/rooms.normalizers';
import { handleArchiveRoom, handleCreateRoom, handleGetMember, handleJoinRoom, handleLeaveRoom, handleListMembers, handleListUserRooms, handleUnarchiveRoom, handleUpdateNickname, handleUpdateRoom } from './membership/membership.service';
import { getMember } from './membership/repositories/room-members.table';
import { listRooms } from './membership/repositories/rooms.table';
import { requireRoomPermission, updateRoomMemberAccess } from './membership/room-access.service';
import type { RoomsAction, RoomsActionResponse } from './rooms.contracts';
import { cancelRoomSessionStart, closeRoomSession, getActiveRoomSession, getRoomSessionRecap, listClosedRoomSessions, prepareRoomSessionStart, startRoomSession, useRoomRollAward } from './sessions/room-sessions.service';
import { handleTalentAction } from './talents/room-talents.service';
export async function handleRoomsAction(payload: RoomsAction, viewerId?: string): Promise<RoomsActionResponse> {
    const permissions: Partial<Record<RoomsAction['action'], RoomPermission>> = {
        updateNickname: 'editNickname', updateRoom: 'editRoom', updateCriticals: 'manageCriticals',
        archiveRoom: 'archiveRoom', unarchiveRoom: 'archiveRoom', createDice: 'manageDice', updateDice: 'manageDice', deleteDice: 'manageDice', createDiceCategory: 'manageDiceCategories', updateDiceCategory: 'manageDiceCategories',
        setRollAwardsEnabled: 'manageRollAwards', createRollAward: 'manageRollAwards', updateRollAward: 'manageRollAwards', deleteRollAward: 'manageRollAwards',
        mutateBonusConfiguration: 'manageBonusPoints', updateBonusPointSettings: 'manageBonusPoints', createBonusPointRule: 'manageBonusPoints', updateBonusPointRule: 'manageBonusPoints', deleteBonusPointRule: 'manageBonusPoints', updateBonusPointBalance: 'manageBonusPoints'
    };
    const permission = permissions[payload.action];
    if (permission && 'payload' in payload && 'roomId' in payload.payload && 'userId' in payload.payload)
        await requireRoomPermission(payload.payload.roomId, payload.payload.userId!, permission);
    if (['createBonusPointRule', 'updateBonusPointRule', 'deleteBonusPointRule'].includes(payload.action))
        throw new ConflictError('Bonus point settings have changed. Reload to edit triggers and effects.');
    switch (payload.action) {
        case 'talents': return handleTalentAction(payload);
        case 'bag':
        case 'setBagEnabled':
        case 'setBagItemFavorite':
        case 'reorderBagSections':
        case 'updateBagUncategorized':
        case 'createBagSection':
        case 'updateBagSection':
        case 'deleteBagSection':
        case 'createBagItemTemplate':
        case 'updateBagItemTemplate':
        case 'deleteBagItemTemplate':
        case 'importBagItemTemplate':
        case 'createBagTemplate':
        case 'updateBagTemplate':
        case 'deleteBagTemplate':
        case 'createBagItem':
        case 'updateBagItem':
        case 'deleteBagItem':
        case 'giveBagItem':
        case 'acceptBagItem':
        case 'rejectBagItem':
        case 'moveBagItem':
        case 'shareBagItem':
            return handleBagAction(payload);
        case 'updateMemberRole':
        case 'updateMemberRights':
        case 'transferRoomOwnership':
            return updateRoomMemberAccess(payload.action, payload.payload);
        case 'list': {
            const rooms = await listRooms();
            return { rooms: rooms.map((room) => mapRoomToSummary(room)) };
        }
        case 'create':
            return { room: await handleCreateRoom(payload.payload) };
        case 'join':
            return { room: await handleJoinRoom(payload.payload) };
        case 'setRoomFavorite': {
            const { roomId, userId, favorite } = payload.payload;
            if (!roomId || !userId || typeof favorite !== 'boolean')
                throw new BadRequestError('Room, user and favorite status are required');
            if (!await getMember(roomId, userId))
                throw new ForbiddenError('You are not a member of this room');
            await execute('UPDATE room_members SET is_favorite = ?, last_seen = last_seen WHERE room_id = ? AND user_id = ?', [favorite, roomId, userId]);
            return { roomId };
        }
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
            return { session: await getRoomSessionRecap(payload.payload.roomId, payload.payload.sessionId, viewerId) };
        case 'updateCriticals':
            return { room: await handleUpdateCriticals(payload.payload) };
        case 'mutateBonusConfiguration': {
            const p = payload.payload;
            if (!['trigger', 'condition', 'effect'].includes(p.kind) || !['save', 'delete', 'reorder'].includes(p.operation))
                throw new BadRequestError('Invalid configuration operation');
            await mutateBonusEntry(p.roomId, p.kind, p.operation, p.entry, p.id, p.ids);
            return handleListBonusPoints(p);
        }
        case 'bonusPoints':
            return await handleListBonusPoints(payload.payload);
        case 'updateBonusPointSettings':
            return { bonusPointSettings: await handleUpdateBonusPointSettings(payload.payload) };
        case 'useBonusPointOnRoll':
            return handleUseBonusPointOnRoll(payload.payload);
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
        case 'updateDiceCategory': {
            const p = payload.payload;
            const category = await getRoomDiceCategory(p.categoryId);
            if (!category || category.room_id !== p.roomId || category.created_by !== p.userId)
                throw new NotFoundError('Dice category not found');
            const updated = await updateRoomDiceCategory(p.categoryId, p.roomId, p.userId, normalizeDiceCategoryName(p.name));
            return { category: mapRoomDiceCategoryRecord(updated!) };
        }
        case 'createDiceCategory':
            return { category: await handleCreateDiceCategory(payload.payload) };
        case 'rollAwards': {
            const { awards, enabled, allowNonLeaders } = await handleListRollAwards(payload.payload);
            return { roomId: payload.payload.roomId, rollAwards: awards, enabled, allowNonLeaders };
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
export { getRoomRollAwardsSnapshot } from './awards/awards.service';
export { getRoomBonusPointSnapshot } from './bonus-points/bonus-points.service';
export { listRoomDiceRolls } from './chat/room-messages.service';
export { getRoomDetailsForRealtime, getRoomMemberCount, getRoomMemberDetails, listRoomMembersForUser, listRoomsForUser } from './membership/membership.service';
export type { RoomsAction, RoomsActionResponse } from './rooms.contracts';
