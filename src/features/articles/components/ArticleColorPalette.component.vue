<template>
  <div class="article-color-palette" @mousedown.stop>
    <div v-if="allowBackground" class="article-color-palette__mode">
      <button class="article-color-palette__mode-option" :class="{ 'article-color-palette__mode-option--active': mode === 'text' }" @click="mode = 'text'">{{ t('articles.editor.textColor') }}</button>
      <button class="article-color-palette__mode-option" :class="{ 'article-color-palette__mode-option--active': mode === 'background' }" @click="mode = 'background'">{{ t('articles.editor.backgroundColor') }}</button>
    </div>
    <button class="article-color-palette__reset" @click="choose(null)"><v-icon icon="mdi-format-color-marker-cancel" size="18" />{{ t('articles.editor.defaultColor') }}</button>
    <div class="article-color-palette__grid">
      <button v-for="color in ARTICLE_COLOR_PRESETS" :key="color.value" class="article-color-palette__swatch" :style="{ '--swatch': color.value }" :title="t(`articles.editor.colorNames.${color.name}`)" :aria-label="t(`articles.editor.colorNames.${color.name}`)" @click="choose(color.value)"><span>A</span></button>
    </div>
    <template v-for="section in sections" :key="section.key">
      <div v-if="section.colors.length" class="article-color-palette__section">
        <h4>{{ t(`articles.editor.${section.key}`) }}</h4>
        <div class="article-color-palette__grid"><button v-for="color in section.colors" :key="color" class="article-color-palette__swatch" :style="{ '--swatch': color }" :title="color" :aria-label="color" @click="choose(color)"><span>A</span></button></div>
      </div>
    </template>
    <details class="article-color-palette__custom-color-picker">
      <summary>{{ t('articles.editor.chooseCustomColor') }}</summary>
      <AppColorPicker :model-value="customColor" :label="t('articles.editor.hexColor')" inline @update:model-value="value => { customColor = value; applyCustom(); }" />
    </details>

  </div>
</template>
<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { unref } from 'vue';
import AppColorPicker from '@/shared/ui/AppColorPicker.component.vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ARTICLE_COLOR_PRESETS, isArticleColor } from '@shared/articles/colors';
import { useArticleColors } from '@/features/articles/composables/useArticleColors';
defineProps<{ allowBackground?: boolean }>();
const emit = defineEmits<{ select: [value: { color: string | null; mode: 'text' | 'background' }] }>();
const { t } = useI18n();
const { history, error, remember } = useArticleColors();
const mode = ref<'text' | 'background'>('text');
const customColor = ref('#6395cf');
const sections = computed(() => [{ key: 'recentColors', colors: history.value.recent }, { key: 'customColors', colors: history.value.custom }]);
function choose(color: string | null) { if (color) remember(color); emit('select', { color, mode: mode.value }); }
function applyCustom() { if (isArticleColor(customColor.value)) choose(customColor.value.toLowerCase()); }

useErrorNotifications(
  () => unref(error) ? unref(t)('articles.editor.colorHistoryError') : null,
);
</script>
<style scoped lang="scss" src="@/assets/styles/features/articles/article-color-palette.scss"></style>
