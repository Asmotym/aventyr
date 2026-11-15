import type { RoomSessionBagActivity, RoomSessionBagCounts, RoomSessionRecap } from '../types/data.types';

export type StoredBagRecap = Omit<RoomSessionRecap, 'bag'> & {
    bag?: NonNullable<RoomSessionRecap['bag']> & { personalByOwner?: Record<string, RoomSessionBagCounts>; itemsByOwner?: Record<string, RoomSessionBagActivity[]> };
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

export interface BagActivityRow {
    id: string; owner_id: string; event_type: RoomSessionBagActivity['action']; item_id: string;
    created_at: Date | string; item_snapshot: RoomSessionBagActivity['item'] | string | null;
}
export function aggregateBagItems(events: BagActivityRow[]): Pick<NonNullable<StoredBagRecap['bag']>, 'teamItems' | 'itemsByOwner'> {
    const teamItems: RoomSessionBagActivity[] = [];
    const itemsByOwner: Record<string, RoomSessionBagActivity[]> = Object.create(null);
    for (const event of events) {
        const item = typeof event.item_snapshot === 'string' ? JSON.parse(event.item_snapshot) : event.item_snapshot;
        const activity: RoomSessionBagActivity = { id: event.id, itemId: event.item_id, action: event.event_type,
            createdAt: new Date(event.created_at).toISOString(), ...(item ? { item } : {}) };
        (event.owner_id === '' ? teamItems : (itemsByOwner[event.owner_id] ??= [])).push(activity);
    }
    return { teamItems, itemsByOwner };
}

// Shared session payloads expose only team totals. Personal totals require a trusted viewer.
export function projectBagRecap(recap: StoredBagRecap, viewerId?: string): RoomSessionRecap {
    if (!recap.bag) return recap;
    return {
        ...recap,
        bag: { version: 1, team: { ...recap.bag.team },
            ...(recap.bag.teamItems ? { teamItems: recap.bag.teamItems } : {}),
            ...(viewerId && recap.bag.itemsByOwner ? { personalItems: recap.bag.itemsByOwner[viewerId] ?? [] } : {}),
            ...(viewerId ? { personal: { ...(recap.bag.personalByOwner?.[viewerId] ?? emptyBagCounts()) } } : {}) }
    };
}
