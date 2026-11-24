import type { RoomCriticalRule, RoomDetails, RoomDice, RoomDiceCategory } from '../../../../shared/rooms/rooms.types';
import type { DatabaseRoomDiceCategory } from '../../../infrastructure/database/records';
import { BadRequestError, NotFoundError } from '../../../infrastructure/http/errors';
import { DEFAULT_DICE_CATEGORY_NAME } from '../domain/rooms.constants';
import { isDefaultCategoryFlag, mapRoomDiceCategoryRecord, mapRoomDiceRecord, mapRoomToSummary } from '../domain/rooms.mappers';
import { normalizeDiceCategoryName, normalizeDiceDescription, normalizeDiceNotation, normalizeRoomCriticals } from '../domain/rooms.normalizers';
import { requireRoom } from '../domain/rooms.shared';
import { ensureRoomMembership } from '../membership/membership-guard';
import { countMembers } from '../membership/repositories/room-members.table';
import { updateRoomCriticals as updateRoomCriticalsRecord } from '../membership/repositories/rooms.table';
import { assignCategoryToUncategorizedDice, getNextDiceCategorySortOrder, insertRoomDiceCategory, listRoomDiceCategories, setDefaultRoomDiceCategory } from './repositories/room-dice-categories.table';
import { deleteRoomDice, getRoomDice, insertRoomDice, listRoomDices, updateRoomDice as updateRoomDiceRecord } from './repositories/room-dices.table';
export async function handleUpdateCriticals(payload: {
    roomId: string;
    userId: string;
    criticals: RoomCriticalRule[];
}): Promise<RoomDetails> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    await requireRoom(payload.roomId);
    const criticals = normalizeRoomCriticals(payload.criticals);
    const updated = await updateRoomCriticalsRecord(payload.roomId, criticals.length ? JSON.stringify(criticals) : null);
    if (!updated)
        throw new globalThis.Error('Failed to update criticals');
    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}
export async function handleListRoomDices(payload: {
    roomId: string;
    userId: string;
}): Promise<{
    dices: RoomDice[];
    categories: RoomDiceCategory[];
}> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const categoryRecords = await ensureDiceCategoriesForUser(room.id, payload.userId);
    const categories = categoryRecords.map(mapRoomDiceCategoryRecord);
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const rows = await listRoomDices(room.id, payload.userId);
    const dices = rows.map((record) => mapRoomDiceRecord(record, categoryMap));
    return { dices, categories };
}
export async function handleCreateRoomDice(payload: {
    roomId: string;
    userId: string;
    notation: string;
    description?: string | null;
    categoryId?: string | null;
}): Promise<RoomDice> {
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
export async function handleUpdateRoomDice(payload: {
    roomId: string;
    userId: string;
    diceId: string;
    notation: string;
    description?: string | null;
    categoryId?: string | null;
}): Promise<RoomDice> {
    if (!payload.diceId)
        throw new BadRequestError('Dice id missing');
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
    if (!updated)
        throw new globalThis.Error('Failed to update dice');
    const categoryMap = new Map(categoryRecords.map((record) => {
        const mapped = mapRoomDiceCategoryRecord(record);
        return [mapped.id, mapped] as const;
    }));
    return mapRoomDiceRecord(updated, categoryMap);
}
export async function handleDeleteRoomDice(payload: {
    roomId: string;
    userId: string;
    diceId: string;
}): Promise<void> {
    if (!payload.diceId)
        throw new BadRequestError('Dice id missing');
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const existing = await getRoomDice(payload.diceId);
    if (!existing || existing.room_id !== room.id || existing.created_by !== payload.userId) {
        throw new NotFoundError('Dice not found');
    }
    await deleteRoomDice(payload.diceId);
}
export async function handleCreateDiceCategory(payload: {
    roomId: string;
    userId: string;
    name: string;
}): Promise<RoomDiceCategory> {
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
export async function ensureDiceCategoriesForUser(roomId: string, userId: string): Promise<DatabaseRoomDiceCategory[]> {
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
export function selectDiceCategory(categories: DatabaseRoomDiceCategory[], categoryId?: string | null): DatabaseRoomDiceCategory | undefined {
    if (categoryId) {
        const match = categories.find((category) => category.id === categoryId);
        if (!match) {
            throw new NotFoundError('Category not found');
        }
        return match;
    }
    return categories.find((category) => isDefaultCategoryFlag(category.is_default)) ?? categories[0];
}
