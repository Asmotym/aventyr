import type { RoomRollAward, RoomSessionAwardResult, RoomSessionStartPreparation } from '../types/data.types';

export function selectSessionAwardCandidates(
    awards: RoomRollAward[], results: RoomSessionAwardResult[], memberIds: Set<string>, enabled: boolean
): RoomSessionStartPreparation['candidates'] {
    if (!enabled) return [];
    return awards.flatMap((award) => {
        const result = results.find((entry) => entry.award.id === award.id);
        const users = result?.leaders.filter((user) => memberIds.has(user.userId)) ?? [];
        return users.length ? [{ award, users }] : [];
    });
}
