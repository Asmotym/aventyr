<template>
  <Teleport to="body">
    <div ref="menu" class="article-block-actions" :class="themeClasses" :style="{ '--article-block-actions-top': `${top}px`, '--article-block-actions-left': `${left}px` }" @keydown.esc.stop.prevent="escapeMenu">
      <div v-if="!showColors && !showAlignment" role="menu" :aria-label="t('articles.editor.blockActions')">
        <button v-if="textOnly" role="menuitem" @mousedown.prevent @click="showColors = true"><v-icon icon="mdi-format-paint" size="18" /><span>{{ t('articles.editor.tableColor') }}</span><v-icon icon="mdi-chevron-right" size="16" /></button>
        <button v-if="isTable" role="menuitem" @mousedown.prevent @click="showAlignment = true"><v-icon icon="mdi-table" size="18" /><span>{{ t('articles.editor.tableAlignment') }}</span><v-icon icon="mdi-chevron-right" size="16" /></button>
        <button role="menuitem" class="article-block-actions__delete-block" @mousedown.prevent @click="removeBlock"><v-icon icon="mdi-delete-outline" size="18" /><span>{{ t('articles.editor.deleteBlock') }}</span></button>
      </div>
      <div v-else-if="showAlignment" role="menu" :aria-label="t('articles.editor.tableAlignment')">
        <button @click="showAlignment = false"><v-icon icon="mdi-chevron-left" size="18" />{{ t('articles.editor.tableAlignment') }}</button>
        <button v-for="alignment in alignments" :key="alignment.value" role="menuitemradio" :aria-checked="tableAlignment === alignment.value" @mousedown.prevent @click="applyAlignment(alignment.value)"><v-icon :icon="alignment.icon" size="18" /><span>{{ t(`articles.editor.tableAlignments.${alignment.value}`) }}</span><v-icon v-if="tableAlignment === alignment.value" icon="mdi-check" size="16" /></button>
      </div>
      <template v-else>
        <button class="block-color-back" @click="showColors = false"><v-icon icon="mdi-chevron-left" size="18" />{{ t('articles.editor.tableColor') }}</button>
        <ArticleColorPalette allow-background @select="applyColor" />
      </template>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Editor } from '@tiptap/core';
import { useTheme } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { type ArticleTableAlignment, isTextOnlyArticleBlock } from '@shared/articles/document';
import { alignArticleTable, colorArticleBlock, deleteArticleBlock } from '@/features/articles/utils/article-block-actions';
import ArticleColorPalette from '@/features/articles/components/ArticleColorPalette.component.vue';
const props = defineProps<{ editor: Editor; pos: number; anchor: { top: number; left: number }; trigger?: HTMLElement }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const { themeClasses } = useTheme();
const menu = ref<HTMLElement>();
const showColors = ref(false);
const showAlignment = ref(false);
const isTable = computed(() => props.editor.state.doc.nodeAt(props.pos)?.type.name === 'table');
const tableAlignment = ref(props.editor.state.doc.nodeAt(props.pos)?.attrs.alignment ?? 'full');
let applyingAlignment = false;
const alignments: { value: ArticleTableAlignment; icon: string }[] = [
  { value: 'left', icon: 'mdi-align-horizontal-left' }, { value: 'center', icon: 'mdi-align-horizontal-center' },
  { value: 'right', icon: 'mdi-align-horizontal-right' }, { value: 'full', icon: 'mdi-arrow-expand-horizontal' }
];
function applyAlignment(value: ArticleTableAlignment) {
  applyingAlignment = true;
  try {
    if (alignArticleTable(props.editor.state, tr => props.editor.view.dispatch(tr), props.pos, value)) tableAlignment.value = value;
  } finally { applyingAlignment = false; }
}
const textOnly = computed(() => { const node = props.editor.state.doc.nodeAt(props.pos); return Boolean(node && isTextOnlyArticleBlock(node.toJSON())); });
const top = computed(() => Math.max(8, Math.min(props.anchor.top + 38, window.innerHeight - (showColors.value ? Math.min(560, window.innerHeight - 16) : showAlignment.value ? 208 : 112))));
const left = computed(() => Math.max(8, Math.min(props.anchor.left, window.innerWidth - 274)));
function removeBlock() { deleteArticleBlock(props.editor.state, tr => props.editor.view.dispatch(tr), props.pos); emit('close'); props.editor.view.focus(); }
function applyColor(value: { color: string | null; mode: 'text' | 'background' }) { colorArticleBlock(props.editor.state, tr => props.editor.view.dispatch(tr), props.pos, value.color, value.mode); emit('close'); props.editor.view.focus(); }
function outside(event: PointerEvent) { if (event.target instanceof Node && !menu.value?.contains(event.target) && !props.trigger?.contains(event.target)) emit('close'); }
function escapeMenu() { emit('close'); props.editor.view.focus(); }
function closeOnChange() { if (!applyingAlignment) emit('close'); }
onMounted(() => { window.addEventListener('pointerdown', outside); window.addEventListener('resize', closeOnChange); props.editor.on('update', closeOnChange); });
onBeforeUnmount(() => { window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', closeOnChange); props.editor.off('update', closeOnChange); });
</script>
<style scoped lang="scss" src="@/assets/styles/features/articles/article-block-actions.scss"></style>
