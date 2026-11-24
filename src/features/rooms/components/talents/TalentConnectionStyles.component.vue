<template>
  <div class="connection-style-pickers" :class="{ 'is-stacked': stacked }">
    <div class="connection-style-field" :class="{ 'has-label': showLabels }">
      <span v-if="showLabels" class="connection-style-label">{{ lineLabel || t('talents.design.connectionStyle') }}</span>
      <div class="connection-style-controls" role="group" :aria-label="lineLabel || t('talents.design.connectionStyle')">
        <v-btn v-for="style in lineStyles" :key="style.value" size="small" :variant="line === style.value ? 'tonal' : 'text'" :color="line === style.value ? 'primary' : undefined" :prepend-icon="style.icon" :aria-pressed="line === style.value" @click="line = style.value">{{ t('talents.design.connectionStyles.' + style.value) }}</v-btn>
        <v-btn v-if="allowReset" icon="mdi-restore" size="small" variant="text" :aria-label="t('talents.design.useDefaultConnectionStyle')" :title="t('talents.design.useDefaultConnectionStyle')" :disabled="!lineOverride" @click="emit('reset-line')" />
      </div>
    </div>
    <div class="connection-style-field" :class="{ 'has-label': showLabels }">
      <span v-if="showLabels" class="connection-style-label">{{ arrowLabel || t('talents.design.arrowStyle') }}</span>
      <div class="connection-style-controls connection-arrow-controls" role="group" :aria-label="arrowLabel || t('talents.design.arrowStyle')">
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
<style scoped>
.connection-style-pickers { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; }
.connection-style-field { display:contents; }
.connection-style-controls { display:flex; flex-wrap:wrap; gap:2px; padding:2px; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); border-radius:8px; }
.connection-style-label { font-size:11px; color:rgba(var(--v-theme-on-surface),.65); }
.is-stacked { flex-direction:column; align-items:stretch; gap:16px; }
.has-label { display:flex; flex-direction:column; align-items:flex-start; gap:8px; min-width:0; }
.is-stacked .connection-style-controls { max-width:100%; }
.is-stacked .connection-style-controls :deep(.v-btn:not(.v-btn--icon)) { padding-inline:8px; font-size:11px; }
</style>
