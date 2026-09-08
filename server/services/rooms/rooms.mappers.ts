import type {
    DatabaseRoom,
    DatabaseRoomDice,
    DatabaseRoomDiceCategory,
    DatabaseRoomMemberWithUser,
    DatabaseRoomMessage,
    DatabaseRoomBonusPointBalance,
    DatabaseRoomBonusPointRule,
    DatabaseRoomRollAward
} from '../../core/types/database.types';
import type { RoomBonusPointBalance, RoomBonusPointRule, RoomCriticalRule, RoomDetails, RoomDice, RoomDiceCategory, RoomMemberDetails, RoomMessage, RoomRollAward } from '../../core/types/data.types';
import { ONLINE_MEMBER_WINDOW_MS, ROOM_CRITICALS_MAX_ITEMS } from './rooms.constants';
import {
    normalizeRollAwardDiceNotations,
    normalizeRoomCriticalColor,
    normalizeRoomCriticalOperator,
    normalizeRoomCriticalThreshold
} from './rooms.normalizers';

export function mapRoomDiceCategoryRecord(record: DatabaseRoomDiceCategory): RoomDiceCategory {
    const sortOrderValue = record.sort_order ?? undefined;
    const sortOrder = typeof sortOrderValue === 'string' ? Number(sortOrderValue) : sortOrderValue;
    return {
        id: record.id,
        roomId: record.room_id,
        name: record.name,
        sortOrder: Number.isFinite(sortOrder) ? Number(sortOrder) : undefined,
        isDefault: isDefaultCategoryFlag(record.is_default),
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined
    };
}

export function parseStoredDiceNotations(value?: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return normalizeRollAwardDiceNotations(parsed);
        }
    } catch {
        // ignore parse errors for legacy string values
    }
    try {
        return normalizeRollAwardDiceNotations(value);
    } catch {
        return [];
    }
}

export function mapRollAwardRecord(record: DatabaseRoomRollAward): RoomRollAward {
    const normalizedNotations = parseStoredDiceNotations(record.dice_notation ?? null);
    return {
        id: record.id,
        roomId: record.room_id,
        name: record.name,
        description: record.description ?? undefined,
        diceResults: parseStoredDiceResults(record.dice_results),
        diceNotation: normalizedNotations[0],
        diceNotations: normalizedNotations.length ? normalizedNotations : undefined,
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined
    };
}

export function isDefaultCategoryFlag(value?: number | boolean | string | null): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value === '1';
    return false;
}

export function mapRoomToSummary(room: DatabaseRoom, options?: { currentUserId?: string }): RoomDetails {
    const lastActivity = room.last_activity ?? room.updated_at ?? room.created_at ?? null;
    const archivedAt = room.archived_at ?? null;
    const currentUserId = options?.currentUserId;
    const isCreator = currentUserId && room.created_by
        ? room.created_by === currentUserId
        : undefined;
    return {
        id: room.id,
        name: room.name,
        inviteCode: room.invite_code,
        isProtected: Boolean(room.password_hash),
        memberCount: room.member_count ?? 0,
        lastActivity,
        archivedAt,
        isArchived: Boolean(archivedAt),
        isCreator,
        createdBy: room.created_by,
        createdAt: room.created_at ?? undefined,
        rollAwardsEnabled: Boolean(room.roll_awards_enabled),
        criticals: parseStoredRoomCriticals(room.room_criticals),
        bonusPointSettings: {
            roomId: room.id,
            enabled: Boolean(room.bonus_points_enabled),
            maxPointsPerUser: normalizeBonusPointsMaxForMapping(room.bonus_points_max),
            allowExtremeSpend: Boolean(room.bonus_points_allow_extreme_spend)
        },
        sessionInactivityMinutes: Number(room.session_inactivity_minutes ?? 240)
    };
}

export function mapBonusPointRuleRecord(record: DatabaseRoomBonusPointRule): RoomBonusPointRule {
    return {
        id: record.id,
        roomId: record.room_id,
        name: record.name,
        diceNotation: record.dice_notation,
        condition: {
            operator: record.condition_operator,
            threshold: Number(record.threshold),
            thresholdMax: record.threshold_max === null || record.threshold_max === undefined
                ? null
                : Number(record.threshold_max)
        },
        spendAdjustment: {
            sign: record.adjustment_sign,
            amount: Number(record.adjustment_amount)
        },
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined
    };
}

export function mapBonusPointBalanceRecord(record: DatabaseRoomBonusPointBalance): RoomBonusPointBalance {
    return {
        roomId: record.room_id,
        userId: record.user_id,
        points: Number(record.points ?? 0),
        username: record.username ?? undefined,
        avatar: record.avatar ?? undefined,
        nickname: record.nickname ?? undefined
    };
}

export function parseStoredRoomCriticals(value?: string | RoomCriticalRule[] | null): RoomCriticalRule[] {
    if (!value) return [];

    let parsed: unknown;
    if (Array.isArray(value)) {
        parsed = value;
    } else {
        try {
            parsed = JSON.parse(value);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(parsed)) {
        return [];
    }

    const normalized: RoomCriticalRule[] = [];
    const seen = new Set<string>();

    for (const entry of parsed) {
        try {
            if (!entry || typeof entry !== 'object') {
                continue;
            }
            const threshold = normalizeRoomCriticalThreshold((entry as RoomCriticalRule).threshold);
            const operator = normalizeRoomCriticalOperator((entry as RoomCriticalRule).operator);
            const color = normalizeRoomCriticalColor((entry as RoomCriticalRule).color);
            const dedupeKey = `${operator}:${threshold}`;
            if (seen.has(dedupeKey)) {
                continue;
            }
            seen.add(dedupeKey);
            normalized.push({ threshold, operator, color });
            if (normalized.length >= ROOM_CRITICALS_MAX_ITEMS) {
                break;
            }
        } catch {
            continue;
        }
    }

    return normalized;
}

export function mapRoomDiceRecord(record: DatabaseRoomDice, categories?: Map<string, RoomDiceCategory>): RoomDice {
    const categoryId = record.category_id ?? undefined;
    const category = categoryId && categories ? categories.get(categoryId) : undefined;
    return {
        id: record.id,
        roomId: record.room_id,
        notation: record.notation,
        description: record.description ?? undefined,
        categoryId,
        categoryName: category?.name,
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined,
    };
}

export function parseStoredDiceResults(value?: string | number[] | null): number[] {
    if (Array.isArray(value)) {
        return value
            .map((entry) => Number(entry))
            .filter((entry) => Number.isFinite(entry))
            .map((entry) => Math.floor(entry));
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((entry) => Number(entry))
                    .filter((entry) => Number.isFinite(entry))
                    .map((entry) => Math.floor(entry));
            }
        } catch {
            return [];
        }
    }
    return [];
}

export function mapMessageRecord(record: DatabaseRoomMessage): RoomMessage {
    let diceRolls: number[] | undefined;
    if (Array.isArray(record.dice_rolls)) {
        diceRolls = record.dice_rolls as number[];
    } else if (typeof record.dice_rolls === 'string') {
        try {
            const parsed = JSON.parse(record.dice_rolls);
            diceRolls = Array.isArray(parsed) ? parsed.map((value) => Number(value)) : undefined;
        } catch {
            diceRolls = undefined;
        }
    }

    const diceTotal = record.dice_total !== null && record.dice_total !== undefined
        ? Number(record.dice_total)
        : undefined;
    let bonusPointRuleUsed: { id: string; name: string } | null = null;
    if (record.bonus_point_rule_used) {
        if (typeof record.bonus_point_rule_used === 'string') {
            try {
                const parsed = JSON.parse(record.bonus_point_rule_used);
                if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
                    bonusPointRuleUsed = { id: parsed.id, name: parsed.name };
                }
            } catch {
                bonusPointRuleUsed = null;
            }
        } else if (
            typeof record.bonus_point_rule_used === 'object' &&
            typeof record.bonus_point_rule_used.id === 'string' &&
            typeof record.bonus_point_rule_used.name === 'string'
        ) {
            bonusPointRuleUsed = {
                id: record.bonus_point_rule_used.id,
                name: record.bonus_point_rule_used.name
            };
        }
    }

    return {
        id: record.id,
        roomId: record.room_id,
        userId: record.user_id,
        username: record.username ?? undefined,
        avatar: record.avatar ?? undefined,
        content: record.content ?? undefined,
        type: record.type,
        rollAwardUsage: typeof record.roll_award_usage === 'string' ? JSON.parse(record.roll_award_usage) : record.roll_award_usage,
        diceNotation: record.dice_notation ?? undefined,
        diceTotal,
        diceRolls,
        pointUsed: Boolean(record.point_used),
        diceBaseTotal: record.dice_base_total === null || record.dice_base_total === undefined
            ? undefined
            : Number(record.dice_base_total),
        bonusPointAdjustment: record.bonus_point_adjustment === null || record.bonus_point_adjustment === undefined
            ? undefined
            : Number(record.bonus_point_adjustment),
        bonusPointsUsed: Number(record.bonus_points_used ?? 0),
        bonusPointRuleUsed,
        bonusPointRulesSkipped: Boolean(record.bonus_point_rules_skipped),
        createdAt: record.created_at,
        nickname: record.member_nickname ?? undefined,
        sessionId: record.session_id ?? null
    };
}

function normalizeBonusPointsMaxForMapping(value?: number | string | null): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.floor(parsed);
}

export function calculateIsOnline(lastSeen?: string | null): boolean {
    if (!lastSeen) return false;
    const timestamp = new Date(lastSeen).getTime();
    if (Number.isNaN(timestamp)) return false;
    return Date.now() - timestamp <= ONLINE_MEMBER_WINDOW_MS;
}

export function mapMemberRecord(record: DatabaseRoomMemberWithUser): RoomMemberDetails {
    return {
        userId: record.user_id,
        username: record.username ?? undefined,
        avatar: record.avatar ?? undefined,
        joinedAt: record.joined_at ?? undefined,
        lastSeen: record.last_seen ?? undefined,
        nickname: record.nickname ?? undefined,
        isOnline: calculateIsOnline(record.last_seen ?? undefined)
    };
}
