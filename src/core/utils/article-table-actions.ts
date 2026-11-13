import type { EditorState, Transaction } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';

export function articleTableContext(state: EditorState, cellPos: number) {
  const resolved = state.doc.resolve(cellPos);
  for (let depth = resolved.depth; depth > 0; depth--) {
    const table = resolved.node(depth);
    if (table.type.spec.tableRole !== 'table') continue;
    const start = resolved.start(depth);
    const map = TableMap.get(table);
    return { table, start, pos: resolved.before(depth), map, cell: map.findCell(cellPos - start) };
  }
  return null;
}
export function canDuplicateTableAxis(state: EditorState): boolean {
  if (!(state.selection instanceof CellSelection)) return false;
  const context = articleTableContext(state, state.selection.$anchorCell.pos);
  if (!context) return false;
  // A merged cell can span across the duplication boundary; don't split or corrupt it.
  let merged = false;
  context.table.descendants(node => { if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') merged ||= node.attrs.colspan !== 1 || node.attrs.rowspan !== 1; });
  return !merged;
}
export function duplicateTableAxis(state: EditorState, dispatch: (tr: Transaction) => void, axis: 'row' | 'column'): boolean {
  if (!(state.selection instanceof CellSelection) || !canDuplicateTableAxis(state)) return false;
  const context = articleTableContext(state, state.selection.$anchorCell.pos)!;
  const rows = [];
  for (let row = 0; row < context.table.childCount; row++) {
    const source = context.table.child(row);
    if (axis === 'row') {
      rows.push(source);
      if (row === context.cell.top) rows.push(source.copy(source.content));
    } else {
      const cells = [];
      for (let col = 0; col < source.childCount; col++) {
        const cell = source.child(col);
        cells.push(cell);
        if (col === context.cell.left) cells.push(cell.copy(cell.content));
      }
      rows.push(source.type.create(source.attrs, cells));
    }
  }
  const table = context.table.type.create(context.table.attrs, rows);
  const tr = state.tr.replaceWith(context.pos, context.pos + context.table.nodeSize, table);
  const map = TableMap.get(table);
  const row = context.cell.top + (axis === 'row' ? 1 : 0);
  const col = context.cell.left + (axis === 'column' ? 1 : 0);
  const cellPos = context.start + map.positionAt(row, col, table);
  tr.setSelection(axis === 'row' ? CellSelection.rowSelection(tr.doc.resolve(cellPos)) : CellSelection.colSelection(tr.doc.resolve(cellPos)));
  dispatch(tr.scrollIntoView());
  return true;
}
export function clearTableSelection(state: EditorState, dispatch: (tr: Transaction) => void): boolean {
  if (!(state.selection instanceof CellSelection)) return false;
  const cells: Array<{ pos: number; size: number }> = [];
  state.selection.forEachCell((node, pos) => cells.push({ pos, size: node.nodeSize }));
  const tr = state.tr;
  for (const cell of cells.sort((a, b) => b.pos - a.pos)) tr.replaceWith(cell.pos + 1, cell.pos + cell.size - 1, state.schema.nodes.paragraph.create());
  dispatch(tr);
  return true;
}
export function toggleTableSelectionHeader(state: EditorState, dispatch: (tr: Transaction) => void): boolean {
  if (!(state.selection instanceof CellSelection)) return false;
  const cells: Array<{ pos: number; attrs: Record<string, unknown>; header: boolean }> = [];
  state.selection.forEachCell((node, pos) => cells.push({ pos, attrs: node.attrs, header: node.type.spec.tableRole === 'header_cell' }));
  const type = cells.every(cell => cell.header) ? state.schema.nodes.tableCell : state.schema.nodes.tableHeader;
  const tr = state.tr;
  for (const cell of cells) tr.setNodeMarkup(cell.pos, type, cell.attrs);
  dispatch(tr);
  return true;
}
