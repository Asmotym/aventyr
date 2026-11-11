import assert from 'node:assert/strict';
import test from 'node:test';
import { BAG_SORT_TYPES, sortBagItems, validBagSort } from '../core/utils/bag-sort.utils';
import type { BagItem } from '../../server/core/types/bag.types';
const item = (id: string, favorite: boolean, createdAt: number, updatedAt: number, rarity: BagItem['rarity']): BagItem => ({ id, name: id, favorite, createdAt, updatedAt, rarity, creatorId: 'alice', sectionId: null, description: '', displayDescription: false, imageId: null, fields: [], revision: 1 });
test('Every item order keeps favorites first and sorts each group independently', () => {
  const items = [item('D', false, 4, 8, 'Mythic'), item('B', true, 2, 6, 'Rare'), item('C', false, 3, 7, 'Heroic'), item('A', true, 1, 5, 'Common')];
  for (const order of BAG_SORT_TYPES) {
    const result = sortBagItems(items, order, 'en');
    assert.deepEqual(result.map(i => i.id), order.endsWith('asc') ? ['A', 'B', 'C', 'D'] : ['B', 'A', 'D', 'C']);
  }
  assert.deepEqual(items.map(i => i.id), ['D', 'B', 'C', 'A']);
});
test('Item ordering handles missing legacy dates, numeric names, stable ties and saved values', () => {
  const a = { ...item('1', false, 0, 0, 'Common'), name: 'Sword 10', createdAt: undefined, updatedAt: undefined };
  const b = { ...item('2', false, 0, 0, 'Common'), name: 'Sword 2' };
  assert.deepEqual(sortBagItems([a, b], 'name-asc', 'en').map(i => i.id), ['2', '1']);
  assert.deepEqual(sortBagItems([b, a], 'created-desc', 'en').map(i => i.id), ['1', '2']);
  for (const order of BAG_SORT_TYPES) assert.equal(validBagSort(order), true);
  for (const value of [null, '', 'unknown', 'created-up']) assert.equal(validBagSort(value), false);
});
