<template>
  <div class="talent-connection-styles" :class="{ 'talent-connection-styles--stacked': stacked }">
    <div class="talent-connection-styles__style-field" :class="{ 'talent-connection-styles__style-field--label': showLabels }">
      <span v-if="showLabels" class="talent-connection-styles__style-label">{{ lineLabel || t('talents.design.connectionStyle') }}</span>
      <div class="talent-connection-styles__style-controls" role="group" :aria-label="lineLabel || t('talents.design.connectionStyle')">
        <v-btn v-for="style in lineStyles" :key="style.value" size="small" :variant="line === style.value ? 'tonal' : 'text'" :color="line === style.value ? 'primary' : undefined" :prepend-icon="style.icon" :aria-pressed="line === style.value" @click="line = style.value">{{ t('talents.design.connectionStyles.' + style.value) }}</v-btn>
        <v-btn v-if="allowReset" icon="mdi-restore" size="small" variant="text" :aria-label="t('talents.design.useDefaultConnectionStyle')" :title="t('talents.design.useDefaultConnectionStyle')" :disabled="!lineOverride" @click="emit('reset-line')" />
      </div>
    </div>
    <div class="talent-connection-styles__style-field" :class="{ 'talent-connection-styles__style-field--label': showLabels }">
      <span v-if="showLabels" class="talent-connection-styles__style-label">{{ arrowLabel || t('talents.design.arrowStyle') }}</span>
      <div class="talent-connection-styles__style-controls connection-arrow-controls" role="group" :aria-label="arrowLabel || t('talents.design.arrowStyle')">
        <v-btn v-for="style in arrowStyles" :key="style.value" size="small" :icon="style.icon" :variant="arrow === style.value ? 'tonal' : 'text'" :color="arrow === style.value ? 'primary' : undefined" :aria-label="t('talents.design.arrowStyles.' + style.value)" :title="t('talents.design.arrowStyles.' + style.value)" :aria-pressed="arrow === style.value" @click="arrow = style.value" />
        <v-btn v-if="allowReset" icon="mdi-restore" size="small" variant="text" :aria-label="t('talents.design.useDefaultArrowStyle')" :title="t('talents.design.useDefaultArrowStyle')" :disabled="!arrowOverride" @click="emit('reset-arrow')" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TalentArrowStyle, TalentConnectionStyle } from '@shared/rooms/talents.types';
defineProps<{ lineLabel?: string; arrowLabel?: string; showLabels?: boolean; stacked?: boolean; allowReset?: boolean; lineOverride?: boolean; arrowOverride?: boolean }>();
const line = defineModel<TalentConnectionStyle>('line', { required: true });
const arrow = defineModel<TalentArrowStyle>('arrow', { required: true });
const emit = defineEmits<{ 'reset-line': []; 'reset-arrow': [] }>();
const { t } = useI18n();
const lineStyles: { value: TalentConnectionStyle; icon: string }[] = [{ value: 'rounded', icon: 'mdi-vector-curve' }, { value: 'square', icon: 'mdi-vector-polyline' }, { value: 'straight', icon: 'mdi-vector-line' }];
const arrowStyles: { value: TalentArrowStyle; icon: string }[] = [{ value: 'triangle', icon: 'mdi-arrow-right-bold' }, { value: 'chevron', icon: 'mdi-chevron-right' }, { value: 'diamond', icon: 'mdi-rhombus' }, { value: 'none', icon: 'mdi-minus' }];
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-connection-styles.scss"></style>
