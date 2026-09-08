import type { RoomsAction, RoomsActionResponse } from '../services/rooms.service';
import {
    getRoomBonusPointSnapshot,
    getRoomDetailsForRealtime,
    getRoomMemberCount,
    getRoomMemberDetails,
    getRoomRollAwardsSnapshot
} from '../services/rooms.service';
import { getActiveRoomSession } from '../services/rooms/room-sessions.service';
import type { RoomDetails, RoomMemberDetails, RoomMessage } from '../core/types/data.types';
import { listRoomIdsForMember } from '../core/database/tables/room-members.table';
import { createLogger } from '../core/utils/logger';
import {
    publishBonusPointSnapshot,
    publishRollAwardsSnapshot,
    publishRoomEvent,
    toRealtimeRoom
} from './room-realtime.publisher';
import { roomRealtimeHub } from './room-realtime.server';

const logger = createLogger('RoomRealtimeEvents');

export async function publishRoomsActionResult(
    action: RoomsAction,
    response: RoomsActionResponse
): Promise<void> {
    try {
        await publishAction(action, response);
    } catch (error) {
        logger.warn('Failed to publish committed room action', {
            action: action.action,
            roomId: getRoomId(action),
            error: error instanceof Error ? error.message : 'UnknownError'
        });
    }
}

export async function publishUserProfileUpdate(userId: string): Promise<void> {
    try {
        const roomIds = await listRoomIdsForMember(userId);
        await Promise.all(roomIds.map(async (roomId) => {
            const member = await getRoomMemberDetails(roomId, userId);
            if (member) publishRoomEvent(roomId, { type: 'member.updated', member });
        }));
    } catch (error) {
        logger.warn('Failed to publish user profile update', {
            userId,
            error: error instanceof Error ? error.message : 'UnknownError'
        });
    }
}

async function publishAction(action: RoomsAction, response: RoomsActionResponse): Promise<void> {
    switch (action.action) {
        case 'create':
            return;
        case 'join': {
            const room = readRoom(response);
            const member = await getRoomMemberDetails(room.id, action.payload.userId);
            publishRoomEvent(room.id, { type: 'room.updated', room: toRealtimeRoom(room) });
            if (member) publishRoomEvent(room.id, { type: 'member.updated', member });
            return;
        }
        case 'member':
        case 'updateNickname': {
            const member = readMember(response);
            publishRoomEvent(action.payload.roomId, { type: 'member.updated', member });
            return;
        }
        case 'leaveRoom': {
            const memberCount = await getRoomMemberCount(action.payload.roomId);
            publishRoomEvent(action.payload.roomId, {
                type: 'member.removed',
                userId: action.payload.userId,
                memberCount
            });
            roomRealtimeHub.closeMember(action.payload.roomId, action.payload.userId);
            return;
        }
        case 'archiveRoom': {
            const room = readRoom(response);
            if ('closedSession' in response && response.closedSession) {
                publishRoomEvent(room.id, { type: 'session.closed', session: response.closedSession });
            }
            publishRoomEvent(room.id, {
                type: 'room.archived',
                archivedAt: room.archivedAt ?? new Date().toISOString()
            });
            roomRealtimeHub.closeRoom(room.id);
            return;
        }
        case 'unarchiveRoom':
        case 'updateRoom':
        case 'updateCriticals': {
            const room = readRoom(response);
            publishRoomEvent(room.id, { type: 'room.updated', room: toRealtimeRoom(room) });
            return;
        }
        case 'message': {
            const message = readMessage(response);
            if ('closedSession' in response && response.closedSession) {
                publishRoomEvent(message.roomId, { type: 'session.closed', session: response.closedSession });
            }
            if ('sessionStarted' in response && response.sessionStarted && 'session' in response && response.session) {
                publishRoomEvent(message.roomId, { type: 'session.started', session: response.session });
            }
            publishRoomEvent(message.roomId, { type: 'message.created', message });
            const session = await getActiveRoomSession(message.roomId);
            if (session) publishRoomEvent(message.roomId, { type: 'session.updated', session });
            if (message.type === 'dice') {
                publishBonusPointSnapshot(await getRoomBonusPointSnapshot(message.roomId));
            }
            return;
        }
        case 'prepareSessionStart':
        case 'requestSessionStart':
            if ('preparation' in response && response.preparation.closedSession) {
                publishRoomEvent(action.payload.roomId, { type: 'session.closed', session: response.preparation.closedSession });
            }
            if (action.action === 'requestSessionStart' && 'preparation' in response && response.preparation.request?.status === 'pending') {
                publishRoomEvent(action.payload.roomId, { type: 'session.start_requested', request: response.preparation.request });
            }
            return;
        case 'cancelSessionStart':
            if ('startRequest' in response) publishRoomEvent(action.payload.roomId, { type: 'session.start_cancelled', request: response.startRequest });
            return;
        case 'useRollAward':
            if ('message' in response && response.session) {
                publishRoomEvent(action.payload.roomId, { type: 'message.created', message: response.message });
                publishRoomEvent(action.payload.roomId, { type: 'session.updated', session: response.session });
            }
            return;
        case 'startSession': {
            if ('session' in response && response.session) {
                publishRoomEvent(action.payload.roomId, { type: 'session.started', session: response.session });
            }
            return;
        }
        case 'closeSession': {
            if ('session' in response && response.session) {
                publishRoomEvent(action.payload.roomId, { type: 'session.closed', session: response.session });
            }
            return;
        }
        case 'useBonusPointOnRoll': {
            const message = readMessage(response);
            publishRoomEvent(message.roomId, { type: 'message.updated', message });
            publishBonusPointSnapshot(await getRoomBonusPointSnapshot(message.roomId));
            const session = await getActiveRoomSession(message.roomId);
            if (session) publishRoomEvent(message.roomId, { type: 'session.updated', session });
            return;
        }
        case 'updateBonusPointSettings': {
            const roomId = action.payload.roomId;
            const room = await getRoomDetailsForRealtime(roomId);
            publishRoomEvent(roomId, { type: 'room.updated', room: toRealtimeRoom(room) });
            publishBonusPointSnapshot(await getRoomBonusPointSnapshot(roomId));
            return;
        }
        case 'createBonusPointRule':
        case 'updateBonusPointRule':
        case 'deleteBonusPointRule':
        case 'updateBonusPointBalance':
            publishBonusPointSnapshot(await getRoomBonusPointSnapshot(action.payload.roomId));
            return;
        case 'setRollAwardsEnabled': {
            const room = await getRoomDetailsForRealtime(action.payload.roomId);
            publishRoomEvent(room.id, { type: 'room.updated', room: toRealtimeRoom(room) });
            publishRollAwardsSnapshot(await getRoomRollAwardsSnapshot(room.id));
            return;
        }
        case 'createRollAward':
        case 'updateRollAward':
        case 'deleteRollAward':
            publishRollAwardsSnapshot(await getRoomRollAwardsSnapshot(action.payload.roomId));
            return;
        case 'list':
        case 'userRooms':
        case 'messages':
        case 'members':
        case 'bonusPoints':
        case 'roomDices':
        case 'createDice':
        case 'updateDice':
        case 'deleteDice':
        case 'createDiceCategory':
        case 'rollAwards':
        case 'sessionState':
        case 'sessions':
        case 'sessionRecap':
            return;
    }
}

function readRoom(response: RoomsActionResponse): RoomDetails {
    if ('room' in response) return response.room;
    throw new Error('Room action response is missing a room');
}

function readMember(response: RoomsActionResponse): RoomMemberDetails {
    if ('member' in response) return response.member;
    throw new Error('Member action response is missing a member');
}

function readMessage(response: RoomsActionResponse): RoomMessage {
    if ('message' in response) return response.message;
    throw new Error('Message action response is missing a message');
}

function getRoomId(action: RoomsAction): string | undefined {
    return 'payload' in action && 'roomId' in action.payload ? action.payload.roomId : undefined;
}
