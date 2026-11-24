import assert from 'node:assert/strict';
import test from 'node:test';
import type { RoomRollAward,RoomSessionAwardResult } from '../../../../../shared/rooms/rooms.types';
import { selectSessionAwardCandidates } from '../../../../../shared/rooms/session-award-candidates';

const award: RoomRollAward = { id: 'award', roomId: 'room', name: 'Current name', description: 'Current description', diceResults: [20] };
const result: RoomSessionAwardResult = { award: { ...award, name: 'Old name' }, maxHits: 2,
    users: [{ userId: 'runner-up', displayName: 'Runner up', count: 1 }],
    leaders: [{ userId: 'online', displayName: 'Online', count: 2 }, { userId: 'offline', displayName: 'Offline', count: 2 }, { userId: 'departed', displayName: 'Left', count: 2 }] };

test('candidates include tied member winners, including offline members, with current definitions', () => {
    const candidates = selectSessionAwardCandidates([award], [result], new Set(['online', 'offline', 'runner-up']), true);
    assert.deepEqual(candidates[0].users.map(user => user.userId), ['online', 'offline']);
    assert.equal(candidates[0].award.name, 'Current name');
});

test('disabled, deleted, first-session and winnerless awards do not require selection', () => {
    assert.deepEqual(selectSessionAwardCandidates([award], [result], new Set(['online']), false), []);
    assert.deepEqual(selectSessionAwardCandidates([], [result], new Set(['online']), true), []);
    assert.deepEqual(selectSessionAwardCandidates([award], [], new Set(['online']), true), []);
    assert.deepEqual(selectSessionAwardCandidates([award], [{ ...result, leaders: [] }], new Set(['online']), true), []);
    assert.deepEqual(selectSessionAwardCandidates([award], [result], new Set(['runner-up']), true), []);
});

test('optional non-leader selection includes positive matches only for current members', () => {
    const winner = { userId: 'winner', displayName: 'Winner', count: 4 };
    const runnerUp = { userId: 'runner-up', displayName: 'Runner up', count: 1 };
    const unequal = { ...result, maxHits: 4, leaders: [winner], users: [winner, runnerUp,
        { userId: 'zero', displayName: 'No matches', count: 0 },
        { userId: 'departed', displayName: 'Left', count: 2 }] };
    const members = new Set(['winner', 'runner-up', 'zero']);
    assert.deepEqual(selectSessionAwardCandidates([award], [unequal], members, true)[0].users, [winner]);
    assert.deepEqual(selectSessionAwardCandidates([award], [unequal], members, true, true)[0].users, [winner, runnerUp]);
    assert.deepEqual(selectSessionAwardCandidates([award], [unequal], new Set(['runner-up']), true, true)[0].users, [runnerUp]);
    assert.deepEqual(selectSessionAwardCandidates([award], [unequal], members, false, true), []);
    assert.deepEqual(selectSessionAwardCandidates([award], [], members, true, true), []);
});
