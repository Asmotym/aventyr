import assert from 'node:assert/strict';
import test from 'node:test';
import icons from '../core/utils/bag-icons.json';
import { BAG_ICON_CATEGORIES, bagIconCategory } from '../core/utils/bag-icon-categories.utils';

test('Icon categories cover every installed icon and use installed navigation icons', () => {
  const ids = new Set(BAG_ICON_CATEGORIES.map(category => category.id));
  const installed = new Set(icons);
  for (const category of BAG_ICON_CATEGORIES) assert.ok(installed.has(category.icon), category.icon);
  const counts = new Map<string, number>();
  for (const icon of icons) {
    const category = bagIconCategory(icon);
    assert.ok(ids.has(category), icon);
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  for (const id of ids) if (id !== 'all' && id !== 'recent') assert.ok((counts.get(id) || 0) > 0, id);
});
test('Icon categories distinguish people, nature, food, activities, travel, objects, symbols, flags and RPG equipment', () => {
  for (const [icon, expected] of [
    ['mdi-account-group', 'people'], ['mdi-emoticon-outline', 'people'],
    ['mdi-cat', 'nature'], ['mdi-flower', 'nature'], ['mdi-weather-sunny', 'nature'],
    ['mdi-food-apple-outline', 'food'], ['mdi-coffee', 'food'],
    ['mdi-soccer', 'activity'], ['mdi-guitar-electric', 'activity'],
    ['mdi-airplane', 'travel'], ['mdi-home', 'travel'], ['mdi-map-marker', 'travel'],
    ['mdi-laptop', 'objects'], ['mdi-camera', 'objects'],
    ['mdi-arrow-up', 'symbols'], ['mdi-math-integral', 'symbols'],
    ['mdi-flag-outline', 'flags'], ['mdi-flag-checkered', 'flags'],
    ['mdi-sword-cross', 'rpg'], ['mdi-shield', 'rpg'], ['mdi-dice-d20-outline', 'rpg'],
  ]) assert.equal(bagIconCategory(icon!), expected, icon);
});
