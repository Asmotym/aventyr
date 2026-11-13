<template>
  <div class="block-editor">
    <div class="editor-body-heading"><v-icon icon="mdi-text-long" size="18" /><span>{{ t('articles.editor.mainText') }}</span><v-spacer /><v-menu :z-index="2500"><template #activator="{ props: helpProps }"><v-btn v-bind="helpProps" size="x-small" variant="text" icon="mdi-keyboard-outline" :aria-label="t('articles.editor.shortcuts')" :title="t('articles.editor.shortcuts')" /></template><v-list class="editor-shortcuts" density="compact" :aria-label="t('articles.editor.shortcuts')"><v-list-item v-for="shortcut in shortcuts" :key="shortcut.key" :title="shortcut.label"><template #append><kbd>{{ modifierLabel }}+{{ shortcut.key }}</kbd></template></v-list-item></v-list></v-menu></div>
    <Teleport to="body">
      <div v-if="editor && selectionToolsOpen" ref="selectionTools" class="selection-tools" :class="themeClasses" :style="{ top: `${selectionPosition.top}px`, left: `${selectionPosition.left}px` }" role="toolbar" :aria-label="t('articles.editor.formatting')" @mousedown.prevent @keydown.esc="selectionToolsOpen = false">
        <v-menu :z-index="2500"><template #activator="{ props: typeProps }"><v-btn v-bind="typeProps" size="small" variant="text" append-icon="mdi-chevron-down">{{ editor.isActive('heading') ? `${t('articles.editor.heading')} ${editor.getAttributes('heading').level}` : t('articles.editor.text') }}</v-btn></template>
          <v-list density="compact"><v-list-item :title="t('articles.editor.text')" @click="editor.chain().focus().setParagraph().run()" /><v-list-item v-for="level in [1,2,3,4,5,6]" :key="level" :title="`${t('articles.editor.heading')} ${level}`" @click="editor.chain().focus().setHeading({ level: level as 1|2|3|4|5|6 }).run()" /></v-list>
        </v-menu>
        <span class="selection-tools-divider" />
        <v-btn v-for="item in toolbar" :key="item.label" size="small" variant="text" :title="`${item.label} (${modifierLabel}+${item.key})`" :aria-label="item.label" :aria-pressed="editor.isActive(item.mark)" :class="{ 'format-active': editor.isActive(item.mark) }" :icon="item.icon" @click="item.run()" />
        <v-menu :z-index="2500" v-model="linkOpen" :close-on-content-click="false" @update:model-value="captureLinkSelection">
          <template #activator="{ props: linkProps }"><v-btn v-bind="linkProps" size="small" variant="text" icon="mdi-link" :title="`${t('articles.editor.link')} (${modifierLabel}+K)`" :aria-label="t('articles.editor.link')" /></template>
          <v-card class="selection-link-popup" width="300"><v-card-text><v-text-field v-model="linkUrl" autofocus variant="outlined" density="compact" :label="t('articles.editor.link')" :error-messages="linkUrl && !safeArticleUrl(linkUrl) ? t('articles.editor.invalidUrl') : ''" @keydown.enter.prevent="applyLink" /><div class="d-flex justify-end ga-2"><v-btn variant="text" size="small" @click="linkUrl = ''; applyLink()">{{ t('articles.editor.removeLink') }}</v-btn><v-btn size="small" color="primary" :disabled="!!linkUrl && !safeArticleUrl(linkUrl)" @click="applyLink">{{ t('common.save') }}</v-btn></div></v-card-text></v-card>
        </v-menu>
        <v-menu :z-index="2500" v-model="textColorOpen" :close-on-content-click="false" @update:model-value="captureColorSelection">
          <template #activator="{ props: colorProps }"><v-btn v-bind="colorProps" size="small" variant="text" icon="mdi-format-color-text" :title="t('articles.editor.color')" :aria-label="t('articles.editor.color')" /></template>
          <ArticleColorPalette @select="applyTextColor" />
        </v-menu>
      </div>
    </Teleport>
    <div ref="surface" class="editor-surface" @mousemove="hoverBlock" @mouseleave="leaveBlockActions" @dragover.prevent @drop.capture="dropContent">
      <Teleport to="body">
      <div v-if="editor && activePos !== null" ref="actionsPopup" v-show="actionsVisible || dragSource !== null || blockMenuPos !== null" class="block-controls" :class="themeClasses" :style="{ top: `${handleTop}px`, left: `${handleLeft}px` }" @mouseleave="leaveBlockActions">
        <button :title="t('articles.editor.addBlock')" :aria-label="t('articles.editor.addBlock')" @mousedown.prevent @click="insertParagraph($event.altKey)">+</button>
        <span role="button" tabindex="0" class="drag-handle" :aria-grabbed="dragSource !== null" :title="t('articles.editor.dragBlock')" :aria-label="t('articles.editor.dragBlock')" @pointerdown.prevent="startBlockDrag" @pointermove="trackBlockDrag" @pointerup="finishBlockDrag" @pointercancel="cancelBlockDrag" @keydown.enter.prevent="openBlockMenu" @keydown.space.prevent="openBlockMenu" @keydown.up.prevent="moveBlock(-1)" @keydown.down.prevent="moveBlock(1)">⠿</span>
      </div>
      </Teleport>
      <ArticleBlockActions v-if="editor && blockMenuPos !== null" :editor="editor" :pos="blockMenuPos" :anchor="{ top: handleTop, left: handleLeft }" :trigger="actionsPopup" @close="closeBlockMenu" />
      <div v-if="dropTop !== null" class="block-drop-line" :style="{ top: `${dropTop}px` }"></div>
      <ArticleTableControls v-if="editor" ref="tableControls" :editor="editor" />
      <EditorContent :editor="editor" class="editor-content" :class="{ 'is-empty': showPlaceholder }" />
      <Teleport to="body">
        <div v-if="slash" class="slash-popup" :class="[themeClasses, { 'preview-before': previewSide === 'left' }]" :style="{ top: `${slashPosition.top}px`, left: `${slashPosition.left}px` }">
          <div ref="slashMenu" class="slash-menu" role="listbox" :aria-label="t('articles.editor.insert')">
            <button v-for="(command, index) in filteredCommands" :key="command.label" role="option" :aria-label="command.label" :aria-selected="index === selectedCommand" :class="{ selected: index === selectedCommand }" @mousemove="highlightCommand(index, $event)" @mousedown.prevent="runSlash(command)">
              <v-icon :icon="command.icon" size="18" aria-hidden="true" />
              <span class="command-label">{{ command.label }}</span>
              <kbd v-if="command.shortcut" class="command-shortcut" aria-hidden="true">{{ command.shortcut }}</kbd>
            </button>
            <span v-if="!filteredCommands.length">{{ t('articles.editor.noCommands') }}</span>
          </div>
          <aside v-if="previewCommand && previewSide !== 'hidden'" class="slash-preview">
            <ArticleBlockPreview :kind="previewCommand.kind" :level="previewCommand.level" :label="previewCommand.label" />
            <div class="slash-preview-caption">{{ previewCommand.label }}</div>
          </aside>
        </div>
      </Teleport>
    </div>
    <div class="editor-canvas-footer"><span><kbd>/</kbd> {{ t('articles.editor.commandHint') }}<span class="selection-hint"> · {{ t('articles.editor.selectionHint') }}</span></span><div><v-btn size="x-small" variant="text" icon="mdi-undo" :aria-label="t('articles.editor.undo')" :title="t('articles.editor.undo')" @mousedown.prevent @click="editor?.chain().focus().undo().run()" /><v-btn size="x-small" variant="text" icon="mdi-redo" :aria-label="t('articles.editor.redo')" :title="t('articles.editor.redo')" @mousedown.prevent @click="editor?.chain().focus().redo().run()" /></div></div>
    <Teleport to="body">
      <div v-if="imageDialog" ref="imagePopover" class="image-upload-popover" :class="themeClasses" :style="{ top: `${imagePopupPosition.top}px`, left: `${imagePopupPosition.left}px` }" role="dialog" :aria-label="t('articles.editor.addImage')" @keydown.esc.stop="imageDialog = false">
        <div class="image-popover-heading"><v-tabs v-model="imageTab" density="compact"><v-tab value="upload">{{ t('articles.editor.upload') }}</v-tab><v-tab value="link">{{ t('articles.editor.link') }}</v-tab></v-tabs><v-btn size="x-small" variant="text" icon="mdi-close" :aria-label="t('common.close')" @click="imageDialog = false" /></div>
        <div class="image-popover-body">
          <template v-if="imageTab === 'upload'">
            <input ref="uploadInput" class="image-file-input" type="file" hidden accept="image/jpeg,image/png,image/webp" :aria-label="t('articles.editor.uploadFile')" @change="chooseUpload" />
            <v-btn block variant="outlined" prepend-icon="mdi-tray-arrow-up" :loading="imageUploading" :disabled="imageUploading" @click="uploadInput?.click()">{{ t('articles.editor.uploadFile') }}</v-btn>
            <p class="image-upload-hint">JPEG, PNG, WebP · 5 MB</p>
          </template>
          <template v-else><v-text-field v-model="imageUrl" variant="outlined" density="compact" :label="t('articles.editor.imageUrl')" placeholder="https://" :error-messages="imageUrl && !safeArticleUrl(imageUrl, true) ? t('articles.editor.invalidUrl') : ''" @keydown.enter.prevent="insertImage(imageUrl)" /><v-btn block color="primary" variant="tonal" :disabled="!safeArticleUrl(imageUrl, true)" @click="insertImage(imageUrl)">{{ t('articles.editor.insertImage') }}</v-btn></template>
          <v-alert v-if="imageError" type="error" density="compact" class="mt-3">{{ imageError }}</v-alert>
        </div>
      </div>
    </Teleport>
    <v-dialog :z-index="2600" v-model="saveLibraryPrompt" max-width="440" :aria-label="t('articles.editor.saveToLibrary')" persistent>
      <v-card><v-card-title>{{ t('articles.editor.saveToLibrary') }}</v-card-title><v-card-text>{{ t('articles.editor.saveToLibraryHint') }}</v-card-text><v-card-actions><v-btn @click="finishUpload(false)">{{ t('articles.editor.onlyThisArticle') }}</v-btn><v-btn color="primary" variant="tonal" @click="finishUpload(true)">{{ t('articles.editor.saveToLibrary') }}</v-btn></v-card-actions></v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { nextTick, computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { Node as TiptapNode } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import ArticleBlockPreview from './ArticleBlockPreview.component.vue';
import ArticleBlockActions from './ArticleBlockActions.component.vue';
import ArticleColorPalette from './ArticleColorPalette.component.vue';
import ArticleTableControls from './ArticleTableControls.component.vue';
import { AllSelection, NodeSelection, TextSelection, type SelectionBookmark } from '@tiptap/pm/state';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { articleExtensions, safeArticleUrl, type ArticleDocument } from 'netlify/core/articles/document';
import { AdminArticleImagesService } from 'core/services/article-images.service';

const props = defineProps<{ modelValue: ArticleDocument; articleId?: string; draftId?: string; prepareDraft?: () => Promise<void>; sessionKey?: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: ArticleDocument]; uploaded: [] }>();
const { t } = useI18n();
const { themeClasses } = useTheme();
const surface = ref<HTMLElement>();
const activePos = ref<number | null>(null);
const blockMenuPos = ref<number | null>(null);
const actionsVisible = ref(false);
const handleTop = ref(0);
const handleLeft = ref(0);
const actionsPopup = ref<HTMLElement>();
const tableControls = ref<InstanceType<typeof ArticleTableControls>>();
const textColorOpen = ref(false);
let colorBookmark: SelectionBookmark | null = null;
const slash = ref<{ from: number; to: number; query: string } | null>(null);
const selectedCommand = ref(0);
let menuPointer: { x: number; y: number } | undefined;
const slashMenu = ref<HTMLElement>();
const slashPosition = ref({ top: 0, left: 16 });
const previewSide = ref<'right' | 'left' | 'hidden'>('right');
const imageDialog = ref(false);
const imageTab = ref('upload');
const imageUrl = ref('');
const imagePopover = ref<HTMLElement>();
const uploadInput = ref<HTMLInputElement>();
const imagePopupPosition = ref({ top: 0, left: 0 });
const imageUploading = ref(false);
const saveLibraryPrompt = ref(false);
let pendingUpload: File | null = null;
const selectionTools = ref<HTMLElement>();
const selectionToolsOpen = ref(false);
const selectionPosition = ref({ top: 0, left: 0 });
const linkOpen = ref(false);
const linkUrl = ref('');
let linkBookmark: SelectionBookmark | null = null;
const imageError = ref('');
let imagePosition: number | undefined;
let lastEmitted = '';
let contentGeneration = 0;
const dragSource = ref<number | null>(null);
const dropTop = ref<number | null>(null);
let pointerStart: { x: number; y: number } | null = null;
let dropBoundary: number | null = null;

// This editor-only node is omitted from saved documents until an image is chosen.
const ImagePlaceholder = TiptapNode.create({
  name: 'imagePlaceholder', group: 'block', atom: true, draggable: true,
  parseHTML: () => [{ tag: 'div[data-image-placeholder]' }],
  renderHTML: () => ['div', { 'data-image-placeholder': '' }],
  addNodeView() {
    return ({ getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'article-image-placeholder'; dom.contentEditable = 'false';
      const button = document.createElement('button'); button.type = 'button';
      const icon = document.createElement('span'); icon.className = 'mdi mdi-image-outline'; icon.setAttribute('aria-hidden', 'true');
      button.append(icon, document.createTextNode(t('articles.editor.addImage')));
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); const pos = getPos(); if (typeof pos === 'number') openImagePopup(pos); });
      dom.append(button);
      return { dom, stopEvent: event => event.target === button || button.contains(event.target as globalThis.Node) };
    };
  }
});
function savedContent(node: JSONContent): JSONContent {
  const content = node.content?.map(child => child.type === 'imagePlaceholder' ? { type: 'paragraph' } : savedContent(child));
  return { ...node, ...(content ? { content: node.type === 'doc' && !content.length ? [{ type: 'paragraph' }] : content } : {}) };
}
// Keep storage URLs in the document; authenticated data URLs are only used by the image DOM view.
const extensions = [ImagePlaceholder, ...articleExtensions().filter(extension => extension.name !== 'image'), Image.extend({
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('img');
      let current = node;
      let generation = 0;
      const refresh = () => {
        const token = ++generation;
        dom.alt = String(current.attrs.alt ?? '');
        const src = String(current.attrs.src ?? '');
        const match = src.match(/^\/api\/article-images\/([a-f0-9-]{36})$/);
        if (match) {
          void AdminArticleImagesService.preview(match[1]).then(url => { if (token === generation) dom.src = url; }).catch(() => { if (token === generation) dom.alt = t('articles.editor.imageUnavailable'); });
        } else if (safeArticleUrl(src, true)) dom.src = src;
      };
      refresh();
      return { dom, update(next) { if (next.type !== current.type) return false; if (next.attrs.src !== current.attrs.src || next.attrs.alt !== current.attrs.alt) { current = next; refresh(); } return true; }, destroy() { generation++; } };
    };
  }
})];
const editor = useEditor({
  extensions, content: props.modelValue.content,
  editorProps: {
    attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': t('articles.editor.body'), 'data-placeholder': t('articles.editor.placeholder') },
    handleKeyDown(_view, event) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.isComposing) {
        const key = event.key.toLowerCase();
        const instance = editor.value;
        if (instance) {
          if (!event.shiftKey && key === 'b') return instance.commands.toggleBold();
          if (!event.shiftKey && key === 'i') return instance.commands.toggleItalic();
          if (!event.shiftKey && key === 'u') return instance.commands.toggleUnderline();
          if (event.shiftKey && ['s', 'x'].includes(key)) return instance.commands.toggleStrike();
          if (!event.shiftKey && key === 'e') return instance.commands.toggleCode();
          if (key === 'z') return event.shiftKey ? instance.commands.redo() : instance.commands.undo();
          if (!event.shiftKey && key === 'y') return instance.commands.redo();
          if (!event.shiftKey && key === 'k' && !instance.state.selection.empty) {
            refreshSelectionTools();
            nextTick(() => { captureLinkSelection(true); linkOpen.value = true; });
            return true;
          }
        }
      }
      if (event.altKey && event.key === 'F10' && !_view.state.selection.empty) {
        refreshSelectionTools();
        nextTick(() => selectionTools.value?.querySelector<HTMLButtonElement>('button')?.focus());
        return true;
      }
      if (!slash.value) return false;
      if (event.key === 'Escape') { slash.value = null; return true; }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        const length = filteredCommands.value.length;
        selectedCommand.value = length ? (selectedCommand.value + (event.key === 'ArrowDown' ? 1 : -1) + length) % length : 0;
        return true;
      }
      if (event.key === 'Enter' && filteredCommands.value[selectedCommand.value]) { runSlash(filteredCommands.value[selectedCommand.value]!); return true; }
      return false;
    }
  },
  onTransaction({ transaction }) {
    if (textColorOpen.value && colorBookmark) colorBookmark = colorBookmark.map(transaction.mapping);
    if (linkOpen.value && linkBookmark) linkBookmark = linkBookmark.map(transaction.mapping);
    if (imagePosition !== undefined && transaction.docChanged) {
      const mapped = transaction.mapping.mapResult(imagePosition);
      if (mapped.deleted) { imagePosition = undefined; imageDialog.value = false; }
      else imagePosition = mapped.pos;
    }
    nextTick(() => { refreshSelectionTools(); if (blockMenuPos.value !== null) positionHandle(blockMenuPos.value); });
  },
  onFocus() { nextTick(refreshSelectionTools); },
  onUpdate({ editor: instance }) {
    const document: ArticleDocument = { version: 1, content: savedContent(instance.getJSON()) };
    lastEmitted = JSON.stringify(document);
    emit('update:modelValue', document);
    const { $from, from, empty } = instance.state.selection;
    const text = $from.parent.textBetween(0, $from.parentOffset, '', '\ufffc');
    const match = empty && text.match(/(?:^|\s)(\/[^/]*)$/);
    slash.value = match ? { from: from - match[1].length, to: from, query: match[1].slice(1) } : null;
    if (match) positionSlashPopup();
    selectedCommand.value = 0;
  },
  onSelectionUpdate({ editor: instance }) {
    refreshSelectionTools();
    if (slash.value && (!instance.state.selection.empty || instance.state.selection.from !== slash.value.to)) slash.value = null;
  }
});
const showPlaceholder = computed(() => {
  const doc = editor.value?.state.doc;
  return doc?.childCount === 1 && doc.firstChild?.type.name === 'paragraph' && doc.firstChild.content.size === 0;
});
watch(() => props.modelValue, value => {
  if (JSON.stringify(value) !== lastEmitted && JSON.stringify(value.content) !== JSON.stringify(savedContent(editor.value?.getJSON() ?? {}))) {
    contentGeneration++; imageDialog.value = false; imagePosition = undefined; selectionToolsOpen.value = false;
    editor.value?.commands.setContent(value.content, { emitUpdate: false });
  }
}, { deep: true });
watch(() => [props.sessionKey, props.articleId], () => {
  contentGeneration++; imageDialog.value = false; imagePosition = undefined; selectionToolsOpen.value = false;
  textColorOpen.value = false; linkOpen.value = false;
  editor.value?.commands.setContent(props.modelValue.content, { emitUpdate: false });
  lastEmitted = JSON.stringify(props.modelValue);
});
function captureColorSelection(open: boolean) {
  colorBookmark = open ? editor.value?.state.selection.getBookmark() ?? null : null;
}
function applyTextColor(value: { color: string | null }) {
  const instance = editor.value;
  if (!instance) return;
  const bookmark = colorBookmark;
  textColorOpen.value = false; colorBookmark = null;
  if (bookmark) instance.view.dispatch(instance.state.tr.setSelection(bookmark.resolve(instance.state.doc)));
  (value.color ? instance.chain().focus().setColor(value.color) : instance.chain().focus().unsetColor()).run();
}
function positionSlashPopup() {
  const instance = editor.value;
  if (!instance || !slash.value) return;
  const caret = instance.view.coordsAtPos(slash.value.to);
  const menuWidth = Math.min(280, window.innerWidth - 32);
  const left = Math.max(16, Math.min(caret.left, window.innerWidth - menuWidth - 16));
  previewSide.value = window.innerWidth < 760 ? 'hidden' : left + menuWidth + 176 <= window.innerWidth - 16 ? 'right' : left >= 192 ? 'left' : 'hidden';
  const menuHeight = Math.min(280, Math.max(1, filteredCommands.value.length) * 36 + 14, window.innerHeight - 32);
  const height = Math.max(menuHeight, previewSide.value === 'hidden' ? 0 : 140);
  const below = window.innerHeight - caret.bottom - 16;
  const above = caret.top - 16;
  const top = below >= height || below >= above
    ? Math.min(caret.bottom + 6, window.innerHeight - height - 16)
    : caret.top - height - 6;
  slashPosition.value = { top: Math.max(16, top), left };
}
function repositionActions() {
  // Menu scrolling bubbles through the capture listener too; the caret anchor stays fixed.
  positionSlashPopup();
  refreshSelectionTools();
  positionImagePopup();
  if (activePos.value !== null && (actionsVisible.value || dragSource.value !== null || blockMenuPos.value !== null)) positionHandle(activePos.value);
}
onMounted(() => {
  window.addEventListener('scroll', repositionActions, true);
  window.addEventListener('resize', repositionActions);
  document.addEventListener('pointerdown', dismissPopups);
  document.addEventListener('focusin', dismissSelection);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', repositionActions, true);
  window.removeEventListener('resize', repositionActions);
  document.removeEventListener('pointerdown', dismissPopups);
  document.removeEventListener('focusin', dismissSelection);
  editor.value?.destroy();
});

type Command = { label: string; kind: string; icon: string; shortcut?: string; level?: number; run: () => void };
const commands = computed<Command[]>(() => [
  { kind: 'text', icon: 'mdi-format-text', label: t('articles.editor.text'), run: () => { editor.value?.chain().focus().setParagraph().run(); } },
  ...[1,2,3,4,5,6].map(level => ({ kind: 'heading', icon: `mdi-format-header-${level}`, shortcut: '#'.repeat(level), level, label: `${t('articles.editor.heading')} ${level}`, run: () => { editor.value?.chain().focus().toggleHeading({ level: level as 1|2|3|4|5|6 }).run(); } })),
  { kind: 'bulletList', icon: 'mdi-format-list-bulleted', shortcut: '-', label: t('articles.editor.bulletList'), run: () => { editor.value?.chain().focus().toggleBulletList().run(); } },
  { kind: 'orderedList', icon: 'mdi-format-list-numbered', shortcut: '1.', label: t('articles.editor.orderedList'), run: () => { editor.value?.chain().focus().toggleOrderedList().run(); } },
  { kind: 'taskList', icon: 'mdi-checkbox-marked-outline', shortcut: '[ ]', label: t('articles.editor.taskList'), run: () => { editor.value?.chain().focus().toggleTaskList().run(); } },
  { kind: 'quote', icon: 'mdi-format-quote-close', shortcut: '>', label: t('articles.editor.quote'), run: () => { editor.value?.chain().focus().toggleBlockquote().run(); } },
  { kind: 'code', icon: 'mdi-code-braces', shortcut: '```', label: t('articles.editor.code'), run: () => { editor.value?.chain().focus().toggleCodeBlock().run(); } },
  { kind: 'divider', icon: 'mdi-minus', shortcut: '---', label: t('articles.editor.divider'), run: () => { editor.value?.chain().focus().setHorizontalRule().run(); } },
  { kind: 'table', icon: 'mdi-table', label: t('articles.editor.table'), run: () => { editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); } },
  { kind: 'image', icon: 'mdi-image-outline', shortcut: '![]()', label: t('articles.editor.image'), run: addImagePlaceholder }
]);
const filteredCommands = computed(() => commands.value.filter(c => c.label.toLowerCase().includes(slash.value?.query.toLowerCase() ?? '')));
const previewCommand = computed(() => filteredCommands.value[selectedCommand.value]);
watch([selectedCommand, () => slash.value?.query], () => {
  const menu = slashMenu.value;
  const selected = menu?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (!menu || !selected) return;
  if (selectedCommand.value === 0) { menu.scrollTop = 0; return; }
  const menuRect = menu.getBoundingClientRect();
  const selectedRect = selected.getBoundingClientRect();
  const inset = parseFloat(getComputedStyle(menu).paddingTop) || 0;
  if (selectedRect.top < menuRect.top + inset) menu.scrollTop -= menuRect.top + inset - selectedRect.top;
  else if (selectedRect.bottom > menuRect.bottom - inset) menu.scrollTop += selectedRect.bottom - menuRect.bottom + inset;
}, { flush: 'post' });
function highlightCommand(index: number, event: MouseEvent) {
  // Scrolling can move a different row under a stationary pointer. Keep keyboard selection then.
  if (menuPointer?.x === event.clientX && menuPointer.y === event.clientY) return;
  menuPointer = { x: event.clientX, y: event.clientY };
  selectedCommand.value = index;
}
function runSlash(command: Command) { if (slash.value) editor.value?.chain().focus().deleteRange({ from: slash.value.from, to: slash.value.to }).run(); slash.value = null; command.run(); }
const modifierLabel = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
const toolbar = computed(() => [
  { mark: 'bold', key: 'B', label: t('articles.editor.bold'), icon: 'mdi-format-bold', run: () => editor.value?.chain().focus().toggleBold().run() },
  { mark: 'italic', key: 'I', label: t('articles.editor.italic'), icon: 'mdi-format-italic', run: () => editor.value?.chain().focus().toggleItalic().run() },
  { mark: 'underline', key: 'U', label: t('articles.editor.underline'), icon: 'mdi-format-underline', run: () => editor.value?.chain().focus().toggleUnderline().run() },
  { mark: 'strike', key: 'Shift+S', label: t('articles.editor.strike'), icon: 'mdi-format-strikethrough', run: () => editor.value?.chain().focus().toggleStrike().run() },
  { mark: 'code', key: 'E', label: t('articles.editor.inlineCode'), icon: 'mdi-code-tags', run: () => editor.value?.chain().focus().toggleCode().run() }
]);
const shortcuts = computed(() => [...toolbar.value, { key: 'K', label: t('articles.editor.link') }, { key: 'Z', label: t('articles.editor.undo') }, { key: 'Shift+Z', label: t('articles.editor.redo') }]);
function refreshSelectionTools() {
  const instance = editor.value;
  if (!instance || !instance.view.dom.getClientRects().length) { selectionToolsOpen.value = false; return; }
  const { selection } = instance.state;
  if (!(selection instanceof TextSelection || selection instanceof AllSelection) || selection.empty || !instance.state.doc.textBetween(selection.from, selection.to).trim() || slash.value) {
    selectionToolsOpen.value = false; return;
  }
  if (!instance.view.hasFocus() && !selectionToolsOpen.value) return;
  selectionToolsOpen.value = true;
  const start = instance.view.coordsAtPos(selection.from);
  const end = instance.view.coordsAtPos(selection.to);
  const width = Math.min(selectionTools.value?.offsetWidth || 460, window.innerWidth - 24);
  const height = selectionTools.value?.offsetHeight || 48;
  selectionPosition.value = {
    left: Math.max(12, Math.min((start.left + end.left) / 2 - width / 2, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(start.top > height + 16 ? start.top - height - 8 : end.bottom + 8, window.innerHeight - height - 12))
  };
}
function dismissSelection(event: Event) {
  const target = event.target as HTMLElement;
  if (editor.value?.view.dom.contains(target) || selectionTools.value?.contains(target) || target.closest('.v-overlay__content')) return;
  selectionToolsOpen.value = false;
}
function dismissPopups(event: PointerEvent) {
  dismissSelection(event);
  if (!(event.target instanceof HTMLElement)) return;
  if (imagePopover.value?.contains(event.target) || event.target.closest('.article-image-placeholder, .v-overlay__content') || saveLibraryPrompt.value) return;
  imageDialog.value = false;
}
function captureLinkSelection(open: boolean) {
  linkBookmark = open ? editor.value?.state.selection.getBookmark() ?? null : null;
  if (open) linkUrl.value = editor.value?.getAttributes('link').href ?? '';
}
function applyLink() {
  const instance = editor.value;
  if (!instance || (linkUrl.value && !safeArticleUrl(linkUrl.value))) return;
  if (linkBookmark) instance.view.dispatch(instance.state.tr.setSelection(linkBookmark.resolve(instance.state.doc)));
  const chain = instance.chain().focus();
  if (linkUrl.value) chain.setLink({ href: linkUrl.value }).run(); else chain.unsetLink().run();
  linkOpen.value = false;
}
function addImagePlaceholder() {
  const instance = editor.value;
  if (!instance) return;
  instance.chain().focus().insertContent({ type: 'imagePlaceholder' }).run();
  let pos: number | undefined;
  instance.state.doc.descendants((node, nodePos) => { if (node.type.name === 'imagePlaceholder' && nodePos <= instance.state.selection.from) pos = nodePos; });
  if (pos !== undefined) openImagePopup(pos);
}
function openImagePopup(pos: number) {
  if (imageUploading.value) return;
  imagePosition = pos; imageError.value = ''; imageUrl.value = ''; imageTab.value = 'upload'; imageDialog.value = true;
  nextTick(positionImagePopup);
}
function positionImagePopup() {
  if (!imageDialog.value || imagePosition === undefined) return;
  const dom = editor.value?.view.nodeDOM(imagePosition);
  if (!(dom instanceof HTMLElement)) { imageDialog.value = false; return; }
  const rect = dom.getBoundingClientRect();
  const width = Math.min(520, window.innerWidth - 32);
  const height = imagePopover.value?.offsetHeight || 180;
  imagePopupPosition.value = {
    left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
    top: Math.max(16, Math.min(rect.bottom + height + 12 < window.innerHeight ? rect.bottom + 8 : rect.top - height - 8, window.innerHeight - height - 16))
  };
}
watch([imageTab, imageError, imageUrl], () => nextTick(positionImagePopup));
function positionHandle(pos: number) {
  const instance = editor.value;
  if (!instance || !surface.value) return;
  activePos.value = pos;
  const dom = instance.view.nodeDOM(pos);
  if (dom instanceof HTMLElement) {
    const rect = (dom.matches('.tableWrapper') ? dom.querySelector('table') ?? dom : dom).getBoundingClientRect();
    handleTop.value = rect.top + (rect.height - (actionsPopup.value?.offsetHeight || 36)) / 2;
    handleLeft.value = Math.max(4, instance.view.dom.getBoundingClientRect().left - 66);
  }
}
function leaveBlockActions(event: MouseEvent) {
  if (blockMenuPos.value !== null) return;
  tableControls.value?.leaveCell(event);
  if (dragSource.value !== null) return;
  const target = event.relatedTarget;
  if (target instanceof Element && target.closest('.table-axis-handle')) return;
  if (target instanceof Node && (surface.value?.contains(target) || actionsPopup.value?.contains(target))) return;
  actionsVisible.value = false;
}
function hoverBlock(event: MouseEvent) {
  if (blockMenuPos.value !== null) return;
  tableControls.value?.hoverCell(event);
  const instance = editor.value;
  if (!instance || dragSource.value !== null) return;
  const popupRect = actionsPopup.value?.getBoundingClientRect();
  if (popupRect && event.clientX >= popupRect.left && event.clientX <= popupRect.right && event.clientY >= popupRect.top && event.clientY <= popupRect.bottom) return;
  actionsVisible.value = false;
  // Include the gutter so the pointer can travel from the block to its actions.
  // Hit-test the whole padded block, including atom blocks without a text cursor position.
  const dom = [...instance.view.dom.children].find(element => {
    const rect = element.getBoundingClientRect();
    return event.clientY >= rect.top - 1 && event.clientY <= rect.bottom + 1;
  });
  if (!(dom instanceof HTMLElement)) return;
  const editorLeft = instance.view.dom.getBoundingClientRect().left;
  if (event.clientX > editorLeft + ((event.target as HTMLElement).closest('td, th') ? 6 : 24)) return;
  const resolved = instance.state.doc.resolve(instance.view.posAtDOM(dom, 0));
  const pos = resolved.depth ? resolved.before(1) : resolved.pos;
  positionHandle(pos);
  actionsVisible.value = true;
}
function insertParagraph(before: boolean) {
  const instance = editor.value;
  if (!instance || activePos.value === null) return;
  const node = instance.state.doc.nodeAt(activePos.value);
  const position = activePos.value + (before ? 0 : node?.nodeSize ?? 0);
  instance.chain().focus().insertContentAt(position, { type: 'paragraph' }).setTextSelection(position + 1).run();
}
function moveBlock(direction: -1 | 1) {
  const instance = editor.value;
  if (!instance || activePos.value === null) return;
  const positions: number[] = [];
  instance.state.doc.forEach((_node, pos) => positions.push(pos));
  const index = positions.indexOf(activePos.value);
  const target = positions[index + direction];
  const node = instance.state.doc.nodeAt(activePos.value);
  if (target === undefined || !node) return;
  const end = direction < 0 ? target : target + instance.state.doc.nodeAt(target)!.nodeSize - node.nodeSize;
  const tr = instance.state.tr.delete(activePos.value, activePos.value + node.nodeSize).insert(end, node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(end + 1)));
  instance.view.dispatch(tr.scrollIntoView());
  positionHandle(end);
}
function startBlockDrag(event: PointerEvent) {
  blockMenuPos.value = null;
  const instance = editor.value;
  if (!instance || activePos.value === null || event.button !== 0) return;
  dragSource.value = activePos.value;
  pointerStart = { x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  instance.view.dispatch(instance.state.tr.setSelection(NodeSelection.create(instance.state.doc, activePos.value)));
}
function trackBlockDrag(event: PointerEvent) {
  const instance = editor.value;
  if (!instance || dragSource.value === null || !pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 5) return;
  const target = instance.view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!target) { dropBoundary = null; dropTop.value = null; return; }
  const resolved = instance.state.doc.resolve(target.pos);
  let boundary = resolved.depth ? resolved.before(1) : target.pos;
  const node = instance.state.doc.nodeAt(boundary);
  const dom = instance.view.nodeDOM(boundary);
  if (!(dom instanceof HTMLElement) || !surface.value) return;
  const rect = dom.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  if (after && node) boundary += node.nodeSize;
  dropBoundary = boundary;
  dropTop.value = (after ? rect.bottom : rect.top) - surface.value.getBoundingClientRect().top;
}
function cancelBlockDrag() { dragSource.value = null; dropTop.value = null; pointerStart = null; dropBoundary = null; }
function openBlockMenu() {
  const instance = editor.value;
  if (!instance || activePos.value === null || !instance.state.doc.nodeAt(activePos.value)) return;
  instance.view.dispatch(instance.state.tr.setSelection(NodeSelection.create(instance.state.doc, activePos.value)));
  blockMenuPos.value = activePos.value;
}
function closeBlockMenu() { blockMenuPos.value = null; actionsVisible.value = false; }
function finishBlockDrag(event: PointerEvent) {
  trackBlockDrag(event);
  const instance = editor.value;
  const from = dragSource.value;
  const boundary = dropBoundary;
  const moved = pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) >= 5;
  cancelBlockDrag();
  if (!instance || from === null) return;
  if (!moved) { openBlockMenu(); return; }
  if (boundary === null) return;
  const node = instance.state.doc.nodeAt(from);
  if (!node || boundary >= from && boundary <= from + node.nodeSize) return;
  const tr = instance.state.tr.delete(from, from + node.nodeSize);
  const insertion = tr.mapping.map(boundary);
  tr.insert(insertion, node).setSelection(TextSelection.near(tr.doc.resolve(insertion + 1)));
  instance.view.dispatch(tr.scrollIntoView());
  instance.view.focus(); positionHandle(insertion);
  hoverBlock(event);
}
function dropContent(event: DragEvent) {
  const instance = editor.value;
  if (!instance) return;
  const src = event.dataTransfer?.getData('application/x-aventyr-image');
  if (!src || !safeArticleUrl(src, true)) return;
  event.preventDefault(); event.stopPropagation();
  const pos = instance.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
  insertImage(src, pos);
}
function insertImage(src: string, pos = imagePosition) {
  if (!safeArticleUrl(src, true) || !editor.value) return;
  const instance = editor.value;
  if (pos !== undefined && instance.state.doc.nodeAt(pos)?.type.name === 'imagePlaceholder') {
    instance.chain().focus().insertContentAt({ from: pos, to: pos + 1 }, { type: 'image', attrs: { src, alt: '' } }).run();
  } else {
    const chain = instance.chain().focus();
    if (pos !== undefined) chain.setTextSelection(pos);
    chain.setImage({ src, alt: '' }).run();
  }
  imageDialog.value = false; imagePosition = undefined; imageUrl.value = '';
}
function chooseUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  pendingUpload = input.files?.[0] ?? null;
  input.value = '';
  if (pendingUpload) saveLibraryPrompt.value = true;
}
async function finishUpload(library: boolean) {
  const file = pendingUpload;
  saveLibraryPrompt.value = false;
  if (!file || imageUploading.value) return;
  imageUploading.value = true; imageError.value = '';
  const generation = contentGeneration;
  try {
    if (!library) { await props.prepareDraft?.(); await nextTick(); }
    const image = await AdminArticleImagesService.upload(file, library ? undefined : props.articleId, library ? undefined : props.draftId, library);
    if (generation === contentGeneration && imagePosition !== undefined) insertImage(image.url);
    emit('uploaded');
  } catch (error) { imageError.value = error instanceof Error ? error.message : t('articles.editor.uploadError'); }
  finally { imageUploading.value = false; pendingUpload = null; }
}
defineExpose({ insertImage });
</script>
<style scoped>
.block-editor { border: 1px solid rgba(var(--v-theme-on-surface), .16); border-radius: 14px; background: color-mix(in srgb, rgb(var(--v-theme-surface-bright)) 65%, rgb(var(--v-theme-surface))); box-shadow: 0 12px 32px #0001, inset 0 1px 0 rgba(var(--v-theme-on-surface), .07); transition: border-color .2s, box-shadow .2s; }
.block-editor:focus-within { border-color: rgba(var(--v-theme-primary), .55); box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), .07), 0 12px 32px #0001; }
.editor-body-heading { display:flex; align-items:center; gap:9px; padding:14px 18px; border-radius:13px 13px 0 0; border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); color:rgba(var(--v-theme-on-surface),.6); background:rgba(var(--v-theme-primary),.035); font-size:.78rem; font-weight:600; letter-spacing:.03em; }
.selection-tools { position:fixed; z-index:2450; display:flex; align-items:center; gap:2px; flex-wrap:wrap; max-width:calc(100vw - 24px); padding:5px; border:1px solid rgba(var(--v-border-color),.25); border-radius:12px; color:rgb(var(--v-theme-on-surface)); background:rgb(var(--v-theme-surface)); box-shadow:0 8px 32px #0004; }
.selection-tools :deep(.v-btn) { border-radius:7px; }
.selection-tools :deep(.format-active) { color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.13); }
.selection-hint { margin-left: 4px; }
.editor-shortcuts kbd { margin-left: 24px; color: rgba(var(--v-theme-on-surface), .6); font-size: .72rem; }
.selection-tools-divider { width:1px; height:24px; margin:0 3px; background:rgba(var(--v-theme-on-surface),.12); }
.image-upload-popover { position:fixed; z-index:2400; width:min(520px, calc(100vw - 32px)); border:1px solid rgba(var(--v-border-color),.25); border-radius:14px; color:rgb(var(--v-theme-on-surface)); background:rgb(var(--v-theme-surface)); box-shadow:0 12px 40px #0004; overflow:hidden; }
.image-popover-heading { display:flex; justify-content:space-between; align-items:center; padding:4px 12px 0; border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); }
.image-popover-body { padding:18px; }
.image-upload-hint { text-align:center; margin:10px 0 0; font-size:.68rem; color:rgba(var(--v-theme-on-surface),.45); }
.image-file-input { position:absolute; width:1px; height:1px; opacity:0; overflow:hidden; }
:deep(.article-image-placeholder) { border:1px dashed rgba(var(--v-theme-primary),.35); border-radius:12px; background:rgba(var(--v-theme-primary),.045); }
:deep(.article-image-placeholder button) { display:flex; align-items:center; gap:12px; width:100%; padding:12px 16px; text-align:left; color:rgba(var(--v-theme-on-surface),.6); font-size:.85rem; }
:deep(.article-image-placeholder button:hover), :deep(.article-image-placeholder button:focus-visible) { color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.07); }
:deep(.article-image-placeholder .mdi) { font-size:22px; }
.editor-surface { position: relative; padding: 22px 16px 48px; min-height: 420px; }
.editor-canvas-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid rgba(var(--v-theme-on-surface), .07); border-radius: 0 0 13px 13px; color: rgba(var(--v-theme-on-surface), .48); font-size: .7rem; }
.editor-canvas-footer kbd { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; margin-right: 6px; border: 1px solid rgba(var(--v-theme-on-surface), .15); border-radius: 5px; font-family: inherit; background: rgba(var(--v-theme-on-surface), .035); }
.editor-content.is-empty :deep(.tiptap)::before { content: attr(data-placeholder); position: absolute; margin-top: 6px; color: rgba(var(--v-theme-on-surface), .38); pointer-events: none; font-style: italic; }
.block-controls { position:fixed; display:flex; gap:2px; padding:4px; border:1px solid rgba(var(--v-border-color),.25); border-radius:10px; background:rgb(var(--v-theme-surface)); color:rgb(var(--v-theme-on-surface)); box-shadow:0 4px 16px #0003; z-index:2000; }
.block-controls button, .block-controls .drag-handle { display:inline-flex; align-items:center; justify-content:center; width:24px; min-height:26px; border-radius:4px; background:rgba(var(--v-theme-on-surface),.08); }
.block-controls .drag-handle { cursor:grab; touch-action:none; user-select:none; }
.block-drop-line { position:absolute; left:16px; right:16px; border-top:2px solid rgb(var(--v-theme-primary)); pointer-events:none; z-index:3; }
.slash-popup { position: fixed; z-index: 2400; color: rgb(var(--v-theme-on-surface)); }
.slash-menu { width: min(280px, calc(100vw - 32px)); max-height: min(280px, calc(100vh - 32px)); overflow: auto; background: rgb(var(--v-theme-surface)); border: 1px solid rgba(var(--v-border-color), .3); border-radius: 10px; padding: 6px; box-shadow: 0 8px 24px #0004; }
.slash-menu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border-radius: 6px; font-size: .85rem; text-align: left; }
.slash-menu button > .v-icon { flex-shrink: 0; opacity: .6; }
.command-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.command-shortcut { flex-shrink: 0; margin-left: auto; padding-left: 12px; color: rgba(var(--v-theme-on-surface), .45); font-family: ui-monospace, monospace; font-size: .72rem; font-weight: 400; white-space: nowrap; }
.slash-menu .selected { color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .16); }
.slash-preview { position: absolute; left: calc(100% + 8px); top: 0; width: 160px; padding: 7px; border: 1px solid rgba(var(--v-border-color), .3); border-radius: 10px; background: rgb(var(--v-theme-surface)); box-shadow: 0 8px 24px #0003; pointer-events: none; }
.preview-before .slash-preview { left: auto; right: calc(100% + 8px); }
.slash-preview-caption { padding: 8px 3px 2px; color: rgba(var(--v-theme-on-surface), .7); font-size: .72rem; line-height: 1.4; }
:deep(.tiptap) { outline:none; min-height:300px; overflow-wrap:anywhere; line-height:1.75; }
:deep(.tiptap h1), :deep(.tiptap h2), :deep(.tiptap h3), :deep(.tiptap h4), :deep(.tiptap h5), :deep(.tiptap h6) { margin:0 0 12px; }
:deep(.tiptap p) { min-height:1.6em; margin:0 0 12px; }
:deep(.tiptap ul), :deep(.tiptap ol) { padding-left:24px; }
:deep(.tiptap img) { max-width:100%; height:auto; border-radius:6px; }
:deep(.tiptap pre) { background:#111827; color:#e5e7eb; padding:14px; border-radius:6px; white-space:pre-wrap; }
:deep(.tiptap blockquote) { border-left:3px solid rgb(var(--v-theme-primary)); padding-left:12px; }
:deep(.tiptap table) { border-collapse:collapse; width:100%; table-layout:fixed; }
:deep(.tiptap table[data-table-alignment]) { width:100% !important; }
:deep(.tiptap table[data-table-alignment=left]), :deep(.tiptap table[data-table-alignment=center]), :deep(.tiptap table[data-table-alignment=right]) { width:75% !important; }
:deep(.tiptap th) { background: rgba(var(--v-theme-primary), .08); font-weight: 600; }
:deep(.tiptap th), :deep(.tiptap td) { border:1px solid rgba(var(--v-border-color),.5); padding:6px; position:relative; }
/* A shared rhythm for every top-level block; internal lists/tables keep their own structure. */
.editor-content :deep(.tiptap) { display: flow-root; }
.editor-content :deep(.tiptap > *) { box-sizing: border-box; min-height: 36px; margin: 0; padding-top: 6px; padding-bottom: 6px; }
.editor-content :deep(.tiptap > * + *) { margin-top: 8px; }
.editor-content :deep(.tiptap > h1), .editor-content :deep(.tiptap > h2), .editor-content :deep(.tiptap > h3), .editor-content :deep(.tiptap > h4), .editor-content :deep(.tiptap > h5), .editor-content :deep(.tiptap > h6) { line-height: 1.35; }
.editor-content :deep(.tiptap li > p), .editor-content :deep(.tiptap td > p), .editor-content :deep(.tiptap th > p) { margin: 0; }
.editor-content :deep(.tiptap blockquote > :first-child) { margin-top: 0; }
.editor-content :deep(.tiptap blockquote > :last-child) { margin-bottom: 0; }
.editor-content :deep(.tiptap > hr) { position: relative; border: 0; }
.editor-content :deep(.tiptap > hr)::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; border-top: 1px solid rgba(var(--v-theme-on-surface), .2); }
:deep(.tiptap > .ProseMirror-selectednode) { outline: 1px solid rgba(var(--v-theme-primary), .55); outline-offset: 2px; border-radius: 3px; }
:deep(.selectedCell) { background:rgba(var(--v-theme-primary),.15); }
:deep(ul[data-type=taskList]) { list-style:none; padding:0; }
:deep(li[data-type=taskItem]) { display:flex; gap:8px; }
:deep(li[data-type=taskItem] > div) { flex:1; }
@media (prefers-reduced-motion: reduce) { .block-editor { transition: none; } }
@media (max-width: 600px) { .selection-tools { gap:0; } .selection-hint { display:none; } .editor-surface { min-height: 360px; } }
</style>
