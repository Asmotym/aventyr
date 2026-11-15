import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRoomCriticals } from '../services/rooms/rooms.normalizers';
import { parseStoredRoomCriticals } from '../services/rooms/rooms.mappers';

const legacy = { operator: 'moreThan' as const, threshold: 19, color: '#ff0000' };

test('legacy critical rules are preserved but disabled', () => {
    for (const rules of [normalizeRoomCriticals([legacy]), parseStoredRoomCriticals(JSON.stringify([legacy]))]) {
        assert.equal(rules.length, 1);
        assert.equal(rules[0]?.enabled, false);
        assert.equal(rules[0]?.diceType, undefined);
    }
});

test('dice bindings and disabled states survive storage and allow thresholds per dice type', () => {
    const rules = normalizeRoomCriticals([
        { ...legacy, diceType: 'D20', enabled: false },
        { ...legacy, diceType: 'd100' },
    ]);
    assert.equal(rules[0]?.diceType, 'd20');
    assert.equal(rules[0]?.enabled, false);
    assert.equal(rules[1]?.enabled, true);
    assert.deepEqual(parseStoredRoomCriticals(JSON.stringify(rules)), rules);
    assert.throws(() => normalizeRoomCriticals([{ ...legacy, diceType: '20' }]));
    assert.throws(() => normalizeRoomCriticals([rules[0]!, rules[0]!]));
});
