import assert from 'node:assert/strict';
import test from 'node:test';
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { articleExtensions, validateDocument } from '../../server/core/articles/document';
import { renderArticleDocument } from '../../server/core/articles/render';
import { normalizeColorHistory, rememberArticleColor } from '../../server/core/articles/colors';
import { articleTableContext, canDuplicateTableAxis, clearTableSelection, duplicateTableAxis, toggleTableSelectionHeader } from '../core/utils/article-table-actions';

function tableState(axis: 'row' | 'column') {
  const schema = getSchema(articleExtensions());
  const cell = (text: string, header = false) => ({ type: header ? 'tableHeader' : 'tableCell', attrs: { backgroundColor: '#123456' }, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  const table = schema.nodeFromJSON({ type: 'table', content: [
    { type: 'tableRow', content: [cell('A', true), cell('B', true)] },
    { type: 'tableRow', content: [cell('One'), cell('Two')] },
    { type: 'tableRow', content: [cell('Three'), cell('Four')] }
  ] });
  const doc = schema.nodes.doc.create(null, table);
  const pos = 1 + TableMap.get(table).positionAt(1, 0, table);
  return EditorState.create({ doc, selection: axis === 'row' ? CellSelection.rowSelection(doc.resolve(pos)) : CellSelection.colSelection(doc.resolve(pos)) });
}
test('table row actions duplicate contents and styling, clear only selected cells, and toggle selected headers', () => {
  let state = tableState('row');
  const dispatch = (tr: Parameters<EditorState['apply']>[0]) => { state = state.apply(tr); };
  assert.equal(articleTableContext(state, (state.selection as CellSelection).$anchorCell.pos)!.cell.top, 1);
  assert.equal(duplicateTableAxis(state, dispatch, 'row'), true);
  assert.equal(state.doc.firstChild!.childCount, 4);
  assert.equal(state.doc.firstChild!.child(2).textContent, 'OneTwo');
  assert.equal(state.doc.firstChild!.child(2).firstChild!.attrs.backgroundColor, '#123456');
  assert.equal(clearTableSelection(state, dispatch), true);
  assert.equal(state.doc.firstChild!.child(2).textContent, '');
  assert.equal(state.doc.firstChild!.child(1).textContent, 'OneTwo');
  toggleTableSelectionHeader(state, dispatch);
  assert.equal(state.doc.firstChild!.child(2).firstChild!.type.name, 'tableHeader');
  assert.equal(state.doc.firstChild!.child(1).firstChild!.type.name, 'tableCell');
  state.doc.check();
});
test('table column duplication copies each row without changing neighboring columns', () => {
  let state = tableState('column');
  duplicateTableAxis(state, tr => { state = state.apply(tr); }, 'column');
  const table = state.doc.firstChild!;
  assert.equal(table.firstChild!.childCount, 3);
  assert.equal(table.child(1).textContent, 'OneOneTwo');
  assert.equal(table.child(2).textContent, 'ThreeThreeFour');
  assert.equal(table.firstChild!.child(1).type.name, 'tableHeader');
  state.doc.check();
});
test('merged cells are preserved instead of being duplicated across a span boundary', () => {
  let state = tableState('row');
  const table = state.doc.firstChild!;
  const merged = table.firstChild!.firstChild!.type.create({ colspan: 2, rowspan: 1 }, table.firstChild!.firstChild!.content);
  const nextTable = table.type.create(null, [table.firstChild!.type.create(null, merged), table.child(1), table.child(2)]);
  const doc = state.schema.nodes.doc.create(null, nextTable);
  const pos = 1 + TableMap.get(nextTable).positionAt(1, 0, nextTable);
  state = EditorState.create({ doc, selection: CellSelection.rowSelection(doc.resolve(pos)) });
  assert.equal(canDuplicateTableAxis(state), false);
  assert.equal(duplicateTableAxis(state, () => assert.fail('must not mutate merged tables'), 'row'), false);
});
test('table text and background colors survive rendering and reject unsafe attributes', () => {
  const doc = { version: 1, content: tableState('row').doc.toJSON() };
  const html = renderArticleDocument(validateDocument(doc));
  assert.ok(html.includes('background-color:#123456'));
  const cell = doc.content.content![0].content![0].content![0];
  cell.attrs = { ...cell.attrs, textColor: '#6395cf' };
  assert.ok(renderArticleDocument(validateDocument(doc)).includes('color:#6395cf'));
  cell.attrs.backgroundColor = 'url(javascript:alert(1))';
  assert.throws(() => validateDocument(doc), /Invalid table color/);
});
test('color history categorizes presets and custom colors, deduplicates and caps each section', () => {
  let colors = normalizeColorHistory(null);
  colors = rememberArticleColor(colors, '#6395CF');
  colors = rememberArticleColor(colors, '#123456');
  colors = rememberArticleColor(colors, '#6395cf');
  assert.deepEqual(colors, { recent: ['#6395cf'], custom: ['#123456'] });
  for (let i = 0; i < 12; i++) colors = rememberArticleColor(colors, `#aabb${i.toString(16).padStart(2, '0')}`);
  assert.equal(colors.custom.length, 8);
  assert.deepEqual(normalizeColorHistory({ recent: ['javascript:x', '#123456'], custom: ['#6395cf', '#abcdef', '#abcdef'] }), { recent: [], custom: ['#abcdef'] });
});
