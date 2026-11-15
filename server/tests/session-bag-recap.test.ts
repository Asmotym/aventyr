import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateBagEvents, emptyBagCounts, projectBagRecap, type StoredBagRecap } from '../core/utils/session-bag-recap';

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
