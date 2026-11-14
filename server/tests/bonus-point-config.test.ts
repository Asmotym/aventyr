import assert from 'node:assert/strict';
import test from 'node:test';
import { countBonusTriggers, evaluateBonusEffects, legacyEffects, legacyTrigger, parseBonusNotation, validateBonusEntry } from '../core/utils/bonus-point-config';
import type { RoomBonusPointEffect, RoomBonusPointRule, RoomBonusPointTrigger } from '../core/types/data.types';
const condition = (threshold: number, operator: 'moreThan' | 'lessThan' = 'moreThan', diceNotation = 'd100') => ({ diceNotation, operator, threshold });
const trigger = (groups: RoomBonusPointTrigger['groups']): RoomBonusPointTrigger => ({ id: 't', roomId: 'r', name: 'Trigger', groups });
const effect = (actions: RoomBonusPointEffect['actions'], diceNotation = 'd100'): RoomBonusPointEffect => ({ id: 'e', roomId: 'r', name: 'Effect', diceNotation, actions });
const adjust = (amount: number, sign: '+' | '-' = '+') => ({ type: 'adjust' as const, sign, amount });
test('canonical notations preserve count, mode and modifiers, and compute complete bounds', () => {
    assert.deepEqual(parseBonusNotation(' 1D10+0 '), { notation: 'd10', min: 1, max: 10 });
    assert.deepEqual(parseBonusNotation('2d10+3'), { notation: '2d10+3', min: 5, max: 23 });
    assert.deepEqual(parseBonusNotation('+2d10-2'), { notation: '+2d10-2', min: -1, max: 8 });
    for (const bad of ['d0', '0d10', '+d10', '2d', 'd20 trailing', 'd9007199254740992']) assert.throws(() => parseBonusNotation(bad));
});
test('trigger groups use OR between groups and AND inside groups, award once per trigger', () => {
    const t = trigger([[condition(90), condition(100, 'lessThan')], [condition(95)]]);
    assert.equal(countBonusTriggers([t], 'd100', 98, [98]), 1);
    assert.equal(countBonusTriggers([t], 'd100', 90, [90]), 0);
    assert.equal(countBonusTriggers([t, t], '1d100', 98, [98]), 2);
    assert.equal(countBonusTriggers([t], '2d100', 98, [49,49]), 0);
    assert.equal(countBonusTriggers([trigger([[condition(12, 'moreThan', '2d10')]])], '2d10', 15, [7,8]), 1);
});
test('legacy conversion preserves raw-die matching, inclusive between and first adjustment', () => {
    const rule: RoomBonusPointRule = { id: 'one', roomId: 'r', name: 'Legacy', diceNotation: 'd10', condition: { operator: 'between', threshold: 3, thresholdMax: 7 }, spendAdjustment: { sign: '-', amount: 2 } };
    for (const roll of [3, 7]) assert.equal(countBonusTriggers([legacyTrigger(rule)], '2d10+4', 19, [roll,9]), 1);
    assert.equal(countBonusTriggers([legacyTrigger(rule)], 'd10', 2, [2]), 0);
    const effects = legacyEffects([rule, { ...rule, id: 'two', spendAdjustment: { sign: '+', amount: 8 } }]);
    assert.equal(effects.length, 1);
    assert.equal(evaluateBonusEffects({ effects }, '2d10+4', 8, [4,4], true).total, 6);
    assert.equal(evaluateBonusEffects({ effects }, 'd10', 10, [5], true).eligible, false);
});
test('all effects and actions execute sequentially with per-action clamping', () => {
    const first = effect([adjust(100), adjust(3, '-'), { type: 'message', text: '<b>plain text</b>' }], '2d10+3');
    const second = { ...effect([adjust(1)], '2d10+3'), id: 'second' };
    const result = evaluateBonusEffects({ effects: [first, second] }, '2d10+3', 12, [4,5], true);
    assert.equal(result.total, 21); // 12 -> 23 -> 20 -> 21
    assert.deepEqual(result.effectIds, ['e', 'second']);
    assert.deepEqual(result.messages, [{ text: '<b>plain text</b>', effectId: 'e' }]);
    assert.equal(result.eligible, true);
    assert.equal(evaluateBonusEffects({ effects: [first] }, 'd10', 5, [5], true).eligible, false);
});
test('message-only effects, no-op adjustments, extremes and selected dice', () => {
    assert.equal(evaluateBonusEffects({ effects: [effect([adjust(2)])] }, 'd100', 100, [50], true).eligible, false);
    assert.equal(evaluateBonusEffects({ effects: [effect([{ type: 'message', text: 'hello' }])] }, 'd100', 100, [50], true).eligible, true);
    assert.equal(evaluateBonusEffects({ effects: [effect([adjust(2)])] }, 'd100', 1, [1], false).eligible, false);
    assert.equal(evaluateBonusEffects({ effects: [effect([adjust(2)], '+2d10')] }, '+2d10', 4, [4,9], false).total, 6);
    assert.equal(evaluateBonusEffects({ effects: [effect([adjust(2)], '-2d10')] }, '-2d10', 10, [4,10], false).eligible, false);
});
test('client/server validation rejects incomplete and malformed configuration', () => {
    validateBonusEntry('trigger', trigger([[condition(90)]]));
    validateBonusEntry('effect', effect([adjust(2)]));
    for (const entry of [trigger([]), trigger([[]]), trigger([[condition(NaN)]]), { ...trigger([[condition(1)]]), name: '' }]) assert.throws(() => validateBonusEntry('trigger', entry));
    for (const entry of [effect([]), effect([adjust(0)]), effect([adjust(1.2)]), effect([{ type: 'message', text: ' ' }]), effect([adjust(1)], 'bad')]) assert.throws(() => validateBonusEntry('effect', entry));
});

test('notification effects are eligible without changing the roll and retain their order', () => {
    const entry = effect([{ type: 'notification', text: 'First' }, { type: 'notification', text: 'Second' }]);
    validateBonusEntry('effect', entry);
    const result = evaluateBonusEffects({ effects: [entry] }, 'd100', 50, [50], true);
    assert.equal(result.eligible, true);
    assert.equal(result.total, 50);
    assert.deepEqual(result.notifications, ['First', 'Second']);
    assert.deepEqual(result.messages, []);
    assert.throws(() => validateBonusEntry('effect', effect([{ type: 'notification', text: ' ' }])));
});

test('optional notification settings validate and propagate without changing defaults', () => {
    const entry = effect([{ type: 'notification', text: 'Success', severity: 'success', timeout: -1 }]);
    validateBonusEntry('effect', entry);
    assert.deepEqual(evaluateBonusEffects({ effects: [entry] }, 'd100', 50, [50], true).notifications, [{ text: 'Success', severity: 'success', timeout: -1 }]);
    for (const timeout of [0, -2, 999, 60001, 1.5, NaN]) assert.throws(() => validateBonusEntry('effect', effect([{ type: 'notification', text: 'Text', timeout }])));
});
