import { upsertMember, touchMember } from '../../core/database/tables/room-members.table';
import {
    getRoomBonusPointBalance,
    setRoomBonusPointBalance
} from '../../core/database/tables/room-bonus-points.table';
import { insertMessage, listDiceMessages, listMessages } from '../../core/database/tables/room-messages.table';
import { touchRoom } from '../../core/database/tables/rooms.table';
import { getUser } from '../../core/database/tables/users.table';
import type { RoomBonusPointRule, RoomMessage, RoomSession } from '../../core/types/data.types';
import { getDiceFaceInfo, getSelectedRawRoll } from '../../core/utils/bonus-point-dice';
import { mapMessageRecord } from './rooms.mappers';
import { sanitizeDiceLimit } from './rooms.normalizers';
import { requireRoom } from './rooms.shared';
import { BadRequestError, NotFoundError } from '../../core/errors/http-errors';
import type { PoolConnection } from 'mysql2/promise';
import { ensureSessionForActivity, recordSessionBonusEvent } from './room-sessions.service';

export async function handleListMessages(payload: {
    roomId: string;
    userId?: string;
    limit?: number;
    since?: string;
    before?: string;
}): Promise<RoomMessage[]> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    await requireRoom(payload.roomId);

    if (payload.userId) {
        await touchMember(payload.roomId, payload.userId);
    }

    const rows = await listMessages(payload.roomId, {
        limit: payload.limit,
        since: payload.since,
        before: payload.before
    });
    return rows.map(mapMessageRecord);
}

export async function listRoomDiceRolls(payload: { roomId: string; limit?: number; since?: string }): Promise<RoomMessage[]> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    await requireRoom(payload.roomId);

    const limit = sanitizeDiceLimit(payload.limit);
    const rows = await listDiceMessages(payload.roomId, { limit, since: payload.since });
    return rows.map(mapMessageRecord);
}

export async function handleSendMessage(payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] }; skipBonusPointRules?: boolean }): Promise<{ message: RoomMessage; session: RoomSession; sessionStarted: boolean; closedSession?: RoomSession }> {
    if (!payload.roomId) throw new BadRequestError('Room id missing');
    if (!payload.userId) throw new BadRequestError('User id missing');
    if (payload.type === 'text' && !payload.content?.trim()) {
        throw new BadRequestError('Message content missing');
    }
    if (payload.type === 'dice' && !payload.dice) {
        throw new BadRequestError('Dice payload missing');
    }

    await requireRoom(payload.roomId);

    const author = await getUser(payload.userId);
    if (!author) throw new NotFoundError('Unknown user');

    await upsertMember(payload.roomId, payload.userId);
    const trimmedContent = payload.content?.trim();
    const diceNotation = payload.dice?.notation?.trim();
    const diceTotal = payload.dice ? Number(payload.dice.total) : undefined;
    const diceRolls = payload.dice ? payload.dice.rolls.map((roll) => Number(roll)) : undefined;
    const lifecycle = await ensureSessionForActivity(payload.roomId, payload.userId, async (connection, session) => {
        let bonusPointsAwarded = 0;
        if (payload.type === 'dice' && payload.dice) {
            const bonusConfiguration = session.configuration.bonusPoints;
            if (bonusConfiguration.enabled && !payload.skipBonusPointRules) {
                bonusPointsAwarded = await awardBonusPointsForRoll({
                    roomId: payload.roomId,
                    userId: payload.userId,
                    roomMax: bonusConfiguration.maxPointsPerUser,
                    notation: diceNotation ?? '',
                    rolls: diceRolls ?? [],
                    rules: bonusConfiguration.rules,
                    connection
                });
            }
        }
        const saved = await insertMessage({
            room_id: payload.roomId,
            user_id: payload.userId,
            content: payload.type === 'text' ? trimmedContent ?? '' : trimmedContent ?? null,
            type: payload.type,
            dice_notation: diceNotation,
            dice_total: diceTotal,
            dice_rolls: diceRolls,
            bonus_point_rules_skipped: payload.type === 'dice' && payload.skipBonusPointRules ? 1 : 0,
            session_id: session.id
        }, connection);
        return { saved, bonusPointsAwarded };
    });
    const saved = lifecycle.value?.saved;
    if (!saved) throw new globalThis.Error('Failed to save room message');

    await touchRoom(payload.roomId);

    if ((lifecycle.value?.bonusPointsAwarded ?? 0) > 0) {
        await recordSessionBonusEvent({
            sessionId: lifecycle.session.id,
            roomId: payload.roomId,
            userId: payload.userId,
            type: 'awarded',
            amount: lifecycle.value?.bonusPointsAwarded ?? 0,
            messageId: saved.id
        });
    }
    return {
        message: mapMessageRecord(saved),
        session: lifecycle.session,
        sessionStarted: lifecycle.started,
        closedSession: lifecycle.closed
    };
}

async function awardBonusPointsForRoll(payload: {
    roomId: string;
    userId: string;
    roomMax: number;
    notation: string;
    rolls: number[];
    rules: RoomBonusPointRule[];
    connection: PoolConnection;
}): Promise<number> {
    const rules = payload.rules;
    const maxPoints = Math.max(0, Math.floor(payload.roomMax));
    if (maxPoints <= 0 || !rules.length) {
        return 0;
    }
    const currentBalance = await getRoomBonusPointBalance(payload.roomId, payload.userId, payload.connection);
    const earned = countMatchingBonusRules(rules, payload.notation, payload.rolls);
    const nextBalance = Math.min(maxPoints, currentBalance + earned);

    if (nextBalance !== currentBalance) {
        await setRoomBonusPointBalance(payload.roomId, payload.userId, nextBalance, payload.connection);
    }
    return nextBalance - currentBalance;
}

function countMatchingBonusRules(rules: RoomBonusPointRule[], notation: string, rolls: number[]): number {
    const faceNotation = getDiceFaceInfo(notation)?.faceNotation ?? null;
    const selectedRoll = getSelectedRawRoll(notation, rolls);
    if (!faceNotation || !Number.isFinite(selectedRoll)) {
        return 0;
    }
    return rules.filter((rule) => (
        rule.diceNotation === faceNotation &&
        matchesBonusCondition(Number(selectedRoll), rule)
    )).length;
}

function matchesBonusCondition(value: number, rule: RoomBonusPointRule): boolean {
    if (rule.condition.operator === 'moreThan') {
        return value > rule.condition.threshold;
    }
    if (rule.condition.operator === 'lessThan') {
        return value < rule.condition.threshold;
    }
    return value >= rule.condition.threshold && value <= Number(rule.condition.thresholdMax);
}
