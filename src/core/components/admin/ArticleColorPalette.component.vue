<template>
  <div class="article-color-palette" @mousedown.stop>
    <div v-if="allowBackground" class="color-mode">
      <button :class="{ active: mode === 'text' }" @click="mode = 'text'">{{ t('articles.editor.textColor') }}</button>
      <button :class="{ active: mode === 'background' }" @click="mode = 'background'">{{ t('articles.editor.backgroundColor') }}</button>
    </div>
    <button class="color-reset" @click="choose(null)"><v-icon icon="mdi-format-color-marker-cancel" size="18" />{{ t('articles.editor.defaultColor') }}</button>
    <div class="color-grid">
      <button v-for="color in ARTICLE_COLOR_PRESETS" :key="color.value" class="color-swatch" :style="{ '--swatch': color.value }" :title="t(`articles.editor.colorNames.${color.name}`)" :aria-label="t(`articles.editor.colorNames.${color.name}`)" @click="choose(color.value)"><span>A</span></button>
    </div>
    <template v-for="section in sections" :key="section.key">
      <div v-if="section.colors.length" class="color-section">
        <h4>{{ t(`articles.editor.${section.key}`) }}</h4>
        <div class="color-grid"><button v-for="color in section.colors" :key="color" class="color-swatch" :style="{ '--swatch': color }" :title="color" :aria-label="color" @click="choose(color)"><span>A</span></button></div>
      </div>
    </template>
    <details class="custom-color-picker">
      <summary>{{ t('articles.editor.chooseCustomColor') }}</summary>
      <AppColorPicker :model-value="customColor" :label="t('articles.editor.hexColor')" inline @update:model-value="value => { customColor = value; applyCustom(); }" />
    </details>
    <p v-if="error" class="color-save-error" role="status">{{ t('articles.editor.colorHistoryError') }}</p>
  </div>
</template>
<script setup lang="ts">
import AppColorPicker from 'core/components/common/AppColorPicker.component.vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ARTICLE_COLOR_PRESETS, isArticleColor } from 'netlify/core/articles/colors';
import { useArticleColors } from 'core/composables/useArticleColors';
defineProps<{ allowBackground?: boolean }>();
const emit = defineEmits<{ select: [value: { color: string | null; mode: 'text' | 'background' }] }>();
const { t } = useI18n();
const { history, error, remember } = useArticleColors();
const mode = ref<'text' | 'background'>('text');
const customColor = ref('#6395cf');
const sections = computed(() => [{ key: 'recentColors', colors: history.value.recent }, { key: 'customColors', colors: history.value.custom }]);
function choose(color: string | null) { if (color) remember(color); emit('select', { color, mode: mode.value }); }
function applyCustom() { if (isArticleColor(customColor.value)) choose(customColor.value.toLowerCase()); }
</script>
<style scoped>
.article-color-palette { width: 264px; max-height: min(540px, 70vh); overflow: auto; padding: 12px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); }
.color-mode { display: flex; gap: 4px; margin-bottom: 10px; }
.color-mode button { flex: 1; border-radius: 6px; padding: 6px; font-size: .75rem; }
.color-mode .active { background: rgba(var(--v-theme-primary), .15); color: rgb(var(--v-theme-primary)); }
.color-reset { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px; margin-bottom: 8px; border-radius: 6px; font-size: .8rem; text-align: left; }
.color-reset:hover { background: rgba(var(--v-theme-on-surface), .07); }
.color-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.color-swatch { display: grid; place-items: center; height: 32px; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--swatch) 60%, transparent); color: var(--swatch); background: color-mix(in srgb, var(--swatch) 12%, transparent); font-size: 1rem; font-weight: 650; }
.color-swatch:hover, .color-swatch:focus-visible { outline: 2px solid var(--swatch); outline-offset: 1px; }
.color-section { margin-top: 14px; }
.color-section h4 { margin-bottom: 7px; font-size: .7rem; font-weight: 500; color: rgba(var(--v-theme-on-surface), .6); }
.custom-color-picker { margin-top: 14px; border-top: 1px solid rgba(var(--v-theme-on-surface), .12); padding-top: 10px; }
.custom-color-picker summary { cursor: pointer; font-size: .8rem; }
.custom-color-input { display: flex; gap: 8px; align-items: center; }
.custom-color-input input { width: 120px; border: 1px solid rgba(var(--v-theme-on-surface), .2); border-radius: 6px; padding: 6px; font-family: monospace; }
.color-save-error { margin-top: 10px; color: rgb(var(--v-theme-error)); font-size: .75rem; }
</style>
