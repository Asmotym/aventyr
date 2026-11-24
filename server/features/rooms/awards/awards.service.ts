import type { RoomRollAward, RoomRollAwardsSnapshot } from '../../../../shared/rooms/rooms.types';
import { BadRequestError, ConflictError, NotFoundError } from '../../../infrastructure/http/errors';
import { mapRollAwardRecord } from '../domain/rooms.mappers';
import { normalizeRollAwardDescription, normalizeRollAwardDiceNotations, normalizeRollAwardName, normalizeRollAwardResults, serializeRollAwardDiceNotations } from '../domain/rooms.normalizers';
import { requireRoom } from '../domain/rooms.shared';
import { updateRollAwardsSettings } from '../membership/repositories/rooms.table';
import { deleteRoomRollAward, getRoomRollAward, insertRoomRollAward, listRoomRollAwards, updateRoomRollAward } from './repositories/room-roll-awards.table';
export async function getRoomRollAwardsSnapshot(roomId: string): Promise<RoomRollAwardsSnapshot> {
    const result = await handleListRollAwards({ roomId });
    return {
        roomId,
        awards: result.awards,
        enabled: result.enabled,
        allowNonLeaders: result.allowNonLeaders
    };
}
export async function handleListRollAwards(payload: {
    roomId: string;
}): Promise<{
    awards: RoomRollAward[];
    enabled: boolean;
    allowNonLeaders?: boolean;
}> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    const room = await requireRoom(payload.roomId);
    const rows = await listRoomRollAwards(room.id);
    const awards = rows.map(mapRollAwardRecord);
    return {
        awards,
        enabled: Boolean(room.roll_awards_enabled),
        allowNonLeaders: Boolean(room.roll_awards_allow_non_leaders)
    };
}
export async function handleSetRollAwardsEnabled(payload: {
    roomId: string;
    userId: string;
    enabled: boolean;
    allowNonLeaders?: boolean;
}): Promise<{
    roomId: string;
    enabled: boolean;
    allowNonLeaders?: boolean;
}> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    const room = await requireRoom(payload.roomId);
    if (typeof payload.enabled !== 'boolean' || (payload.allowNonLeaders !== undefined && typeof payload.allowNonLeaders !== 'boolean')) {
        throw new BadRequestError('Invalid Roll Awards settings');
    }
    const updated = await updateRollAwardsSettings(room.id, { enabled: payload.enabled, allowNonLeaders: payload.allowNonLeaders });
    if (!updated)
        throw new globalThis.Error('Failed to update setting');
    return {
        roomId: room.id,
        enabled: Boolean(updated.roll_awards_enabled),
        allowNonLeaders: Boolean(updated.roll_awards_allow_non_leaders)
    };
}
export async function handleCreateRollAward(payload: {
    roomId: string;
    userId: string;
    name: string;
    description?: string | null;
    diceResults: number[];
    diceNotation?: string | null;
    diceNotations?: string[];
}): Promise<RoomRollAward> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    const room = await requireRoom(payload.roomId);
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
export async function handleUpdateRollAward(payload: {
    roomId: string;
    userId: string;
    awardId: string;
    name: string;
    description?: string | null;
    diceResults: number[];
    diceNotation?: string | null;
    diceNotations?: string[];
}): Promise<RoomRollAward> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    if (!payload.awardId)
        throw new BadRequestError('Award id missing');
    const room = await requireRoom(payload.roomId);
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
export async function handleDeleteRollAward(payload: {
    roomId: string;
    userId: string;
    awardId: string;
}): Promise<string> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    if (!payload.awardId)
        throw new BadRequestError('Award id missing');
    const room = await requireRoom(payload.roomId);
    const existing = await getRoomRollAward(payload.awardId);
    if (!existing || existing.room_id !== room.id) {
        throw new NotFoundError('Award not found');
    }
    await deleteRoomRollAward(payload.awardId);
    return payload.awardId;
}
