import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBagItemTemplate } from '../../../shared/rooms/bag-item-template';
import { bagItemData } from '../../../server/features/rooms/bags/bag-validation';
import type { BagField, BagItem, BagItemTemplate } from '../../../shared/rooms/bag.types';
const field = (name: string, value = 7): BagField => ({ name, type: 'integer', options: [], value, display: false });
const item: BagItem = { id: 'item', revision: 2, creatorId: 'author', sectionId: 'section', name: 'My sword', description: 'Old', rarity: 'Common', displayDescription: false, imageId: null, favorite: true, fields: [field(' Damage ', 42), field('Weight', 2)] };
const preset: BagItemTemplate = { id: 'preset', revision: 1, ownerId: 'other', public: true, name: 'Sword', description: 'Sharp', rarity: 'Rare', imageId: null, icon: 'mdi-sword', displayDescription: true, fields: [field('Damage'), { name: 'Element', type: 'select', options: ['Fire', 'Ice'], value: 'Fire', display: true }] };
test('preset merges preserve identity and compatible conflicting values; copies round-trip independently', () => {
    const result = applyBagItemTemplate(item, preset);
    assert.equal(result.name, item.name); assert.equal(result.sectionId, item.sectionId); assert.equal(result.favorite, true);
    assert.deepEqual(result.fields.map(f => [f.name, f.value]), [['Weight', 2], ['Damage', 42], ['Element', 'Fire']]);
    assert.equal(result.description, 'Sharp'); assert.equal(result.rarity, 'Rare');
    assert.equal(result.fields[1]!.itemTemplateField, true);
    const saved = bagItemData(result);
    assert.deepEqual(saved.itemTemplate, result.itemTemplate);
    preset.fields[1]!.options.push('Air');
    assert.deepEqual(result.itemTemplate!.fields[1]!.options, ['Fire', 'Ice']);
    assert.deepEqual(result.fields[2]!.options, ['Fire', 'Ice']);
    preset.fields[1]!.options.pop();
    assert.equal(item.fields[0]!.name, ' Damage ');
});
test('incompatible conflicts use defaults, replacing only previous template fields', () => {
    const applied = applyBagItemTemplate({ ...item, fields: [{ ...field('Element'), value: 12 }] }, preset);
    assert.equal(applied.fields.find(f => f.name === 'Element')!.value, 'Fire');
    const replacement = applyBagItemTemplate({ ...applied, fields: [field('Notes'), ...applied.fields] }, { ...preset, id: 'next', name: 'Shield', fields: [field('Armor')] });
    assert.deepEqual(replacement.fields.map(f => f.name), ['Notes', 'Armor']);
    assert.equal(replacement.itemTemplate!.name, 'Shield');
});
test('field limit failures preserve the original draft', () => {
    const full = { ...item, fields: Array.from({ length: 50 }, (_, i) => field('Field ' + i)) };
    assert.throws(() => applyBagItemTemplate(full, preset), /50 fields/);
    assert.equal(full.fields.length, 50); assert.equal(full.itemTemplate, undefined);
});
test('copied definitions cannot be renamed, reordered, omitted or duplicated by ordinary fields', () => {
    const applied = applyBagItemTemplate(item, preset);
    const changed = structuredClone(applied); changed.fields[1]!.name = 'Forged';
    assert.throws(() => bagItemData(changed), /cannot be changed/);
    assert.throws(() => bagItemData({ ...applied, fields: applied.fields.slice(0, 2) }), /cannot be changed/);
    assert.throws(() => bagItemData({ ...applied, fields: [...applied.fields, field(' DAMAGE ')] }), /Duplicate/);
    assert.throws(() => bagItemData({ ...applied, itemTemplate: undefined }), /Missing/);
});
