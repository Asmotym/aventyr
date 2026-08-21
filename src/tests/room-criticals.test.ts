import assert from 'node:assert/strict';
import test from 'node:test';
import type { RoomCriticalRule, RoomMessage } from '../../server/core/types/data.types';
import {
  findMatchingRoomCritical,
  getCriticalMessageStyle,
  getRoomCriticalRulesSignature,
  getRoomCriticalSignature,
  matchesRoomCritical,
} from '../core/utils/room-criticals.utils';

const diceMessage: RoomMessage = {
  id: 'message-1',
  roomId: 'room-1',
  userId: 'user-1',
  type: 'dice',
  diceTotal: 20,
};

test('critical comparisons remain strict', () => {
  assert.equal(matchesRoomCritical({ operator: 'moreThan', threshold: 20, color: '#ff0000' }, 20), false);
  assert.equal(matchesRoomCritical({ operator: 'moreThan', threshold: 19, color: '#ff0000' }, 20), true);
  assert.equal(matchesRoomCritical({ operator: 'lessThan', threshold: 20, color: '#ff0000' }, 20), false);
  assert.equal(matchesRoomCritical({ operator: 'lessThan', threshold: 21, color: '#ff0000' }, 20), true);
});

test('the last matching critical rule wins', () => {
  const rules: RoomCriticalRule[] = [
    { operator: 'moreThan', threshold: 10, color: '#ff0000' },
    { operator: 'moreThan', threshold: 15, color: '#ffd700' },
  ];

  assert.equal(findMatchingRoomCritical(diceMessage, rules), rules[1]);
});

test('text messages and invalid dice totals do not match critical rules', () => {
  const rules: RoomCriticalRule[] = [
    { operator: 'moreThan', threshold: 10, color: '#ff0000' },
  ];

  assert.equal(findMatchingRoomCritical({ ...diceMessage, type: 'text' }, rules), null);
  assert.equal(findMatchingRoomCritical({ ...diceMessage, diceTotal: Number.NaN }, rules), null);
});

test('critical styles expose resting and animation colors', () => {
  const rule: RoomCriticalRule = { operator: 'moreThan', threshold: 19, color: '#336699' };

  assert.deepEqual(getCriticalMessageStyle(rule), {
    '--message-bg': 'rgba(51, 102, 153, 0.24)',
    '--message-border-color': 'rgba(51, 102, 153, 0.7)',
    '--dice-message-bg': 'rgba(51, 102, 153, 0.14)',
    '--critical-reveal-bg': 'rgba(51, 102, 153, 0.42)',
    '--critical-glow': 'rgba(51, 102, 153, 0.5)',
    '--critical-sweep': 'rgba(51, 102, 153, 0.72)',
  });
});

test('invalid colors use the safe fallback and signatures normalize color casing', () => {
  const invalidRule: RoomCriticalRule = { operator: 'lessThan', threshold: 2, color: 'invalid' };
  const normalizedRule: RoomCriticalRule = { operator: 'lessThan', threshold: 2, color: ' #AbCDef ' };

  assert.equal(getCriticalMessageStyle(invalidRule)['--critical-glow'], 'rgba(255, 255, 255, 0.5)');
  assert.equal(getRoomCriticalSignature(normalizedRule), 'lessThan:2:#abcdef');
  assert.equal(getRoomCriticalSignature(null), null);
});

test('equivalent critical rule arrays have a stable signature', () => {
  const first: RoomCriticalRule[] = [
    { operator: 'moreThan', threshold: 19, color: '#FFD700' },
  ];
  const replaced: RoomCriticalRule[] = [
    { operator: 'moreThan', threshold: 19, color: '#ffd700' },
  ];
  const changed: RoomCriticalRule[] = [
    { operator: 'moreThan', threshold: 20, color: '#ffd700' },
  ];

  assert.equal(getRoomCriticalRulesSignature(first), getRoomCriticalRulesSignature(replaced));
  assert.notEqual(getRoomCriticalRulesSignature(first), getRoomCriticalRulesSignature(changed));
});
