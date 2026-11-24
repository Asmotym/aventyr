import type { RoomRollAward, RoomSessionAwardResult, RoomSessionStartPreparation } from './rooms.types';
export function selectSessionAwardCandidates(awards: RoomRollAward[], results: RoomSessionAwardResult[], memberIds: Set<string>, enabled: boolean, allowNonLeaders = false): RoomSessionStartPreparation['candidates'] {
    if (!enabled)
        return [];
    return awards.flatMap((award) => {
        const result = results.find((entry) => entry.award.id === award.id);
        const eligible = allowNonLeaders ? result?.users : result?.leaders;
        const users = eligible?.filter((user) => user.count > 0 && memberIds.has(user.userId)) ?? [];
        return users.length ? [{ award, users }] : [];
    });
}
