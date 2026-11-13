<template>
  <svg viewBox="0 0 160 100" fill="currentColor" role="img" :aria-label="label" class="block-preview-art">
    <template v-if="kind === 'heading'">
      <text x="18" y="62" font-family="inherit" font-weight="700" :font-size="44 - (level - 1) * 4">Aa</text>
      <line x1="18" y1="80" x2="140" y2="80" stroke="currentColor" opacity=".14" />
    </template>
    <template v-else-if="kind === 'image'">
      <rect x="20" y="18" width="120" height="64" rx="6" fill="currentColor" opacity=".08" />
      <circle cx="111" cy="36" r="9" fill="currentColor" opacity=".45" />
      <path d="M24 76L59 38L87 67L103 52L137 78Z" fill="currentColor" opacity=".6" />
    </template>
    <template v-else-if="kind === 'table'">
      <rect x="18" y="20" width="124" height="60" rx="4" fill="none" stroke="currentColor" opacity=".45" />
      <path d="M18 40H142M18 60H142M59 20V80M101 20V80" fill="none" stroke="currentColor" opacity=".3" />
      <rect x="19" y="21" width="122" height="18" fill="currentColor" opacity=".12" />
    </template>
    <template v-else-if="kind === 'divider'">
      <line x1="20" y1="50" x2="140" y2="50" stroke="currentColor" stroke-width="2" />
    </template>
    <template v-else-if="kind === 'code'">
      <rect x="15" y="18" width="130" height="64" rx="6" fill="currentColor" opacity=".06" />
      <text x="30" y="61" font-family="monospace" font-size="31" fill="currentColor">&lt;/&gt;</text>
    </template>
    <template v-else>
      <rect v-if="kind === 'quote'" x="19" y="24" width="3" height="54" rx="1.5" fill="currentColor" opacity=".65" />
      <template v-for="(width, index) in [106, 87, 97]" :key="index">
        <circle v-if="kind === 'bulletList'" cx="22" :cy="30 + index * 20" r="2.5" fill="currentColor" />
        <text v-if="kind === 'orderedList'" x="17" :y="34 + index * 20" font-size="12" font-family="inherit">{{ index + 1 }}.</text>
        <rect v-if="kind === 'taskList'" x="17" :y="24 + index * 20" width="11" height="11" rx="2" fill="none" stroke="currentColor" opacity=".6" />
        <path v-if="kind === 'taskList' && index === 0" d="M19 29L22 32L26 26" fill="none" stroke="currentColor" stroke-width="1.5" />
        <rect :x="kind === 'text' ? 18 : 36" :y="27 + index * 20" :width="width" height="5" rx="2.5" fill="currentColor" :opacity="index === 0 ? .6 : .25" />
      </template>
    </template>
  </svg>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ kind: string; label: string; level?: number }>(), { level: 1 });
</script>
<style scoped>
.block-preview-art { display: block; width: 100%; aspect-ratio: 8 / 5; border-radius: 7px; color: rgb(var(--v-theme-on-surface)); background: rgb(var(--v-theme-surface-bright)); }
</style>
