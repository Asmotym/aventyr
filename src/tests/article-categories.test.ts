import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryOptions } from '../core/utils/article-categories';
import { isArticleSort, type ArticleCategory } from '../../server/core/types/data.types';

test('category paths preserve hierarchy and sibling positions with duplicate names', () => {
  const make = (id: string, name: string, parentId: string | null, position: number): ArticleCategory => ({ id, name, description: null, parentId, position });
  const rows = [make('b', 'Same name', null, 1), make('c', 'Leaf', 'a', 0), make('a', 'Same name', null, 0), make('d', 'Deep', 'c', 0), make('e', 'Leaf', 'b', 0)];
  const options = categoryOptions(rows);
  assert.deepEqual(options.map(row => row.id), ['a', 'c', 'd', 'b', 'e']);
  assert.deepEqual(options.map(row => row.depth), [0, 1, 2, 0, 1]);
  assert.equal(options[2].label, 'Same name / Leaf / Deep');
  assert.equal(rows[0].id, 'b');
});

test('article sort accepts only the public enum values', () => {
  for (const value of ['newest', 'oldest', 'title-asc', 'title-desc']) assert.equal(isArticleSort(value), true);
  for (const value of ['', undefined, null, [], 'title', 'newest; DROP TABLE articles']) assert.equal(isArticleSort(value), false);
});
