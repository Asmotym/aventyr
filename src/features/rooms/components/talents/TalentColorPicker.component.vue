<template>
  <div class="talent-color-picker" role="group" :aria-label="label || t('talents.design.shapeColor')"><button v-for="(rgb, color) in talentColors" :key="color" type="button" class="talent-color-picker__swatch" :class="{ 'talent-color-picker__swatch--selected': model === color }" :style="{ ...talentColorStyle(color), '--swatch-color': `rgb(${rgb})` }" :title="t('talents.design.shapeColors.' + color)" :aria-label="t('talents.design.shapeColors.' + color)" :aria-pressed="model === color" @click="model = color"><v-icon v-if="model === color" icon="mdi-check" size="17" /></button></div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TalentColor } from '@shared/rooms/talents.types';
import { talentColors, talentColorStyle } from '@/features/rooms/components/talents/talent-colors';
defineProps<{ label?: string }>();
const model = defineModel<TalentColor>({ default: 'primary' });
const { t } = useI18n();
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-color-picker.scss"></style>
