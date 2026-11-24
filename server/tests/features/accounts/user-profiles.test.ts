import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRoomRollAward } from '../../../../shared/rooms/room-roll-awards';
import type { RoomRollAward } from '../../../../shared/rooms/rooms.types';
import { ABOUT_ME_MAX_LENGTH,normalizeAboutMe } from '../../../features/accounts/user-profile';

test('About Me normalization trims outer whitespace and preserves internal line breaks', () => {
    assert.equal(normalizeAboutMe('  First line\n\nSecond line  '), 'First line\n\nSecond line');
    assert.equal(normalizeAboutMe('   '), '');
    assert.equal(normalizeAboutMe('équipe 🎲'), 'équipe 🎲');
});

test('About Me normalization rejects invalid values and oversized text', () => {
    assert.throws(() => normalizeAboutMe(null), /must be a string/);
    assert.throws(() => normalizeAboutMe('x'.repeat(ABOUT_ME_MAX_LENGTH + 1)), /too long/);
    assert.equal(normalizeAboutMe('x'.repeat(ABOUT_ME_MAX_LENGTH)).length, ABOUT_ME_MAX_LENGTH);
});

test('roll award evaluation returns positive leaders and ties', () => {
    const award: RoomRollAward = {
        id: 'award-1',
        roomId: 'room-1',
        name: 'Natural twenties',
        diceResults: [20],
        diceNotations: ['d20']
    };
    const result = evaluateRoomRollAward(award, [
        { userId: 'user-1', notation: '1d20+2', rolls: [20, 4] },
        { userId: 'user-2', notation: 'd20', rolls: [20] },
        { userId: 'user-3', notation: 'd100', rolls: [20, 20] }
    ]);

    assert.equal(result.maxHits, 1);
    assert.deepEqual(result.leaderUserIds.sort(), ['user-1', 'user-2']);
    assert.equal(result.counts.has('user-3'), false);
});

test('roll award evaluation counts all configured results and omits zero-hit users', () => {
    const award: RoomRollAward = {
        id: 'award-2',
        roomId: 'room-1',
        name: 'Extremes',
        diceResults: [1, 100]
    };
    const result = evaluateRoomRollAward(award, [
        { userId: 'user-1', notation: 'd100', rolls: [1, 100, 50] },
        { userId: 'user-2', notation: 'd100', rolls: [1] },
        { userId: 'user-3', notation: 'd100', rolls: [50] }
    ]);

    assert.equal(result.maxHits, 2);
    assert.deepEqual(result.leaderUserIds, ['user-1']);
    assert.equal(result.counts.get('user-1'), 2);
    assert.equal(result.counts.has('user-3'), false);
});
