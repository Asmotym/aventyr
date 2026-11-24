<template>
  <div class="shape-color-picker" role="group" :aria-label="label || t('talents.design.shapeColor')"><button v-for="(rgb, color) in talentColors" :key="color" type="button" class="shape-color-swatch" :class="{ 'is-selected': model === color }" :style="{ ...talentColorStyle(color), '--swatch-color': `rgb(${rgb})` }" :title="t('talents.design.shapeColors.' + color)" :aria-label="t('talents.design.shapeColors.' + color)" :aria-pressed="model === color" @click="model = color"><v-icon v-if="model === color" icon="mdi-check" size="17" /></button></div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TalentColor } from 'netlify/core/types/talents.types';
import { talentColors, talentColorStyle } from '@/features/rooms/components/talents/talent-colors';
defineProps<{ label?: string }>();
const model = defineModel<TalentColor>({ default: 'primary' });
const { t } = useI18n();
</script>
<style scoped>
.shape-color-picker { display:flex; flex-wrap:wrap; gap:10px; max-width:310px; margin:12px 0 24px; }.shape-color-swatch { width:30px; height:30px; border-radius:50%; display:grid; place-items:center; background:var(--swatch-color); border:3px solid rgb(var(--v-theme-surface)); box-shadow:0 0 0 1px var(--talent-border); color:rgb(var(--talent-on-accent)); }.shape-color-swatch:hover,.shape-color-swatch:focus-visible,.shape-color-swatch.is-selected { outline:2px solid var(--swatch-color); outline-offset:3px; }
</style>
