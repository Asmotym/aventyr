import type { RoomRollAward } from './rooms.types';
export interface RoomRollAwardEntry {
    userId: string;
    rolls: number[];
    notation?: string | null;
}
export interface RoomRollAwardEvaluation {
    counts: Map<string, number>;
    leaderUserIds: string[];
    maxHits: number;
}
const DICE_NOTATION_FACE_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i;
export function getRollAwardNotations(award: RoomRollAward): string[] {
    if (Array.isArray(award.diceNotations) && award.diceNotations.length) {
        return award.diceNotations;
    }
    return award.diceNotation ? [award.diceNotation] : [];
}
export function extractRollAwardDieFace(value?: string | null): string | null {
    const normalized = value?.trim().toLowerCase();
    if (!normalized)
        return null;
    return normalized.match(DICE_NOTATION_FACE_REGEX)?.[2] ?? null;
}
export function evaluateRoomRollAward(award: RoomRollAward, entries: RoomRollAwardEntry[]): RoomRollAwardEvaluation {
    const targets = new Set((award.diceResults ?? [])
        .map((result) => Number(result))
        .filter((result) => Number.isFinite(result))
        .map((result) => Math.floor(result)));
    if (!targets.size) {
        return { counts: new Map(), leaderUserIds: [], maxHits: 0 };
    }
    const requiredFaces = getRollAwardNotations(award)
        .map(extractRollAwardDieFace)
        .filter((face): face is string => Boolean(face));
    const counts = new Map<string, number>();
    for (const entry of entries) {
        const face = extractRollAwardDieFace(entry.notation);
        if (requiredFaces.length && (!face || !requiredFaces.includes(face)))
            continue;
        const hits = entry.rolls.reduce((total, roll) => (targets.has(Math.floor(Number(roll))) ? total + 1 : total), 0);
        if (hits > 0)
            counts.set(entry.userId, (counts.get(entry.userId) ?? 0) + hits);
    }
    const maxHits = Math.max(0, ...counts.values());
    const leaderUserIds = [...counts.entries()]
        .filter(([, count]) => count === maxHits && maxHits > 0)
        .map(([userId]) => userId);
    return { counts, leaderUserIds, maxHits };
}
