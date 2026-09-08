import assert from 'node:assert/strict';
import test from 'node:test';
import { selectSessionAwardCandidates } from '../core/utils/session-award-candidates';
import type { RoomRollAward, RoomSessionAwardResult } from '../core/types/data.types';

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
