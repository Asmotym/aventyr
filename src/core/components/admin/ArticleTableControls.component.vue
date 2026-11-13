<template>
  <Teleport to="body">
    <template v-if="cellPos !== null">
      <button ref="rowHandle" class="table-axis-handle table-row-handle" :class="themeClasses" :style="{ top: `${rowPosition.top}px`, left: `${rowPosition.left}px` }" :aria-label="t('articles.editor.rowActions')" :title="t('articles.editor.rowActions')" @mousedown.prevent @click="openMenu('row')" @mouseleave="leaveCell"><v-icon icon="mdi-drag-vertical" size="17" /></button>
      <button ref="columnHandle" class="table-axis-handle table-column-handle" :class="themeClasses" :style="{ top: `${columnPosition.top}px`, left: `${columnPosition.left}px` }" :aria-label="t('articles.editor.columnActions')" :title="t('articles.editor.columnActions')" @mousedown.prevent @click="openMenu('column')" @mouseleave="leaveCell"><v-icon icon="mdi-drag-horizontal" size="17" /></button>
      <button ref="cellHandle" class="table-axis-handle table-cell-handle" :class="themeClasses" :style="{ top: `${cellPosition.top}px`, left: `${cellPosition.left}px` }" :aria-label="t('articles.editor.cellActions')" :title="t('articles.editor.cellActions')" @mousedown.prevent @click="openMenu('cell')" @mouseleave="leaveCell"><v-icon icon="mdi-dots-horizontal" size="17" /></button>
    </template>
    <div v-if="menuOpen && outline" class="table-axis-outline" :style="{ top: `${outline.top}px`, left: `${outline.left}px`, width: `${outline.width}px`, height: `${outline.height}px` }"></div>
    <div v-if="menuOpen" ref="menu" class="table-action-menu" :class="themeClasses" :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }" @keydown.esc.stop.prevent="closeMenu">
      <template v-if="!showColors">
        <input v-model="search" class="table-action-search" :placeholder="t('articles.editor.searchActions')" :aria-label="t('articles.editor.searchActions')">
        <div role="menu" :aria-label="t(axis === 'row' ? 'articles.editor.rowActions' : axis === 'column' ? 'articles.editor.columnActions' : 'articles.editor.cellActions')">
          <button v-for="action in filteredActions" :key="action.key" :role="action.key === 'header' ? 'menuitemcheckbox' : 'menuitem'" :aria-checked="action.key === 'header' ? headerActive : undefined" :disabled="action.key === 'duplicate' && !canDuplicate" :class="{ 'danger-action': action.key === 'delete' || action.key === 'deleteTable' }" @mousedown.prevent @click="runAction(action.key)"><v-icon :icon="action.icon" size="17" /><span>{{ action.label }}</span><v-icon v-if="action.key === 'header'" :icon="headerActive ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'" size="23" /><v-icon v-if="action.key === 'color'" icon="mdi-chevron-right" size="16" /></button>
        </div>
      </template>
      <template v-else>
        <button class="table-color-back" @click="showColors = false"><v-icon icon="mdi-chevron-left" size="18" />{{ t('articles.editor.tableColor') }}</button>
        <ArticleColorPalette allow-background @select="applyColor" />
      </template>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Editor } from '@tiptap/core';
import { CellSelection } from '@tiptap/pm/tables';
import { useTheme } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { articleTableContext, canDuplicateTableAxis, clearTableSelection, duplicateTableAxis, toggleTableSelectionHeader } from 'core/utils/article-table-actions';
import ArticleColorPalette from './ArticleColorPalette.component.vue';
const props = defineProps<{ editor: Editor }>();
const { t } = useI18n();
const { themeClasses } = useTheme();
const cellPos = ref<number | null>(null);
let cellElement: HTMLElement | null = null;
const rowHandle = ref<HTMLElement>();
const columnHandle = ref<HTMLElement>();
const cellHandle = ref<HTMLElement>();
const menu = ref<HTMLElement>();
const rowPosition = ref({ top: 0, left: 0 });
const columnPosition = ref({ top: 0, left: 0 });
const cellPosition = ref({ top: 0, left: 0 });
const menuPosition = ref({ top: 0, left: 0 });
const menuOpen = ref(false);
const showColors = ref(false);
const search = ref('');
const axis = ref<'row' | 'column' | 'cell'>('row');
const outline = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const canDuplicate = computed(() => menuOpen.value && canDuplicateTableAxis(props.editor.state));
const headerActive = computed(() => {
  if (!menuOpen.value || !(props.editor.state.selection instanceof CellSelection)) return false;
  let all = true;
  props.editor.state.selection.forEachCell(node => { all &&= node.type.spec.tableRole === 'header_cell'; });
  return all;
});
const actions = computed(() => [
  { key: 'header', icon: 'mdi-table-headers-eye', label: t(axis.value === 'row' ? 'articles.editor.headerRow' : 'articles.editor.headerColumn') },
  { key: 'color', icon: 'mdi-format-paint', label: t('articles.editor.tableColor') },
  { key: 'before', icon: axis.value === 'row' ? 'mdi-arrow-up' : 'mdi-arrow-left', label: t(axis.value === 'row' ? 'articles.editor.insertAbove' : 'articles.editor.insertLeft') },
  { key: 'after', icon: axis.value === 'row' ? 'mdi-arrow-down' : 'mdi-arrow-right', label: t(axis.value === 'row' ? 'articles.editor.insertBelow' : 'articles.editor.insertRight') },
  { key: 'duplicate', icon: 'mdi-content-copy', label: t('articles.editor.duplicate') },
  { key: 'clear', icon: 'mdi-backspace-outline', label: t('articles.editor.clearContents') },
  { key: 'delete', icon: 'mdi-delete-outline', label: t(axis.value === 'row' ? 'articles.editor.deleteRow' : 'articles.editor.deleteColumn') },
  { key: 'deleteTable', icon: 'mdi-table-remove', label: t('articles.editor.deleteTable') }
].filter(action => axis.value !== 'cell' || ['color', 'clear'].includes(action.key)));
const filteredActions = computed(() => actions.value.filter(action => action.label.toLowerCase().includes(search.value.toLowerCase())));
function hoverCell(event: MouseEvent) {
  if (menuOpen.value) return;
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('td, th') : null;
  if (!target || !props.editor.view.dom.contains(target)) { cellPos.value = null; return; }
  const resolved = props.editor.state.doc.resolve(props.editor.view.posAtDOM(target, 0));
  for (let depth = resolved.depth; depth > 0; depth--) {
    if (['cell', 'header_cell'].includes(resolved.node(depth).type.spec.tableRole ?? '')) {
      cellPos.value = resolved.before(depth); cellElement = target; reposition(); return;
    }
  }
}
function leaveCell(event: MouseEvent) {
  if (menuOpen.value) return;
  const target = event.relatedTarget;
  if (target instanceof Node && (rowHandle.value?.contains(target) || columnHandle.value?.contains(target) || cellHandle.value?.contains(target) || cellElement?.contains(target))) return;
  cellPos.value = null;
}
function reposition() {
  if (cellPos.value === null || !cellElement?.isConnected) return;
  const context = articleTableContext(props.editor.state, cellPos.value);
  if (!context) return;
  const tableDom = props.editor.view.nodeDOM(context.pos);
  if (!(tableDom instanceof HTMLElement)) return;
  const tableRect = (tableDom.matches('.tableWrapper') ? tableDom.querySelector('table') ?? tableDom : tableDom).getBoundingClientRect();
  const cellRect = cellElement.getBoundingClientRect();
  rowPosition.value = { left: Math.max(2, tableRect.left - 12), top: cellRect.top + cellRect.height / 2 - 12 };
  columnPosition.value = { left: cellRect.left + cellRect.width / 2 - 12, top: tableRect.top - 12 };
  cellPosition.value = { left: Math.max(2, cellRect.right - 28), top: cellRect.top + 4 };
  if (menuOpen.value) updateOutline();
}
function updateOutline() {
  const cells = [...props.editor.view.dom.querySelectorAll<HTMLElement>('.selectedCell')].map(cell => cell.getBoundingClientRect());
  if (!cells.length) { outline.value = null; return; }
  const left = Math.min(...cells.map(c => c.left)), top = Math.min(...cells.map(c => c.top));
  outline.value = { left, top, width: Math.max(...cells.map(c => c.right)) - left, height: Math.max(...cells.map(c => c.bottom)) - top };
}
async function openMenu(value: 'row' | 'column' | 'cell') {
  if (cellPos.value === null) return;
  axis.value = value; search.value = ''; showColors.value = false;
  const resolved = props.editor.state.doc.resolve(cellPos.value);
  props.editor.view.dispatch(props.editor.state.tr.setSelection(value === 'row' ? CellSelection.rowSelection(resolved) : value === 'column' ? CellSelection.colSelection(resolved) : new CellSelection(resolved)));
  await nextTick();
  updateOutline();
  const anchor = value === 'row' ? rowPosition.value : value === 'column' ? columnPosition.value : cellPosition.value;
  menuPosition.value = { left: Math.max(8, Math.min(anchor.left, window.innerWidth - 280)), top: Math.max(8, Math.min(anchor.top + 24, window.innerHeight - (value === 'cell' ? 150 : 390))) };
  menuOpen.value = true;
}
function closeMenu() { menuOpen.value = false; showColors.value = false; outline.value = null; cellPos.value = null; }
function runAction(key: string) {
  if (key === 'color') {
    menuPosition.value.top = Math.min(menuPosition.value.top, Math.max(8, window.innerHeight - Math.min(560, window.innerHeight - 16) - 8));
    showColors.value = true; return;
  }
  const editor = props.editor;
  if (key === 'duplicate' && axis.value !== 'cell') duplicateTableAxis(editor.state, tr => editor.view.dispatch(tr), axis.value);
  else if (key === 'header') toggleTableSelectionHeader(editor.state, tr => editor.view.dispatch(tr));
  else if (key === 'clear') clearTableSelection(editor.state, tr => editor.view.dispatch(tr));
  else {
    const chain = editor.chain().focus();
    if (key === 'before') (axis.value === 'row' ? chain.addRowBefore() : chain.addColumnBefore()).run();
    if (key === 'after') (axis.value === 'row' ? chain.addRowAfter() : chain.addColumnAfter()).run();
    if (key === 'delete') (axis.value === 'row' ? chain.deleteRow() : chain.deleteColumn()).run();
    if (key === 'deleteTable') chain.deleteTable().run();
  }
  closeMenu();
}
function applyColor(value: { color: string | null; mode: 'text' | 'background' }) {
  const chain = props.editor.chain().focus().setCellAttribute(value.mode === 'text' ? 'textColor' : 'backgroundColor', value.color);
  if (value.mode === 'text') (value.color ? chain.setColor(value.color) : chain.unsetColor()).run();
  else chain.run();
  closeMenu();
}
function outside(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Node) || menu.value?.contains(target) || rowHandle.value?.contains(target) || columnHandle.value?.contains(target) || cellHandle.value?.contains(target)) return;
  closeMenu();
}
function documentChanged() { if (menuOpen.value) closeMenu(); else cellPos.value = null; }
onMounted(() => { window.addEventListener('pointerdown', outside); window.addEventListener('scroll', reposition, true); window.addEventListener('resize', closeMenu); props.editor.on('update', documentChanged); });
onBeforeUnmount(() => { window.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', closeMenu); props.editor.off('update', documentChanged); });
defineExpose({ hoverCell, leaveCell });
</script>
<style scoped>
.table-axis-handle { position: fixed; display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid rgba(var(--v-theme-primary), .5); border-radius: 5px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-primary)); box-shadow: 0 2px 6px #0002; z-index: 2100; }
.table-cell-handle { width: 22px; height: 20px; }
.table-axis-handle:hover { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.table-axis-outline { position: fixed; border: 2px solid #6395cf; pointer-events: none; z-index: 2000; }
.table-action-menu { position: fixed; width: 266px; max-height: calc(100vh - 16px); overflow: auto; padding: 6px; border: 1px solid rgba(var(--v-border-color), .3); border-radius: 10px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); box-shadow: 0 8px 28px #0004; z-index: 2400; }
.table-action-search { width: 100%; border: 1px solid rgba(var(--v-theme-on-surface), .18); border-radius: 6px; padding: 7px; margin-bottom: 6px; font-size: .8rem; outline-color: rgb(var(--v-theme-primary)); }
.table-action-menu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px; border-radius: 6px; font-size: .8rem; text-align: left; }
.table-action-menu button span { flex: 1; }
.table-action-menu button:hover, .table-action-menu button:focus-visible { background: rgba(var(--v-theme-on-surface), .07); }
.table-action-menu button:disabled { opacity: .35; cursor: not-allowed; }
.table-action-menu .danger-action { color: rgb(var(--v-theme-error)); }
.table-action-menu :deep(.article-color-palette) { width: 100%; }
</style>
