import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateBagEvents,aggregateBagItems,emptyBagCounts,projectBagRecap,type StoredBagRecap } from '../../../../../shared/rooms/session-bag-recap';

const base = { messageCount: 0, rollCount: 0, durationSeconds: 0, rollAwards: [], criticals: [], bonusPoints: { awarded: 0, used: 0, users: [] } };
test('bag recap aggregates actions by source owner, including repeated edits', () => {
    const bag = aggregateBagEvents([
        { owner_id: '', event_type: 'created', count: '2' },
        { owner_id: 'alice', event_type: 'edited', count: 3 },
        { owner_id: 'alice', event_type: 'gifted', count: 1 },
        { owner_id: 'bob', event_type: 'deleted', count: 4 },
        { owner_id: 'alice', event_type: 'moved', count: 9 },
    ]);
    assert.deepEqual(bag.team, { ...emptyBagCounts(), created: 2 });
    assert.deepEqual(bag.personalByOwner?.alice, { ...emptyBagCounts(), edited: 3, gifted: 1 });
    assert.deepEqual(bag.personalByOwner?.bob, { ...emptyBagCounts(), deleted: 4 });
});
test('shared recaps omit all personal totals; authenticated projections expose only the viewer', () => {
    const recap: StoredBagRecap = { ...base, bag: aggregateBagEvents([
        { owner_id: 'alice', event_type: 'created', count: 7 },
        { owner_id: 'bob', event_type: 'created', count: 99 },
    ]) };
    assert.deepEqual(projectBagRecap(recap).bag, { version: 1, team: emptyBagCounts() });
    assert.deepEqual(projectBagRecap(recap, 'alice').bag, { version: 1, team: emptyBagCounts(), personal: { ...emptyBagCounts(), created: 7 } });
    assert.deepEqual(projectBagRecap(recap, 'new-member').bag?.personal, emptyBagCounts());
    assert.equal(JSON.stringify(projectBagRecap(recap, 'alice')).includes('bob'), false);
    assert.equal(recap.bag?.personalByOwner?.bob?.created, 99);
});
test('legacy recaps retain missing tracking; tracked zero activity remains available', () => {
    assert.equal(projectBagRecap(base, 'alice').bag, undefined);
    assert.deepEqual(projectBagRecap({ ...base, bag: aggregateBagEvents([]) }, 'alice').bag?.personal, emptyBagCounts());
});

test('bag activity retains individual historical snapshots and projects only the viewer items', () => {
    const item = { id: 'sword', creatorId: 'alice', sectionId: null, name: 'Moonblade', description: 'Before deletion', displayDescription: true, rarity: 'Rare' as const, imageId: null, fields: [], revision: 2 };
    const event = { id: 'event-1', owner_id: '', event_type: 'deleted' as const, item_id: 'sword', created_at: '2026-11-15T10:00:00Z', item_snapshot: JSON.stringify(item) };
    const items = aggregateBagItems([event, { ...event, id: 'event-2', owner_id: 'alice' }, { ...event, id: 'event-3', owner_id: 'bob', item_snapshot: null }]);
    const recap: StoredBagRecap = { ...base, bag: { ...aggregateBagEvents([]), ...items } };
    assert.equal(items.teamItems?.[0]?.item?.description, 'Before deletion');
    assert.equal(items.itemsByOwner?.bob?.[0]?.item, undefined);
    assert.equal(projectBagRecap(recap).bag?.personalItems, undefined);
    const projected = projectBagRecap(recap, 'alice');
    assert.deepEqual(projected.bag?.personalItems?.map(entry => entry.id), ['event-2']);
    assert.equal(JSON.stringify(projected).includes('event-3'), false);
    assert.equal(JSON.stringify(projected).includes('itemsByOwner'), false);
    assert.equal(projected.bag?.teamItems?.[0]?.item?.name, 'Moonblade');
});
