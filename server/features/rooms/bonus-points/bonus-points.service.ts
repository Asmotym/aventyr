import { evaluateBonusEffects } from '../../../../shared/rooms/bonus-point-config';
import { clampTotalToDiceFace, getDiceFaceInfo, isNaturalExtremeRoll } from '../../../../shared/rooms/bonus-point-dice';
import type { RoomBonusNotification, RoomBonusPointBalance, RoomBonusPointEffect, RoomBonusPointRule, RoomBonusPointSettings, RoomBonusPointSnapshot, RoomBonusPointTrigger, RoomMessage } from '../../../../shared/rooms/rooms.types';
import { execute, query, transaction } from '../../../infrastructure/database/client';
import type { DatabaseRoomMessage } from '../../../infrastructure/database/records';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../infrastructure/http/errors';
import { getMessageById, insertMessage, updateMessageBonusPointUsage } from '../chat/repositories/room-messages.table';
import { mapBonusPointBalanceRecord, mapBonusPointRuleRecord, mapMessageRecord } from '../domain/rooms.mappers';
import { normalizeBonusPointsMax } from '../domain/rooms.normalizers';
import { requireRoom } from '../domain/rooms.shared';
import { getMember } from '../membership/repositories/room-members.table';
import { updateBonusPointsSettings } from '../membership/repositories/rooms.table';
import { requireRoomPermission } from '../membership/room-access.service';
import { getActiveRoomSession, recordSessionBonusEvent } from '../sessions/room-sessions.service';
import { listBonusEntries, migrateRoomBonusConfiguration } from './repositories/room-bonus-config.table';
import { capRoomBonusPointBalances, getRoomBonusPointBalance, listRoomBonusPointBalances, listRoomBonusPointRules, setRoomBonusPointBalance } from './repositories/room-bonus-points.table';
export async function getRoomBonusPointSnapshot(roomId: string): Promise<RoomBonusPointSnapshot> {
    return handleListBonusPoints({ roomId });
}
export async function handleListBonusPoints(payload: {
    roomId: string;
}): Promise<RoomBonusPointSnapshot> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    const room = await requireRoom(payload.roomId);
    await migrateRoomBonusConfiguration(room.id);
    const rules = (await listRoomBonusPointRules(room.id)).map(mapBonusPointRuleRecord);
    const balances = (await listRoomBonusPointBalances(room.id)).map(mapBonusPointBalanceRecord);
    return {
        roomId: room.id, version: 2,
        triggers: await listBonusEntries<RoomBonusPointTrigger>(room.id, 'trigger'),
        conditions: await listBonusEntries<RoomBonusPointTrigger>(room.id, 'condition'),
        effects: await listBonusEntries<RoomBonusPointEffect>(room.id, 'effect'),
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
export async function handleUpdateBonusPointSettings(payload: {
    roomId: string;
    userId: string;
    enabled?: boolean;
    maxPointsPerUser?: number;
    allowExtremeSpend?: boolean;
}): Promise<RoomBonusPointSettings> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    const room = await requireRoom(payload.roomId);
    const maxPointsPerUser = typeof payload.maxPointsPerUser === 'undefined'
        ? normalizeMappedBonusPointsMax(room.bonus_points_max)
        : normalizeBonusPointsMax(payload.maxPointsPerUser);
    const updated = await updateBonusPointsSettings(room.id, {
        enabled: payload.enabled,
        maxPointsPerUser,
        allowExtremeSpend: payload.allowExtremeSpend,
    });
    if (!updated)
        throw new globalThis.Error('Failed to update bonus point settings');
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
export async function handleUseBonusPointOnRoll(payload: {
    roomId: string;
    userId: string;
    messageId: string;
}): Promise<{
    message: RoomMessage;
    effectMessages?: RoomMessage[];
    notifications?: Array<string | RoomBonusNotification>;
}> {
    return transaction(async () => {
        const lockedRoom = await query<Array<{
            id: string;
        }>>('SELECT id FROM rooms WHERE id = ? FOR UPDATE', [payload.roomId]);
        if (!lockedRoom.length)
            throw new NotFoundError('Room not found');
        await query('SELECT id FROM room_sessions WHERE room_id = ? AND ended_at IS NULL FOR UPDATE', [payload.roomId]);
        const session = await getActiveRoomSession(payload.roomId);
        if (!session || !session.configuration.bonusPoints.enabled)
            throw new ConflictError('Bonus points require an active enabled session');
        if (session.configuration.bonusPoints.version !== 2)
            return { message: await handleLegacyUseBonusPointOnRoll(payload) };
        const message = await getMessageById(payload.messageId);
        if (!message || message.room_id !== payload.roomId || message.session_id !== session.id || message.type !== 'dice')
            throw new ConflictError('Roll must belong to the current session');
        if (message.user_id !== payload.userId)
            throw new ForbiddenError('You can only use bonus points on your own rolls');
        if (message.bonus_point_rules_skipped)
            throw new ConflictError('Bonus points are disabled for this roll');
        const balance = await getRoomBonusPointBalance(payload.roomId, payload.userId, undefined, true);
        if (balance < 1)
            throw new ConflictError('Not enough bonus points');
        const config = session.configuration.bonusPoints;
        let result: ReturnType<typeof evaluateBonusEffects>;
        try {
            result = evaluateBonusEffects(config, message.dice_notation ?? '', Number(message.dice_total), parseMessageRolls(message.dice_rolls), config.allowExtremeSpend);
        }
        catch {
            throw new ConflictError('Invalid dice notation for bonus points');
        }
        if (!result.eligible)
            throw new ConflictError('No applicable bonus point effect');
        await setRoomBonusPointBalance(payload.roomId, payload.userId, balance - 1);
        const base = Number(message.dice_base_total ?? message.dice_total);
        await updateMessageBonusPointUsage({ messageId: message.id, diceTotal: result.total, diceBaseTotal: base,
            bonusPointAdjustment: Number(message.bonus_point_adjustment ?? 0) + result.total - Number(message.dice_total),
            bonusPointsUsed: Number(message.bonus_points_used ?? 0) + 1, bonusPointRuleUsed: 'null' });
        const oldEffects = typeof message.bonus_point_effects_used === 'string' ? JSON.parse(message.bonus_point_effects_used) as string[] : message.bonus_point_effects_used ?? [];
        await execute('UPDATE room_messages SET bonus_point_effects_used = ? WHERE id = ?', [JSON.stringify([...oldEffects, ...result.effectIds]), message.id]);
        const effectMessages: RoomMessage[] = [];
        for (const action of result.messages)
            effectMessages.push(mapMessageRecord(await insertMessage({ room_id: payload.roomId, user_id: null,
                session_id: session.id, type: 'bonus_effect', content: action.text, bonus_effect: { sourceRollId: message.id, effectIds: [action.effectId] } })));
        await recordSessionBonusEvent({ sessionId: session.id, roomId: payload.roomId, userId: payload.userId, type: 'used', amount: 1, messageId: message.id });
        return { message: mapMessageRecord((await getMessageById(message.id))!), effectMessages, notifications: result.notifications };
    });
}
export async function handleLegacyUseBonusPointOnRoll(payload: {
    roomId: string;
    userId: string;
    messageId: string;
}): Promise<RoomMessage> {
    if (!payload.roomId)
        throw new BadRequestError('Room id missing');
    if (!payload.userId)
        throw new BadRequestError('User id missing');
    if (!payload.messageId)
        throw new BadRequestError('Message id missing');
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
    const balance = await getRoomBonusPointBalance(payload.roomId, payload.userId, undefined, true);
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
export async function handleUpdateBonusPointBalance(payload: {
    roomId: string;
    userId: string;
    targetUserId: string;
    points: number;
}): Promise<RoomBonusPointBalance> {
    const room = await ensureCanManageBonusPoints(payload.roomId, payload.userId);
    if (!payload.targetUserId)
        throw new BadRequestError('Target user id missing');
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
export function getSignedBonusPointAdjustment(rule: RoomBonusPointRule): number {
    const amount = Math.abs(rule.spendAdjustment.amount);
    return rule.spendAdjustment.sign === '-' ? -amount : amount;
}
export async function ensureCanManageBonusPoints(roomId: string, userId: string) {
    if (!roomId)
        throw new BadRequestError('Room id missing');
    if (!userId)
        throw new BadRequestError('User id missing');
    const room = await requireRoom(roomId);
    await requireRoomPermission(roomId, userId, 'manageBonusPoints');
    return room;
}
export function normalizeBonusPointBalanceValue(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new BadRequestError('Bonus point balance must be a whole number.');
    }
    return Math.max(0, parsed);
}
export function parseMessageRolls(value: DatabaseRoomMessage['dice_rolls']): number[] {
    if (Array.isArray(value)) {
        return value.map((roll) => Number(roll)).filter((roll) => Number.isFinite(roll));
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? parsed.map((roll) => Number(roll)).filter((roll) => Number.isFinite(roll))
                : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
export function normalizeMappedBonusPointsMax(value?: number | string | null): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.floor(parsed);
}
