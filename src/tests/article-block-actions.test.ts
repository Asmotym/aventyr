import assert from 'node:assert/strict';
import test from 'node:test';
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { articleExtensions, isTextOnlyArticleBlock, validateDocument } from '../../server/core/articles/document';
import { renderArticleDocument } from '../../server/core/articles/render';
import { alignArticleTable, colorArticleBlock, deleteArticleBlock } from '../core/utils/article-block-actions';
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
function makeState(content: object[]) {
  const schema = getSchema(articleExtensions());
  return EditorState.create({ doc: schema.nodeFromJSON({ type: 'doc', content }) });
}
test('block color is available only for text-only blocks, including nested lists and quotes', () => {
  assert.equal(isTextOnlyArticleBlock(paragraph('Text')), true);
  assert.equal(isTextOnlyArticleBlock({ type: 'heading', attrs: { level: 2 } }), true);
  assert.equal(isTextOnlyArticleBlock({ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('Item')] }] }), true);
  for (const node of [{ type: 'image' }, { type: 'horizontalRule' }, { type: 'table' }, { type: 'blockquote', content: [{ type: 'image', attrs: { src: 'https://example.com/test.png' } }] }]) assert.equal(isTextOnlyArticleBlock(node), false);
});
test('whole-block text/background colors affect only the selected block and survive rendering', () => {
  let state = makeState([paragraph('First'), paragraph('Second')]);
  const dispatch = (tr: Parameters<EditorState['apply']>[0]) => { state = state.apply(tr); };
  colorArticleBlock(state, dispatch, 0, '#6395cf', 'background');
  colorArticleBlock(state, dispatch, 0, '#da7272', 'text');
  assert.equal(state.doc.child(0).attrs.backgroundColor, '#6395cf');
  assert.equal(state.doc.child(0).firstChild!.marks[0].attrs.color, '#da7272');
  assert.equal(state.doc.child(1).attrs.backgroundColor, null);
  const html = renderArticleDocument(validateDocument({ version: 1, content: state.doc.toJSON() }));
  assert.ok(html.includes('background-color:#6395cf'));
  assert.ok(html.includes('color:#da7272'));
  assert.equal(colorArticleBlock(state, dispatch, 0, 'url(javascript:x)', 'background'), false);
  colorArticleBlock(state, dispatch, 0, null, 'text');
  colorArticleBlock(state, dispatch, 0, null, 'background');
  assert.equal(state.doc.firstChild!.attrs.textColor, null);
  assert.equal(state.doc.firstChild!.attrs.backgroundColor, null);
  assert.equal(state.doc.firstChild!.firstChild!.marks.length, 0);
});
test('block colors remain valid for code blocks and cannot color media', () => {
  let state = makeState([{ type: 'codeBlock', content: [{ type: 'text', text: 'const x = 1;' }] }]);
  colorArticleBlock(state, tr => { state = state.apply(tr); }, 0, '#6395cf', 'text');
  state.doc.check();
  assert.equal(state.doc.firstChild!.attrs.textColor, '#6395cf');
  state = makeState([{ type: 'image', attrs: { src: 'https://example.com/test.png' } }]);
  assert.equal(colorArticleBlock(state, () => assert.fail('must not color media'), 0, '#6395cf', 'text'), false);
});
test('deleting a block preserves its neighbors and deleting the final block creates an empty paragraph', () => {
  let state = makeState([paragraph('First'), paragraph('Second')]);
  const dispatch = (tr: Parameters<EditorState['apply']>[0]) => { state = state.apply(tr); };
  deleteArticleBlock(state, dispatch, 0);
  assert.equal(state.doc.childCount, 1);
  assert.equal(state.doc.textContent, 'Second');
  deleteArticleBlock(state, dispatch, 0);
  assert.equal(state.doc.childCount, 1);
  assert.equal(state.doc.firstChild!.type.name, 'paragraph');
  assert.equal(state.doc.textContent, '');
  state.doc.check();
});

test('table alignment changes only its layout, survives sanitized rendering and rejects invalid values', () => {
  let state = makeState([{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('Cell')] }] }] }, paragraph('After')]);
  for (const alignment of ['left', 'center', 'right', 'full'] as const) {
    assert.equal(alignArticleTable(state, tr => { state = state.apply(tr); }, 0, alignment), true);
    const doc = validateDocument({ version: 1, content: state.doc.toJSON() });
    const html = renderArticleDocument(doc);
    assert.ok(html.includes(`data-table-alignment="${alignment}"`));
    assert.ok(html.includes(`width:${alignment === 'full' ? '100%' : '75%'}`));
    assert.ok(html.includes(`margin-left:${['right', 'center'].includes(alignment) ? 'auto' : '0'}`));
    assert.equal(state.doc.lastChild!.textContent, 'After');
  }
  const invalid = state.doc.toJSON(); invalid.content[0].attrs.alignment = 'url(javascript:x)';
  assert.throws(() => validateDocument({ version: 1, content: invalid }), /Invalid table alignment/);
  assert.equal(alignArticleTable(state, () => assert.fail('must not change a paragraph'), state.doc.firstChild!.nodeSize, 'left'), false);
});
