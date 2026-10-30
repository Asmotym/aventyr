import assert from 'node:assert/strict';
import test from 'node:test';
import { bagDefinition, bagItemData, requireBagRevision } from '../core/utils/bag-validation';
import { ROOM_ROLES, resolveRoomRights } from '../core/utils/room-permissions';
import { BAG_RARITIES } from '../core/types/bag.types';

test('Bag permissions default to every role while overrides restrict access', () => {
    for (const role of ROOM_ROLES) { assert.equal(resolveRoomRights(role).viewBag, true); assert.equal(resolveRoomRights(role).editBag, true); }
    assert.equal(resolveRoomRights('player', { viewBag: false }).viewBag, false);
    assert.equal(resolveRoomRights('creator', { viewBag: false }).viewBag, true);
});
test('Bag item validation accepts generic typed values and defaults', () => {
    const fields = [
        { name: 'Weight', type: 'integer', value: 2, display: true },
        { name: 'Note', type: 'string', value: '', display: false },
        { name: 'Slot', type: 'select', options: ['Hand', 'Head'], value: 'Hand' },
        { name: 'Tags', type: 'multi-select', options: ['Magic', 'Heavy'], value: ['Magic'] }
    ];
    const item = bagItemData({ name: '  Sword  ', fields });
    assert.equal(item.name, 'Sword'); assert.equal(item.rarity, 'Common'); assert.equal(item.displayDescription, false);
    assert.deepEqual(item.fields[3]?.value, ['Magic']); assert.equal(item.fields[2]?.display, false);
    for (const rarity of BAG_RARITIES) assert.equal(bagItemData({ name: 'Sword', rarity }).rarity, rarity);
});
test('Bag rejects invalid names, types, options, values and oversized fields', () => {
    for (const data of [{ name: '' }, { name: 'a', rarity: 'Epic' }, { name: 'a', fields: Array(51).fill({}) }, { name: 'a', description: 5 }, { name: 'a', displayDescription: 'true' }]) assert.throws(() => bagItemData(data), { status: 400 });
    for (const field of [
        { name: '', type: 'string' }, { name: 'x', type: 'boolean' },
        { name: 'x', type: 'select', options: [] }, { name: 'x', type: 'select', options: ['a', 'a'] }
    ]) assert.throws(() => bagDefinition(field), { status: 400 });
    for (const field of [
        { name: 'x', type: 'integer', value: 1.5 }, { name: 'x', type: 'integer', value: '1' },
        { name: 'x', type: 'string', value: 1 }, { name: 'x', type: 'select', options: ['a'], value: 'b' },
        { name: 'x', type: 'multi-select', options: ['a'], value: ['a', 'a'] }
    ]) assert.throws(() => bagItemData({ name: 'a', fields: [field] }), { status: 400 });
});
test('Stale and omitted revisions conflict instead of overwriting data', () => {
    requireBagRevision(3, 3);
    for (const revision of [undefined, '3', 2, 4]) assert.throws(() => requireBagRevision(3, revision), { status: 409 });
});
