import type { RoomSessionBagCounts, RoomSessionRecap } from '../types/data.types';

export type StoredBagRecap = Omit<RoomSessionRecap, 'bag'> & {
    bag?: NonNullable<RoomSessionRecap['bag']> & { personalByOwner?: Record<string, RoomSessionBagCounts> };
};
export const emptyBagCounts = (): RoomSessionBagCounts => ({ created: 0, edited: 0, deleted: 0, gifted: 0 });

export function aggregateBagEvents(events: Array<{ owner_id: string; event_type: string; count: number | string }>): NonNullable<StoredBagRecap['bag']> {
    const team = emptyBagCounts();
    const personalByOwner: Record<string, RoomSessionBagCounts> = Object.create(null);
    for (const event of events) {
        if (!['created', 'edited', 'deleted', 'gifted'].includes(event.event_type)) continue;
        const counts = event.owner_id === '' ? team : (personalByOwner[event.owner_id] ??= emptyBagCounts());
        counts[event.event_type as keyof RoomSessionBagCounts] += Number(event.count);
    }
    return { version: 1, team, personalByOwner };
}

// Shared session payloads expose only team totals. Personal totals require a trusted viewer.
export function projectBagRecap(recap: StoredBagRecap, viewerId?: string): RoomSessionRecap {
    if (!recap.bag) return recap;
    return {
        ...recap,
        bag: { version: 1, team: { ...recap.bag.team },
            ...(viewerId ? { personal: { ...(recap.bag.personalByOwner?.[viewerId] ?? emptyBagCounts()) } } : {}) }
    };
}
