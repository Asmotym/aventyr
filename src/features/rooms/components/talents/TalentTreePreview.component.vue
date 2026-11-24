<template>
  <svg class="talent-tree-preview" viewBox="0 0 240 120" fill="none" aria-hidden="true">
    <defs><pattern :id="gridId" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="currentColor" opacity=".12" /></pattern></defs>
    <rect width="240" height="120" :fill="`url(#${gridId})`" />
    <path v-for="(edge, index) in paths" :key="index" :d="edge" stroke="currentColor" stroke-width="1.5" opacity=".35" />
    <g v-for="(point, index) in points" :key="index">
      <rect :x="point[0] - 7" :y="point[1] - 7" width="14" height="14" rx="4" fill="rgb(var(--v-theme-surface))" stroke="currentColor" :stroke-opacity="index < 2 ? 1 : .4" :stroke-width="index === 0 ? 2 : 1.5" />
      <circle v-if="index < 2" :cx="point[0]" :cy="point[1]" r="2.5" fill="currentColor" />
    </g>
  </svg>
</template>
<script setup lang="ts">
import { computed, useId } from 'vue';
import type { TalentLayout } from '@shared/rooms/talents.types';
const props = defineProps<{ layout: TalentLayout }>();
const gridId = useId();
const points = computed(() => props.layout === 'classic' ? [[60, 25], [180, 25], [35, 60], [85, 60], [155, 60], [205, 60], [60, 98], [180, 98]] : props.layout === 'centered' ? [[120, 60], [120, 24], [163, 40], [163, 80], [120, 99], [77, 80], [77, 40], [201, 25], [39, 99]] : [[40, 35], [100, 22], [132, 62], [82, 92], [193, 40], [205, 90], [35, 85]]);
const links = computed(() => props.layout === 'classic' ? [[0, 2], [0, 3], [1, 4], [1, 5], [2, 6], [3, 6], [4, 7], [5, 7]] : props.layout === 'centered' ? [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [2, 7], [5, 8]] : [[0, 1], [0, 6], [1, 2], [2, 3], [2, 4], [4, 5], [3, 6]]);
const paths = computed(() => links.value.map(([from, to]) => `M ${points.value[from!]!.join(' ')} L ${points.value[to!]!.join(' ')}`));
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-tree-preview.scss"></style>
