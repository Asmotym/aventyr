import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDiceNotation, parseInlineDiceCommand, rollDiceNotation } from '@/features/rooms/utils/dice.utils';

test('dice commands preserve modifiers and descriptions and reject ordinary chat', () => {
  assert.deepEqual(parseDiceNotation('D20'), { count: 1, sides: 20, modifier: 0, mode: 'sum' });
  assert.deepEqual(parseInlineDiceCommand('  +2D20-3 Attack roll  '), { notation: '+2d20-3', description: 'Attack roll' });
  for (const input of ['', 'hello', '0d6', '2d0', '+d20', '2d6extra', null, undefined]) {
    assert.equal(parseInlineDiceCommand(input), null);
  }
});

test('sum, advantage and disadvantage preserve Aventyr lower-is-better dice semantics', () => {
  const original = Math.random;
  try {
    const roll = (notation: string, options = {}) => {
      const values = [0, 0.95];
      Math.random = () => values.shift()!;
      return rollDiceNotation(notation, options, '  Attack  ');
    };
    assert.deepEqual(roll('2d20+3', { modifier: -1 }), {
      dice: '2d20+3', rolls: [1, 20], total: 23, result: 23,
      critical: undefined, fumble: undefined, description: 'Attack',
    });
    assert.equal(roll('+2d20').total, 1);
    assert.equal(roll('-2d20').total, 20);
    assert.equal(roll('2d20', { advantage: true, criticalRange: 1 }).critical, true);
    assert.equal(roll('2d20', { disadvantage: true, fumbleRange: 20 }).fumble, true);
    assert.throws(() => roll('2d20', { advantage: true, disadvantage: true }), /both/);
  } finally { Math.random = original; }
});
