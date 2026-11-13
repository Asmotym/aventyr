import { NodeSelection, Selection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { ARTICLE_TABLE_ALIGNMENTS, type ArticleTableAlignment, isTextOnlyArticleBlock } from 'netlify/core/articles/document';
import { isArticleColor } from 'netlify/core/articles/colors';

export function colorArticleBlock(state: EditorState, dispatch: (tr: Transaction) => void, pos: number, color: string | null, mode: 'text' | 'background'): boolean {
  const node = state.doc.nodeAt(pos);
  if (!node || !isTextOnlyArticleBlock(node.toJSON()) || color !== null && !isArticleColor(color)) return false;
  const attribute = mode === 'text' ? 'textColor' : 'backgroundColor';
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attribute]: color });
  if (mode === 'text') {
    node.descendants((child, offset) => {
      if ('textColor' in child.attrs) tr.setNodeMarkup(pos + 1 + offset, undefined, { ...child.attrs, textColor: null });
    });
    const mark = state.schema.marks.textStyle;
    tr.removeMark(pos + 1, pos + node.nodeSize - 1, mark);
    if (color) tr.addMark(pos + 1, pos + node.nodeSize - 1, mark.create({ color }));
  }
  tr.setSelection(NodeSelection.create(tr.doc, pos));
  dispatch(closeHistory(tr));
  return true;
}
export function deleteArticleBlock(state: EditorState, dispatch: (tr: Transaction) => void, pos: number): boolean {
  const node = state.doc.nodeAt(pos);
  if (!node || state.doc.resolve(pos).depth !== 0) return false;
  const tr = state.tr.deleteRange(pos, pos + node.nodeSize);
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))));
  dispatch(closeHistory(tr));
  return true;
}

export function alignArticleTable(state: EditorState, dispatch: (tr: Transaction) => void, pos: number, alignment: ArticleTableAlignment): boolean {
  const node = state.doc.nodeAt(pos);
  if (node?.type.name !== 'table' || !ARTICLE_TABLE_ALIGNMENTS.includes(alignment)) return false;
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, alignment });
  tr.setSelection(NodeSelection.create(tr.doc, pos));
  dispatch(closeHistory(tr));
  return true;
}
